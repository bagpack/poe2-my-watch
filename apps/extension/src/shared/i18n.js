const PLACEHOLDERS = {
  chartOmitted: ["count"],
  conversionFallback: ["currency"],
  conversionScout: ["sourceEpoch"],
  deleteConfirm: ["name"],
  deleteWatchLabel: ["name"],
  watchDeleted: ["name"],
  filtersCount: ["count"],
  saveFailed: ["message"],
  saved: ["priced", "total"],
  tradeDisplay: ["currency"],
  watchCount: ["count"],
  watchFilterCount: ["visible", "total"],
  yAxis: ["currency"]
};

const FALLBACK_MESSAGES = {
  appDescription: "Save, organize, and reopen official Path of Exile 2 trade search links.",
  auto: "Auto",
  boxPlotAria: "Price distribution history. X axis is time, Y axis is price.",
  boxPlotBox: "Box: p10-p90",
  boxPlotMedian: "Median line",
  boxPlotPaidCount: "n: priced listings",
  boxPlotWhisker: "Whisker: min-max",
  chartOmitted: "{count} history points could not be converted and are omitted.",
  chartTime: "Captured at",
  chartUnavailable: "No price history can be drawn for this display currency.",
  clearFilter: "Clear",
  clearFilterLabel: "Clear watch filter",
  conversionFallback: "{currency} base: price currency in this snapshot",
  conversionScout: "ex conversion: POE2 Scout snapshot {sourceEpoch}",
  dashboard: "Dashboard",
  deleteConfirm: "Delete {name} and its saved snapshot history? This cannot be undone.",
  deleteWatchLabel: "Delete {name}",
  deleteWatchTitle: "Delete this watch and its history",
  displayCurrency: "Display currency",
  emptyWatchDetail: "No watches yet.",
  filterFallbackLabel: "Filter",
  filterFallbackValue: "Could not read filter labels from the page",
  filterNoResults: "No watches match this filter.",
  filtersCount: "Filters {count}",
  item: "Item",
  league: "League",
  latestListingSample: "Latest snapshot listing sample",
  latestMedian: "Latest median",
  listings: "listings",
  listingSampleEmpty: "No listing sample.",
  median: "Median",
  medianChart: "Median history",
  medianChartAria: "Median history chart",
  minPrice: "Min price",
  maxPrice: "Max price",
  noHistory: "No saved price history.",
  noSnapshot: "No snapshot yet.",
  openDashboard: "Open dashboard",
  openTrade: "Trade search",
  openTradeTitle: "Open official trade search",
  operationFailed: "The operation failed. Refresh and try again.",
  paidListings: "Priced",
  priceAxis: "Price",
  priceHistory: "Price distribution history",
  position: "Position",
  queryId: "Query ID",
  rawPrice: "Listed price",
  refresh: "Refresh",
  refreshing: "Refreshing...",
  refreshDone: "Refreshed",
  refreshFailed: "Refresh failed",
  reloadPage: "Reload page",
  saveFailed: "Save failed: {message}",
  saved: "Saved {priced}/{total}",
  saveWatch: "Save watch",
  saving: "Saving...",
  snapshot: "Snapshot",
  snapshotNone: "No snapshot",
  tradeDisplay: "{currency} display",
  tradePageWatchNameSetting: "Use watch names on trade tabs",
  watchAddHint: "Add a watch from Save watch on an official trade search page.",
  watchChangedError: "This watch changed in another view. Refresh to load the latest state.",
  watchCount: "{count} watches",
  watchFilterCount: "{visible} / {total} watches",
  watchFilterLabel: "Filter watches by name",
  watchFilterPlaceholder: "Watch name",
  watch: "Watch",
  watchSaved: "Watch saved; no price snapshot.",
  watchDeleted: "Deleted {name}.",
  watchNameLabel: "Watch name",
  xAxisTime: "Time",
  yAxis: "Y axis: {currency}"
};

export function createTranslator(i18n = globalThis.chrome?.i18n) {
  return (key, values = {}) => translate(key, values, i18n);
}

export function localizeStaticElements(root, translator = createTranslator()) {
  const attributeKeys = [
    ["data-i18n-text", "textContent"],
    ["data-i18n-title", "title"],
    ["data-i18n-aria-label", "aria-label"],
    ["data-i18n-placeholder", "placeholder"]
  ];

  for (const element of root.querySelectorAll("[data-i18n-text], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder]")) {
    for (const [dataAttribute, target] of attributeKeys) {
      const key = element.getAttribute(dataAttribute);
      if (!key) continue;
      if (target === "textContent") {
        element.textContent = translator(key);
      } else {
        element.setAttribute(target, translator(key));
      }
    }
  }
}

export function translate(key, values = {}, i18n = globalThis.chrome?.i18n) {
  const substitutions = buildSubstitutions(key, values);
  const message = i18n?.getMessage?.(key, substitutions);
  if (message) {
    return message;
  }

  return formatFallback(FALLBACK_MESSAGES[key] ?? key, values);
}

export function getUiLanguage(i18n = globalThis.chrome?.i18n, navigatorLanguage = globalThis.navigator?.language) {
  return i18n?.getUILanguage?.() ?? navigatorLanguage ?? "en";
}

function buildSubstitutions(key, values) {
  const names = PLACEHOLDERS[key];
  if (!names) {
    return undefined;
  }
  return names.map((name) => String(values[name] ?? ""));
}

function formatFallback(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}
