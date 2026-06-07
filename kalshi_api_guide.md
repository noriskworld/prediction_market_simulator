# Architectural and Engineering Guidelines for Developing Real-Time Predictive Market Dashboards

## Introduction to Predictive Market Infrastructure and Dashboard Objectives

The evolution of modern financial markets has introduced highly sophisticated event-driven predictive derivatives, allowing market participants to hedge risk or speculate on the precise occurrence of real-world events. The Kalshi exchange operates as a Commodity Futures Trading Commission (CFTC) regulated prediction market where participants trade binary options, formally known as event contracts, that fundamentally resolve to a payout of either $1.00 or $0.00. Building a sophisticated, institutional-grade portfolio management dashboard for such an exchange requires a rigorous, microscopic understanding of market ontology, reciprocal pricing mechanics, state management, and high-throughput data integration.

To properly contextualize the required systems and data pipelines, this analysis provides a generalized operational scenario designed for tracking, visualizing, and calculating expected gains for a portfolio across any predictive event—whether it be economic indicators, climate data, political outcomes, or sporting events. To anchor these abstract concepts, this guide will utilize a specific, highly liquid future sporting event—the French Open 2026 Men's Singles tournament (identified by the event ticker `KXFOMEN-26`)—as a running, concrete example.

A comprehensive dashboard must synthesize data across multiple concurrent sub-markets associated with a parent event (e.g., outright winners, specific match scores, or multivariate combinations). Furthermore, the architecture must maintain live orderbook quotes, instantaneously ingest user holdings and position modifications, and dynamically compute expected portfolio gains based on live probabilities and liquidity constraints. Achieving this level of real-time fidelity requires seamless integration with Kalshi’s REST application programming interfaces (APIs) for state initialization, paired with WebSocket streams for instantaneous updates.

## Cryptographic Authentication Protocols and Environment Initialization

Secure interaction with the Kalshi exchange necessitates the implementation of asymmetric cryptography. Unlike traditional cryptocurrency or equity exchange APIs that predominantly utilize symmetric Hash-based Message Authentication Code (HMAC) signatures, Kalshi mandates the use of RSA key pairs, specifically utilizing the RSA-PSS signature scheme, for API authentication. This rigorous standard ensures non-repudiation and enhanced security for programmatic trading and sensitive data ingestion, ensuring that unauthorized entities cannot forge requests even if they intercept the transmission.

### Environment Partitioning and Host Allocation

The Kalshi API infrastructure is strictly partitioned into production and demonstration environments. Credentials are fundamentally environment-specific; keys generated in the demonstration sandbox cannot execute calls or authenticate connections in the production environment, and vice versa. Dashboard developers must implement environment variables within their application architecture to seamlessly toggle between these hosts during the development and deployment lifecycles.

The REST API utilizes standard HTTP verbs and relies on the following base URLs:
The primary production environment is hosted at `https://external-api.kalshi.com/trade-api/v2`. Secondary routing is also available via `https://api.elections.kalshi.com/trade-api/v2`, though the primary external API host is highly recommended for general non-election trading activities. The demonstration sandbox, which utilizes simulated funds for safe testing, is located at `https://external-api.demo.kalshi.co/trade-api/v2`.

For real-time data ingestion via WebSocket streaming, the endpoints follow a parallel network structure. The production WebSocket URL is accessed at `wss://external-api-ws.kalshi.com/trade-api/ws/v2`, while the demonstration WebSocket environment resides at `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`. Developers must ensure that their WebSocket client libraries support the attachment of custom HTTP headers during the initial handshake, as authentication is required prior to the protocol upgrade.

### API Key Setup and Management Guide

To establish authenticated sessions and gain access to private portfolio data, developers must obtain and manage API keys directly through the Kalshi platform.

1. **Key Generation:** Developers must log in to their Kalshi account (in either the demo or production environment) and navigate to Account & Security -> API Keys to click "Create Key".
2. **Credential Storage:** The system will display an API Key ID (a UUID) and prompt the download of a Private Key as a `.key` file. The private key cannot be retrieved after this page is closed and must be stored securely by the developer. Keys can also be assigned specific scopes, such as `read` or `write`, to limit the potential attack surface if a key is compromised.
3. **Request Signing:** Every authenticated HTTP request, as well as the initial WebSocket handshake, requires three specific headers: `KALSHI-ACCESS-KEY` (the API Key ID), `KALSHI-ACCESS-TIMESTAMP` (current Unix timestamp in milliseconds), and `KALSHI-ACCESS-SIGNATURE`.
4. **Signature Construction:** The signature string is mathematically constructed by concatenating the timestamp, the HTTP method (e.g., "GET" or "POST"), and the exact request path. Crucially, the path used for signing must exclude the base URL hostname and any query parameters (for example, you must sign `/trade-api/v2/portfolio/orders` rather than the full URL appended with `?limit=5`). This concatenated string is then signed using the RSA-PSS algorithm with SHA-256 hashing and encoded as a Base64 string to be passed in the signature header.

