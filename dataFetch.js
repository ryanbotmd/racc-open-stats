// you could also npm install firebase and import the packages from 'firebase/app' and 'firebase/firestore'
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOZOQKH7slZ2fW_jjZEvFCH0T82EMBiVg",
    projectId: "raggooneropen",
    appId: "1:389145362446:web:907a5c2f2c30a11db97c5f"
};

// 3. Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// const tournamentsRef = collection(db, 'artifacts', 'default-app','public', 'data', 'tournaments');

async function renderTournaments() {
    try {
        const tournamentsRef = collection(db, 'artifacts', 'default-app','public', 'data', 'tournaments');

        const snapshot = await getDocs(query(tournamentsRef, orderBy('createdAt', 'asc')));
        const listContainer = document.getElementById("output");
        listContainer.innerHTML = "";

        if (snapshot.empty) {
            listContainer.innerHTML = "No tournaments found.";
            return;
        }

        //now shapshot holds the data for all tournaments
        snapshot.forEach(doc => {

            //this is the important bit. all the tournament data is in here now
            const t = doc.data();

            // 1. Create a container for this tournament
            const tournamentDiv = document.createElement("div");
            tournamentDiv.style.border = "2px solid #333";
            tournamentDiv.style.marginBottom = "20px";
            tournamentDiv.style.padding = "15px";

            // 2. Header info
            let htmlContent = `
                <h2 style="margin-top:0;">${t.name} <small>(${t.status})</small></h2>
                <p><strong>Stage:</strong> ${t.stage}</p>
            `;

            const playerMap = {};
            if (t.players && Array.isArray(t.players)) {
                t.players.forEach(p => {
                    playerMap[p.id] = { name: p.name, uma: p.uma };
                });
            }

            if (t.races && t.races.length > 0) {
                htmlContent += `<h3>Race Results</h3>`;
                htmlContent += `<table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">`;

                htmlContent += `<div>${t.password}</div>
                    <thead style="background-color: #f0f0f0;">
                        <tr>
                            <th>Race #</th>
                            <th>Group</th>
                            <th>Results (Rank: Name [Uma])</th>
                        </tr>
                    </thead>
                    <tbody>
                `;

                // 1. Define the custom order for groups
                const groupOrder = {
                    'A': 1,
                    'B': 2,
                    'C': 3,
                    'Finals': 4 // Finals will appear last
                };

                const sortedRaces = t.races.sort((a, b) => {
                    const rankA = groupOrder[a.group] || 99;
                    const rankB = groupOrder[b.group] || 99;

                    if (rankA !== rankB) {
                        return rankA - rankB; // Sort by Group Priority
                    }

                    // If groups are the same, sort by Race Number
                    return a.raceNumber - b.raceNumber;
                });

                sortedRaces.forEach(race => {
                    // Convert placements object { "p1": 1, "p2": 2 } into an array we can sort
                    // Result: [ ["p1", 1], ["p2", 2] ]
                    const resultsArray = Object.entries(race.placements || {});

                    // Sort by rank (value) so 1st place is first
                    resultsArray.sort((a, b) => a[1] - b[1]);

                    const resultString = resultsArray.map(([pid, rank]) => {
                        const pInfo = playerMap[pid] || { name: "Unknown", uma: "?" };
                        return `<strong>${rank}.</strong> ${pInfo.name} <span style="color:#666; font-size:0.9em;">[${pInfo.uma}]</span>`;
                    }).join('<br>'); // Use <br> to stack them, or ", " to list them

                    htmlContent += `
                        <tr>
                            <td style="text-align:center;"><strong>${race.raceNumber}</strong></td>
                            <td style="text-align:center;">${race.group}</td>
                            <td>${resultString}</td>
                        </tr>
                    `;
                });

                htmlContent += `</tbody></table>`;
            } else {
                htmlContent += `<p><em>No races recorded yet.</em></p>`;
            }

            tournamentDiv.innerHTML = htmlContent;
            listContainer.appendChild(tournamentDiv);
        });

    } catch (error) {
        console.error("Error:", error);
        document.getElementById("output").innerText = "Error loading data. Check console.";
    }
}

renderTournaments();