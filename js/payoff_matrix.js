// Simple matrix calculator for Phase 1 MVP
window.updatePayoffMatrix = function(portfolio) {
    const container = document.getElementById('payoff-matrix-container');
    
    if (!portfolio || portfolio.length === 0) {
        container.style.flexDirection = 'row';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.innerHTML = '<div style="color:var(--text-muted)">Add positions to your portfolio to view the scenario matrix.</div>';
        return;
    }

    container.style.flexDirection = 'column';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'stretch';
    container.style.justifyContent = 'flex-start';
    container.style.textAlign = 'left';

    const winnerContracts = portfolio.filter(p => !p.title.toLowerCase().includes('vs'));
    const matchContracts = portfolio.filter(p => p.title.toLowerCase().includes('vs'));

    let html = '';

    // Render Overall Winner Event
    if (winnerContracts.length > 0) {
        const teams = [...new Set(winnerContracts.map(p => {
            return TEAMS.find(t => p.title.includes(t)) || 'Other';
        }).filter(t => t !== 'Other'))];
        
        const scenarios = [...teams, 'Other'];

        html += `<div style="margin-bottom: 0.5rem; font-weight: bold; color: var(--text-main);">Event: World Cup Winner</div>`;
        html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; color: var(--text-main); margin-bottom: 1.5rem;">
            <thead>
                <tr style="border-bottom: 1px solid var(--panel-border);">
                    <th style="padding: 0.5rem; text-align: left;">Scenario (Winner)</th>
                    <th style="padding: 0.5rem; text-align: right;">Net P/L</th>
                </tr>
            </thead>
            <tbody>`;

        scenarios.forEach(scenario => {
            let netPl = 0;
            winnerContracts.forEach(pos => {
                const cost = pos.stake * pos.price;
                let paysOut = pos.title.includes(scenario);
                if (paysOut) {
                    netPl += (pos.stake * 1.00) - cost;
                } else {
                    netPl -= cost;
                }
            });

            const color = netPl >= 0 ? 'var(--polymarket-color)' : 'var(--secondary-accent)';
            const sign = netPl >= 0 ? '+' : '';
            html += `
                <tr style="border-bottom: 1px solid var(--panel-border); background: ${netPl > 0 ? 'rgba(16, 185, 129, 0.05)' : (netPl < 0 ? 'rgba(244, 63, 94, 0.05)' : 'transparent')}">
                    <td style="padding: 0.5rem; text-align: left;">${scenario} Wins</td>
                    <td style="padding: 0.5rem; text-align: right; color: ${color}; font-weight: 600;">${sign}$${netPl.toFixed(2)}</td>
                </tr>
            `;
        });
        html += `</tbody></table>`;
    }

    // Render Individual Match Events
    if (matchContracts.length > 0) {
        const matchEvents = {};
        matchContracts.forEach(p => {
            let teamsInMatch = [];
            const titleLower = p.title.toLowerCase();
            const vsIndex = titleLower.indexOf(' vs ');
            const vsDotIndex = titleLower.indexOf(' vs. ');
            
            const splitIndex = vsIndex !== -1 ? vsIndex : vsDotIndex;
            const splitLength = vsIndex !== -1 ? 4 : 5;

            if (splitIndex !== -1) {
                // Extract teams from surrounding "vs"
                let beforeVs = p.title.substring(0, splitIndex).replace(/event:\s*match\s+/i, '').replace(/match\s+/i, '').trim();
                let afterVsPart = p.title.substring(splitIndex + splitLength).trim();
                let afterVs = afterVsPart.split(/;|:|\(|-|,/)[0].trim();
                
                teamsInMatch = [beforeVs, afterVs];
            } else {
                teamsInMatch = TEAMS.filter(t => p.title.includes(t));
            }

            let matchKey = p.title;
            if (teamsInMatch.length >= 2) {
                matchKey = teamsInMatch[0] + ' vs ' + teamsInMatch[1];
                p._teamsInMatch = [teamsInMatch[0], teamsInMatch[1]];
            } else {
                p._teamsInMatch = teamsInMatch;
            }

            if (!matchEvents[matchKey]) matchEvents[matchKey] = [];
            matchEvents[matchKey].push(p);
        });

        for (const [matchKey, contracts] of Object.entries(matchEvents)) {
            // Get the teams from the first contract in this group
            let scenarios = [];
            const firstContract = contracts[0];
            if (firstContract._teamsInMatch && firstContract._teamsInMatch.length >= 2) {
                scenarios = [firstContract._teamsInMatch[0], firstContract._teamsInMatch[1], 'Tie'];
            } else {
                scenarios = ['Yes', 'No']; // fallback
            }

            html += `<div style="margin-bottom: 0.5rem; font-weight: bold; color: var(--text-main);">Event: Match ${matchKey}</div>`;
            html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; color: var(--text-main); margin-bottom: 1.5rem;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--panel-border);">
                        <th style="padding: 0.5rem; text-align: left;">Scenario</th>
                        <th style="padding: 0.5rem; text-align: right;">Net P/L</th>
                    </tr>
                </thead>
                <tbody>`;

            scenarios.forEach(scenario => {
                let netPl = 0;
                contracts.forEach(pos => {
                    const cost = pos.stake * pos.price;
                    let paysOut = false;
                    
                    const titleLower = pos.title.toLowerCase();
                    const scenarioLower = scenario.toLowerCase();

                    if (scenario === 'Tie') {
                        if (titleLower.includes('tie') || titleLower.includes('draw')) paysOut = true;
                    } else if (scenario === 'Yes' || scenario === 'No') {
                         if (scenario === 'Yes') paysOut = true;
                    } else {
                        // Determine if the contract pays out for this specific team winning
                        if (titleLower.includes('tie') || titleLower.includes('draw')) {
                            paysOut = false; // It's a tie contract, so a team winning means it loses
                        } else if (titleLower.includes(scenarioLower + ' win') || titleLower.includes(scenarioLower + ' advances')) {
                            paysOut = true; // Explicit win statement
                        } else {
                            // If no explicit 'wins' keyword, check if the scenario team is isolated in the outcome part
                            const parts = pos.title.split(';');
                            if (parts.length > 1) {
                                // The outcome is usually the part after the semicolon
                                const outcomePart = parts[parts.length - 1].toLowerCase();
                                if (outcomePart.includes(scenarioLower)) {
                                    paysOut = true;
                                }
                            } else {
                                // Default fallback if no delimiter exists: just check if name is in title 
                                // (Warning: if both names are in the title, it might payout for both if we reach this fallback)
                                if (titleLower.includes(scenarioLower)) paysOut = true;
                            }
                        }
                    }

                    if (paysOut) {
                        netPl += (pos.stake * 1.00) - cost;
                    } else {
                        netPl -= cost;
                    }
                });

                const color = netPl >= 0 ? 'var(--polymarket-color)' : 'var(--secondary-accent)';
                const sign = netPl >= 0 ? '+' : '';
                const scenarioText = scenario === 'Tie' ? 'Match Ties' : (scenario === 'Yes' || scenario === 'No' ? `Event resolves ${scenario}` : `${scenario} Wins Match`);
                
                html += `
                    <tr style="border-bottom: 1px solid var(--panel-border); background: ${netPl > 0 ? 'rgba(16, 185, 129, 0.05)' : (netPl < 0 ? 'rgba(244, 63, 94, 0.05)' : 'transparent')}">
                        <td style="padding: 0.5rem; text-align: left;">${scenarioText}</td>
                        <td style="padding: 0.5rem; text-align: right; color: ${color}; font-weight: 600;">${sign}$${netPl.toFixed(2)}</td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
        }
    }

    container.innerHTML = html;
};
