import test from "node:test";
import assert from "node:assert/strict";
import { handleExtensionMessage } from "./message-router.js";

test("handleExtensionMessage saves snapshot through injected store", async () => {
  const calls = [];
  const result = await handleExtensionMessage({
    type: "saveWatchSnapshot",
    payload: { name: "Boots", listings: [pricedListing()] }
  }, {
    async saveWatchSnapshot(payload) {
      calls.push(payload);
      return { snapshot: { pricedListingCount: 2 } };
    }
  });

  assert.deepEqual(calls, [{ name: "Boots", listings: [pricedListing()] }]);
  assert.deepEqual(result, {
    ok: true,
    data: { snapshot: { pricedListingCount: 2 } }
  });
});

test("handleExtensionMessage notifies trade tabs after saving a new watch", async () => {
  const calls = [];
  await handleExtensionMessage({
    type: "saveWatchSnapshot",
    payload: { name: "Boots", listings: [pricedListing()] }
  }, {
    store: {
      async saveWatchSnapshot() {
        calls.push("store");
        return { snapshot: { pricedListingCount: 1 } };
      }
    },
    async notifyTradePageTitleChanged() {
      calls.push("notify");
    }
  });

  assert.deepEqual(calls, ["store", "notify"]);
});

test("handleExtensionMessage attaches conversion snapshot when provider succeeds", async () => {
  const calls = [];
  const result = await handleExtensionMessage({
    type: "saveWatchSnapshot",
    payload: {
      name: "Boots",
      listings: [pricedListing()],
      sourceUrl: "https://www.pathofexile.com/trade2/search/poe2/Fate%20of%20the%20Vaal/abc",
      now: "2026-06-28T00:00:00.000Z"
    }
  }, {
    async conversionSnapshotProvider(request) {
      assert.deepEqual(request, {
        league: "Fate of the Vaal",
        capturedAt: "2026-06-28T00:00:00.000Z"
      });
      return {
        provider: "poe2scout",
        baseCurrency: "exalted",
        rates: { exalted: 1, divine: 187, chaos: 7 }
      };
    },
    store: {
      async saveWatchSnapshot(payload) {
        calls.push(payload);
        return { snapshot: { baseCurrency: "exalted" } };
      }
    }
  });

  assert.equal(calls[0].conversionSnapshot.provider, "poe2scout");
  assert.deepEqual(result, {
    ok: true,
    data: { snapshot: { baseCurrency: "exalted" } }
  });
});

