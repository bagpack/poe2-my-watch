import { createWatchId, normalizeWatchSourceUrl } from "../shared/watch-key.js";
import { extractTradeLeague, extractTradeSearchQueryId } from "../shared/trade-url.js";

export function createWatch({ name, sourceUrl, searchCondition, now }) {
  const normalizedUrl = normalizeWatchSourceUrl(sourceUrl);
  const league = extractTradeLeague(normalizedUrl);
  const timestamp = now.toISOString();

  return {
    id: createWatchId(normalizedUrl),
    name: name?.trim() || league,
    sourceUrl: normalizedUrl,
    normalizedSearchKey: normalizedUrl,
    realm: "poe2",
    league,
    searchCondition: sanitizeSearchCondition(searchCondition, { sourceUrl: normalizedUrl, league }),
    customName: false,
    displayCurrencyPreference: "auto",
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null
  };
}

export function sanitizeWatchName(value) {
  return sanitizeText(value, 120);
}

export function createSnapshot({ watchId, sourceUrl, listings, conversionSnapshot, capturedAt }) {
  const baseCurrency = conversionSnapshot?.baseCurrency ?? selectBaseCurrency(listings);
  const rates = conversionSnapshot?.rates ?? null;
  const normalizedListings = listings.map((listing, index) => ({
    externalListingId: listing.externalListingId ?? null,
    itemName: listing.itemName ?? null,
    rawAmount: listing.rawAmount ?? null,
    rawCurrency: listing.rawCurrency ?? null,
    normalizedAmount: normalizePrice(listing.rawAmount, listing.rawCurrency, baseCurrency, rates),
    normalizedCurrency: baseCurrency,
    indexedAt: listing.indexedAt ?? null,
    sellerStatus: listing.sellerStatus ?? "unknown",
    position: listing.position ?? index + 1
  }));
  const prices = normalizedListings
    .map((listing) => listing.normalizedAmount)
    .filter((amount) => typeof amount === "number")
    .sort((a, b) => a - b);

  return {
    id: `snapshot:${watchId}:${capturedAt}`,
    watchId,
    league: extractTradeLeague(sourceUrl),
    capturedAt,
    sourceUrl,
    visibleListingCount: normalizedListings.length,
    pricedListingCount: prices.length,
    currencyCounts: countCurrencies(normalizedListings),
    minPrice: prices[0] ?? null,
    p10Price: percentile(prices, 0.1),
    medianPrice: percentile(prices, 0.5),
    p90Price: percentile(prices, 0.9),
    maxPrice: prices.at(-1) ?? null,
    baseCurrency,
    conversionSnapshot: sanitizeConversionSnapshot(conversionSnapshot),
    listings: normalizedListings
  };
}

export function hasPricedListings(listings) {
  return Array.isArray(listings) && listings.some(isPricedListing);
}

function sanitizeSearchCondition(searchCondition, fallback) {
  const queryId = extractTradeSearchQueryId(fallback.sourceUrl);
  if (!searchCondition || typeof searchCondition !== "object") {
    return {
      title: "",
      realm: "poe2",
      league: fallback.league,
      queryId,
      sourceUrl: fallback.sourceUrl,
      filters: []
    };
  }

  return {
    title: sanitizeText(searchCondition.title, 120),
    realm: "poe2",
    league: sanitizeText(searchCondition.league, 120) || fallback.league,
    queryId: sanitizeText(searchCondition.queryId, 80) || queryId,
    sourceUrl: fallback.sourceUrl,
    filters: sanitizeFilters(searchCondition.filters)
  };
}

function sanitizeFilters(filters) {
  if (!Array.isArray(filters)) {
    return [];
  }
  return filters.slice(0, 40)
    .map((filter) => ({
      label: sanitizeText(filter?.label, 80) || "filter",
      value: sanitizeText(filter?.value, 160)
    }))
    .filter((filter) => filter.value.length > 0);
}

function sanitizeText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePrice(amount, currency, baseCurrency, rates) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return null;
  }
  if (typeof currency !== "string") {
    return null;
  }

  const normalizedCurrency = currency.toLowerCase().trim();
  if (normalizedCurrency === baseCurrency) {
    return amount;
  }

  if (baseCurrency !== "exalted" || !rates) {
    return null;
  }

  const rate = rates[normalizedCurrency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return amount * rate;
}

function sanitizeConversionSnapshot(conversionSnapshot) {
  if (!conversionSnapshot?.rates || conversionSnapshot.baseCurrency !== "exalted") {
    return null;
  }
  return {
    provider: conversionSnapshot.provider,
    realm: conversionSnapshot.realm,
    league: conversionSnapshot.league,
    capturedAt: conversionSnapshot.capturedAt,
    sourceEpoch: conversionSnapshot.sourceEpoch,
    baseCurrency: conversionSnapshot.baseCurrency,
    baseCurrencyText: conversionSnapshot.baseCurrencyText,
    rates: { ...conversionSnapshot.rates }
  };
}

function selectBaseCurrency(listings) {
  const counts = {};
  for (const listing of listings) {
    if (!isPricedListing(listing)) {
      continue;
    }
    const currency = listing.rawCurrency.toLowerCase().trim();
    counts[currency] = (counts[currency] ?? 0) + 1;
  }

  const currencies = Object.keys(counts);
  if (currencies.length === 0) {
    return "exalted";
  }

  return currencies.sort((left, right) => {
    const countDiff = counts[right] - counts[left];
    if (countDiff !== 0) {
      return countDiff;
    }
    return currencyPriority(left) - currencyPriority(right);
  })[0];
}

function isPricedListing(listing) {
  return typeof listing.rawAmount === "number"
    && Number.isFinite(listing.rawAmount)
    && listing.rawAmount >= 0
    && typeof listing.rawCurrency === "string"
    && listing.rawCurrency.trim().length > 0;
}

function currencyPriority(currency) {
  const priorities = ["exalted", "divine", "chaos", "mirror"];
  const index = priorities.indexOf(currency);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function countCurrencies(listings) {
  const counts = {};
  for (const listing of listings) {
    const currency = listing.rawCurrency ?? "unknown";
    counts[currency] = (counts[currency] ?? 0) + 1;
  }
  return counts;
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}
