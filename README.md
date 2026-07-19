<p align="center">
  <img src="apps/extension/assets/icon128.png" width="96" height="96" alt="PoE2 My Watch icon">
</p>

# PoE2 My Watch

**English** | [日本語](./README.ja.md)

PoE2 My Watch is a Chrome extension for saving and organizing your official Path of Exile 2 trade search links. Give each search a clear name, keep searches separated by league, and reopen the original trade page whenever you need it.

Each saved search can optionally collect price snapshots, helping you see how its visible listings change over time.

## What you can do

- Save an official PoE2 trade search as a watch.
- Rename watches so important searches are easy to find.
- Filter dashboard and popup watch lists by part of a watch name.
- Review the league, query ID, source link, and captured filter summary.
- Reopen the original official trade search from the popup or dashboard.
- Remove a watch together with its optional saved history.
- Optionally show your watch names as the browser tab titles on matching official trade pages. This is on by default and can be turned off globally.
- Optionally compare recent median prices, listing counts, and price distributions.
- Optionally view prices in Auto, Exalted, Divine, Chaos, or Mirror for each watch.
- Use the extension in English or Japanese based on your browser language.

## Screenshots

### Popup

<p align="center">
  <img src="docs/images/popup-watch-list.png" width="360" alt="PoE2 My Watch popup showing a filtered watch list and selected watch details">
</p>

### Dashboard

![PoE2 My Watch dashboard showing saved trade searches and price distribution history](docs/images/dashboard-price-history.png)

## Install

1. Download `poe2-my-watch-vX.Y.Z.zip` from [GitHub Releases](../../releases/latest).
2. Extract the ZIP file.
3. Open `chrome://extensions` in Chrome or Chromium.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
6. Open an official PoE2 trade search page.

## Save and organize a trade search

1. Create or open a search on the official PoE2 trade site.
2. Open the search conditions. Results are not required to create a watch.
3. Select **Save watch** in the bottom-right corner.
4. Open the extension from the browser toolbar.
5. Edit the watch name to give the search a useful name. Press Enter or move focus away to save it.
6. Matching trade tabs use watch names by default. Turn **Use watch names on trade tabs** off in the popup or dashboard if you prefer the official page titles.
7. Select **Trade search** whenever you want to reopen the original link.

Open **Dashboard** to see all saved watches, review their search conditions, and use optional price history in a larger view.

Matching trade tabs use your watch name once the search is ready. Pages without a saved watch keep the official page title.

## Price history

Saving the same watch again adds another observation to its history. The extension shows:

- the latest minimum and median price;
- visible and priced listing counts;
- recent median history in the popup;
- min, p10, median, p90, and max as a box plot in the dashboard;
- a sample of listings from the latest snapshot.

Prices remain available when automatic currency conversion cannot be used. The extension shows the available currency and clearly identifies history points that cannot be compared in one display currency.

## Your data

- Watches and snapshots are stored locally in the extension.
- Official-site credentials such as `POESESSID` are not stored or sent.
- Currency conversion uses only the league name with POE2 Scout; your watch data is not uploaded.
- Removing the extension may also remove its saved watches and history.

## Troubleshooting

### The button says “Reload page”

The extension was reloaded while the trade page was already open. **Reload page** remains on the save button until you reload that trade page. Then save the watch again.

### The popup does not open after saving

The watch may still have been saved. Chrome can block automatic popup opening, so open PoE2 My Watch from the browser toolbar.

## Current limitations

- Updates are manual; saving a watch records the listings currently visible on the page.
- A snapshot represents visible listings, not the entire market.
- Some filter summaries may be unavailable when the official trade page does not expose those values.
- Changes to the official trade page may temporarily prevent searches or prices from being captured.
