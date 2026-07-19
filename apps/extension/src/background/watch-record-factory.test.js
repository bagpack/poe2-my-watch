import assert from "node:assert/strict";
import test from "node:test";
import {
  createSnapshot,
  createWatch,
  hasPricedListings,
  sanitizeWatchName
} from "./watch-record-factory.js";

const SOURCE_URL = "https://www.pathofexile.com/trade2/search/poe2/Standard/query-id";

test("watch record factory normalizes a watch and its search condition", () => {
  const watch = createWatch({
    name: "  My watch  ",
    sourceUrl: SOURCE_URL,
    searchCondition: { title: " Trade search ", filters: [{ label: "name", value: " ring " }] },
    now: new Date("2026-07-19T00:00:00.000Z")
  });

  assert.equal(watch.name, "My watch");
  assert.equal(watch.league, "Standard");
  assert.equal(watch.searchCondition.filters[0].value, "ring");
});

test("snapshot factory keeps only safe numeric prices in statistics", () => {
  const listings = [
    { rawAmount: 3, rawCurrency: "divine" },
    { rawAmount: "3", rawCurrency: "divine" }
  ];

  assert.equal(hasPricedListings(listings), true);
  const snapshot = createSnapshot({
    watchId: "watch-1",
    sourceUrl: SOURCE_URL,
    listings,
    conversionSnapshot: null,
    capturedAt: "2026-07-19T00:00:00.000Z"
  });

  assert.equal(snapshot.pricedListingCount, 1);
  assert.equal(snapshot.medianPrice, 3);
  assert.equal(sanitizeWatchName("  name  "), "name");
});
