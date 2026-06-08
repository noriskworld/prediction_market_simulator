# Design Proposal – **FIFA World Cup 2026 Prediction Dashboard**

> **Goal** – Create a premium‑looking web app that lets users build and monitor a multi‑market portfolio (Kalshi + Polymarket) for the 2026 FIFA World Cup. Phase 1 focuses on market data, portfolio analytics, and a sleek UI. Phase 2 adds on‑demand research powered by Gemini chat and web search.

---

## 1. High‑Level Overview  

| Aspect | Description |
|-------|-------------|
| **Target Users** | Casual football fans who want to have fun trading positions with friends (<5 people), focusing on favorite teams (e.g., Team USA) and simple win‑or‑lose outcomes. |
| **Core Value** | One‑stop dashboard that **maps winners & individual match contracts** from Kalshi & Polymarket, shows a **portfolio payoff matrix** across every possible tournament scenario, and later **provides AI‑augmented research** (news, odds, historical data). |
| **Tech Stack** | • Front‑end: **HTML + Vanilla JS + CSS** (no framework). <br>• Backend‑for‑Frontend (BFF) proxy: **Cloudflare Workers** (re‑use existing `cloudflare‑worker` package). <br>• Data sources: Kalshi REST + WebSocket, Polymarket GraphQL/REST. <br>• Phase‑2 AI: **Gemini Chat API** (via secure BFF) + **Web‑search micro‑service** (optional). |
| **Deployment** | Static SPA served from GitHub Pages / Netlify **plus** Cloudflare Worker (deployed on Cloudflare).  No npm‑build required for Direct mode; BFF mode handles CORS & auth. |

---

## 2. User Stories (Phase 1)

| # | As a … | I want to … | So that … |
|---|--------|-------------|-----------|
| 1 | Visitor | See a friendly landing page explaining the World Cup market idea | I know how to start even without trading experience |
| 2 | Fan | Filter contracts to my favorite team (e.g., Team USA) and only see those markets | I can focus on the outcomes I care about |
| 3 | Fan | View live implied probability for the tournament winner (final) across both markets | I understand the current odds at a glance |
| 4 | Fan | See a simple arbitrage indicator highlighting price gaps between Kalshi and Polymarket | I can spot low‑risk fun opportunities |
| 5 | User | Switch between Direct Client Mode and BFF Proxy Mode | I can choose between simulated or live data |
| 6 | User | Export my selected contracts as a small JSON list to share with friends | Easy sharing within a small circle |


---

## 3. Phase 2 User Stories (Research Layer)

| # | As a … | I want to … | So that … |
|---|--------|-------------|-----------|
| 8 | Trader | Ask **Gemini Chat** for “latest injury news for Brazil” or “historical World Cup upset odds” | Get contextual insight without leaving the dashboard |
| 9 | Analyst | Run a **web search** for “Kalshi FIFA 2026 contract list” and have results displayed inline | Quickly verify contract availability |
|10 | User | Save **research snippets** and link them to specific contracts in my portfolio | Build a knowledge base tied to my positions |

---

## 4. Architecture Sketch  

```mermaid
graph TD
    A[Browser SPA (index.html)] -->|fetch| B[BFF Proxy (Cloudflare Worker)]
    B -->|REST| K[Kalshi API]
    B -->|WebSocket| KWS[Kalshi WS]
    B -->|GraphQL| P[Polymarket API]
    A -->|Direct Mode| C1[Static JSON (fallback simulated data)]
    A -->|Direct Mode| C2[Local WebSocket simulation]

    subgraph Phase2
        A -->|POST /gemini| G[Gemini Chat Service (via BFF)]
        A -->|POST /search| S[Web‑Search Micro‑service (via BFF)]
    end

    style A fill:#1e1e2f,stroke:#818cf8,color:#fff
    style B fill:#2d2d44,stroke:#f472b6,color:#fff
    style K fill:#0ea5e9,stroke:#0284c7,color:#fff
    style P fill:#10b981,stroke:#059669,color:#fff
    style G fill:#eab308,stroke:#ca8a04,color:#fff
    style S fill:#d946ef,stroke:#c026d3,color:#fff
```

