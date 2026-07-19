import {
  DISPLAY_CURRENCY_OPTIONS,
  convertDisplayAmount,
  formatCurrency,
  formatDisplayPrice,
  resolveDisplayCurrency
} from "../shared/display-currency.js";
import { createTranslator, getUiLanguage, localizeStaticElements } from "../shared/i18n.js";
import { reconcileSelectedWatchId } from "../shared/ui-state.js";
import { filterWatches, normalizeWatchFilterText } from "../shared/watch-filter.js";
import { normalizeAppSettings } from "../shared/trade-page-title.js";
import { escapeAttribute, escapeHtml } from "../shared/html.js";
import { formatConversionSource, snapshotsForWatch } from "../shared/watch-view.js";
import {
  createWatchPageActions,
  persistTradePageNameSetting,
  runWithButtonFeedback
} from "../shared/watch-page-actions.js";

const state = {
  watches: [],
  snapshots: [],
  settings: normalizeAppSettings(null),
  selectedWatchId: null,
  filterQuery: ""
};

const t = createTranslator();
const pageActions = createWatchPageActions({
  state,
  sendMessage: (message) => chrome.runtime.sendMessage(message),
  render: () => {
    renderWatchList();
    renderDetail();
  },
  showStatus,
  translate: t,
  focusAfterDelete: focusAfterWatchDelete
});

document.getElementById("refresh").addEventListener("click", (event) => {
  runWithButtonFeedback({ button: event.currentTarget, action: loadState, translate: t }).catch(showError);
});
document.getElementById("open-dashboard").addEventListener("click", () => {
  openDashboard().catch(showError);
});
document.getElementById("popup-watch-filter").addEventListener("input", (event) => {
  state.filterQuery = event.currentTarget.value;
  renderWatchList();
});
document.getElementById("popup-watch-filter").addEventListener("keydown", (event) => {
  if (event.key === "Escape" && normalizeWatchFilterText(state.filterQuery)) {
    event.preventDefault();
    clearPopupWatchFilter();
  }
});
document.getElementById("clear-popup-watch-filter").addEventListener("click", clearPopupWatchFilter);
document.getElementById("trade-page-watch-name").addEventListener("change", (event) => {
  updateTradePageNameSetting(event.currentTarget).catch(showError);
});

renderStaticText();
loadState().catch(showError);

function renderStaticText() {
  document.documentElement.lang = getUiLanguage();
  localizeStaticElements(document, t);
}

async function loadState() {
  const response = await chrome.runtime.sendMessage({ type: "readState" });
  if (!response?.ok) {
    throw new Error(response?.error ?? "read_failed");
  }

  const stored = response.data;
  state.watches = stored.watches ?? [];
  state.snapshots = stored.snapshots ?? [];
  state.settings = normalizeAppSettings(stored.settings);
  state.selectedWatchId = reconcileSelectedWatchId(state.selectedWatchId, state.watches);
  clearNotification();

  renderWatchList();
  renderDetail();
  renderAppSettings();
}

function renderAppSettings() {
  document.getElementById("trade-page-watch-name").checked = state.settings.useWatchNameOnTradeSite === true;
}

async function updateTradePageNameSetting(input) {
  state.settings = await persistTradePageNameSetting({
    input,
    currentValue: state.settings.useWatchNameOnTradeSite,
    sendMessage: (message) => chrome.runtime.sendMessage(message)
  });
}

async function openDashboard() {
  const dashboardUrl = chrome.runtime.getURL("dashboard.html");
  const existingTabs = await chrome.tabs.query({ url: dashboardUrl });
  const dashboardTab = existingTabs[0];
  if (!dashboardTab?.id) {
    await chrome.tabs.create({ url: dashboardUrl });
    return;
  }

  await chrome.tabs.update(dashboardTab.id, { active: true });
  await chrome.tabs.reload(dashboardTab.id);
}

