/**
 * Cloudflare Worker Backend-For-Frontend (BFF) Proxy
 * Handles CORS, server-side RSA request signing, and WebSocket tunneling.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight options
    if (request.method === "OPTIONS") {
      return handleCorsPreflight();
    }

    // Route: WebSocket tunnel to Kalshi
    if (url.pathname === "/ws/kalshi") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket connection", { status: 400 });
      }
      return handleWebSocket(request, env);
    }

    // Route: Polymarket REST proxy
    if (url.pathname.startsWith("/api/polymarket/")) {
      return handlePolymarketProxy(request, url);
    }

    // Route: Kalshi REST proxy
    if (url.pathname.startsWith("/api/kalshi/")) {
      return handleKalshiProxy(request, url, env);
    }

    // Default response for unmatched routes
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders()
    });
  }
};

/**
 * Base64 & ArrayBuffer helper utilities
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Signs Kalshi requests using RSA-PSS SHA-256 via Web Crypto
 */
async function signKalshiRequest(privateKeyPem, timestamp, method, path) {
  try {
    const cleanPem = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\s+/g, "");

    const binaryKey = base64ToArrayBuffer(cleanPem);
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      {
        name: "RSA-PSS",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

    const encoder = new TextEncoder();
    const payload = timestamp + method + path;
    const payloadBuffer = encoder.encode(payload);

    const signatureBuffer = await crypto.subtle.sign(
      {
        name: "RSA-PSS",
        saltLength: 32
      },
      privateKey,
      payloadBuffer
    );

    return arrayBufferToBase64(signatureBuffer);
  } catch (e) {
    console.error("Cryptographic signing failed:", e);
    throw e;
  }
}

/**
 * CORS headers helper
 */
function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-kalshi-api-key, x-kalshi-private-key, x-kalshi-env, x-kalshi-subaccount",
    ...extra
  };
}

/**
 * Handles CORS OPTIONS preflight
 */
function handleCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

/**
 * Proxies public Polymarket Gamma REST requests
 */
async function handlePolymarketProxy(request, url) {
  // Extract route after '/api/polymarket'
  const targetPath = url.pathname.replace("/api/polymarket", "");
  const targetUrl = `https://gamma-api.polymarket.com${targetPath}${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "Accept": "application/json"
      }
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: corsHeaders({ "Content-Type": "application/json" })
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders({ "Content-Type": "application/json" })
    });
  }
}

/**
 * Proxies signed Kalshi REST requests
 */
async function handleKalshiProxy(request, url, env) {
  // Extract credentials from environment variables or optional client overrides
  const apiKeyId = request.headers.get("x-kalshi-api-key") || env.KALSHI_API_KEY_ID;
  const privateKeyPem = request.headers.get("x-kalshi-private-key") || env.KALSHI_PRIVATE_KEY;
  const subaccount = request.headers.get("x-kalshi-subaccount") || env.KALSHI_SUBACCOUNT || "0";
  const kalshiEnv = request.headers.get("x-kalshi-env") || url.searchParams.get("env") || env.KALSHI_ENV || "demo";

  const targetPath = url.pathname.replace("/api/kalshi", "");
  const basePath = `/trade-api/v2${targetPath}`;
  const targetUrl = kalshiEnv === "prod"
    ? `https://external-api.kalshi.com${basePath}${url.search}`
    : `https://external-api.demo.kalshi.co${basePath}${url.search}`;

  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  // Attach cryptographic signature headers if credentials are provided
  if (apiKeyId && privateKeyPem) {
    const timestamp = Date.now().toString();
    const signPath = basePath.split("?")[0]; // Sign the base endpoint path without query params
    try {
      const signature = await signKalshiRequest(privateKeyPem, timestamp, request.method, signPath);
      headers["KALSHI-ACCESS-KEY"] = apiKeyId;
      headers["KALSHI-ACCESS-TIMESTAMP"] = timestamp;
      headers["KALSHI-ACCESS-SIGNATURE"] = signature;
      if (subaccount && subaccount !== "0") {
        headers["KALSHI-SUBACCOUNT"] = subaccount;
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: `Signing failed: ${err.message}` }), {
        status: 400,
        headers: corsHeaders({ "Content-Type": "application/json" })
      });
    }
  }

  try {
    const fetchOptions = {
      method: request.method,
      headers
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: corsHeaders({ "Content-Type": "application/json" })
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders({ "Content-Type": "application/json" })
    });
  }
}

/**
 * Proxies authenticated Kalshi WebSocket connections
 */
async function handleWebSocket(request, env) {
  const url = new URL(request.url);
  const apiKeyId = request.headers.get("x-kalshi-api-key") || url.searchParams.get("apiKeyId") || env.KALSHI_API_KEY_ID;
  const privateKeyPem = request.headers.get("x-kalshi-private-key") || url.searchParams.get("privateKey") || env.KALSHI_PRIVATE_KEY;
  const kalshiEnv = request.headers.get("x-kalshi-env") || url.searchParams.get("env") || env.KALSHI_ENV || "demo";

  if (!apiKeyId || !privateKeyPem) {
    return new Response("Missing Kalshi credentials for WebSocket proxy", { status: 400, headers: corsHeaders() });
  }

  // Determine Kalshi WS endpoint
  const wsUrl = kalshiEnv === "prod"
    ? "wss://external-api-ws.kalshi.com/trade-api/ws/v2"
    : "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2";

  // Build the auth headers for WebSocket handshake
  const timestamp = Date.now().toString();
  let signature;
  try {
    signature = await signKalshiRequest(privateKeyPem, timestamp, "GET", "/trade-api/ws/v2");
  } catch (err) {
    return new Response(`WebSocket signature generation failed: ${err.message}`, { status: 400, headers: corsHeaders() });
  }

  const headers = {
    "Upgrade": "websocket",
    "Connection": "Upgrade",
    "KALSHI-ACCESS-KEY": apiKeyId,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "KALSHI-ACCESS-SIGNATURE": signature
  };

  try {
    // Create standard WebSocketPair
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    // Connect to Kalshi WebSocket server
    const kalshiRes = await fetch(wsUrl, { headers });
    const kalshiSocket = kalshiRes.webSocket;

    if (!kalshiSocket) {
      return new Response("Could not establish connection to Kalshi WebSocket server", { status: 502, headers: corsHeaders() });
    }

    kalshiSocket.accept();

    // Tunnel messages client -> Kalshi WS
    server.addEventListener("message", event => {
      kalshiSocket.send(event.data);
    });
    server.addEventListener("close", () => {
      kalshiSocket.close();
    });
    server.addEventListener("error", err => {
      console.error("Client WS error:", err);
      kalshiSocket.close();
    });

    // Tunnel messages Kalshi WS -> client
    kalshiSocket.addEventListener("message", event => {
      server.send(event.data);
    });
    kalshiSocket.addEventListener("close", () => {
      server.close();
    });
    kalshiSocket.addEventListener("error", err => {
      console.error("Kalshi WS error:", err);
      server.close();
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: corsHeaders()
    });

  } catch (err) {
    return new Response(`WebSocket proxy initialization failed: ${err.message}`, { status: 500, headers: corsHeaders() });
  }
}