By cryptographically linking the millisecond timestamp to the signature, the exchange effectively mitigates replay attacks, ensuring that intercepted network requests cannot be duplicated by malicious actors at a later time.

## Data Ontology and Isolating Specific Events

To accurately display target events on the dashboard and extract all possible contracts, the data pipeline must accurately parse Kalshi’s hierarchical market ontology. The exchange systematically categorizes tradable assets into a three-tiered structure: Series, Events, and Markets. Understanding the relational database design between these tiers is paramount for mapping the correct data structures to the dashboard's user interface.

### The Series Tier

A "Series" acts as the foundational, overarching template for recurring, related events. A series might represent recurring thematic categories like "Grand Slam Men's Singles", "Monthly CPI Releases", or "Fed Interest Rate Decisions". Metadata regarding the series is fetched via the `GET /series/{series_ticker}` endpoint. The series response schema returns a JSON object providing macro-level context, including a `title`, the `frequency` of the occurrence, and the thematic `category` to which it belongs.

### The Event Tier and Nested Markets

An "Event" represents a specific, real-world occurrence bounded by a timeframe and a definitive resolution criteria (identified by an `{event_ticker}`). Events act as the parent container for multiple granular, tradable markets. For our example, the specific event is `KXFOMEN-26` (the French Open 2026). To retrieve the event details and populate the initial state of the dashboard, the backend architecture must execute an HTTP GET request to the `GET /events/KXFOMEN-26` endpoint.

For optimal performance and comprehensive dashboard initialization, developers should aggressively utilize the query parameter `with_nested_markets=true`. When this parameter is activated, the API alters its standard response schema, embedding all subordinate, active markets directly within the parent event object. This architectural pattern significantly reduces network overhead, allowing the dashboard client to download the entire state of the French Open in a single payload rather than querying each nested market individually.

The event object itself contains several critical metadata fields that dictate the structural logic of the portfolio risk modeling engine. The `mutually_exclusive` boolean flag indicates whether the subordinate markets represent mutually exclusive outcomes. For an outright event winner market, this flag will be true, as only one outcome can prevail. This flag is absolutely vital for calculating maximum portfolio risk, as the dashboard software can mathematically deduce that holding positions on multiple mutually exclusive outcomes limits the maximum potential loss.

### The Market Tier Schema

The "Market" represents the most granular level of the taxonomy: the specific, tradable binary contract possessing its own distinct orderbook. Within any overarching event (like `KXFOMEN-26`), individual nested markets will differentiate themselves based on the proposition. These propositions might include outright questions (e.g., "Will Carlos Alcaraz win?"), specific metric thresholds, or exact set scorelines.

Each market operates entirely independently regarding pricing and liquidity. The dashboard developers must strictly map their internal state interfaces to the following critical fields within the Market schema:

| Market Field Identifier | Data Type | Analytical Purpose for Dashboard Integration |
| --- | --- | --- |
| `ticker` | string | The unique identifier required for subsequent WebSocket subscriptions, orderbook queries, and user position tracking. |
| `yes_sub_title` | string | The explicit contextual criteria defining a YES resolution, which should be displayed prominently on the dashboard UI. |
| `no_sub_title` | string | The explicit contextual criteria defining a NO resolution. |
| `yes_bid_dollars` / `yes_ask_dollars` | string | Top-of-book pricing represented as a fixed-point decimal string (e.g., "0.6500"). This serves as the immediate proxy for the market's perceived probability of the event occurring. |
| `volume_fp` | string | Total historical trading volume, serving as a primary metric for market interest and confidence. |
| `open_interest_fp` | string | Total outstanding active contracts, indicating overall market depth, capital allocation, and systemic risk. |
| `liquidity_dollars` | string | A calculated representation of available liquidity across the orderbook, essential to display so users understand if large portfolio liquidations are viable without massive slippage. |
| `price_ranges` | array of objects | Dictates the allowed `start`, `end`, and `step` increments for order submission, strictly regulating the tick sizes the dashboard can accept for new orders. |