* **SPA** – Pure client logic (portfolio builder, UI).  
* **BFF Proxy** – Handles authentication, CORS, header injection for Kalshi WS, and forwards Gemini / search calls securely.  
* **Direct Mode** – Uses the existing simulated feeds (already in the repo) – no external calls.  

---

## 5. UI / UX Layout (Desktop‑first, responsive)

| Area | Description | Visual Treatment |
|------|-------------|------------------|
| **Header** | App logo (“World Cup Predictor”), mode toggle (Direct ↔ BFF), global settings icon. | Glass‑morphism bar, subtle drop‑shadow, dark‑mode gradient. |
| **Left Sidebar** | **Market Selector** – toggle Kalshi / Polymarket, list of **available contracts** (grouped by *Winner* and *Match*). Searchable, with animated hover cards. | Semi‑transparent cards, accent color per market (Kalshi teal, Polymarket purple). |
| **Center Canvas** | **Portfolio Builder** – Drag‑and‑drop contract tiles onto a **grid**. Each tile shows live price, odds, and a small “info” badge. | Card‑style tiles with glass background, micro‑animations on drop. |
| **Right Panel** | **Payoff Matrix** – Dynamic heat‑map showing profit/loss for each tournament scenario. Supports zoom/pan to view group‑stage vs final outcomes. | Gradient‑colored matrix, tooltip on hover, animated transitions when contracts change. |
| **Bottom Bar** | **Scanner Log** (real‑time WebSocket feed), **Export** button, **Research** launcher (Phase‑2). | Mini‑terminal style, dark background, scroll‑snap. |
| **Modal / Drawer** | **Settings** – Execution mode, API keys (optional), theme picker, research preferences. | Sliding drawer with rounded corners, smooth opening animation. |

*All components will follow a **design system** (CSS variables for colors, spacing, typography – e.g., Google Font *Inter*).*

---

## 6. Core Components (Re‑use + New)

| Component | Source | Responsibility |
|-----------|--------|----------------|
| `MarketList` | Fork of existing contract list UI (from `index.html`) | Show filtered contracts per market, add drag handle. |
| `PortfolioCanvas` | New | Accept drops, maintain internal state (`portfolio = [{contractId, market}]`). |
| `PayoffMatrix` | New (based on existing payoff calculator) | Compute matrix on‑the‑fly, render as interactive grid. |
| `ScannerLog` | Existing (algorithmic scan log) | Extend to show live WS messages from both markets. |
| `SettingsDrawer` | Existing (settings UI) | Add **Research** toggle, Gemini API key entry (encrypted in local storage). |
| `ResearchPanel` (Phase 2) | New | Text input → send to BFF → display Gemini response & search results side‑by‑side. |
| `BFFProxy` | Existing Cloudflare Worker (`cloudflare‑worker/src/index.js`) | Add routes: `/api/gemini`, `/api/search`. Securely inject API keys from request headers. |

---

## 7. Data Flow (Phase 1)

1. **App start** → Detect mode (Direct / BFF).  
2. **BFF Mode**: SPA calls `GET /api/kalshi/contracts` → Worker forwards to Kalshi, returns JSON. Same for Polymarket.  
3. **WebSocket**: UI opens WS via `ws://localhost:8787/ws/kalshi` (proxied). Worker upgrades to real Kalshi WS, streams data back.  
4. **User drags contract** → Portfolio state updates → Payoff matrix recomputed (client‑side math).  
5. **Export** → JSON blob downloaded.

**Direct Mode**: All calls hit static fallback JSON files (`data/kalshi_stub.json`, `data/polymarket_stub.json`) already bundled in the repo.

---

## 8. Phase 2 – Research Layer

