const GROUPS = {
    "Group A": ["Mexico", "South Africa", "South Korea", "Czechia"],
    "Group B": ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
    "Group C": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "Group D": ["USA", "Paraguay", "Australia", "Turkiye"],
    "Group E": ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
    "Group F": ["Netherlands", "Japan", "Sweden", "Tunisia"],
    "Group G": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "Group H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "Group I": ["France", "Senegal", "Bolivia", "Norway"],
    "Group J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "Group K": ["Portugal", "Jamaica", "Uzbekistan", "Colombia"],
    "Group L": ["England", "Croatia", "Ghana", "Panama"]
};

const TEAMS = Object.values(GROUPS).flat().sort();

const AppState = {
    mode: 'direct', // 'direct' or 'bff'
    markets: { kalshi: [], polymarket: [] },
    portfolio: [],
    filter: 'all'
};

const UI = {
    modeSelector: document.getElementById('mode-selector'),
    marketList: document.getElementById('market-list-container'),
    portfolioDropzone: document.getElementById('portfolio-dropzone'),
    placeholder: document.getElementById('dropzone-placeholder'),
    totalExposure: document.getElementById('portfolio-total-exposure'),
    arbitrageAlerts: document.getElementById('arbitrage-alerts'),
    teamFilter: document.getElementById('team-filter'),
    statusLog: document.getElementById('status-log'),
    manualAddContainer: document.getElementById('manual-add-container'),
    manualSource: document.getElementById('manual-source'),
    manualGroup: document.getElementById('manual-group'),
    manualMatch: document.getElementById('manual-match'),
    manualOutcome: document.getElementById('manual-outcome'),
    manualPrice: document.getElementById('manual-price'),
    manualStake: document.getElementById('manual-stake'),
    btnManualAdd: document.getElementById('btn-manual-add')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadData();
});

function bindEvents() {
    UI.modeSelector.addEventListener('change', (e) => {
        AppState.mode = e.target.value;
        UI.manualAddContainer.style.display = AppState.mode === 'direct' ? 'block' : 'none';
        loadData();
    });

    UI.teamFilter.addEventListener('change', (e) => {
        AppState.filter = e.target.value;
        renderMarketList();
    });

    // Drag and drop for portfolio dropzone
    UI.portfolioDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        UI.portfolioDropzone.classList.add('drag-over');
    });

    UI.portfolioDropzone.addEventListener('dragleave', () => {
        UI.portfolioDropzone.classList.remove('drag-over');
    });

    UI.portfolioDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        UI.portfolioDropzone.classList.remove('drag-over');
        const marketId = e.dataTransfer.getData('text/plain');
        const source = e.dataTransfer.getData('source');
        addContractToPortfolio(marketId, source);
    });

    const updateMatches = () => {
        const group = UI.manualGroup.value;
        const teams = GROUPS[group];
        if (!teams) return;
        let matchOptions = '';
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const m = `${teams[i]} vs ${teams[j]}`;
                matchOptions += `<option value="${m}">${m}</option>`;
            }
        }
        UI.manualMatch.innerHTML = matchOptions;
        updateOutcomes();
    };

    const updateOutcomes = () => {
        const match = UI.manualMatch.value;
        if (!match) return;
        const [teamA, teamB] = match.split(' vs ');
        UI.manualOutcome.innerHTML = `
            <option value="${teamA} wins">${teamA} wins</option>
            <option value="${teamB} wins">${teamB} wins</option>
            <option value="Tie">Match Ties</option>
        `;
    };

    if (UI.manualGroup) {
        let groupOptions = '';
        Object.keys(GROUPS).forEach(g => groupOptions += `<option value="${g}">${g}</option>`);
        UI.manualGroup.innerHTML = groupOptions;
        
        UI.manualGroup.addEventListener('change', updateMatches);
        UI.manualMatch.addEventListener('change', updateOutcomes);
        updateMatches();
    }

    UI.btnManualAdd.addEventListener('click', () => {
        const source = UI.manualSource.value;
        const match = UI.manualMatch.value;
        const outcome = UI.manualOutcome.value;
        
        if (!match) return;

        const title = `Event: Match ${match}; ${outcome}`;
        const price = parseFloat(UI.manualPrice.value);
        const stake = parseInt(UI.manualStake.value, 10);
        if (isNaN(price) || price <= 0 || price >= 1) {
            alert('Please enter a valid price between 0.01 and 0.99.');
            return;
        }
        if (isNaN(stake) || stake <= 0) {
            alert('Please enter a valid stake amount.');
            return;
        }

        const id = 'custom-' + Date.now();
        AppState.portfolio.push({ id, source, title, price, stake });
        
        renderPortfolio();
        if (typeof window.updatePayoffMatrix === 'function') {
            window.updatePayoffMatrix(AppState.portfolio);
        }
    });
}