### Managing Multivariate Events and Combo Contracts

The dashboard must also account for complex user portfolios that include combo markets or multivariate events (MVE). A trader might wish to leverage their capital by trading a custom combination, such as "Carlos Alcaraz to win Set 1 AND Jannik Sinner to win Set 2".

Kalshi facilitates these custom combinations through a Request For Quote (RFQ) system. When a user requests a combo, the platform generates a unique, temporary orderbook, prompting market makers to respond with live quotes. From a dashboard development perspective, combos resolve to the mathematical product of the underlying positions, capping at a maximum payout of $1.00 per contract. Settlement is deferred until all underlying legs of the position have been definitively determined. Crucially, if any single leg of the combination resolves to a NO outcome (effectively paying $0), the entire combo market pays $0, regardless of the success of the other legs.

For the dashboard to accurately calculate the expected gain on an MVE, it must parse the `mve_selected_legs` array nested within the market schema. This array contains objects detailing the `event_ticker`, `market_ticker`, `side`, and `yes_settlement_value_dollars` for each leg of the combo. The dashboard software must dynamically fetch the standalone market ticker assigned to the combo and parse its specific RFQ-generated orderbook.

## Orderbook Mechanics and the Reciprocal Pricing Model

To accurately display "live quotes" and calculate the liquidation value of a portfolio, the dashboard architecture must intimately interface with Kalshi's highly specific orderbook mechanics. Because the exchange deals exclusively in binary options that possess a mathematically guaranteed settlement of either $1.00 or $0.00, the pricing system operates on a strictly reciprocal foundation.

### The Mathematical Axiom of the $1.00 Constraint

In any given binary market on the exchange, the combined value of a YES contract and a NO contract must inherently and perpetually equal $1.00 (excluding minor bid-ask spread deviations). This immutable mathematical property dictates how the central limit orderbook is structured on Kalshi's backend and how quotes are disseminated over the API to external clients.

In a departure from traditional financial exchanges, the Kalshi API deliberately does not return "asks" (sell orders) in its raw orderbook payload; it exclusively returns "bids" (buy orders) for both the YES and NO sides of the market. This architectural design choice halves the necessary payload size over the network, maximizing throughput, but it shifts the computational burden of reconstructing the full orderbook to the dashboard developer.

The logic dictating this reconstruction relies on the principle that buying one side of the market is mathematically indistinguishable from selling the opposite side. If a trader is willing to pay $0.60 to acquire a YES contract, they are effectively demanding a $0.40 profit in exchange for taking on $0.60 of risk. Consequently, for the market to clear, the counterparty must be willing to pay $0.40 for the NO contract to win that same total $1.00. Therefore, the dashboard's data parser must apply the following reciprocal transformations to display standard bid/ask spreads to the user:

| Raw API Data (Action on the Orderbook) | Mathematical Equivalent (Dashboard Display) | Rationale based on the $1.00 Axiom |
| --- | --- | --- |
| **YES BID** at $0.60 | **NO ASK** at $0.40 | The trader is willing to pay $0.60 for YES. This is mathematically equivalent to demanding $0.40 to take on a NO position. |
| **NO BID** at $0.30 | **YES ASK** at $0.70 | The trader is willing to pay $0.30 for NO. This is mathematically equivalent to demanding $0.70 to take on a YES position. |

By dynamically executing the calculation `Ask = $1.00 - Bid of the opposite side`, the dashboard provides complete market depth information while seamlessly conforming to the exchange's data models.

### Extracting Initial State Quotes via the REST API

To construct the initial, foundational state of the orderbook for the target markets upon dashboard load, the application must query the `GET /markets/{ticker}/orderbook` endpoint. Developers can utilize the `depth` query parameter to limit the number of price tiers returned; however, passing a value of `0` or omitting the parameter returns the entire orderbook, which is highly recommended for accurate portfolio liquidation modeling.

The JSON response schema provides two primary, highly structured arrays encapsulated within the `orderbook_fp` parent object: `yes_dollars` and `no_dollars`. Each array contains a list of nested tuples formatted precisely as `[price_dollars, count_fp]`, representing the exact bid price and the sheer quantity of contracts available at that specific price level.