function renderWatchList() {
  const list = document.getElementById("watch-list");
  const count = document.getElementById("watch-count");
  const tools = document.getElementById("popup-watch-filter-tools");
  const clearButton = document.getElementById("clear-popup-watch-filter");
  const filteredWatches = filterWatches(state.watches, state.filterQuery);
  const hasQuery = Boolean(normalizeWatchFilterText(state.filterQuery));
  list.textContent = "";
  tools.hidden = state.watches.length === 0;
  clearButton.hidden = !hasQuery;
  count.textContent = hasQuery
    ? t("watchFilterCount", { visible: filteredWatches.length, total: state.watches.length })
    : t("watchCount", { count: state.watches.length });

  if (state.watches.length === 0) {
    list.textContent = t("watchAddHint");
    return;
  }

  if (filteredWatches.length === 0) {
    list.textContent = t("filterNoResults");
    return;
  }

  for (const watch of filteredWatches) {
    const latest = snapshotsForWatch(state.snapshots, watch.id).at(-1);
    const displayCurrency = resolveWatchDisplayCurrency(watch, latest);
    const row = document.createElement("div");
    row.className = "watch-row-shell";
    const selectButton = document.createElement("button");
    selectButton.className = "watch-row";
    selectButton.type = "button";
    selectButton.setAttribute("aria-pressed", String(watch.id === state.selectedWatchId));
    selectButton.innerHTML = `
      <strong>${escapeHtml(watch.name)}</strong>
      <span>${escapeHtml(watch.league)} / ${formatDisplayPrice({ amount: latest?.medianPrice, snapshot: latest, displayCurrency })}</span>
    `;
    selectButton.addEventListener("click", () => {
      selectWatch(watch.id);
    });
    row.append(selectButton);
    list.append(row);
  }
}

function clearPopupWatchFilter() {
  const input = document.getElementById("popup-watch-filter");
  state.filterQuery = "";
  input.value = "";
  renderWatchList();
  input.focus();
}

function selectWatch(watchId) {
  state.selectedWatchId = watchId;
  renderWatchList();
  renderDetail();
}

function renderDetail() {
  const detail = document.getElementById("watch-detail");
  const watch = state.watches.find((item) => item.id === state.selectedWatchId);
  if (!watch) {
    detail.className = "watch-detail empty";
    detail.tabIndex = -1;
    detail.textContent = t("emptyWatchDetail");
    return;
  }

  const series = snapshotsForWatch(state.snapshots, watch.id);
  const latest = series.at(-1);
  const displayCurrency = resolveWatchDisplayCurrency(watch, latest);
  detail.className = "watch-detail";
  detail.removeAttribute("tabindex");
  detail.innerHTML = `
    <div class="detail-title-row">
      ${renderNameEditor(watch)}
      <div class="detail-actions">
        <a class="trade-link" href="${escapeAttribute(watch.sourceUrl)}" target="_blank" rel="noreferrer" title="${escapeAttribute(t("openTradeTitle"))}">${escapeHtml(t("openTrade"))}</a>
        <button id="delete-watch" class="detail-delete" type="button" title="${escapeAttribute(t("deleteWatchTitle"))}" aria-label="${escapeAttribute(t("deleteWatchLabel", { name: watch.name }))}">
          <svg class="delete-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"></path>
          </svg>
        </button>
      </div>
    </div>
    <p class="snapshot-time">${latest ? new Date(latest.capturedAt).toLocaleString() : t("snapshotNone")}</p>
    <p class="snapshot-time">${escapeHtml(formatConversionSource(latest, t, formatCurrency))}</p>
    ${renderCurrencyControl(watch)}
    ${renderMetrics(latest, displayCurrency)}
    <h3>${escapeHtml(t("medianChart"))}</h3>
    ${renderChart(series, displayCurrency)}
  `;
  document.getElementById("display-currency")?.addEventListener("change", (event) => {
    pageActions.updateDisplayCurrency(watch.id, event.target.value).catch(showError);
  });
  bindDeleteWatchButton(watch);
  bindNameEditor(watch);
}

function bindDeleteWatchButton(watch) {
  const button = document.getElementById("delete-watch");
  button.addEventListener("click", () => {
    pageActions.deleteWatch(watch.id, button).catch(showError);
  });
}

