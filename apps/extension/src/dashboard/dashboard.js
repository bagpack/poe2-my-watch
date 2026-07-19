import {
  DISPLAY_CURRENCY_OPTIONS,
  convertDisplayAmount,
  formatCurrency,
  formatDisplayPrice,
  resolveDisplayCurrency
} from "../shared/display-currency.js";
import { createBoxPlotScale } from "./boxplot-scale.js";
import { createTranslator, getUiLanguage, localizeStaticElements } from "../shared/i18n.js";
import { reconcileSelectedWatchId } from "../shared/ui-state.js";
import { filterWatches, normalizeWatchFilterText } from "../shared/watch-filter.js";
import { normalizeAppSettings } from "../shared/trade-page-title.js";
import { escapeAttribute, escapeHtml } from "../shared/html.js";
import { formatConversionSource, snapshotsForWatch } from "../shared/watch-view.js";
import { extractTradeSearchQueryId } from "../shared/trade-url.js";
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
document.getElementById("watch-filter").addEventListener("input", (event) => {
  state.filterQuery = event.currentTarget.value;
  renderWatchList();
});
document.getElementById("watch-filter").addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || normalizeWatchFilterText(state.filterQuery).length === 0) return;
  event.preventDefault();
  clearWatchFilter();
});
document.getElementById("clear-watch-filter").addEventListener("click", clearWatchFilter);
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

  state.watches = response.data.watches ?? [];
  state.snapshots = response.data.snapshots ?? [];
  state.settings = normalizeAppSettings(response.data.settings);
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