For a dashboard displaying the expected liquidation value of a portfolio, the software must deeply traverse this structured orderbook. If the portfolio holds 500 YES contracts predicting Carlos Alcaraz will win, the system cannot simply multiply 500 by the top-of-book `yes_bid_dollars` to calculate value. Doing so would ignore market depth and slippage, resulting in a dangerously inflated expected gain. Instead, the dashboard must programmatically compute the Volume-Weighted Average Price (VWAP) by iterating down the `yes_dollars` array—which represents the resting bids of buyers willing to absorb the user's contracts—until the simulated 500 contracts are completely filled.

## Streaming Real-Time Market Data via WebSocket

While the REST API is sufficient for bootstrapping the dashboard's initial state, polling REST endpoints for live quotes is an antipattern. It introduces severe latency, provides an asynchronous view of the market, and will rapidly exhaust the user's API rate limits. To achieve a high-fidelity, institutional-grade dashboard, the architecture must establish a persistent, bidirectional WebSocket connection to stream live quotes directly from the matching engine.

### The WebSocket Handshake and Subscription Protocol

As previously established, the connection must be instantiated with the requisite RSA-PSS authentication headers. Once the authenticated WebSocket is successfully initialized to `wss://external-api-ws.kalshi.com/trade-api/ws/v2`, the client must transmit a JSON-formatted `subscribe` command targeting specific channels.

For tracking target markets, the dashboard should primarily subscribe to the `orderbook_delta` channel, passing the array of specific `market_tickers` it wishes to monitor. The WebSocket sequence operates systematically to ensure the client remains synchronized with the server's state:

1. **Subscription Acknowledgment**: The server immediately responds with a `subscribed` type message, confirming the subscription ID (`sid`) mapped to the request.
2. **The Orderbook Snapshot**: To synchronize the client, the server pushes an initial `orderbook_snapshot` message. This payload contains the full, aggregated depth of the orderbook at that exact millisecond, delivering complete `yes_dollars_fp` and `no_dollars_fp` arrays exactly like the REST endpoint. The dashboard must cache this snapshot as the foundational baseline.
3. **Orderbook Deltas**: As trading occurs and liquidity shifts, the server emits continuous `orderbook_delta` messages. Rather than sending the full book, these payloads are highly optimized, containing only the `price_dollars`, a `delta_fp` representing the change in volume at that exact price level, and the `side` (`yes` or `no`).

### Client-Side State Management

The most technically demanding aspect of the dashboard is maintaining the local orderbook replica. The dashboard’s state manager (such as a Redux store, a Vuex module, or a custom RxJS observable pipeline) must meticulously apply these incoming deltas to the cached snapshot.

When a `delta_fp` arrives, the system must locate the corresponding `price_dollars` within the correct `side` array. The `delta_fp` value (which can be positive or negative) is added to the existing `count_fp`. If the resulting calculation causes the volume at that price level to drop to exactly zero, that price level must be entirely expunged from the local orderbook array. Furthermore, the dashboard must continually sort the arrays to ensure the best bid remains at the top of the book.

## Portfolio Management: Ingesting Positions, Balances, and Holdings

The core utility and primary value proposition of the dashboard rely entirely on accurately retrieving, displaying, and tracking the user's specific holdings—their portfolio positions—in real-time. Kalshi provides an ecosystem of both REST endpoints for initial portfolio state hydration and dedicated private WebSocket channels for event-driven updates regarding executions.

### State Initialization via the REST Portfolio Endpoints

When the dashboard application initializes, it must execute queries to ascertain the user's current capital exposure. The foundational request is sent to the `GET /portfolio/balance` endpoint. This endpoint returns the total unencumbered cash balance alongside the aggregate portfolio value. Notably, Kalshi allows advanced users to operate multiple subaccounts. Developers can pass an optional `subaccount` query parameter (e.g., `subaccount=1`) to isolate balances and portfolio values for specific algorithmic strategies, while omitting it or passing `subaccount=0` defaults to the primary account ledger.

Following the balance retrieval, the dashboard must query the `GET /portfolio/positions` endpoint to fetch the granular holdings. **Crucially, dashboard developers must be aware that the `GET /portfolio/positions` endpoint exclusively returns *unsettled*, active positions.** If the dashboard needs to calculate historical performance or view expected gains that have already materialized into realized profits for a completed event, the architecture must explicitly query the `GET /portfolio/settlements` endpoint instead.

The API responds with an array of `market_positions` objects. Each nested object rigorously details the user's financial exposure to a specific market.

