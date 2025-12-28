# 🦝 Racc Open Analysis Dashboard

A lightweight, browser-based dashboard for analyzing *Uma Musume Pretty Derby* tournament statistics. This tool visualizes pick rates, win rates, ban rates, and tier lists for custom community tournaments.

## ✨ Features

* **📊 Dynamic Tier Lists:** Automatically generates S-F tier lists based on **True Win Rate** (Wins / Races Run) for both Umas and Trainers.
* **📈 Comprehensive Statistics:**
    * **Uma Stats:** Picks, Race Wins, True Win Rate %, Tournament Win %, and Ban Rate.
    * **Trainer Stats:** Entries, Race Wins, True Win Rate %, Most Used Uma, and "Ace" (Best Performing) Uma.
* **🔍 Filtering:** Filter data by **Surface** (Turf/Dirt) and **Distance** (Short/Mile/Medium/Long).
* **🎨 Theming:** Includes 9 distinct color themes (Default Dark, Ram, Rem, Miku, etc.) with local storage persistence.
* **📱 Responsive Design:** Optimized for both desktop and mobile viewing.

## 🚀 Setup & Usage

No installation required! This is a static site.

### Method 1: GitHub Pages (Recommended)
1.  Fork or clone this repository.
2.  Enable **GitHub Pages** in your repository settings (Settings -> Pages -> Source: `main`).
3.  Visit the provided URL to see your dashboard live.

### Method 2: Local Usage
1.  Download all files (`index.html`, `script.js`, `style.css`, `data.js`).
2.  Open `index.html` in any web browser.

## 📂 Project Structure

* `index.html`: The main dashboard structure and layout.
* `style.css`: All visual styling and theme definitions.
* `script.js`: The logic engine. Calculates stats, processes filters, and renders tables.
* `data.js`: The raw database file. **(Edit this to add new results!)**

## 📝 How to Update Data

All data is stored in `data.js`. To add new tournament results, you need to update three sections:

### 1. Add Race Results (`compactData`)
Add rows to the `compactData` array. Each row represents **one entry** in a race.

**Note:** The last number is **Races Run**, representing the actual number of races the character participated in (e.g., 5 for Group Stage exit, 10 or 15 for Finals).

```javascript
const compactData = [
  // [Trainer, Uma Name, Wins, Surface, Tournament ID, Base Name, Variant, Races Run]
  ["TrainerName", "Oguri Cap (Christmas)", 1, "2500m Turf (R)", "Open 28", "Oguri Cap", "Christmas", 5],
  ["TrainerName", "Gold Ship (Original)", 3, "2500m Turf (R)", "Open 28", "Gold Ship", "Original", 10],
  ...
];
```

### 2. Add Team Winners (`tournamentWinners`)
To calculate "Tournament Win %", define the winning team (list of trainer names) for specific tournament IDs.

```javascript
const tournamentWinners = {
    "Open 1": ["Cookie", "Jess", "Potato"],
    "Open 28": ["Marie", "Mika", "Aria"]
};
```

### 3. Add Bans (`tournamentBans`)
To calculate "Ban Rate", list the Umas banned in specific tournaments. **Note:** Names must match the names in `compactData` exactly (including variants).

```javascript
const tournamentBans = {
    "Open 28": ["Vodka (Original)", "Maruzensky (Summer)"],
    "Open 7": ["Seiun Sky (Original)"]
};
```

## 🛠 Customization

### Changing Tier Thresholds
The tier list logic is located in `script.js` inside the `renderTierList` function. You can adjust the percentages required for each tier. Current defaults are based on **Win Rate** (Wins / Races Run):

* **S Tier:** ≥ 20.0% Win Rate
* **A Tier:** ≥ 12.0% Win Rate
* **B Tier:** ≥ 8.0% Win Rate
* **C Tier:** ≥ 4.0% Win Rate

### Adding Themes
Themes are defined in `style.css`. You can add new color schemes by creating a new `[data-theme="name"]` block and defining the primary, secondary, and background colors.

## 📜 License
MIT License. Free to use and modify for your own tournament communities.

## ⚖️ Disclaimer & Copyrights

This project is a fan-made tool and is not affiliated with, endorsed, sponsored, or specifically approved by **Cygames, Inc.** or the *Uma Musume Pretty Derby* franchise.

* **Code:** The source code (HTML, CSS, JS) of this dashboard is licensed under the **MIT License**.
* **Assets:** All character names, game concepts, and related intellectual property belong to their respective owners.
