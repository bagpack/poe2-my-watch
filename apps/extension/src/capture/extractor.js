import {
  extractTradeLeague,
  extractTradeSearchQueryId,
  isPoe2TradeSearchUrl
} from "../shared/trade-url.js";

export { isPoe2TradeSearchUrl } from "../shared/trade-url.js";

export function extractVisibleListings(root = document) {
  const rows = findListingRows(root);
  return rows.map((row, index) => {
    const price = extractPrice(row);
    return {
      externalListingId: row.getAttribute("data-id")
        ?? row.id
        ?? row.querySelector("[data-id]")?.getAttribute("data-id")
        ?? null,
      rawAmount: price.amount,
      rawCurrency: price.currency,
      indexedAt: extractIndexedAt(row),
      sellerStatus: extractSellerStatus(row),
      position: index + 1
    };
  });
}

export function extractVisibleListingIds(root = document) {
  return findListingRows(root)
    .map((row) => row.getAttribute("data-id") ?? row.id ?? row.querySelector("[data-id]")?.getAttribute("data-id"))
    .filter(Boolean);
}

export function extractListingsFromTradeFetchResponse(response) {
  const results = response?.result ?? [];
  return results.map((entry, index) => {
    const price = entry?.listing?.price;
    return {
      externalListingId: entry?.id ?? null,
      rawAmount: typeof price?.amount === "number" ? price.amount : null,
      rawCurrency: normalizeCurrencyName(price?.currency ?? null),
      indexedAt: entry?.listing?.indexed ?? null,
      sellerStatus: entry?.listing?.account?.online ? "online" : "unknown",
      itemName: formatItemName(entry?.item),
      position: index + 1
    };
  });
}

export function extractListingsFromTradeFetchResponses(responses) {
  return reindexListings(dedupeListingsPreferNewest(
    responses.flatMap((response) => extractListingsFromTradeFetchResponse(response))
  ));
}

export function selectVisibleTradeListings({ listings, visibleListingIds }) {
  if (!Array.isArray(visibleListingIds) || visibleListingIds.length === 0) {
    return [];
  }

  const latestById = new Map();
  for (const listing of listings) {
    if (listing.externalListingId) {
      latestById.set(listing.externalListingId, listing);
    }
  }

  return reindexListings(visibleListingIds
    .map((id) => latestById.get(id))
    .filter(Boolean));
}

export function createWatchName({ pageUrl, listings, fallbackTitle = "" }) {
  const firstName = listings.find((listing) => listing.itemName)?.itemName;
  if (firstName) {
    return firstName;
  }

  const queryId = extractTradeSearchQueryId(pageUrl);
  const title = fallbackTitle.replace("Path of Exile", "").trim();
  if (title) {
    return `${title}${queryId ? ` (${queryId})` : ""}`;
  }

  return queryId ? `POE2 search ${queryId}` : "POE2 search";
}

export function extractSearchCondition({ pageUrl, title = "", root = null }) {
  return {
    title: normalizeTitle(title),
    realm: "poe2",
    league: extractTradeLeague(pageUrl),
    queryId: extractTradeSearchQueryId(pageUrl),
    sourceUrl: pageUrl,
    filters: root ? extractFilterSummaries(root) : []
  };
}

function findListingRows(root) {
  const selectors = [
    "[data-id].row",
    "[data-id].resultset",
    ".row[data-id]",
    ".resultset[data-id]",
    ".resultset .row",
    "[class*='row'][data-id]"
  ];

  for (const selector of selectors) {
    const rows = [...root.querySelectorAll(selector)];
    if (rows.length > 0) {
      return rows;
    }
  }

  return [...root.querySelectorAll("[data-price]")]
    .map((node) => node.closest("[data-id]") ?? node);
}

function dedupeListings(listings) {
  const seen = new Set();
  return listings.filter((listing) => {
    if (!listing.externalListingId) {
      return true;
    }
    if (seen.has(listing.externalListingId)) {
      return false;
    }
    seen.add(listing.externalListingId);
    return true;
  });
}

function dedupeListingsPreferNewest(listings) {
  const latestById = new Map();
  const unkeyed = [];
  for (const listing of listings) {
    if (!listing.externalListingId) {
      unkeyed.push(listing);
      continue;
    }
    latestById.set(listing.externalListingId, listing);
  }
  return [...latestById.values(), ...unkeyed];
}