// Data Fetching
async function loadData() {
    UI.statusLog.innerText = `Status: Fetching data in ${AppState.mode} mode...`;
    
    try {
        if (AppState.mode === 'direct') {
            // Automatically generate outright winner contracts for all 48 teams
            const kMarkets = TEAMS.map(team => ({
                ticker: `KXWC-${team.toUpperCase().replace(/\\s/g, '')}`,
                title: `${team} to win the World Cup`,
                yes_bid_dollars: (Math.random() * 0.1 + 0.01).toFixed(2),
                no_bid_dollars: (0.90).toFixed(2)
            }));
            const pMarkets = TEAMS.map(team => ({
                id: `PMWC-${team.toUpperCase().replace(/\\s/g, '')}`,
                question: `Will ${team} win the World Cup?`,
                outcomePrices: [(Math.random() * 0.1 + 0.01).toFixed(2), (0.90).toFixed(2)]
            }));
            
            AppState.markets.kalshi = kMarkets;
            AppState.markets.polymarket = pMarkets;
        } else {
            // BFF Mode - hits the local Cloudflare worker proxy
            const [kRes, pRes] = await Promise.all([
                fetch('http://127.0.0.1:8787/api/kalshi/contracts'),
                fetch('http://127.0.0.1:8787/api/polymarket/contracts')
            ]);
            // If BFF isn't fully wired up yet, it might fail or return mock data
            // We'll simulate error handling here
            if (kRes.ok) {
                const kData = await kRes.json();
                AppState.markets.kalshi = kData.markets || [];
            }
            if (pRes.ok) {
                const pData = await pRes.json();
                AppState.markets.polymarket = pData.markets || [];
            }
        }
        
        UI.statusLog.innerText = `Status: Connected (${AppState.mode})`;
        renderMarketList();
        checkArbitrage();
        
    } catch (err) {
        console.error("Failed to fetch data:", err);
        UI.statusLog.innerText = `Status: Error fetching data - ${err.message}`;
    }
}

// Rendering
function renderMarketList() {
    UI.marketList.innerHTML = '';
    
    const kMarkets = AppState.markets.kalshi.filter(m => AppState.filter === 'all' || m.title.includes(AppState.filter));
    const pMarkets = AppState.markets.polymarket.filter(m => AppState.filter === 'all' || m.question.includes(AppState.filter));
    
    if (kMarkets.length === 0 && pMarkets.length === 0) {
        UI.marketList.innerHTML = `<div style="color:var(--text-muted); text-align:center;">No markets match the filter.</div>`;
        return;
    }

    kMarkets.forEach(m => UI.marketList.appendChild(createMarketCard(m, 'kalshi')));
    pMarkets.forEach(m => UI.marketList.appendChild(createMarketCard(m, 'polymarket')));
}

function createMarketCard(market, source) {
    const el = document.createElement('div');
    el.className = `market-card glass-panel ${source}`;
    el.draggable = true;
    
    const id = source === 'kalshi' ? market.ticker : market.id;
    const title = source === 'kalshi' ? market.title : market.question;
    const yesPrice = source === 'kalshi' ? parseFloat(market.yes_bid_dollars) : parseFloat(market.outcomePrices[0]);
    const noPrice = source === 'kalshi' ? parseFloat(market.no_bid_dollars) : parseFloat(market.outcomePrices[1]);

    el.innerHTML = `
        <div class="market-title">${title}</div>
        <div class="market-prices">
            <span class="price-yes">Yes: $${yesPrice.toFixed(2)}</span>
            <span>No: $${noPrice.toFixed(2)}</span>
        </div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem; text-transform: capitalize;">${source}</div>
    `;

    el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.setData('source', source);
    });

    return el;
}

// Portfolio Management
function addContractToPortfolio(id, source) {
    const exists = AppState.portfolio.find(p => p.id === id);
    if (exists) return; // Prevent duplicates for MVP

    let market = null;
    let title = '';
    let price = 0;

    if (source === 'kalshi') {
        market = AppState.markets.kalshi.find(m => m.ticker === id);
        if (market) {
            title = market.title;
            price = parseFloat(market.yes_bid_dollars);
        }
    } else {
        market = AppState.markets.polymarket.find(m => m.id === id);
        if (market) {
            title = market.question;
            price = parseFloat(market.outcomePrices[0]);
        }
    }

    if (!market) return;

    AppState.portfolio.push({
        id,
        source,
        title,
        price,
        stake: 100 // default stake
    });

    renderPortfolio();
    if (typeof window.updatePayoffMatrix === 'function') {
        window.updatePayoffMatrix(AppState.portfolio);
    }
}