| Position Field Identifier | Dashboard Application and Context |
| --- | --- |
| `ticker` | The specific market identifier string, acting as the primary key allowing the dashboard to link the specific position to the live orderbook data stream. |
| `position_fp` | A string indicating the net number of contracts held. This value is the absolute cornerstone of the portfolio dashboard. |
| `market_exposure_dollars` | Represents the total capital presently locked at risk within this specific market. |
| `total_cost_shares` | Tracks the total number of shares traded on an event across both YES and NO contracts, regardless of side. |

### Understanding Negative Positions and Directional Exposure

It is absolutely crucial for the dashboard developers to understand how Kalshi processes and reports directional exposure. While traditional equity or futures exchanges allow users to hold explicit "short" positions on an asset, the binary, zero-sum structure of Kalshi means that taking a bearish position on a YES contract is mechanically and financially executed by purchasing a NO contract.

Because the exchange system abstracts this for accounting simplicity, the `position_fp` field tracks the net directional exposure and can return a negative value. A positive `position_fp` indicates a net long holding of YES contracts. Conversely, a negative `position_fp` mathematically indicates a net holding of NO contracts. The dashboard must parse this negative float, invert the sign for display purposes, and correctly label the holding as a NO position to avoid catastrophic confusion for the end-user.

### Dynamic Portfolio Updates via Private WebSockets

To guarantee the dashboard reflects newly executed trades, partial fills, and market settlements instantaneously, the architecture must subscribe to the private `market_positions` WebSocket channel. When an order is executed by the matching engine or a position updates due to settlement, the server proactively pushes a `market_position` message type to the client.

The payload structure directly mirrors the REST position object but delivers it as a discrete, real-time event. Developers must note that all monetary values within WebSocket payloads strictly utilize the `_dollars` suffix and are returned as fixed-point decimal strings, definitively abandoning legacy integer formats that represented centi-cents.

Upon receipt of a `market_position` WebSocket message, the dashboard’s internal state management system must intercept the payload, locate the existing cached position data mapped to the specified `market_ticker`, override it with the new data, and immediately trigger a recalculation of the expected portfolio gains.

## Computational Models for Dashboard Expected Gains

The analytical core of the dashboard relies entirely on the accurate mathematical translation of live orderbook probabilities and position sizes into a dynamic expected return matrix. Because prediction markets operate on binary $1.00 payouts, the quoted prices effectively function as the raw, crowd-sourced probability of the event's occurrence. For example, a YES price of $0.65 implies a 65% perceived probability that the specific outcome will occur.

### Defining Mark-to-Market (MTM) Liquidation Value

For an individual market $m$ within the target event, the dashboard can compute expected gains through two distinct lenses: Mark-to-Market (MTM) or Theoretical Expected Value. If the dashboard is designed to reflect the immediate, realizable value of the portfolio based on current liquidity, the calculation relies strictly on orderbook realities, abandoning theoretical edge.

The MTM Expected Gain ($EG_{mtm}$) for a single position is calculated as:


$$EG_{mtm} = V_{liq} - C_{total}$$


Where $C_{total}$ is the total cost basis of the position (derived from `position_cost_dollars` plus any allocated `fees_paid_dollars`), and $V_{liq}$ is the current, executable liquidation value of the contracts based on resting orders.

### Algorithmic Calculation of Liquidation Value ($V_{liq}$)

Because market liquidity organically fluctuates throughout an event's lifecycle, valuing a position based merely on the top-of-book price or the last traded price is a fundamentally flawed architecture that will present users with an illusion of wealth. A robust dashboard must mathematically simulate walking down the orderbook to calculate true expected gains.

Assume the portfolio holds a quantity $Q$ of YES contracts. To liquidate this position, the trader must act as an aggressive taker, selling their contracts into the resting YES bids provided by the market makers.

Let the `yes_dollars` bid orderbook for the market be represented as an ordered set of price-quantity pairs:


$$B_{yes} = \{ (p_1, q_1), (p_2, q_2),..., (p_n, q_n) \}$$


Where $p_1$ is the highest bid price (best execution), and prices descend sequentially $p_1 > p_2 >... > p_n$.

The liquidation value $V_{liq}$ is calculated by a loop algorithm that iteratively depletes the bid quantities until the user's holding $Q$ is fully absorbed by the market depth:


$$V_{liq} = \sum_{i=1}^{k} (p_i \times \min(q_i, Q_{remaining}))$$


Where $Q_{remaining}$ is updated at each computational step $i$ by subtracting the quantity absorbed at that price tier.

If the total available liquidity in the entire orderbook ($\sum q_i$) is less than $Q$, the dashboard must break the calculation loop and immediately flag the position as "Illiquid." This complex calculation loop must be executed in real-time by the client every single time an `orderbook_delta` message updates the local state.

