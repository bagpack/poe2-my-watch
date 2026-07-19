import assert from "node:assert/strict";
import test from "node:test";
import {
  extractTradeLeague,
  extractTradeSearchQueryId,
  isPoe2TradeFetchUrl,
  isPoe2TradeSearchUrl
} from "./trade-url.js";

test("shared trade URL helpers recognize official POE2 search URLs", () => {
  const url = "https://www.pathofexile.com/trade2/search/poe2/Standard/abc123";

  assert.equal(isPoe2TradeSearchUrl(url), true);
  assert.equal(extractTradeLeague(url), "Standard");
  assert.equal(extractTradeSearchQueryId(url), "abc123");
});

test("shared trade URL helpers reject lookalike hosts and non-POE2 paths", () => {
  assert.equal(isPoe2TradeSearchUrl("https://pathofexile.com.evil.example/trade2/search/poe2/Standard/abc"), false);
  assert.equal(isPoe2TradeSearchUrl("https://www.pathofexile.com/trade/search/Standard/abc"), false);
});

test("shared trade URL helpers recognize POE2 trade fetch URLs without realm", () => {
  assert.equal(
    isPoe2TradeFetchUrl("https://www.pathofexile.com/api/trade2/fetch/abc?query=query-id"),
    true
  );
});
