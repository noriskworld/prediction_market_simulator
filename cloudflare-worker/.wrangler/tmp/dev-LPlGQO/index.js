var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-rvUpw7/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return handleCorsPreflight();
    }
    if (url.pathname === "/ws/kalshi") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket connection", { status: 400 });
      }
      return handleWebSocket(request, env);
    }
    if (url.pathname.startsWith("/api/polymarket/")) {
      return handlePolymarketProxy(request, url);
    }
    if (url.pathname.startsWith("/api/kalshi/")) {
      return handleKalshiProxy(request, url, env);
    }
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders()
    });
  }
};
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
__name(base64ToArrayBuffer, "base64ToArrayBuffer");
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
async function signKalshiRequest(privateKeyPem, timestamp, method, path) {
  try {
    const cleanPem = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
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
__name(signKalshiRequest, "signKalshiRequest");
function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-kalshi-api-key, x-kalshi-private-key, x-kalshi-env, x-kalshi-subaccount",
    ...extra
  };
}
__name(corsHeaders, "corsHeaders");
function handleCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
__name(handleCorsPreflight, "handleCorsPreflight");
async function handlePolymarketProxy(request, url) {
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
__name(handlePolymarketProxy, "handlePolymarketProxy");
async function handleKalshiProxy(request, url, env) {
  const apiKeyId = request.headers.get("x-kalshi-api-key") || env.KALSHI_API_KEY_ID;
  const privateKeyPem = request.headers.get("x-kalshi-private-key") || env.KALSHI_PRIVATE_KEY;
  const subaccount = request.headers.get("x-kalshi-subaccount") || env.KALSHI_SUBACCOUNT || "0";
  const kalshiEnv = request.headers.get("x-kalshi-env") || url.searchParams.get("env") || env.KALSHI_ENV || "demo";
  const targetPath = url.pathname.replace("/api/kalshi", "");
  const basePath = `/trade-api/v2${targetPath}`;
  const targetUrl = kalshiEnv === "prod" ? `https://external-api.kalshi.com${basePath}${url.search}` : `https://external-api.demo.kalshi.co${basePath}${url.search}`;
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
  };
  if (apiKeyId && privateKeyPem) {
    const timestamp = Date.now().toString();
    const signPath = basePath.split("?")[0];
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
__name(handleKalshiProxy, "handleKalshiProxy");
async function handleWebSocket(request, env) {
  const url = new URL(request.url);
  const apiKeyId = request.headers.get("x-kalshi-api-key") || url.searchParams.get("apiKeyId") || env.KALSHI_API_KEY_ID;
  const privateKeyPem = request.headers.get("x-kalshi-private-key") || url.searchParams.get("privateKey") || env.KALSHI_PRIVATE_KEY;
  const kalshiEnv = request.headers.get("x-kalshi-env") || url.searchParams.get("env") || env.KALSHI_ENV || "demo";
  if (!apiKeyId || !privateKeyPem) {
    return new Response("Missing Kalshi credentials for WebSocket proxy", { status: 400, headers: corsHeaders() });
  }
  const wsUrl = kalshiEnv === "prod" ? "wss://external-api-ws.kalshi.com/trade-api/ws/v2" : "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2";
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
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const kalshiRes = await fetch(wsUrl, { headers });
    const kalshiSocket = kalshiRes.webSocket;
    if (!kalshiSocket) {
      return new Response("Could not establish connection to Kalshi WebSocket server", { status: 502, headers: corsHeaders() });
    }
    kalshiSocket.accept();
    server.addEventListener("message", (event) => {
      kalshiSocket.send(event.data);
    });
    server.addEventListener("close", () => {
      kalshiSocket.close();
    });
    server.addEventListener("error", (err) => {
      console.error("Client WS error:", err);
      kalshiSocket.close();
    });
    kalshiSocket.addEventListener("message", (event) => {
      server.send(event.data);
    });
    kalshiSocket.addEventListener("close", () => {
      server.close();
    });
    kalshiSocket.addEventListener("error", (err) => {
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
__name(handleWebSocket, "handleWebSocket");

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-rvUpw7/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-rvUpw7/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