### Scenario Analysis and Predictive Edge Calculation

Conversely, if the dashboard is built for a quantitative trading desk that integrates proprietary machine learning models or statistical forecasting tools (e.g., an internal model determining that an outcome has a true 75% chance of occurring, while the Kalshi market YES price sits at $0.65), a secondary metric—*Theoretical Expected Gain*—should be calculated and displayed.

Let $\hat{P}$ be the proprietary forecast probability (0.75). Let $P_{market}$ be the current entry price available on the orderbook ($0.65).
The theoretical expected value of a contract that pays $1.00 upon success is calculated as:


$$EV_{theoretical} = (\hat{P} \times \$1.00) + ((1 - \hat{P}) \times \$0.00) = \$0.75$$

The Expected Return on Investment (ROI) per contract is therefore the delta between the theoretical value and the market cost, divided by the cost:


$$ROI_{expected} = \frac{EV_{theoretical} - P_{market}}{P_{market}} = \frac{0.75 - 0.65}{0.65} \approx 15.38\%$$

The dashboard can graphically visualize this metric to highlight instances where the internal forecast diverges significantly from the market consensus.

## Lifecycle Management and Historical Data Integration

A predictive market dashboard cannot assume that all markets remain perpetually open or liquid. Kalshi enforces a rigorous, multi-stage market lifecycle, and handling these state transitions within the application architecture is essential to prevent false expected gain calculations or broken user interfaces.

### Managing Market Status States

Both the REST API and the dedicated `market_lifecycle_v2` WebSocket channel continuously emit status changes that dictate a market's current operability. The dashboard must programmatically track and react to the following defined states:

* `initialized`: The market is created on the backend but is not yet open for live trading.
* `active`: The primary, nominal trading state. The orderbook is live, execution is possible, and expected gains will organically fluctuate.
* `paused`: Trading has been temporarily halted by exchange administrators, often due to anomalous news or technical review.
* `determined`: The outcome of the real-world event is known, but the final financial payout processing is pending. Orderbooks freeze immediately.
* `settled`: Payouts have been successfully distributed to the user's cash balance. The position effectively exits the active portfolio.

When a WebSocket payload indicates a market has transitioned to `determined` or `settled`, the dashboard architecture must immediately sever the orderbook calculation loops. It must freeze the expected gain calculation and lock the position value to its final settlement payout ($1.00 or $0.00), preventing the UI from displaying chaotic data as the orderbook is cleared by the exchange.

## Rate Limiting and Dashboard Architecture Resilience

Developing a dynamic dashboard that polls multiple REST endpoints while simultaneously maintaining concurrent WebSocket streams risks triggering exchange-imposed rate limits. Kalshi enforces strict rate limits utilizing a sophisticated token bucket algorithm, varying the allowed throughput based on the user's specific account tier.

To monitor these constraints, the dashboard can query the `GET /trade-api/v2/account/limits` endpoint. This request returns nested objects detailing the precise `refill_rate` (representing the tokens added to the bucket per second) and the `bucket_capacity` (the maximum tokens the bucket can hold before overflowing and rejecting requests). To build a robust, resilient architecture that avoids HTTP 429 Too Many Requests errors, the dashboard backend should implement the following engineering strategies:

First, implement strict state bootstrapping. Upon initialization, the application must execute the absolute minimal number of REST calls necessary. It should fetch the overall portfolio balance (`GET /portfolio/balance`) and open positions (`GET /portfolio/positions?limit=100`). It should then fetch the parent event schema using the dense payload parameter (`GET /events/{event_ticker}?with_nested_markets=true`).

Following this initial hydration, the architecture must transition to WebSocket delegation. Once the baseline state is acquired, the software should cease polling the REST API entirely. It must rely exclusively on the lightweight WebSocket channels (`orderbook_delta`, `market_positions`, `market_lifecycle_v2`) to mutate the application state.

Finally, the architecture requires client-side computational throttling. The user interface must not attempt to re-render the complex expected gains matrix and DOM elements on every single millisecond `orderbook_delta` tick, as this will result in severe CPU thrashing and browser freezing. Instead, developers must utilize a `requestAnimationFrame` loop or a highly tuned debounce function (e.g., executing calculations at 200ms intervals) to batch the orderbook changes in memory and re-calculate the portfolio value efficiently, providing a smooth, performant user experience that accurately reflects the volatile nature of predictive markets.