function renderWatchList() {
  const list = document.getElementById("watch-list");
  const input = document.getElementById("watch-filter");
  const clearButton = document.getElementById("clear-watch-filter");
  const filteredWatches = filterWatches(state.watches, state.filterQuery);
  const hasQuery = normalizeWatchFilterText(state.filterQuery).length > 0;
  list.textContent = "";
  input.disabled = state.watches.length === 0;
  clearButton.hidden = !hasQuery;
  document.getElementById("watch-filter-count").textContent = t("watchFilterCount", {
    visible: filteredWatches.length,
    total: state.watches.length
  });

  if (state.watches.length === 0) {
    list.innerHTML = `<p class="muted">${escapeHtml(t("watchAddHint"))}</p>`;
    return;
  }

  if (filteredWatches.length === 0) {
    list.innerHTML = `<p class="muted">${escapeHtml(t("filterNoResults"))}</p>`;
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
      <span>${escapeHtml(watch.league)} / ${formatDisplayPrice({ amount: latest?.medianPrice, snapshot: latest, displayCurrency })} / ${latest?.visibleListingCount ?? 0} ${escapeHtml(t("listings"))}</span>
    `;
    selectButton.addEventListener("click", () => {
      state.selectedWatchId = watch.id;
      renderWatchList();
      renderDetail();
    });
    row.append(selectButton);
    list.append(row);
  }
}

function clearWatchFilter() {
  const input = document.getElementById("watch-filter");
  state.filterQuery = "";
  input.value = "";
  renderWatchList();
  input.focus();
}

function renderDetail() {
  const detail = document.getElementById("watch-detail");
  const watch = state.watches.find((item) => item.id === state.selectedWatchId);

  if (!watch) {
    detail.className = "detail-panel empty";
    detail.tabIndex = -1;
    detail.textContent = t("emptyWatchDetail");
    return;
  }

  const series = snapshotsForWatch(state.snapshots, watch.id);
  const latest = series.at(-1);
  const displayCurrency = resolveWatchDisplayCurrency(watch, latest);
  detail.className = "detail-panel";
  detail.removeAttribute("tabindex");
  detail.innerHTML = `
    <div class="detail-header">
      <div>
        ${renderNameEditor(watch)}
        <p class="snapshot-time">${latest ? new Date(latest.capturedAt).toLocaleString() : t("snapshotNone")}</p>
        <p class="snapshot-time">${escapeHtml(formatConversionSource(latest, t, formatCurrency))}</p>
        ${renderCurrencyControl(watch)}
      </div>
      <div class="detail-actions">
        <a class="trade-link" href="${escapeAttribute(watch.sourceUrl)}" target="_blank" rel="noreferrer" title="${escapeAttribute(t("openTradeTitle"))}">${escapeHtml(t("openTrade"))}</a>
        <button id="delete-watch" class="detail-delete" type="button" title="${escapeAttribute(t("deleteWatchTitle"))}" aria-label="${escapeAttribute(t("deleteWatchLabel", { name: watch.name }))}">
          <svg class="delete-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"></path>
          </svg>
        </button>
      </div>
    </div>
    ${renderSearchCondition(watch)}
    ${renderMetrics(latest, displayCurrency)}
    <h3>${escapeHtml(t("priceHistory"))}</h3>
    ${renderChart(series, displayCurrency)}
    <h3>${escapeHtml(t("latestListingSample"))}</h3>
    ${renderListings(latest, displayCurrency)}
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
      <div class="metric"><strong>${formatDisplayPrice({ amount: latest.p10Price, snapshot: latest, displayCurrency })}</strong><span>p10</span></div>
      <div class="metric"><strong>${formatDisplayPrice({ amount: latest.medianPrice, snapshot: latest, displayCurrency })}</strong><span>${escapeHtml(t("median"))}</span></div>
      <div class="metric"><strong>${latest.visibleListingCount}</strong><span>${escapeHtml(t("listings"))}</span></div>
    </div>
  `;
}

function renderChart(series, displayCurrency) {
  if (series.length === 0) {
    return `<p class="empty">${escapeHtml(t("noHistory"))}</p>`;
  }

  const chartPoints = series.map((point) => toBoxPlotPoint(point, displayCurrency))
    .filter(Boolean);
  if (chartPoints.length === 0) {
    return `<p class="empty">${escapeHtml(t("chartUnavailable"))}</p>`;
  }

  const latestPoints = chartPoints.slice(-12);
  const omittedCount = series.length - chartPoints.length;
  const chart = {
    width: 760,
    height: 300,
    top: 18,
    right: 24,
    bottom: 58,
    left: 78
  };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const scale = createBoxPlotScale({
    values: latestPoints.flatMap((item) => [item.min, item.p10, item.median, item.p90, item.max]),
    width: plotHeight
  });
  const y = (value) => chart.top + plotHeight - scale.x(value);
  const x = (index) => chart.left + (plotWidth * index) / Math.max(latestPoints.length - 1, 1);
  const boxHalfWidth = Math.max(6, Math.min(18, Math.floor(plotWidth / Math.max(latestPoints.length, 1) / 4)));
  const tickMarkup = renderBoxPlotTicks({ scale, chart, y, displayCurrency });
  const xLabelStep = Math.max(1, Math.ceil(latestPoints.length / 6));
  const plotMarkup = latestPoints.map((item, index) => {
    const centerX = Math.round(x(index));
    const minY = y(item.min);
    const maxY = y(item.max);
    const p10Y = y(item.p10);
    const p90Y = y(item.p90);
    const medianY = y(item.median);
    const boxY = Math.min(p10Y, p90Y);
    const boxHeight = Math.max(2, Math.abs(p10Y - p90Y));
    const label = formatBoxPlotLabel(item, displayCurrency);
    return `
      <g class="boxplot-item" aria-label="${escapeAttribute(label)}">
        <title>${escapeHtml(label)}</title>
        <line class="boxplot-whisker" x1="${centerX}" y1="${maxY}" x2="${centerX}" y2="${minY}"></line>
        <line class="boxplot-cap" x1="${centerX - boxHalfWidth}" y1="${maxY}" x2="${centerX + boxHalfWidth}" y2="${maxY}"></line>
        <line class="boxplot-cap" x1="${centerX - boxHalfWidth}" y1="${minY}" x2="${centerX + boxHalfWidth}" y2="${minY}"></line>
        <rect class="boxplot-box" x="${centerX - boxHalfWidth}" y="${boxY}" width="${boxHalfWidth * 2}" height="${boxHeight}"></rect>
        <line class="boxplot-median" x1="${centerX - boxHalfWidth}" y1="${medianY}" x2="${centerX + boxHalfWidth}" y2="${medianY}"></line>
      </g>
      ${renderBoxPlotXAxisLabel({ item, index, total: latestPoints.length, step: xLabelStep, x: centerX, y: chart.height - 28 })}
    `;
  }).join("");

  return `
    <div class="boxplot-chart">
      <div class="boxplot-legend">
        <span>${escapeHtml(t("boxPlotWhisker"))}</span>
        <span>${escapeHtml(t("boxPlotBox"))}</span>
        <span>${escapeHtml(t("boxPlotMedian"))}</span>
        <span>${escapeHtml(t("boxPlotPaidCount"))}</span>
        <span>${escapeHtml(t("yAxis", { currency: formatCurrency(displayCurrency) }))}</span>
      </div>
      <svg class="boxplot-svg" viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="${escapeAttribute(t("boxPlotAria"))}">
        <line class="boxplot-axis" x1="${chart.left}" y1="${chart.top}" x2="${chart.left}" y2="${chart.top + plotHeight}"></line>
        <line class="boxplot-axis" x1="${chart.left}" y1="${chart.top + plotHeight}" x2="${chart.left + plotWidth}" y2="${chart.top + plotHeight}"></line>
        ${tickMarkup}
        ${plotMarkup}
        <text class="boxplot-axis-title" x="${chart.left + plotWidth / 2}" y="${chart.height - 4}" text-anchor="middle">${escapeHtml(t("xAxisTime"))}</text>
        <text class="boxplot-axis-title" transform="translate(14 ${chart.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(t("priceAxis"))} (${escapeHtml(formatCurrency(displayCurrency))})</text>
      </svg>
      ${renderBoxPlotDataTable(latestPoints, displayCurrency)}
      ${omittedCount > 0 ? `<p class="chart-warning">${escapeHtml(t("chartOmitted", { count: omittedCount }))}</p>` : ""}
    </div>
  `;
}

function renderBoxPlotDataTable(points, displayCurrency) {
  const rows = points.map((item) => `
    <tr>
      <td>${escapeHtml(formatSnapshotAxisLabel(item.point.capturedAt))}</td>
      <td>${escapeHtml(formatAxisPrice(item.min, displayCurrency))}</td>
      <td>${escapeHtml(formatAxisPrice(item.p10, displayCurrency))}</td>
      <td>${escapeHtml(formatAxisPrice(item.median, displayCurrency))}</td>
      <td>${escapeHtml(formatAxisPrice(item.p90, displayCurrency))}</td>
      <td>${escapeHtml(formatAxisPrice(item.max, displayCurrency))}</td>
    </tr>
  `).join("");
  return `
    <table class="visually-hidden">
      <caption>${escapeHtml(t("priceHistory"))}</caption>
      <thead><tr><th>${escapeHtml(t("chartTime"))}</th><th>${escapeHtml(t("minPrice"))}</th><th>p10</th><th>${escapeHtml(t("median"))}</th><th>p90</th><th>${escapeHtml(t("maxPrice"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderBoxPlotTicks({ scale, chart, y, displayCurrency }) {
  const plotRight = chart.width - chart.right;
  const values = scale.min === scale.max
    ? [scale.min]
    : [scale.max, scale.min + ((scale.max - scale.min) / 2), scale.min];

  return values.map((value) => {
    const tickY = y(value);
    return `
      <g class="boxplot-tick">
        <line class="boxplot-grid" x1="${chart.left}" y1="${tickY}" x2="${plotRight}" y2="${tickY}"></line>
        <text class="boxplot-y-label" x="${chart.left - 8}" y="${tickY + 4}" text-anchor="end">${escapeHtml(formatAxisPrice(value, displayCurrency))}</text>
      </g>
    `;
  }).join("");
}

function renderBoxPlotXAxisLabel({ item, index, total, step, x, y }) {
  if (index !== 0 && index !== total - 1 && index % step !== 0) {
    return "";
  }

  return `<text class="boxplot-x-label" transform="translate(${x} ${y}) rotate(-35)" text-anchor="end">${escapeHtml(formatSnapshotAxisLabel(item.point.capturedAt))}</text>`;
}

function toBoxPlotPoint(point, displayCurrency) {
  const values = {
    min: convertDisplayAmount({ amount: point.minPrice, snapshot: point, displayCurrency }),
    p10: convertDisplayAmount({ amount: point.p10Price, snapshot: point, displayCurrency }),
    median: convertDisplayAmount({ amount: point.medianPrice, snapshot: point, displayCurrency }),
    p90: convertDisplayAmount({ amount: point.p90Price, snapshot: point, displayCurrency }),
    max: convertDisplayAmount({ amount: point.maxPrice, snapshot: point, displayCurrency })
  };
  if (Object.values(values).some((value) => value === null)) {
    return null;
  }
  return { point, ...values };
}

function formatBoxPlotLabel(item, displayCurrency) {
  return [
    new Date(item.point.capturedAt).toLocaleString(),
    `${t("minPrice")} ${formatAxisPrice(item.min, displayCurrency)}`,
    `p10 ${formatAxisPrice(item.p10, displayCurrency)}`,
    `${t("median")} ${formatAxisPrice(item.median, displayCurrency)}`,
    `p90 ${formatAxisPrice(item.p90, displayCurrency)}`,
    `${t("maxPrice")} ${formatAxisPrice(item.max, displayCurrency)}`
  ].join(", ");
}

function formatAxisPrice(value, displayCurrency) {
  const amount = Math.abs(value) >= 100
    ? Math.round(value)
    : Number(value.toFixed(2));
  return `${amount} ${formatCurrency(displayCurrency)}`;
}

function formatSnapshotAxisLabel(capturedAt) {
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderListings(latest, displayCurrency) {
  if (!latest?.listings?.length) {
    return `<p class="empty">${escapeHtml(t("listingSampleEmpty"))}</p>`;
  }

  const capturedAt = latest.capturedAt ? new Date(latest.capturedAt).toLocaleString() : "-";
  const rows = latest.listings.slice(0, 20).map((listing) => `
    <tr>
      <td>${listing.position}</td>
      <td>${escapeHtml(listing.itemName ?? "-")}</td>
      <td>${escapeHtml(formatRawPrice(listing))}</td>
      <td>${formatDisplayPrice({ amount: listing.normalizedAmount, snapshot: latest, displayCurrency })}</td>
    </tr>
  `).join("");

  return `
    <p class="snapshot-time listing-snapshot-time">${escapeHtml(t("snapshot"))}: ${escapeHtml(capturedAt)}</p>
    <div class="listing-table-scroll"><table class="listing-table">
      <thead>
        <tr>
          <th>${escapeHtml(t("position"))}</th>
          <th>${escapeHtml(t("item"))}</th>
          <th>${escapeHtml(t("rawPrice"))}</th>
          <th>${escapeHtml(t("tradeDisplay", { currency: formatCurrency(displayCurrency) }))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>
  `;
}

function renderSearchCondition(watch) {
  const condition = watch.searchCondition ?? fallbackSearchCondition(watch);
  const filters = condition.filters?.length
    ? condition.filters.map((filter) => `
      <li>
        <span>${escapeHtml(filter.label)}</span>
        <strong>${escapeHtml(filter.value)}</strong>
      </li>
    `).join("")
    : `<li><span>${escapeHtml(t("filterFallbackLabel"))}</span><strong>${escapeHtml(t("filterFallbackValue"))}</strong></li>`;

  return `
    <section class="search-condition">
      <div class="condition-grid">
        <div><span>${escapeHtml(t("league"))}</span><strong>${escapeHtml(condition.league ?? watch.league)}</strong></div>
        <div><span>${escapeHtml(t("queryId"))}</span><strong>${escapeHtml(condition.queryId ?? "-")}</strong></div>
      </div>
      <a class="condition-url" href="${escapeAttribute(condition.sourceUrl ?? watch.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(condition.sourceUrl ?? watch.sourceUrl)}</a>
      <details class="condition-filters">
        <summary>${escapeHtml(t("filtersCount", { count: condition.filters?.length ?? 0 }))}</summary>
        <ul class="condition-list">${filters}</ul>
      </details>
    </section>
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

function fallbackSearchCondition(watch) {
  return {
    title: watch.name,
    league: watch.league,
    queryId: extractTradeSearchQueryId(watch.sourceUrl),
    sourceUrl: watch.sourceUrl,
    filters: []
  };
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

function formatRawPrice(listing) {
  if (listing.rawAmount === null || listing.rawAmount === undefined || !listing.rawCurrency) {
    return "-";
  }
  return `${listing.rawAmount} ${listing.rawCurrency}`;
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
