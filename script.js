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
const rawData = compactData.map(r => {
    const distCat = getDistanceCategory(r[3]);
    return {
        Trainer: r[0],
        UniqueName: r[1],
        Wins: r[2],
        Surface: r[3],
        RawLength: r[4], 
        DistanceCategory: distCat,
        UmaPick: r[5],
        Variant: r[6],
        RacesRun: r[7] 
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
    if (tabId === 'championship') tabs[3].classList.add('active');
}

// --- Tier List View Switcher (Slider Logic) ---
function setTierView(index) {
    const buttons = document.querySelectorAll('.switch-option');
    buttons.forEach((btn, i) => {
        if (i === index) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const glider = document.getElementById('tierGlider');
    if(glider) glider.style.transform = `translateX(${index * 100}%)`;

    const views = ['view-wr', 'view-dom', 'view-champ'];
    views.forEach((viewId, i) => {
        const el = document.getElementById(viewId);
        if(el) {
            if (i === index) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
}

// --- Formatting Helper ---
function formatName(fullName) {
    if (!fullName.includes('(')) return fullName;
    const parts = fullName.split('(');
    const mainName = parts[0].trim();
    const variant = parts[1].replace(')', '').trim();
    return `${mainName} <span class="variant-tag">(${variant})</span>`;
}

// --- NEW: Calculate Points & Beat Rate (Respects Filters) ---
function getChampionshipPoints(activeTournaments, filteredData) {
    let stats = { trainer: {}, uma: {} };
    
    // 1. Create a Map to link Trainer+Tourney -> UmaName
    const lookupMap = {};
    filteredData.forEach(row => {
        const key = `${row.RawLength}_${row.Trainer}`;
        lookupMap[key] = row.UniqueName;
    });

    // 2. Iterate detailed race results
    for (const [tournamentName, stages] of Object.entries(tournamentRaceResults)) {
        if (!activeTournaments.has(tournamentName)) continue;

        for (const [stageName, races] of Object.entries(stages)) {
            races.forEach((raceResult) => {
                // AUTOMAGIC: Count participants to determine lobby difficulty
                const lobbySize = raceResult.length; 
                const possibleOpponents = lobbySize - 1;

                raceResult.forEach((player, rankIndex) => {
                    // Filter out placeholders and DQ
                    if (player.includes("Player") || player === "DQ") return; 

                    // Beat Rate Math: If you are 1st (Index 0) in 5-man race, you beat 4 people.
                    const opponentsBeaten = (lobbySize - 1) - rankIndex;

                    // --- A. Process Trainer ---
                    if (!stats.trainer[player]) {
                        stats.trainer[player] = { points: 0, races: 0, beaten: 0, totalOpp: 0 };
                    }
                    if (rankIndex < POINTS_SYSTEM.length) {
                        stats.trainer[player].points += POINTS_SYSTEM[rankIndex];
                    }
                    stats.trainer[player].races += 1;
                    stats.trainer[player].beaten += opponentsBeaten;
                    stats.trainer[player].totalOpp += possibleOpponents;

                    // --- B. Process Uma (via Lookup) ---
                    const key = `${tournamentName}_${player}`;
                    const umaName = lookupMap[key];
                    
                    if (umaName) {
                        if (!stats.uma[umaName]) {
                            stats.uma[umaName] = { points: 0, races: 0, beaten: 0, totalOpp: 0 };
                        }
                        if (rankIndex < POINTS_SYSTEM.length) {
                            stats.uma[umaName].points += POINTS_SYSTEM[rankIndex];
                        }
                        stats.uma[umaName].races += 1;
                        stats.uma[umaName].beaten += opponentsBeaten;
                        stats.uma[umaName].totalOpp += possibleOpponents;
                    }
                });
            });
        }
    }
    return stats;
}

// --- Core Logic: Statistics Calculation ---
function calculateStats(filteredData) {
    const umaMap = {};
    const trainerMap = {};
    const activeTournaments = new Set();
    
    filteredData.forEach(row => activeTournaments.add(row.RawLength));

    // 1. Get Points & Beat Rate Data
    const pointsData = getChampionshipPoints(activeTournaments, filteredData);

    // 2. Process Basic Data
    filteredData.forEach(row => {
        // --- Uma Stats ---
        if (!umaMap[row.UniqueName]) { 
            umaMap[row.UniqueName] = { 
                name: row.UniqueName, 
                picks: 0, wins: 0, totalRacesRun: 0, tourneyWins: 0, bans: 0 
            }; 
        }
        umaMap[row.UniqueName].picks++;
        umaMap[row.UniqueName].wins += row.Wins;
        umaMap[row.UniqueName].totalRacesRun += row.RacesRun;

        if (typeof tournamentWinners !== 'undefined' && tournamentWinners[row.RawLength]) {
            if (tournamentWinners[row.RawLength].includes(row.Trainer)) {
                umaMap[row.UniqueName].tourneyWins++;
            }
        }

        // --- Trainer Stats ---
        if (!trainerMap[row.Trainer]) {
            trainerMap[row.Trainer] = {
                name: row.Trainer,
                entries: 0, wins: 0, totalRacesRun: 0, 
                characterHistory: {}, playedTourneys: new Set(), tournamentWins: 0
            };
        }

        let t = trainerMap[row.Trainer];
        t.entries++;
        t.wins += row.Wins;
        t.totalRacesRun += row.RacesRun;
        t.playedTourneys.add(row.RawLength);

        if (!t.characterHistory[row.UniqueName]) {
            t.characterHistory[row.UniqueName] = { picks: 0, wins: 0 };
        }
        t.characterHistory[row.UniqueName].picks++;
        t.characterHistory[row.UniqueName].wins += row.Wins;
    });

    // 3. Process Tourney Wins
    Object.values(trainerMap).forEach(t => {
        t.playedTourneys.forEach(tourneyID => {
            if (typeof tournamentWinners !== 'undefined' && tournamentWinners[tourneyID]) {
                if (tournamentWinners[tourneyID].includes(t.name)) {
                    t.tournamentWins++;
                }
            }
        });
    });

    // 4. Process Bans
    let validBanTourneyCount = 0;
    if (typeof tournamentBans !== 'undefined') {
        Object.keys(tournamentBans).forEach(tourneyID => {
            if (activeTournaments.has(tourneyID)) {
                validBanTourneyCount++; 
                const banList = tournamentBans[tourneyID];
                banList.forEach(umaName => {
                    if (!umaMap[umaName]) {
                        umaMap[umaName] = { 
                            name: umaName, picks: 0, wins: 0, totalRacesRun: 0, tourneyWins: 0, bans: 0 
                        };
                    }
                    umaMap[umaName].bans++;
                });
            }
        });
    }

    // 5. Formatting Helper
    const formatItem = (item, type) => {
        // A. Win Rate %
        const winRateVal = item.totalRacesRun > 0 
            ? (item.wins / item.totalRacesRun * 100).toFixed(1) 
            : "0.0";

        // B. Dominance % (NOW: Beat Rate Calculation)
        let dominanceVal = "0.0";
        const pStats = type === 'trainer' ? pointsData.trainer[item.name] : pointsData.uma[item.name];
        
        if (pStats && pStats.totalOpp > 0) {
            // Formula: (Opponents Beaten / Total Opponents Faced) * 100
            dominanceVal = ((pStats.beaten / pStats.totalOpp) * 100).toFixed(1);
        }

        // C. Tourney Win %
        let tWinPct = "0.0";
        if (type === 'uma') {
            tWinPct = item.picks > 0 ? (item.tourneyWins / item.picks * 100).toFixed(1) : "0.0";
        } else {
            const tourneyCount = item.playedTourneys.size;
            tWinPct = tourneyCount > 0 ? (item.tournamentWins / tourneyCount * 100).toFixed(1) : "0.0";
        }

        const stats = {
            ...item,
            displayName: formatName(item.name),
            winRate: winRateVal,
            dom: dominanceVal,
            tourneyWinPct: tWinPct
        };

        if (type === 'uma') {
            stats.tourneyStatsDisplay = `${tWinPct}% <span style="font-size:0.8em; color:#888">(${item.tourneyWins}/${item.picks})</span>`;
            const banRate = validBanTourneyCount > 0 ? (item.bans / validBanTourneyCount * 100).toFixed(1) : "0.0";
            stats.banStatsDisplay = `${banRate}% <span style="font-size:0.8em; color:#888">(${item.bans}/${validBanTourneyCount})</span>`;
        }

        if (type === 'trainer') {
            stats.tourneyStatsDisplay = `${tWinPct}% <span style="font-size:0.8em; color:#888">(${item.tournamentWins}/${item.playedTourneys.size})</span>`;
            const historyArr = Object.entries(item.characterHistory).map(([key, val]) => ({ name: key, ...val }));
            historyArr.sort((a, b) => b.picks - a.picks);
            const fav = historyArr[0];
            stats.favorite = fav ? `${formatName(fav.name)} <span class="stat-badge">x${fav.picks}</span>` : '-';
            historyArr.sort((a, b) => b.wins - a.wins || a.picks - b.picks);
            const best = historyArr[0];
            stats.ace = (best && best.wins > 0) ? `${formatName(best.name)} <span class="stat-badge win-badge">★${best.wins}</span>` : '<span style="color:#666">-</span>';
        }

        return stats;
    };

    return {
        umaStats: Object.values(umaMap).map(i => formatItem(i, 'uma')),
        trainerStats: Object.values(trainerMap).map(i => formatItem(i, 'trainer'))
    };
}

// --- Render Functions ---
function renderTable(tableId, data, columns) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = data.map(row => {
        const cells = columns.map(col => {
            if (col === 'name') return `<td>${row.displayName}</td>`;
            if (col === 'winRate' || col === 'dom' || col === 'tourneyWinPct') return `<td>${row[col]}%</td>`;
            return `<td>${row[col]}</td>`;
        });
        return `<tr>${cells.join('')}</tr>`;
    }).join('');
}

// Updated Generic Tier List Render
function renderTierList(containerId, data, countKey, minReq, sortKey) {
    const tiers = { S: [], A: [], B: [], C: [], D: [], F: [] };

    data.forEach(item => {
        if (item[countKey] < minReq) return;

        const val = parseFloat(item[sortKey]); 
        let tier = 'D';
        
        // Thresholds based on metrics
        if (sortKey === 'winRate') {
             if (val <= 1.0) tier = 'F';
             else if (val >= 25.0) tier = 'S'; 
             else if (val >= 15.0) tier = 'A';
             else if (val >= 10.0) tier = 'B';
             else if (val >= 5.0) tier = 'C';
        } else if (sortKey === 'tourneyWinPct') {
             if (val <= 0.0) tier = 'F';
             else if (val >= 25.0) tier = 'S';
             else if (val >= 15.0) tier = 'A';
             else if (val >= 10.0) tier = 'B';
             else if (val >= 5.0) tier = 'C';
        } else {
            // New Dominance (Beat Rate) Thresholds
            // Beat Rate is usually higher than points %, so we adjust up slightly
            if (val <= 20.0) tier = 'F';
            else if (val >= 80.0) tier = 'S'; 
            else if (val >= 65.0) tier = 'A';
            else if (val >= 50.0) tier = 'B';
            else if (val >= 35.0) tier = 'C';
        }

        tiers[tier].push(item);
    });

    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '';

    ['S', 'A', 'B', 'C', 'D', 'F'].forEach(tier => {
        if (tiers[tier].length === 0 && tier !== 'S') return;
        tiers[tier].sort((a, b) => b[sortKey] - a[sortKey]);
        html += `
            <div class="tier-row">
                <div class="tier-label tier-${tier}">${tier}</div>
                <div class="tier-content">
                    ${tiers[tier].map(i => `<span class="tier-item">${i.displayName} <b>${i[sortKey]}%</b></span>`).join('')}
                </div>
            </div>`;
    });

    if (html === '') html = '<div style="padding:20px; color:#888;">No data.</div>';
    container.innerHTML = html;
}

function updateData() {
    const surface = document.getElementById('surfaceFilter').value;
    const length = document.getElementById('lengthFilter').value;
    const minEntries = document.getElementById('minEntries').value;

    document.getElementById('minEntriesVal').textContent = minEntries;

    const filtered = rawData.filter(d => {
        // Exclude DQ from stats tables
        if (d.Trainer === "DQ") return false;

        const surfaceMatch = (surface === 'All' || d.Surface.includes(surface));
        const lengthMatch = (length === 'All' || d.DistanceCategory === length);
        return surfaceMatch && lengthMatch;
    });

    const stats = calculateStats(filtered);

    // Sort Tables
    stats.umaStats.sort((a, b) => b.dom - a.dom);
    renderTable('umaTable', stats.umaStats, 
        ['name', 'picks', 'wins', 'winRate', 'dom', 'tourneyStatsDisplay', 'banStatsDisplay']
    );

    stats.trainerStats.sort((a, b) => b.dom - a.dom);
    renderTable('trainerTable', stats.trainerStats, 
        ['name', 'entries', 'wins', 'winRate', 'dom', 'tourneyStatsDisplay', 'favorite', 'ace']
    );

    // --- Render the 3 Separate Tier Lists ---
    renderTierList('umaTierListWR', stats.umaStats, 'picks', minEntries, 'winRate');
    renderTierList('trainerTierListWR', stats.trainerStats, 'entries', minEntries, 'winRate');

    renderTierList('umaTierListDom', stats.umaStats, 'picks', minEntries, 'dom');
    renderTierList('trainerTierListDom', stats.trainerStats, 'entries', minEntries, 'dom');

    renderTierList('umaTierListChamp', stats.umaStats, 'picks', minEntries, 'tourneyWinPct');
    renderTierList('trainerTierListChamp', stats.trainerStats, 'entries', minEntries, 'tourneyWinPct');
}

// --- Sorting, Theme, Init ---
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

// Calculate total unfiltered stats for the Championship Tab
function calculateIndividualStats() {
    let stats = {};
    for (const [tournamentName, stages] of Object.entries(tournamentRaceResults)) {
        for (const [stageName, races] of Object.entries(stages)) {
            races.forEach((raceResult) => {
                raceResult.forEach((player, rankIndex) => {
                    // Filter out "Player" placeholder AND "DQ"
                    if (player.includes("Player") || player === "DQ") return;

                    if (!stats[player]) { stats[player] = { name: player, totalPoints: 0, racesRun: 0 }; }
                    if (rankIndex < POINTS_SYSTEM.length) { stats[player].totalPoints += POINTS_SYSTEM[rankIndex]; }
                    stats[player].racesRun += 1;
                });
            });
        }
    }
    const leaderboard = Object.values(stats).map(player => {
        return {
            name: player.name,
            totalPoints: player.totalPoints,
            racesRun: player.racesRun,
            avgPoints: (player.totalPoints / player.racesRun).toFixed(2)
        };
    });
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

window.onload = function() {
    const savedTheme = localStorage.getItem('siteTheme');
    if (savedTheme) {
        document.getElementById('themeSelector').value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
    }
    updateData();
    renderStatsTable();
};
