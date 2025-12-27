// --- Helper: Distance Category ---
function getDistanceCategory(surfaceString) {
    const match = surfaceString.match(/(\d+)m/);
    if (!match) return "Unknown";
    const dist = parseInt(match[1]);

    if (dist <= 1400) return "Short";
    if (dist <= 1800) return "Mile";
    if (dist <= 2400) return "Medium";
    return "Long";
}

// --- Process Raw Data ---
// Uses 'compactData' from data.js
const rawData = compactData.map(r => {
    const distCat = getDistanceCategory(r[3]);
    return {
        Trainer: r[0],
        UniqueName: r[1],
        Wins: r[2],
        Surface: r[3],
        RawLength: r[4], // Tournament ID (e.g., "Open 1")
        DistanceCategory: distCat,
        UmaPick: r[5],
        Variant: r[6],
        WinShare: r[7]
    };
});

// --- UI Logic: Tabs ---
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    const tabs = document.querySelectorAll('.tab');
    if (tabId === 'tier-lists') tabs[0].classList.add('active');
    if (tabId === 'uma-stats') tabs[1].classList.add('active');
    if (tabId === 'trainer-stats') tabs[2].classList.add('active');
}

// --- Formatting Helper ---
function formatName(fullName) {
    if (!fullName.includes('(')) return fullName;
    const parts = fullName.split('(');
    const mainName = parts[0].trim();
    const variant = parts[1].replace(')', '').trim();
    return `${mainName} <span class="variant-tag">(${variant})</span>`;
}

// --- Core Logic: Statistics Calculation ---
function calculateStats(filteredData) {
    const umaMap = {};
    const trainerMap = {};

    // 1. Identify which tournaments are currently active based on filters
    // This allows us to calculate Ban Rate accurately (only for visible tournaments)
    const activeTournaments = new Set();
    filteredData.forEach(row => activeTournaments.add(row.RawLength));

    // 2. Process Race Data (Picks & Wins)
    filteredData.forEach(row => {
        // --- Uma Stats ---
        if (!umaMap[row.UniqueName]) { 
            umaMap[row.UniqueName] = { 
                name: row.UniqueName, 
                picks: 0, 
                wins: 0, 
                totalShare: 0, 
                tourneyWins: 0,
                bans: 0 // Initialize bans
            }; 
        }
        umaMap[row.UniqueName].picks++;
        umaMap[row.UniqueName].wins += row.Wins;
        umaMap[row.UniqueName].totalShare += row.WinShare;

        // Check tourney wins
        // (This naturally filters because filteredData only contains active rows)
        if (typeof tournamentWinners !== 'undefined' && tournamentWinners[row.RawLength]) {
            if (tournamentWinners[row.RawLength].includes(row.Trainer)) {
                umaMap[row.UniqueName].tourneyWins++;
            }
        }

        // --- Trainer Stats ---
        if (!trainerMap[row.Trainer]) {
            trainerMap[row.Trainer] = {
                name: row.Trainer,
                entries: 0,
                wins: 0,
                totalShare: 0,
                characterHistory: {},
                playedTourneys: new Set(),
                tournamentWins: 0
            };
        }

        let t = trainerMap[row.Trainer];
        t.entries++;
        t.wins += row.Wins;
        t.totalShare += row.WinShare;
        t.playedTourneys.add(row.RawLength);

        if (!t.characterHistory[row.UniqueName]) {
            t.characterHistory[row.UniqueName] = { picks: 0, wins: 0 };
        }
        t.characterHistory[row.UniqueName].picks++;
        t.characterHistory[row.UniqueName].wins += row.Wins;
    });

    // 3. Process Trainer Tourney Wins
    Object.values(trainerMap).forEach(t => {
        t.playedTourneys.forEach(tourneyID => {
            if (typeof tournamentWinners !== 'undefined' && tournamentWinners[tourneyID]) {
                if (tournamentWinners[tourneyID].includes(t.name)) {
                    t.tournamentWins++;
                }
            }
        });
    });

    // 4. Process Bans (DYNAMICALLY FILTERED)
    // We only count bans if the tournament they belong to is currently in 'activeTournaments'
    let validBanTourneyCount = 0;

    if (typeof tournamentBans !== 'undefined') {
        Object.keys(tournamentBans).forEach(tourneyID => {
            // CRITICAL CHECK: Only process bans if this tournament matches our filters
            if (activeTournaments.has(tourneyID)) {
                validBanTourneyCount++; 
                
                const banList = tournamentBans[tourneyID];
                banList.forEach(umaName => {
                    // Ensure Uma exists in map (even if 0 picks)
                    if (!umaMap[umaName]) {
                        umaMap[umaName] = { 
                            name: umaName, 
                            picks: 0, wins: 0, totalShare: 0, tourneyWins: 0, 
                            bans: 0 
                        };
                    }
                    umaMap[umaName].bans++;
                });
            }
        });
    }

    // 5. Formatting for Display
    const formatStats = (obj, type) => Object.values(obj).map(item => {
        const stats = {
            ...item,
            displayName: formatName(item.name),
            dom: item[type === 'uma' ? 'picks' : 'entries'] > 0 
                 ? (item.totalShare / item[type === 'uma' ? 'picks' : 'entries'] * 100).toFixed(1) 
                 : 0
        };

        if (type === 'uma') {
            // Tourney Win Rate
            const tWinRate = item.picks > 0 ? (item.tourneyWins / item.picks * 100).toFixed(1) : "0.0";
            stats.tourneyStatsDisplay = `${tWinRate}% <span style="font-size:0.8em; color:#888">(${item.tourneyWins}/${item.picks})</span>`;

            // Ban Rate (Uses validBanTourneyCount as denominator)
            const banRate = validBanTourneyCount > 0 ? (item.bans / validBanTourneyCount * 100).toFixed(1) : "0.0";
            stats.banStatsDisplay = `${banRate}% <span style="font-size:0.8em; color:#888">(${item.bans}/${validBanTourneyCount})</span>`;
        }

        if (type === 'trainer') {
            const tourneyCount = item.playedTourneys.size;
            const tWinRate = tourneyCount > 0 ? (item.tournamentWins / tourneyCount * 100).toFixed(1) : "0.0";
            stats.tourneyStatsDisplay = `${tWinRate}% <span style="font-size:0.8em; color:#888">(${item.tournamentWins}/${tourneyCount})</span>`;

            const historyArr = Object.entries(item.characterHistory).map(([key, val]) => ({ name: key, ...val }));
            
            historyArr.sort((a, b) => b.picks - a.picks);
            const fav = historyArr[0];
            stats.favorite = fav ? `${formatName(fav.name)} <span class="stat-badge">x${fav.picks}</span>` : '-';

            historyArr.sort((a, b) => b.wins - a.wins || a.picks - b.picks);
            const best = historyArr[0];
            stats.ace = (best && best.wins > 0) ? `${formatName(best.name)} <span class="stat-badge win-badge">★${best.wins}</span>` : '<span style="color:#666">-</span>';
        }

        return stats;
    });

    return {
        umaStats: formatStats(umaMap, 'uma'),
        trainerStats: formatStats(trainerMap, 'trainer')
    };
}

