# Prediction Market Risk & Pricing Engine

A headless mathematical trading engine coupled with a responsive risk scenario dashboard for prediction markets like Kalshi and Polymarket. This is a single-file web application built with HTML5, vanilla React (via Babel standalone), and Tailwind CSS.

## Features

- **Decoupled Pricing Engine:** Pure mathematical models calculate precise transaction fee deductions based on specific platform rules (e.g., Kalshi Taker/Maker fees, Polymarket Crypto/Sports Taker fees).
- **Portfolio Matrix Generator:** Calculates total cost basis, fees, payoffs, net profit/loss, and ROI under both YES and NO terminal outcomes for an array of holdings.
- **Cross-Platform Arbitrage Speculator:** Examines multi-platform YES/NO ask data to detect mispriced contracts where the total purchase cost (inclusive of routing fees) is less than $1.00.
- **Algorithmic Risk Evaluator:** Calculates Net Expected Value (EV) based on a dynamically updatable "True Probability" sliding scale.
- **Live Terminal Simulation:** Built-in simulated feed demonstrating orderbook updates, machine learning probability adjustments, and arbitrage signal detection.

## How to Run

Because this is a completely client-side application, there are no build steps, backend servers, or dependencies to install.

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (e.g., Chrome, Firefox, Safari).
   - On Mac: `open index.html`
3. Enjoy the dashboard!

> **Note on Kalshi API Integration:** 
> Because Kalshi heavily protects its endpoints using Cloudflare, public CORS proxies (like `corsproxy.io`) are actively blocked. To fetch real-time data directly from the Kalshi API on a local `file:///` system, you must use a browser extension that bypasses CORS restrictions (such as "Allow CORS: Access-Control-Allow-Origin").

## Technologies Used

- **HTML5 / CSS3**
- **React 18** (loaded via CDN)
- **Babel Standalone** (for in-browser JSX compilation)
- **Tailwind CSS** (via CDN for rapid UI styling)
- **Chart.js** (for risk rendering and PnL visualizations)

## License
MIT License
