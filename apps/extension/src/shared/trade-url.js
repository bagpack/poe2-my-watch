export function isPoe2TradeSearchUrl(value) {
  return Boolean(parseTradeSearchUrl(value));
}

export function extractTradeSearchQueryId(value) {
  return parseTradeSearchUrl(value)?.queryId ?? null;
}

export function extractTradeLeague(value) {
  return parseTradeSearchUrl(value)?.league ?? "";
}

export function isPoe2TradeFetchUrl(value, baseUrl = undefined) {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:"
      && isPathOfExileHost(url.hostname)
      && url.pathname.startsWith("/api/trade2/fetch/");
  } catch {
    return false;
  }
}

export function extractTradeFetchQueryId(value, baseUrl = undefined) {
  if (!isPoe2TradeFetchUrl(value, baseUrl)) {
    return null;
  }
  try {
    return new URL(value, baseUrl).searchParams.get("query");
  } catch {
    return null;
  }
}

function parseTradeSearchUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !isPathOfExileHost(url.hostname)) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "trade2" || segments[1] !== "search" || segments[2] !== "poe2") {
      return null;
    }

    return {
      league: decodeURIComponent(segments[3] ?? ""),
      queryId: decodeURIComponent(segments[4] ?? "") || null
    };
  } catch {
    return null;
  }
}

function isPathOfExileHost(hostname) {
  return hostname === "pathofexile.com" || hostname.endsWith(".pathofexile.com");
}
