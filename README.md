# Multi-Scenario Prediction Market Portfolio Risk Engine

A stateless mathematical trading and evaluation engine coupled with a responsive risk scenario dashboard for prediction markets like Kalshi and Polymarket. This client-side Single Page Application (SPA) allows traders to combine winner and score contracts across different exchanges and evaluate their net payout profiles under all possible terminal scenarios (e.g. French Open Women's Finals).

## Features

- **Decoupled Pricing Engine:** Pure mathematical models calculate precise transaction fee deductions based on specific platform rules (e.g., Kalshi Taker/Maker fees, Polymarket Crypto/Sports Taker fees).
- **VWAP MTM Walkdown Liquidation:** Simulates walking down the orderbook bids (real or synthetic) to determine true mark-to-market liquidation value and average execution price, alerting the user of `⚠️ ILLIQUID LIMITS` if sizes exceed book depth.
- **Reciprocal Orderbook depth Reconstruction:** Automatically reconstructs the full bid/ask spread from raw YES and NO bids using the $1.00 constraint: $\text{YES ASK} = 1.00 - \text{NO BID}$ and $\text{NO ASK} = 1.00 - \text{YES BID}$, presenting a real-time depth ladder.
- **RSA-PSS SHA-256 Web Crypto Client:** Integrates an optional client-side cryptographic private key PEM importer and request signer using standard Web Crypto API to securely pull active balances and nested event markets (`with_nested_markets=true`).
- **Multi-Scenario Portfolio Payoff Matrix:** Calculates total cost basis, fees, payoffs, net profit/loss, and ROI under multiple custom, mutually exclusive terminal scenarios (e.g., specific set score outcomes or tournament winners).
- **Cross-Platform Contract Mapper:** Integrates Polymarket (winner) and Kalshi (score) contracts into a single event model. Maps YES/NO contracts to the scenarios they trigger.
- **Automated Live Market Fetching:** Pulls real-time contracts and ask prices directly from Polymarket (Gamma API) and Kalshi (Trade API v2) in the browser, letting you load trades into your portfolio with a single click.
- **Generalized Arbitrage Monitor:** Automatically flags risk-free portfolios (active hedges) where the net profit remains positive under all possible outcomes.
- **Simulated Live Scan Logs:** An algorithmic scanner log terminal demonstrating live WebSocket feeds, expected value updates, and bot actions.

## Documentation

For a comprehensive guide on the mathematical formulas, dashboard controls, contract mapping heuristics, and programmatic Node.js/Python bot integration, refer to the [User's Guide](file:///Users/yunweihu/Documents/code/prediction_market_simulator/USERS_GUIDE.md).

## How to Run

### a. Direct Client Mode (no `npm run`)

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (e.g., Chrome, Firefox, Safari).
   - On macOS: `open index.html`
3. The application runs entirely in the browser using simulated data. No backend or server is required.

### b. BFF Proxy Mode (`npm run`)

1. Ensure you have Node.js (v18+) installed.
2. In a terminal, navigate to the Cloudflare Worker directory:

   ```bash
   cd cloudflare-worker
   npm install   # install dependencies
   npx wrangler dev   # start the local BFF proxy at http://localhost:8787
   ```

3. In the main dashboard (`index.html`), open the settings drawer (top‑right gear icon) and set **Execution Mode** to **BFF** and **Proxy URL** to `http://localhost:8787`.
4. Reload the page. API calls and WebSocket connections will now be routed through the proxy, enabling live market data.

> **Note on API Fetching:**
> Kalshi API endpoints are protected by Cloudflare. When using Direct Client Mode, you may need a CORS‑bypass extension or rely on the built‑in simulated feeds. BFF Proxy Mode handles CORS and WebSocket header restrictions automatically.

> **Note on API Fetching:**
> Kalshi API endpoints are protected by Cloudflare. To fetch live data directly from the Kalshi trade API on a local `file:///` system, you must use a browser extension that bypasses CORS restrictions (such as "Allow CORS: Access-Control-Allow-Origin"). A built-in simulated roland-garros winner and score feed will automatically load as a fallback if the connection is restricted.

## License
MIT License