function renderMetrics(latest, displayCurrency) {
  if (!latest) {
    return `<p class="empty">${escapeHtml(t("noSnapshot"))}</p>`;
  }

  return `
    <div class="metrics">
      <div class="metric"><strong>${formatDisplayPrice({ amount: latest.minPrice, snapshot: latest, displayCurrency })}</strong><span>${escapeHtml(t("minPrice"))}</span></div>
      <div class="metric"><strong>${formatDisplayPrice({ amount: latest.medianPrice, snapshot: latest, displayCurrency })}</strong><span>${escapeHtml(t("latestMedian"))}</span></div>
      <div class="metric"><strong>${latest.visibleListingCount}</strong><span>${escapeHtml(t("listings"))}</span></div>
      <div class="metric"><strong>${latest.pricedListingCount}</strong><span>${escapeHtml(t("paidListings"))}</span></div>
    </div>
  `;
}

function renderChart(series, displayCurrency) {
  if (series.length === 0) {
    return `<p class="empty">${escapeHtml(t("noHistory"))}</p>`;
  }

  const chartPoints = series
    .map((point) => ({
      point,
      value: convertDisplayAmount({ amount: point.medianPrice, snapshot: point, displayCurrency })
    }))
    .filter((item) => item.value !== null);
  if (chartPoints.length === 0) {
    return `<p class="empty">${escapeHtml(t("chartUnavailable"))}</p>`;
  }

  const latestPoints = chartPoints.slice(-8);
  const omittedCount = series.length - chartPoints.length;
  const path = buildMedianPath(latestPoints);
  const yAxisLabels = path.ticks.map((tick) => `
    <g class="y-tick">
      <line x1="${path.chartLeft}" y1="${tick.y}" x2="${path.chartRight}" y2="${tick.y}"></line>
      <text x="${path.labelRight}" y="${tick.y + 4}">${escapeHtml(formatAxisPrice(tick.value, displayCurrency))}</text>
    </g>
  `).join("");
  const pointMarkers = latestPoints.map(({ point, value }, index) => {
    const marker = path.points[index];
    return `
      <circle cx="${marker.x}" cy="${marker.y}" r="3">
        <title>${formatSnapshotTime(point.capturedAt)} ${formatDisplayPrice({ amount: point.medianPrice, snapshot: point, displayCurrency })}</title>
      </circle>
    `;
  }).join("");
  const first = latestPoints[0].point;
  const last = latestPoints.at(-1).point;

  return `
    <div class="median-chart">
      <svg viewBox="0 0 320 120" role="img" aria-label="${escapeAttribute(t("medianChartAria"))}">
        ${yAxisLabels}
        <line class="axis" x1="${path.chartLeft}" y1="102" x2="${path.chartRight}" y2="102"></line>
        <line class="axis" x1="${path.chartLeft}" y1="18" x2="${path.chartLeft}" y2="102"></line>
        <polyline points="${path.polyline}"></polyline>
        ${pointMarkers}
      </svg>
      ${renderChartDataTable(latestPoints, displayCurrency)}
      ${omittedCount > 0 ? `<p class="chart-warning">${escapeHtml(t("chartOmitted", { count: omittedCount }))}</p>` : ""}
      <div class="chart-summary">
        <span>${formatSnapshotTime(first.capturedAt)}</span>
        <strong>${formatDisplayPrice({ amount: last.medianPrice, snapshot: last, displayCurrency })}</strong>
        <span>${formatSnapshotTime(last.capturedAt)}</span>
      </div>
    </div>
  `;
}

