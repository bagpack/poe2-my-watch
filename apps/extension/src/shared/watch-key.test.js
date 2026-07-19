import test from "node:test";
import assert from "node:assert/strict";
import { createWatchId, migrateWatchRecords } from "./watch-key.js";

test("createWatchId keeps known 32-bit hash collisions separated", () => {
  const first = createWatchId("https://www.pathofexile.com/trade2/search/poe2/Standard/abc?q=Aa");
  const second = createWatchId("https://www.pathofexile.com/trade2/search/poe2/Standard/abc?q=BB");

  assert.notEqual(first, second);
});

test("migrateWatchRecords moves watches and related snapshots to collision-free ids", () => {
  const sourceUrl = "https://www.pathofexile.com/trade2/search/poe2/Standard/abc?q=Aa";
  const result = migrateWatchRecords({
    watches: [{ id: "watch:4yx5qr", sourceUrl, name: "Boots" }],
    snapshots: [{ id: "snapshot:watch:4yx5qr:2026", watchId: "watch:4yx5qr", sourceUrl }]
  });

  assert.equal(result.watches[0].id, createWatchId(sourceUrl));
  assert.equal(result.snapshots[0].watchId, createWatchId(sourceUrl));
  assert.match(result.snapshots[0].id, /^snapshot:watch:url:/);
});

test("migrateWatchRecords preserves an existing target watch when ids converge", () => {
  const sourceUrl = "https://www.pathofexile.com/trade2/search/poe2/Standard/abc?q=Aa";
  const targetId = createWatchId(sourceUrl);
  const result = migrateWatchRecords({
    watches: [
      { id: "watch:legacy", sourceUrl, name: "Generated name", customName: false },
      {
        id: targetId,
        sourceUrl,
        name: "My saved search",
        customName: true,
        displayCurrencyPreference: "divine",
        createdAt: "2026-07-01T00:00:00.000Z"
      }
    ],
    snapshots: []
  });

  assert.equal(result.watches.length, 1);
  assert.deepEqual(result.watches[0], {
    id: targetId,
    sourceUrl,
    name: "My saved search",
    customName: true,
    displayCurrencyPreference: "divine",
    createdAt: "2026-07-01T00:00:00.000Z",
    normalizedSearchKey: sourceUrl
  });
});
