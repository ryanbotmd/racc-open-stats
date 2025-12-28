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

// --- Formatting Helper ---
function formatName(fullName) {
    if (!fullName.includes('(')) return fullName;
    const parts = fullName.split('(');
    const mainName = parts[0].trim();
    const variant = parts[1].replace(')', '').trim();
    return `${mainName} <span class="variant-tag">(${variant})</span>`;
}

// --- NEW: Calculate Points from Race Results ---
function getChampionshipPoints() {
    let stats = {};
    
    // Iterate over the detailed race results in data.js
    for (const [tournamentName, stages] of Object.entries(tournamentRaceResults)) {
        for (const [stageName, races] of Object.entries(stages)) {
            races.forEach((raceResult) => {
                raceResult.forEach((player, rankIndex) => {
                    // Skip placeholders if you haven't filled them yet
                    if(player.includes("Player")) return; 

                    if (!stats[player]) {
                        stats[player] = { points: 0, races: 0 };
                    }
                    if (rankIndex < POINTS_SYSTEM.length) {
                        stats[player].points += POINTS_SYSTEM[rankIndex];
                    }
                    stats[player].races += 1;
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
    
    // 1. Get Points Data (New Dominance Source)
    const pointsData = getChampionshipPoints();

    filteredData.forEach(row => activeTournaments.add(row.RawLength));

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

    // 5. Formatting
    const formatStats = (obj, type) => Object.values(obj).map(item => {
        // --- Win Rate % Calculation (Old Dominance) ---
        const winRateVal = item.totalRacesRun > 0 
            ? (item.wins / item.totalRacesRun * 100).toFixed(1) 
            : "0.0";

        // --- Dominance % Calculation (Points Based) ---
        let dominanceVal = "0.0";
        
        // Only calculate Points Dominance for Trainers (since we have the data)
        if (type === 'trainer' && pointsData[item.name]) {
            const p = pointsData[item.name];
            // Max points possible = Races Run * 25 (1st place points)
            const maxPoints = p.races * 25;
            if (maxPoints > 0) {
                dominanceVal = ((p.points / maxPoints) * 100).toFixed(1);
            }
        } else if (type === 'uma') {
            // For Umas, we stick to Win Rate as "Dom" for now until we have detailed uma race results
            dominanceVal = winRateVal; 
        }

        const stats = {
            ...item,
            displayName: formatName(item.name),
            winRate: winRateVal,    // Explicit Win Rate
            dom: dominanceVal       // Explicit Dominance (Points for Trainers, WR for Umas)
        };

        if (type === 'uma') {
            const tWinRate = item.picks > 0 ? (item.tourneyWins / item.picks * 100).toFixed(1) : "0.0";
            stats.tourneyStatsDisplay = `${tWinRate}% <span style="font-size:0.8em; color:#888">(${item.tourneyWins}/${item.picks})</span>`;
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
            if (col === 'winRate' || col === 'dom') return `<td>${row[col]}%</td>`;
            return `<td>${row[col]}</td>`;
        });
        return `<tr>${cells.join('')}</tr>`;
    }).join('');
}

function renderTierList(containerId, data, countKey, minReq) {
    const tiers = { S: [], A: [], B: [], C: [], D: [], F: [] };

    data.forEach(item => {
        if (item[countKey] < minReq) return;

        // Use 'dom' (Dominance) for Tier List calculation
        // For Trainers, this is now Points %. For Umas, it's still Win Rate %.
        const val = parseFloat(item.dom);
        
        let tier = 'D';
        if (val <= 5.0) tier = 'F';
        else if (val >= 60.0) tier = 'S'; 
        else if (val >= 45.0) tier = 'A';
        else if (val >= 30.0) tier = 'B';
        else if (val >= 15.0) tier = 'C';

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

    // Render Uma Table (Uses Win Rate as Dom for now)
    stats.umaStats.sort((a, b) => b.dom - a.dom);
    renderTable('umaTable', stats.umaStats, 
        ['name', 'picks', 'wins', 'winRate', 'tourneyStatsDisplay', 'banStatsDisplay']
    );

    // Render Trainer Table (Uses Points for Dom, WinRate for WR)
    // NOTE: We added 'winRate' and 'dom' to the columns list
    stats.trainerStats.sort((a, b) => b.dom - a.dom);
    renderTable('trainerTable', stats.trainerStats, 
        ['name', 'entries', 'wins', 'winRate', 'dom', 'tourneyStatsDisplay', 'favorite', 'ace']
    );

    renderTierList('umaTierList', stats.umaStats, 'picks', minEntries);
    renderTierList('trainerTierList', stats.trainerStats, 'entries', minEntries);
}

// --- Sorting, Theme, Init (Standard) ---
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

function renderStatsTable() {
    const data = calculateIndividualStats(); 
    // Uses the function you already had at the bottom of script.js
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

function calculateIndividualStats() {
    let stats = {};
    for (const [tournamentName, stages] of Object.entries(tournamentRaceResults)) {
        for (const [stageName, races] of Object.entries(stages)) {
            races.forEach((raceResult) => {
                raceResult.forEach((player, rankIndex) => {
                    if(player.includes("Player")) return;
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

window.onload = function() {
    const savedTheme = localStorage.getItem('siteTheme');
    if (savedTheme) {
        document.getElementById('themeSelector').value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
    }
    updateData();
    renderStatsTable();
};