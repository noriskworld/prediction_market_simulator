# Prediction Market Portfolio Simulator - User's Guide

This guide describes how to run, use, and programmatically integrate the **Multi-Scenario Prediction Market Risk & Pricing Simulator**. This tool serves a dual-purpose:
1. **Headless Pricing and Evaluation Engine:** A stateless mathematical library (`PredictionEngine`) that algorithmic trading bots can run in Node.js or Python to instantly calculate fees, portfolio payoff matrices, Expected Value (EV), and arbitrage.
2. **Interactive HTML5 React Dashboard:** A premium, cybernetic slate dashboard designed for manual scenario plotting, risk analysis, and arbitrage discovery on Kalshi and Polymarket.

---

## Refactored Concept: Multi-Scenario Risk Modeling

Unlike simple binary calculators, this simulator evaluates portfolios against a user-defined set of $M$ **mutually exclusive terminal scenarios** (e.g., tournament winners, set score outcomes).

For example, when trading the **French Open Women's Final**, you can define the terminal outcomes as:
1. **Swiatek wins 2-0**
2. **Swiatek wins 2-1**
3. **Sabalenka wins 2-0**
4. **Sabalenka wins 2-1**

Any prediction market contract (regardless of its structure or platform) can be modeled by specifying the scenarios under which the contract pays out $\$1.00$ on a **YES** outcome.
- **Swiatek Tournament Winner (YES):** Triggers in Scenario 1 & 2.
- **Swiatek Wins 2-1 (YES):** Triggers in Scenario 2.
- **Final Score is 2-1 (YES):** Triggers in Scenario 2 & 4.

The simulator allows you to construct a combined portfolio of winner contracts (e.g., from Polymarket) and score contracts (e.g., from Kalshi) and instantly plots your net financial outcomes across all scenarios.

---

## Getting Started

Since this is a client-side Single Page Application (SPA), it runs instantly in any modern web browser with no compiler, bundler, or local server requirements.

