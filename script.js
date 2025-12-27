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

    // 1. Process Race Data (Picks & Wins)
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

        // Check if this Uma was on a winning team
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

    // 2. Process Trainer Tourney Wins
    Object.values(trainerMap).forEach(t => {
        t.playedTourneys.forEach(tourneyID => {
            if (typeof tournamentWinners !== 'undefined' && tournamentWinners[tourneyID]) {
                if (tournamentWinners[tourneyID].includes(t.name)) {
                    t.tournamentWins++;
                }
            }
        });
    });

    // 3. Process Bans
    // We count how many tournaments actually have ban data to calculate a fair percentage
    const totalBanTourneys = (typeof tournamentBans !== 'undefined') ? Object.keys(tournamentBans).length : 0;

    if (typeof tournamentBans !== 'undefined') {
        Object.values(tournamentBans).forEach(banList => {
            banList.forEach(umaName => {
                // If banned Uma was never picked, create a new entry for them so they show up
                if (!umaMap[umaName]) {
                    umaMap[umaName] = { 
                        name: umaName, 
                        picks: 0, wins: 0, totalShare: 0, tourneyWins: 0, 
                        bans: 0 
                    };
                }
                umaMap[umaName].bans++;
            });
        });
    }

    // 4. Formatting for Display
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

            // Ban Rate
            const banRate = totalBanTourneys > 0 ? (item.bans / totalBanTourneys * 100).toFixed(1) : "0.0";
            stats.banStatsDisplay = `${banRate}% <span style="font-size:0.8em; color:#888">(${item.bans}/${totalBanTourneys})</span>`;
        }

        if (type === 'trainer') {
            // Trainer Tourney Win Rate
            const tourneyCount = item.playedTourneys.size;
            const tWinRate = tourneyCount > 0 ? (item.tournamentWins / tourneyCount * 100).toFixed(1) : "0.0";
            stats.tourneyStatsDisplay = `${tWinRate}% <span style="font-size:0.8em; color:#888">(${item.tournamentWins}/${tourneyCount})</span>`;

            // Favorites & Aces
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

    // Render Uma Table (Updated to include Ban Stats)
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
