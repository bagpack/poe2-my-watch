const POE2SCOUT_API_BASE = "https://poe2scout.com/api";
const POE2_REALM = "poe2";
const REFERENCE_CURRENCIES = ["exalted", "chaos", "divine"];

export async function fetchPoe2ScoutConversionSnapshot({
  league,
  capturedAt,
  fetchImpl = fetch,
  logger = console,
  timeoutMs = 3000
}) {
  if (!league) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [exchangeSnapshot, referenceCurrencies, mirrorCurrency] = await Promise.all([
      fetchJson(`${POE2SCOUT_API_BASE}/${POE2_REALM}/Leagues/${encodeURIComponent(league)}/ExchangeSnapshot`, fetchImpl, controller.signal),
      fetchJson(`${POE2SCOUT_API_BASE}/${POE2_REALM}/Leagues/${encodeURIComponent(league)}/ReferenceCurrencies`, fetchImpl, controller.signal),
      fetchOptionalMirror(`${POE2SCOUT_API_BASE}/${POE2_REALM}/Leagues/${encodeURIComponent(league)}/Currencies/mirror`, fetchImpl, controller.signal, logger)
    ]);
    return buildPoe2ScoutConversionSnapshot({
      league,
      capturedAt,
      exchangeSnapshot,
      referenceCurrencies,
      mirrorCurrency
    });
  } catch (error) {
    logger?.warn?.("PoE2 My Watch: POE2 Scout conversion snapshot failed.", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildPoe2ScoutConversionSnapshot({
  league,
  capturedAt,
  exchangeSnapshot,
  referenceCurrencies,
  mirrorCurrency
}) {
  const baseCurrency = normalizeCurrencyId(exchangeSnapshot?.BaseCurrencyApiId);
  if (baseCurrency !== "exalted") {
    return null;
  }

  const rates = {};
  for (const currency of referenceCurrencies ?? []) {
    const apiId = normalizeCurrencyId(currency.ApiId);
    if (!REFERENCE_CURRENCIES.includes(apiId)) {
      continue;
    }
    if (typeof currency.RelativePrice !== "number" || !Number.isFinite(currency.RelativePrice)) {
      continue;
    }
    rates[apiId] = currency.RelativePrice;
  }

  if (isPositiveFinite(mirrorCurrency?.CurrentPrice)) {
    rates.mirror = mirrorCurrency.CurrentPrice;
  }

  if (!hasRequiredRates(rates)) {
    return null;
  }

  return {
    provider: "poe2scout",
    realm: POE2_REALM,
    league,
    capturedAt,
    sourceEpoch: exchangeSnapshot.Epoch,
    baseCurrency,
    baseCurrencyText: exchangeSnapshot.BaseCurrencyText,
    rates
  };
}

async function fetchJson(url, fetchImpl, signal) {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
    credentials: "omit",
    signal
  });
  if (!response.ok) {
    throw new Error(`poe2scout_${response.status}`);
  }
  return response.json();
}

async function fetchOptionalMirror(url, fetchImpl, signal, logger) {
  try {
    return await fetchJson(url, fetchImpl, signal);
  } catch (error) {
    logger?.warn?.("PoE2 My Watch: POE2 Scout mirror rate unavailable.", error);
    return null;
  }
}

function hasRequiredRates(rates) {
  return REFERENCE_CURRENCIES.every((currency) => (
    typeof rates[currency] === "number"
    && Number.isFinite(rates[currency])
    && rates[currency] > 0
  ));
}

function isPositiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeCurrencyId(value) {
  return String(value ?? "").toLowerCase().trim();
}