function renderChartDataTable(chartPoints, displayCurrency) {
  const rows = chartPoints.map(({ point }) => `
    <tr><td>${escapeHtml(formatSnapshotTime(point.capturedAt))}</td><td>${escapeHtml(formatDisplayPrice({ amount: point.medianPrice, snapshot: point, displayCurrency }))}</td></tr>
  `).join("");
  return `
    <table class="visually-hidden">
      <caption>${escapeHtml(t("medianChart"))}</caption>
      <thead><tr><th>${escapeHtml(t("chartTime"))}</th><th>${escapeHtml(t("median"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatSnapshotTime(capturedAt) {
  return new Date(capturedAt).toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildMedianPath(chartPoints) {
  const width = 320;
  const height = 120;
  const padding = { left: 62, right: 14, top: 18, bottom: 18 };
  const values = chartPoints.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const drawableWidth = width - padding.left - padding.right;
  const drawableHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(chartPoints.length - 1, 1);
  const points = chartPoints.map((item, index) => {
    const x = Math.round(padding.left + (drawableWidth * index) / denominator);
    const ratio = range === 0 ? 0.5 : (item.value - min) / range;
    const y = Math.round(padding.top + drawableHeight - ratio * drawableHeight);
    return { x, y };
  });

  return {
    chartLeft: padding.left,
    chartRight: width - padding.right,
    labelRight: padding.left - 7,
    points,
    polyline: points.map((point) => `${point.x},${point.y}`).join(" "),
    ticks: buildYAxisTicks({ min, max, range, padding, drawableHeight })
  };
}

function buildYAxisTicks({ min, max, range, padding, drawableHeight }) {
  if (range === 0) {
    return [{
      value: min,
      y: Math.round(padding.top + drawableHeight / 2)
    }];
  }

  return [
    { value: max, ratio: 1 },
    { value: min + range / 2, ratio: 0.5 },
    { value: min, ratio: 0 }
  ].map((tick) => ({
    value: tick.value,
    y: Math.round(padding.top + drawableHeight - tick.ratio * drawableHeight)
  }));
}

function formatAxisPrice(value, displayCurrency) {
  const amount = Math.abs(value) >= 100
    ? Math.round(value)
    : Number(value.toFixed(2));
  return `${amount} ${formatCurrency(displayCurrency)}`;
}

function showError(error) {
  const notification = document.getElementById("notification");
  notification.setAttribute("role", "alert");
  notification.textContent = userFacingError(error);
}

function clearNotification() {
  const notification = document.getElementById("notification");
  notification.setAttribute("role", "status");
  notification.textContent = "";
}

function showStatus(message) {
  const notification = document.getElementById("notification");
  notification.setAttribute("role", "status");
  notification.textContent = message;
}

function userFacingError(error) {
  if (error?.message === "watch_not_found") return t("watchChangedError");
  return t("operationFailed");
}

function renderCurrencyControl(watch) {
  const preference = watch.displayCurrencyPreference ?? "auto";
  const options = DISPLAY_CURRENCY_OPTIONS.map((currency) => `
    <option value="${currency}" ${currency === preference ? "selected" : ""}>${escapeHtml(formatCurrencyOption(currency))}</option>
  `).join("");
  return `
    <label class="currency-control">
      <span>${escapeHtml(t("displayCurrency"))}</span>
      <select id="display-currency">${options}</select>
    </label>
  `;
}

function renderNameEditor(watch) {
  return `
    <input id="watch-name-input" class="name-editor" value="${escapeAttribute(watch.name)}" maxlength="120" aria-label="${escapeAttribute(t("watchNameLabel"))}" />
  `;
}

function bindNameEditor(watch) {
  const input = document.getElementById("watch-name-input");
  if (!input) {
    return;
  }

  input.addEventListener("blur", () => {
    pageActions.persistNameIfChanged(watch, input).catch(showError);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
      return;
    }
    if (event.key === "Escape") {
      input.value = watch.name;
      input.blur();
    }
  });
}

function resolveWatchDisplayCurrency(watch, snapshot) {
  return resolveDisplayCurrency({
    snapshot,
    preference: watch?.displayCurrencyPreference ?? "auto"
  });
}

function focusAfterWatchDelete() {
  const target = document.querySelector('.watch-row[aria-pressed="true"]')
    ?? document.getElementById("watch-name-input")
    ?? document.getElementById("watch-detail");
  target.focus();
}

function formatCurrencyOption(currency) {
  return currency === "auto" ? t("auto") : formatCurrency(currency);
}