function renderPortfolio() {
    if (AppState.portfolio.length === 0) {
        UI.placeholder.style.display = 'block';
    } else {
        UI.placeholder.style.display = 'none';
    }

    // Keep placeholder if it's the only child, remove everything else
    Array.from(UI.portfolioDropzone.children).forEach(child => {
        if (child.id !== 'dropzone-placeholder') {
            UI.portfolioDropzone.removeChild(child);
        }
    });

    let totalExp = 0;

    AppState.portfolio.forEach((pos, index) => {
        totalExp += pos.stake * pos.price;

        const card = document.createElement('div');
        card.className = `market-card glass-panel ${pos.source}`;
        card.style.cursor = 'default';
        card.innerHTML = `
            <div class="market-title">${pos.title}</div>
            <div class="market-prices" style="align-items: center; margin-bottom: 0.5rem; gap: 0.5rem;">
                <span style="display: flex; align-items: center; gap: 0.25rem;">
                    Entry: $<input type="number" class="price-input" value="${pos.price.toFixed(2)}" min="0.01" max="0.99" step="0.01" style="width: 60px; padding: 0.1rem 0.2rem; font-size: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid var(--panel-border); color: var(--text-main); border-radius: 4px;" />
                </span>
                <span style="display: flex; align-items: center; gap: 0.25rem;">
                    Stake: <input type="number" class="stake-input" value="${pos.stake}" min="1" style="width: 60px; padding: 0.1rem 0.2rem; font-size: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid var(--panel-border); color: var(--text-main); border-radius: 4px;" />
                </span>
            </div>
            <button class="remove-btn" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; background: rgba(255,0,0,0.2); color: #fca5a5; border: none; border-radius: 4px; cursor: pointer;">Remove</button>
        `;

        card.querySelector('.price-input').addEventListener('change', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0 && val <= 1) {
                AppState.portfolio[index].price = val;
                renderPortfolio();
                if (typeof window.updatePayoffMatrix === 'function') {
                    window.updatePayoffMatrix(AppState.portfolio);
                }
            }
        });

        card.querySelector('.stake-input').addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0) {
                AppState.portfolio[index].stake = val;
                renderPortfolio();
                if (typeof window.updatePayoffMatrix === 'function') {
                    window.updatePayoffMatrix(AppState.portfolio);
                }
            }
        });

        card.querySelector('.remove-btn').addEventListener('click', () => {
            AppState.portfolio.splice(index, 1);
            renderPortfolio();
            if (typeof window.updatePayoffMatrix === 'function') {
                window.updatePayoffMatrix(AppState.portfolio);
            }
        });

        UI.portfolioDropzone.appendChild(card);
    });

    UI.totalExposure.innerText = `Exposure: $${totalExp.toFixed(2)}`;
}

// Arbitrage Engine
function checkArbitrage() {
    UI.arbitrageAlerts.innerHTML = '';
    let found = false;
    
    TEAMS.forEach(team => {
        const kMarket = AppState.markets.kalshi.find(m => m.title.includes(team) && !m.title.includes('vs'));
        const pMarket = AppState.markets.polymarket.find(m => m.question.includes(team) && !m.question.includes('vs'));
        
        if (kMarket && pMarket) {
            const kYes = parseFloat(kMarket.yes_bid_dollars);
            const pYes = parseFloat(pMarket.outcomePrices[0]);
            
            const diff = Math.abs(kYes - pYes);
            if (diff >= 0.02) { // 2% divergence
                const alert = document.createElement('div');
                alert.className = 'arbitrage-badge';
                alert.style.marginBottom = '0.5rem';
                alert.style.display = 'block';
                const higher = kYes > pYes ? 'Kalshi' : 'Polymarket';
                alert.innerText = `Arbitrage Alert: ${team} Win divergence (${(diff * 100).toFixed(1)}%) - Sell on ${higher}`;
                UI.arbitrageAlerts.appendChild(alert);
                found = true;
            }
        }
    });

    if (!found) {
        UI.arbitrageAlerts.innerHTML = '<div style="color:var(--text-muted); text-align:center; font-size:0.85rem; padding-top: 1rem;">No arbitrage opportunities > 2% found.</div>';
    }
}