// --- Render Functions ---
function renderTable(tableId, data, columns) {
    const tbody = document.querySelector(`#${tableId} tbody`);

    tbody.innerHTML = data.map(row => {
        const cells = columns.map(col => {
            if (col === 'name') return `<td>${row.displayName}</td>`;
            return `<td>${row[col]}</td>`;
        });
        return `<tr>${cells.join('')}</tr>`;
    }).join('');
}

function renderTierList(containerId, data, countKey, minReq) {
    const tiers = { S: [], A: [], B: [], C: [], D: [], F: [] };

    data.forEach(item => {
        if (item[countKey] < minReq) return;

        const val = parseFloat(item.dom);
        let tier = 'D';
        if (val <= 1.0) tier = 'F';
        else if (val >= 12.0) tier = 'S';
        else if (val >= 8.0) tier = 'A';
        else if (val >= 5.0) tier = 'B';
        else if (val >= 2.0) tier = 'C';

        tiers[tier].push(item);
    });

    const container = document.getElementById(containerId);
    let html = '';

    ['S', 'A', 'B', 'C', 'D', 'F'].forEach(tier => {
        if (tiers[tier].length === 0 && tier !== 'S') return;

        tiers[tier].sort((a, b) => b.dom - a.dom);

        html += `
            <div class="tier-row">
                <div class="tier-label tier-${tier}">${tier}</div>
                <div class="tier-content">
                    ${tiers[tier].map(i => `<span class="tier-item">${i.displayName} <b>${i.dom}%</b></span>`).join('')}
                </div>
            </div>`;
    });

    if (html === '') html = '<div style="padding:20px; color:#888;">No data meets the criteria.</div>';

    container.innerHTML = html;
}