1. **Open the App:** Double-click [index.html](file:///Users/yunweihu/Documents/code/prediction_market_simulator/index.html) or run `open index.html` in your terminal.
2. **French Open Preset:** Click **Load French Open Template** at the top right to instantly populate the simulator with a tournament winner + match score portfolio.

---

## Core Calculations & Math Models

### 1. Dynamic Fee Calculations
Trading fees are derived from contract pricing volatility represented by the variance term: $P \cdot (1 - P)$.

The engine calculates fees using the following formulas:
* **Kalshi Taker:** $0.07 \cdot Q \cdot P \cdot (1 - P)$
* **Kalshi Maker:** $0.0175 \cdot Q \cdot P \cdot (1 - P)$
* **Polymarket Crypto Taker:** $0.05 \cdot Q \cdot P \cdot (1 - P)$
* **Polymarket Sports Taker:** $0.03 \cdot Q \cdot P \cdot (1 - P)$
* **Polymarket Maker / Other Categories:** $0.00$ (No fee)

*Where $Q$ = contract quantity and $P$ = average entry price.*

### 2. Multi-Scenario Payoff Matrix
Let the terminal scenarios be $S = \{s_1, s_2, \dots, s_m\}$. For each position $P_i$, let $S_i \subseteq S$ be the set of scenarios where the YES outcome is triggered.
* **Capital Invested:** $\sum (\text{Entry Price} \cdot \text{Quantity}) + \text{Fees}$
* **Gross Payoff (Scenario $s$):** $\sum_{i} Q_i \cdot \mathbb{I}(s, P_i)$
  * *Where $\mathbb{I} = 1.0$ if the contract resolves YES and $s \in S_i$, or if the contract resolves NO and $s \notin S_i$.*
* **Net PnL (Scenario $s$):** $\text{Gross Payoff}(s) - \text{Capital Invested}$
* **Scenario ROI (Scenario $s$):** $(\text{Net PnL}(s) / \text{Capital Invested}) \cdot 100\%$

### 3. Expected Value (EV)
The statistical expectation of your portfolio's terminal profit or loss based on your probability distribution over the terminal scenarios:
$$\text{Expected Value} = \sum_{s \in S} \text{Probability}(s) \cdot \text{Net PnL}(s)$$

### 4. Reciprocal Pricing Reconstruction (The \$1.00 Constraint)
Because Kalshi only lists Bids (BUY orders) in raw WebSocket and orderbook payloads, the dashboard reconstructs the Ask (sell) price using the reciprocal axiom of binary options:
$$\text{YES ASK} = \$1.00 - \text{NO BID}$$
$$\text{NO ASK} = \$1.00 - \text{YES BID}$$
This maintains accurate market spreads and provides true marking of current execution limits.

### 5. VWAP Walkdown Liquidation Solver (Mark-to-Market)
Instead of valuing positions at top-of-book (which ignores size constraints and slippage), the simulator iterates down the bid book to calculate the **Volume-Weighted Average Price (VWAP)** liquidation value ($V_{liq}$):
$$V_{liq} = \sum_{i=1}^{k} (p_i \cdot \min(q_i, Q_{remaining}))$$
If the size exceeds all available depth, the remaining quantity is marked as **"Illiquid"**, and a warning badge `⚠️ ILLIQUID LIMITS` flashes on the dashboard.

### 6. Market Lifecycle States
The engine monitors and reacts to market status updates:
* `initialized`, `active`, `paused`: Active pricing loops continue.
* `determined`, `settled`: Calculations are frozen, and the contract value locks to its final settlement payout ($\$1.00$ or $\$0.00$), preventing pricing anomalies in resolved positions.

### 7. RSA-PSS Cryptographic Authentication
For institutional security, Kalshi API requires asymmetric RSA key pairs. The signer creates Millisecond-bound signatures:
$$\text{Payload} = \text{Access-Timestamp} + \text{HTTP Method} + \text{Request Path}$$
The payload is signed using **RSA-PSS SHA-256** (salt length 32) and attached via custom headers (`KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-TIMESTAMP`, `KALSHI-ACCESS-SIGNATURE`). This is computed purely in-memory in your browser using the Web Crypto API.

---

## Interactive Dashboard Guide

The dashboard is divided into three primary rows:

### Row 1: Event Config & Automated Puller
1. **Terminal Event Outcomes Panel:**
   - Define, rename, add, or delete scenarios.
   - Enter probabilities for each scenario. Click **Normalize %** to scale them so they sum to exactly 100%.
2. **Automated Market Feed Loader:**
   - Type in the Polymarket event slug and the Kalshi event ticker.
   - **Integration Settings:** Expand this panel to enter your Environment, Subaccount, Access Key ID, and RSA Private Key PEM. If valid, this calls Kalshi directly (via proxy) and displays your account balance.
   - Click **Fetch Live Market Status** to pull real-time contract listings and ask prices.
   - **Orderbook Depth Widget:** Click on any discovered market to display its YES/NO bid-ask ladder, reconstructed asks, and spread dividers.

### Row 2: Portfolio Editor & Active Holdings
1. **Position Editor:**
   - Manually enter or adjust pre-loaded trades (Exchange, Side, Contract Name, Q, P, fees, routine).
   - Check the **YES Payout Settle Scenarios** to map which scenarios trigger a payout.
   - *Heuristics:* Typing player names or scores will auto-suggest mappings by matching keywords.
2. **Active Risk Portfolio:**
   - Review active positions, contract prices, total cost basis, and **VWAP MTM Valuation**.
   - Highlights illiquid holdings with an orange warning badge if the portfolio size exceeds orderbook depth.

### Row 3: Risk Analytics & Live Feed
1. **Stat Cards & Scenario Bar Chart:**
   - **Row 1 (Expiration Forecast):** Invested Capital, Expected Value (EV), Max Drawdown, and Arbitrage Status.
   - **Row 2 (Mark-to-Market Forecast):** MTM Liquidation Value, Net PnL, MTM ROI, and Book Liquidity Status.
   - The bar chart visualizes Net PnL ($) under each scenario.
2. **Payoff Matrix Table:**
   - Details probability, gross payout, net profit, and ROI for each scenario.
3. **Algorithmic scanning Logs:**
   - Displays real-time WebSocket orderbook delta events, ML adjustments, and arbitrage scanner notifications.

---

## Programmatic Integration (Headless Engine)

Because `PredictionEngine` is entirely decoupled from the UI, you can copy the math code block at the top of `index.html` directly into your algorithmic execution workspace.

### Node.js Integration Example
```javascript
// Import the decoupled math module
const PredictionEngine = {
  calculateFee(platform, orderType, category, quantity, price) { /* ... */ },
  evaluateTradeArray(portfolio, platform, scenarios) { /* ... */ },
  calculateEV(portfolioMatrix) { /* ... */ }
};

// 1. Define terminal mutually exclusive scenarios
const scenarios = [
  { id: 'sc_1', name: 'Swiatek Wins 2-0', probability: 0.40 },
  { id: 'sc_2', name: 'Swiatek Wins 2-1', probability: 0.25 },
  { id: 'sc_3', name: 'Sabalenka Wins 2-0', probability: 0.15 },
  { id: 'sc_4', name: 'Sabalenka Wins 2-1', probability: 0.20 }
];

// 2. Define cross-platform portfolio
const portfolio = [
  // Polymarket winner contract: pays in sc_1 & sc_2 (Swiatek wins)
  { platform: 'Polymarket', outcome: 'YES', price: 0.62, quantity: 1500, orderType: 'Taker', category: 'Sports', payoutScenarios: ['sc_1', 'sc_2'] },
  // Kalshi score contract: pays in sc_2 (Swiatek wins 2-1)
  { platform: 'Kalshi', outcome: 'YES', price: 0.26, quantity: 1000, orderType: 'Taker', category: 'Other', payoutScenarios: ['sc_2'] }
];

// 3. Evaluate portfolio risk matrix
const matrix = PredictionEngine.evaluateTradeArray(portfolio, 'Polymarket', scenarios);
console.log(`Total Invested: $${matrix.totalCapitalDeployed}`);
console.log(`Expected Value (EV): $${PredictionEngine.calculateEV(matrix)}`);

matrix.scenarios.forEach(sc => {
  console.log(`Scenario '${sc.scenarioName}' Net PnL: $${sc.netPnL.toFixed(2)} (ROI: ${sc.roi.toFixed(1)}%)`);
});

if (matrix.isArbitrageActive) {
  console.log(`🔥 Risk-free arbitrage detected! Min Profit: $${matrix.minPnL}`);
}
```