function reindexListings(listings) {
  return listings.map((listing, index) => ({
    ...listing,
    position: index + 1
  }));
}

function normalizeTitle(title) {
  return title.replace("Path of Exile", "").replace(/\s+-\s*$/, "").trim();
}

function extractFilterSummaries(root) {
  const selectors = [
    "[data-filter-id]",
    ".filter-group",
    ".filter"
  ];
  const nodes = selectors.flatMap((selector) => [...root.querySelectorAll(selector)]);
  const seen = new Set();
  const summaries = [];

  for (const node of nodes) {
    if (summaries.length >= 40 || isListingNode(node)) {
      continue;
    }
    const summary = summarizeFilterNode(node);
    if (!summary) {
      continue;
    }
    const key = `${summary.label}:${summary.value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    summaries.push(summary);
  }

  return summaries;
}

function summarizeFilterNode(node) {
  const label = cleanText(
    node.getAttribute("data-filter-id")
      ?? node.querySelector(".filter-title, .title, label")?.textContent
      ?? "filter"
  );
  const value = cleanText(extractInputValues(node).join(", "));
  if (!value) {
    return null;
  }
  return {
    label: truncateText(label, 80),
    value: truncateText(value, 160)
  };
}

function extractInputValues(node) {
  return [...node.querySelectorAll("input, select")]
    .map((input) => {
      if (input.tagName === "SELECT") {
        return normalizeSelectedValue(input.selectedOptions?.[0]?.textContent ?? input.value);
      }
      if ((input.type === "checkbox" || input.type === "radio") && !input.checked) {
        return "";
      }
      if ((input.type === "checkbox" || input.type === "radio") && input.value === "on") {
        return "";
      }
      return input.value;
    })
    .map(cleanText)
    .filter(Boolean);
}

function normalizeSelectedValue(value) {
  const text = cleanText(value);
  return isAnyValue(text) ? "" : text;
}

function isAnyValue(value) {
  return ["", "any", "すべて", "指定なし", "-"].includes(value.toLowerCase());
}

function isListingNode(node) {
  return Boolean(node.closest("[data-id].row, .row[data-id], .resultset .row, [data-price]"));
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatItemName(item) {
  const name = item?.name?.trim();
  const typeLine = item?.typeLine?.trim();
  if (name && typeLine) {
    return `${name} ${typeLine}`;
  }
  return name || typeLine || null;
}

function extractPrice(row) {
  const explicitPrice = row.getAttribute("data-price")
    ?? row.querySelector("[data-price]")?.getAttribute("data-price");
  if (explicitPrice) {
    return parsePriceText(explicitPrice);
  }

  const candidates = [
    ".price",
    ".price-label",
    "[class*='price']",
    "[data-field='price']"
  ];

  for (const selector of candidates) {
    const text = row.querySelector(selector)?.textContent;
    const price = parsePriceText(text);
    if (price.amount !== null) {
      return price;
    }
  }

  return parsePriceText(row.textContent);
}

export function parsePriceText(text) {
  if (!text) {
    return { amount: null, currency: null };
  }

  const compact = text.replace(/\s+/g, " ").trim().toLowerCase();
  const match = compact.match(/([0-9]+(?:\.[0-9]+)?)\s*(exalted|divine|chaos|mirror|regal|alchemy|vaal|ex|div|c)\b/);
  if (!match) {
    return { amount: null, currency: null };
  }

  return {
    amount: Number(match[1]),
    currency: normalizeCurrencyName(match[2])
  };
}

function normalizeCurrencyName(currency) {
  if (!currency) {
    return null;
  }
  if (currency === "ex") {
    return "exalted";
  }
  if (currency === "div") {
    return "divine";
  }
  if (currency === "c") {
    return "chaos";
  }
  return currency;
}

function extractIndexedAt(row) {
  const time = row.querySelector("time")?.getAttribute("datetime");
  return time ?? null;
}

function extractSellerStatus(row) {
  const text = row.textContent?.toLowerCase() ?? "";
  if (text.includes("online")) {
    return "online";
  }
  if (text.includes("offline")) {
    return "offline";
  }
  return "unknown";
}