function updateData() {
    const surface = document.getElementById('surfaceFilter').value;
    const length = document.getElementById('lengthFilter').value;
    const minEntries = document.getElementById('minEntries').value;

    document.getElementById('minEntriesVal').textContent = minEntries;

    const filtered = rawData.filter(d => {
        const surfaceMatch = (surface === 'All' || d.Surface.includes(surface));
        const lengthMatch = (length === 'All' || d.DistanceCategory === length);
        return surfaceMatch && lengthMatch;
    });

    const stats = calculateStats(filtered);

    // Render Uma Table (Sorted by Dom%, includes new Ban Stats column)
    stats.umaStats.sort((a, b) => b.dom - a.dom);
    renderTable('umaTable', stats.umaStats, 
        ['name', 'picks', 'wins', 'dom', 'tourneyStatsDisplay', 'banStatsDisplay']
    );

    // Render Trainer Table
    stats.trainerStats.sort((a, b) => b.dom - a.dom);
    renderTable('trainerTable', stats.trainerStats, 
        ['name', 'entries', 'wins', 'dom', 'tourneyStatsDisplay', 'favorite', 'ace']
    );

    renderTierList('umaTierList', stats.umaStats, 'picks', minEntries);
    renderTierList('trainerTierList', stats.trainerStats, 'entries', minEntries);
}

// --- Sorting & Utils ---
let sortState = {};
function sortTable(tableId, colIndex, isNumeric = false) {
    const key = tableId + colIndex;
    sortState[key] = !sortState[key];
    const tbody = document.querySelector(`#${tableId} tbody`);
    const rows = Array.from(tbody.rows);

    rows.sort((a, b) => {
        let x = a.cells[colIndex].innerText;
        let y = b.cells[colIndex].innerText;

        if (isNumeric) {
            // Clean up string to number (handles "100%" or "50% (1/2)")
            x = parseFloat(x.split(' ')[0].replace(/[^\d.-]/g, ''));
            y = parseFloat(y.split(' ')[0].replace(/[^\d.-]/g, ''));
        }
        if (isNaN(x)) x = 0; if (isNaN(y)) y = 0;
        return sortState[key] ? (x < y ? -1 : 1) : (x > y ? -1 : 1);
    });

    tbody.append(...rows);
}

function switchTheme() {
    const theme = document.getElementById('themeSelector').value;
    
    if (theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('siteTheme', theme);
    } else {
        document.body.removeAttribute('data-theme');
        localStorage.removeItem('siteTheme');
    }
}

window.onload = function() {
    const savedTheme = localStorage.getItem('siteTheme');
    if (savedTheme) {
        document.getElementById('themeSelector').value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
    }

    updateData();
};



function calculateIndividualStats() {
    let stats = {};

    // 1. Loop through every Tournament
    for (const [tournamentName, stages] of Object.entries(tournamentRaceResults)) {
        
        // 2. Loop through every Stage (Group A, Group B, Finals)
        for (const [stageName, races] of Object.entries(stages)) {
            
            // 3. Loop through every Race
            races.forEach((raceResult) => {
                
                // 4. Loop through players in that race
                raceResult.forEach((player, rankIndex) => {
                    // Initialize player if not exists
                    if (!stats[player]) {
                        stats[player] = { 
                            name: player, 
                            totalPoints: 0, 
                            racesRun: 0 
                        };
                    }

                    // Assign Points (If rank is within 1-10)
                    if (rankIndex < POINTS_SYSTEM.length) {
                        stats[player].totalPoints += POINTS_SYSTEM[rankIndex];
                    }

                    // Increment race count for Average calc
                    stats[player].racesRun += 1;
                });
            });
        }
    }

    // 5. Convert to Array and Calculate Average
    const leaderboard = Object.values(stats).map(player => {
        return {
            name: player.name,
            totalPoints: player.totalPoints,
            racesRun: player.racesRun,
            // Calculate Avg and round to 2 decimals
            avgPoints: (player.totalPoints / player.racesRun).toFixed(2)
        };
    });

    // 6. Sort by Total Points (Highest to Lowest)
    return leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
}

function renderStatsTable() {
    const data = calculateIndividualStats();
    const tbody = document.getElementById('points-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    data.forEach((player, index) => {
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${player.name}</td>
                <td>${player.racesRun}</td> <td>${player.totalPoints}</td>
                <td>${player.avgPoints}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    renderStatsTable();
});