| Feature | Implementation Note |
|---------|--------------------|
| **Gemini Chat** | Add BFF route `POST /api/gemini` → forward to `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent` with user prompt. Responses streamed back to UI. |
| **Web Search** | Minimal search service using **SerpAPI** or Google Custom Search (via BFF) – returns top 5 results (title, snippet, link). |
| **AI‑augmented Contract Insight** | When a contract tile is selected, auto‑suggest a Gemini prompt like “What are the key factors that could affect the Argentina vs Germany match outcome?” and display answer. |
| **Secure Storage** | API keys stored in **encrypted IndexedDB**; BFF never logs them. |
| **Rate‑Limiting** | Worker uses built‑in `http_client` (from `science-skills-common`) to throttle calls. |

---

## 9. Security & Secure Key Handling

**Kalshi RSA Authentication Flow:**
Kalshi API authentication strictly requires RSA-PSS cryptographic signatures. To prevent critical key leakage, the private `.key` file and the Key ID must **never** be exposed in the front-end application (`index.html`) or committed to version control. 

1. **Secure Storage**: The `KALSHI_KEY_ID` (from the website) and the full text of `KALSHI_PRIVATE_KEY` are stored strictly as encrypted Secrets/Environment Variables within the Cloudflare Worker (BFF).
2. **Signature Generation**: When the front-end requests Kalshi data, the Worker intercepts it, generates a timestamp, and constructs the signing payload (`timestamp + method + path`).
3. **Signing**: The Worker uses the Web Crypto API to sign the payload using the `KALSHI_PRIVATE_KEY` via the RSA-PSS algorithm.
4. **Header Injection**: The Worker injects `KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-TIMESTAMP`, and the base64-encoded `KALSHI-ACCESS-SIGNATURE` into the outbound request. Kalshi validates the signature and returns the data securely to the proxy.

| Concern | Mitigation |
|---------|------------|
| **API Key Leakage** | Private keys are isolated in the backend environment variables. The client browser only exchanges unauthenticated requests with the BFF proxy, eliminating the risk of XSS attacks stealing Kalshi credentials. |
| **CORS & WS Header Restrictions** | All external calls (REST & WebSocket) go through the Cloudflare Worker (BFF), which naturally injects the necessary auth headers that browsers block. |
| **Data Size** | Payoff matrix rendered with canvas/WebGL for large scenario sets. We will use **Monte-Carlo sampling** with adjustable sample counts for complex bracket computations. |
| **Responsiveness** | Lazy-load market data; use `requestIdleCallback` for heavy probability calculations. |
| **Accessibility** | Semantic HTML, ARIA labels on draggable items, high-contrast mode toggle. |

---

## 10. Deployment & Ops

| Step | Action |
|------|--------|
| **Static Site** | Deploy `index.html` + assets to **GitHub Pages** (or Netlify). |
| **BFF Proxy** | Deploy Cloudflare Worker via `wrangler publish`. Use a custom domain (e.g., `api.worldcup-prediction.dev`). |
| **CI** | GitHub Actions: lint CSS/JS, run unit tests, build Worker bundle, trigger `wrangler publish` on `main` push. |
| **Monitoring** | Cloudflare Analytics for request counts, error rates; client‑side error reporting via Sentry (optional). |

---

## 11. Roadmap Snapshot

| Milestone | Deliverable |
|-----------|-------------|
| **M1 – Foundations** | Re‑use existing SPA, add market list for World‑Cup contracts, implement drag‑and‑drop portfolio builder. |
| **M2 – Payoff Engine** | Extend current payoff calculator to handle **tournament‑bracket scenarios** (group → knockout). |
| **M3 – BFF Integration** | Add new Worker routes for Kalshi & Polymarket live data, UI switch for Direct/BFF. |
| **M4 – UI Polish** | Premium design: dark mode, glassmorphism, micro‑animations, responsive layout. |
| **M5 – Research Layer** | Gemini chat & web‑search endpoints, UI panel, secure key handling. |
| **M6 – Export & Share** | JSON/CSV export, optional link‑sharing via GitHub Gist. |
| **M7 – Documentation** | Updated README (usage modes, API keys, contribution guide). |

---

### Next Steps  

*Confirm any preferred branding colors or logo assets, and whether you’d like the Gemini API key stored now or added later. Once approved, we can move to a concrete **implementation plan** (file structure, tasks, timeline).*