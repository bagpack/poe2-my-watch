import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPoe2ScoutConversionSnapshot,
  fetchPoe2ScoutConversionSnapshot
} from "./poe2scout-rate-provider.js";

test("buildPoe2ScoutConversionSnapshot converts reference currencies into exalted rates", () => {
  const snapshot = buildPoe2ScoutConversionSnapshot({
    league: "Fate of the Vaal",
    capturedAt: "2026-06-28T00:00:00.000Z",
    exchangeSnapshot: {
      Epoch: 1779746400,
      BaseCurrencyApiId: "exalted",
      BaseCurrencyText: "Exalted Orb"
    },
    referenceCurrencies: [
      { ApiId: "exalted", Text: "Exalted Orb", RelativePrice: 1 },
      { ApiId: "chaos", Text: "Chaos Orb", RelativePrice: 7 },
      { ApiId: "divine", Text: "Divine Orb", RelativePrice: 187 }
    ],
    mirrorCurrency: {
      ApiId: "mirror",
      Text: "Mirror of Kalandra",
      CurrentPrice: 3121019.880845904
    }
  });

  assert.deepEqual(snapshot, {
    provider: "poe2scout",
    realm: "poe2",
    league: "Fate of the Vaal",
    capturedAt: "2026-06-28T00:00:00.000Z",
    sourceEpoch: 1779746400,
    baseCurrency: "exalted",
    baseCurrencyText: "Exalted Orb",
    rates: {
      exalted: 1,
      chaos: 7,
      divine: 187,
      mirror: 3121019.880845904
    }
  });
});

test("fetchPoe2ScoutConversionSnapshot keeps core rates when mirror lookup fails", async () => {
  const snapshot = await fetchPoe2ScoutConversionSnapshot({
    league: "Runes of Aldur",
    capturedAt: "2026-07-13T00:00:00.000Z",
    logger: null,
    fetchImpl: async (url) => {
      if (url.endsWith("/ExchangeSnapshot")) {
        return response({ Epoch: 1783900800, BaseCurrencyApiId: "exalted", BaseCurrencyText: "Exalted Orb" });
      }
      if (url.endsWith("/ReferenceCurrencies")) {
        return response([
          { ApiId: "exalted", RelativePrice: 1 },
          { ApiId: "chaos", RelativePrice: 68 },
          { ApiId: "divine", RelativePrice: 555 }
        ]);
      }
      return { ok: false, status: 404 };
    }
  });

  assert.deepEqual(snapshot.rates, { exalted: 1, chaos: 68, divine: 555 });
});

test("fetchPoe2ScoutConversionSnapshot adds the current mirror rate", async () => {
  const requestedUrls = [];
  const snapshot = await fetchPoe2ScoutConversionSnapshot({
    league: "Runes of Aldur",
    capturedAt: "2026-07-13T00:00:00.000Z",
    logger: null,
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      if (url.endsWith("/ExchangeSnapshot")) {
        return response({ Epoch: 1783900800, BaseCurrencyApiId: "exalted", BaseCurrencyText: "Exalted Orb" });
      }
      if (url.endsWith("/ReferenceCurrencies")) {
        return response([
          { ApiId: "exalted", RelativePrice: 1 },
          { ApiId: "chaos", RelativePrice: 68 },
          { ApiId: "divine", RelativePrice: 555 }
        ]);
      }
      return response({ ApiId: "mirror", CurrentPrice: 3121019.880845904 });
    }
  });

  assert.equal(requestedUrls.some((url) => url.endsWith("/Currencies/mirror")), true);
  assert.equal(snapshot.rates.mirror, 3121019.880845904);
});

test("fetchPoe2ScoutConversionSnapshot returns null when the provider fails", async () => {
  const snapshot = await fetchPoe2ScoutConversionSnapshot({
    league: "Runes of Aldur",
    capturedAt: "2026-06-28T00:00:00.000Z",
    fetchImpl: async () => ({ ok: false, status: 404 }),
    logger: null
  });

  assert.equal(snapshot, null);
});

test("fetchPoe2ScoutConversionSnapshot aborts stalled requests at the deadline", async () => {
  let aborted = false;
  const snapshot = await fetchPoe2ScoutConversionSnapshot({
    league: "Runes of Aldur",
    capturedAt: "2026-06-28T00:00:00.000Z",
    timeoutMs: 5,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      });
    }),
    logger: null
  });

  assert.equal(aborted, true);
  assert.equal(snapshot, null);
});

function response(data) {
  return { ok: true, json: async () => data };
}