test("handleExtensionMessage keeps saving when conversion snapshot provider fails", async () => {
  const calls = [];
  const result = await handleExtensionMessage({
    type: "saveWatchSnapshot",
    payload: {
      name: "Boots",
      listings: [pricedListing()],
      sourceUrl: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/abc",
      now: "2026-06-28T00:00:00.000Z"
    }
  }, {
    async conversionSnapshotProvider() {
      throw new Error("provider_down");
    },
    logger: null,
    store: {
      async saveWatchSnapshot(payload) {
        calls.push(payload);
        return { snapshot: { baseCurrency: "divine" } };
      }
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].conversionSnapshot, undefined);
  assert.deepEqual(result, {
    ok: true,
    data: { snapshot: { baseCurrency: "divine" } }
  });
});

test("handleExtensionMessage reads state through injected store", async () => {
  const result = await handleExtensionMessage({ type: "readState" }, {
    async readState() {
      return { watches: [{ id: "watch:1" }], snapshots: [] };
    }
  });

  assert.deepEqual(result, {
    ok: true,
    data: { watches: [{ id: "watch:1" }], snapshots: [] }
  });
});

test("handleExtensionMessage reads a trade page title directive through injected store", async () => {
  const result = await handleExtensionMessage({
    type: "readTradePageTitle",
    payload: {
      sourceUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/abc",
      activeQueryId: "abc"
    }
  }, {
    async readTradePageTitle(payload) {
      assert.equal(payload.sourceUrl.endsWith("/abc"), true);
      assert.equal(payload.activeQueryId, "abc");
      return { enabled: true, title: "High ES boots" };
    }
  });

  assert.deepEqual(result, {
    ok: true,
    data: { enabled: true, title: "High ES boots" }
  });
});

test("handleExtensionMessage updates global watch name settings and notifies trade tabs", async () => {
  const calls = [];
  const result = await handleExtensionMessage({
    type: "updateAppSettings",
    payload: { useWatchNameOnTradeSite: true }
  }, {
    store: {
      async updateAppSettings(payload) {
        calls.push(["store", payload]);
        return { settings: { id: "app", ...payload } };
      }
    },
    async notifyTradePageTitleChanged() {
      calls.push(["notify"]);
    }
  });

  assert.deepEqual(calls, [
    ["store", { useWatchNameOnTradeSite: true }],
    ["notify"]
  ]);
  assert.deepEqual(result.data.settings, {
    id: "app",
    useWatchNameOnTradeSite: true
  });
});

test("handleExtensionMessage saves a watch without priced listings and skips rate lookup", async () => {
  let providerCalled = false;
  const calls = [];
  const result = await handleExtensionMessage({
    type: "saveWatchSnapshot",
    payload: {
      name: "Empty search",
      sourceUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/abc",
      listings: []
    }
  }, {
    async conversionSnapshotProvider() {
      providerCalled = true;
    },
    store: {
      async saveWatchSnapshot(payload) {
        calls.push(payload);
        return { watch: { name: payload.name }, snapshot: null };
      }
    }
  });

  assert.equal(providerCalled, false);
  assert.deepEqual(calls, [{
    name: "Empty search",
    sourceUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/abc",
    listings: []
  }]);
  assert.deepEqual(result, {
    ok: true,
    data: { watch: { name: "Empty search" }, snapshot: null }
  });
});

test("handleExtensionMessage updates watch settings through injected store", async () => {
  const calls = [];
  const result = await handleExtensionMessage({
    type: "updateWatchSettings",
    payload: {
      watchId: "watch:1",
      displayCurrencyPreference: "divine"
    }
  }, {
    async updateWatchSettings(payload) {
      calls.push(payload);
      return { watch: { id: payload.watchId, displayCurrencyPreference: payload.displayCurrencyPreference } };
    }
  });

  assert.deepEqual(calls, [{
    watchId: "watch:1",
    displayCurrencyPreference: "divine"
  }]);
  assert.deepEqual(result, {
    ok: true,
    data: { watch: { id: "watch:1", displayCurrencyPreference: "divine" } }
  });
});

test("handleExtensionMessage updates watch name through injected store", async () => {
  const calls = [];
  const result = await handleExtensionMessage({
    type: "updateWatchName",
    payload: {
      watchId: "watch:1",
      name: "High ES boots"
    }
  }, {
    store: {
      async updateWatchName(payload) {
        calls.push(["store", payload]);
        return { watch: { id: payload.watchId, name: payload.name } };
      }
    },
    async notifyTradePageTitleChanged() {
      calls.push(["notify"]);
    }
  });

  assert.deepEqual(calls, [
    ["store", { watchId: "watch:1", name: "High ES boots" }],
    ["notify"]
  ]);
  assert.deepEqual(result, {
    ok: true,
    data: { watch: { id: "watch:1", name: "High ES boots" } }
  });
});

test("handleExtensionMessage deletes watch through injected store", async () => {
  const calls = [];
  const result = await handleExtensionMessage({
    type: "deleteWatch",
    payload: { watchId: "watch:1" }
  }, {
    store: {
      async deleteWatch(payload) {
        calls.push(["store", payload]);
        return { deletedWatchId: payload.watchId, deletedSnapshotCount: 3 };
      }
    },
    async notifyTradePageTitleChanged() {
      calls.push(["notify"]);
    }
  });

  assert.deepEqual(calls, [
    ["store", { watchId: "watch:1" }],
    ["notify"]
  ]);
  assert.deepEqual(result, {
    ok: true,
    data: { deletedWatchId: "watch:1", deletedSnapshotCount: 3 }
  });
});

test("handleExtensionMessage opens popup through injected action", async () => {
  let opened = false;
  const result = await handleExtensionMessage({ type: "openPopup" }, {
    async openPopup() {
      opened = true;
    }
  });

  assert.equal(opened, true);
  assert.deepEqual(result, {
    ok: true,
    data: { opened: true }
  });
});

test("handleExtensionMessage keeps openPopup best-effort when browser rejects it", async () => {
  const result = await handleExtensionMessage({ type: "openPopup" }, {
    logger: null,
    async openPopup() {
      throw new Error("gesture_required");
    }
  });

  assert.deepEqual(result, {
    ok: true,
    data: { opened: false, reason: "gesture_required" }
  });
});

test("handleExtensionMessage rejects unknown messages", async () => {
  const result = await handleExtensionMessage({ type: "nope" }, {});

  assert.deepEqual(result, {
    ok: false,
    error: "unknown_message_type"
  });
});

function pricedListing() {
  return { rawAmount: 10, rawCurrency: "exalted" };
}
