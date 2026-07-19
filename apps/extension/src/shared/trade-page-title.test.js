import test from "node:test";
import assert from "node:assert/strict";
import {
  createAppSettings,
  createTradePageTitleSyncGuard,
  createTradePageTitleController,
  normalizeAppSettings,
  resolveConfirmedTradeSearchQueryId,
  resolveTradePageTitleDirective
} from "./trade-page-title.js";

const WATCH_URL = "https://www.pathofexile.com/trade2/search/poe2/Standard/abc";

test("normalizeAppSettings defaults the global watch name setting to on", () => {
  assert.deepEqual(normalizeAppSettings(null), {
    id: "app",
    useWatchNameOnTradeSite: true
  });
});

test("normalizeAppSettings preserves an explicitly disabled watch name setting", () => {
  assert.deepEqual(normalizeAppSettings({ useWatchNameOnTradeSite: false }), {
    id: "app",
    useWatchNameOnTradeSite: false
  });
});

test("normalizeAppSettings preserves the disabled value from the legacy title setting", () => {
  assert.deepEqual(normalizeAppSettings({ useWatchTitleOnTradeSite: false }), {
    id: "app",
    useWatchNameOnTradeSite: false
  });
});

test("createAppSettings accepts only an explicit boolean", () => {
  assert.deepEqual(createAppSettings({ useWatchNameOnTradeSite: true }), {
    id: "app",
    useWatchNameOnTradeSite: true
  });
  assert.throws(
    () => createAppSettings({ useWatchNameOnTradeSite: "true" }),
    /invalid_trade_page_name_setting/
  );
});

test("resolveTradePageTitleDirective keeps the official title when the global setting is off", () => {
  const directive = resolveTradePageTitleDirective({
    settings: { useWatchNameOnTradeSite: false },
    watches: [{ name: "High ES boots", sourceUrl: WATCH_URL }],
    sourceUrl: WATCH_URL,
    activeQueryId: "abc"
  });

  assert.deepEqual(directive, { enabled: false, title: null });
});

test("resolveTradePageTitleDirective uses the matching watch name when the global setting is on", () => {
  const directive = resolveTradePageTitleDirective({
    settings: { useWatchNameOnTradeSite: true },
    watches: [{ name: "  High   ES boots  ", sourceUrl: WATCH_URL }],
    sourceUrl: `${WATCH_URL}?utm_source=test#result`,
    activeQueryId: "abc"
  });

  assert.deepEqual(directive, { enabled: true, title: "High ES boots" });
});

test("resolveTradePageTitleDirective leaves unregistered trade pages unchanged", () => {
  const directive = resolveTradePageTitleDirective({
    settings: { useWatchNameOnTradeSite: true },
    watches: [{ name: "High ES boots", sourceUrl: WATCH_URL }],
    sourceUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/other",
    activeQueryId: "other"
  });

  assert.deepEqual(directive, { enabled: false, title: null });
});

test("resolveTradePageTitleDirective rejects a URL without a query ID", () => {
  const sourceUrl = "https://www.pathofexile.com/trade2/search/poe2/Standard";
  const directive = resolveTradePageTitleDirective({
    settings: { useWatchNameOnTradeSite: true },
    watches: [{ name: "Standard search", sourceUrl }],
    sourceUrl,
    activeQueryId: null
  });

  assert.deepEqual(directive, { enabled: false, title: null });
});

test("resolveTradePageTitleDirective requires a response for the current query ID", () => {
  const watches = [{ name: "High ES boots", sourceUrl: WATCH_URL }];

  assert.deepEqual(resolveTradePageTitleDirective({
    settings: { useWatchNameOnTradeSite: true },
    watches,
    sourceUrl: WATCH_URL,
    activeQueryId: null
  }), { enabled: false, title: null });

  assert.deepEqual(resolveTradePageTitleDirective({
    settings: { useWatchNameOnTradeSite: true },
    watches,
    sourceUrl: WATCH_URL,
    activeQueryId: "previous"
  }), { enabled: false, title: null });
});

test("createTradePageTitleSyncGuard accepts only the latest request for the current URL", () => {
  let currentUrl = WATCH_URL;
  const guard = createTradePageTitleSyncGuard(() => currentUrl);
  const first = guard.begin(WATCH_URL);
  const latest = guard.begin(WATCH_URL);

  assert.equal(first.isCurrent(), false);
  assert.equal(latest.isCurrent(), true);

  currentUrl = "https://www.pathofexile.com/trade2/search/poe2/Standard/other";
  assert.equal(latest.isCurrent(), false);
});

test("createTradePageTitleSyncGuard invalidates an in-flight request on navigation", () => {
  const guard = createTradePageTitleSyncGuard(() => WATCH_URL);
  const request = guard.begin(WATCH_URL);

  guard.invalidate();

  assert.equal(request.isCurrent(), false);
});

test("resolveConfirmedTradeSearchQueryId accepts only a response from the current navigation", () => {
  const responses = [
    {
      url: "/api/trade2/fetch/items?query=abc&realm=poe2",
      navigationVersion: 2
    }
  ];

  assert.equal(resolveConfirmedTradeSearchQueryId({
    sourceUrl: WATCH_URL,
    responses,
    navigationVersion: 2
  }), "abc");
  assert.equal(resolveConfirmedTradeSearchQueryId({
    sourceUrl: WATCH_URL,
    responses,
    navigationVersion: 3
  }), null);
});

test("resolveConfirmedTradeSearchQueryId rejects pages without a query ID", () => {
  assert.equal(resolveConfirmedTradeSearchQueryId({
    sourceUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard",
    responses: [],
    navigationVersion: 0
  }), null);
});

test("createTradePageTitleController restores the latest official title after disabling", () => {
  const page = { title: "Trade - Path of Exile 2" };
  const controller = createTradePageTitleController(page);

  controller.apply({ enabled: true, title: "High ES boots" });
  assert.equal(page.title, "High ES boots");
  assert.equal(controller.getOfficialTitle(), "Trade - Path of Exile 2");

  page.title = "Search Results - Path of Exile 2";
  controller.enforce();
  assert.equal(page.title, "High ES boots");
  assert.equal(controller.getOfficialTitle(), "Search Results - Path of Exile 2");

  controller.apply({ enabled: false, title: null });
  assert.equal(page.title, "Search Results - Path of Exile 2");
});

test("createTradePageTitleController tracks official title changes while the setting is off", () => {
  const page = { title: "Loading - Path of Exile 2" };
  const controller = createTradePageTitleController(page);

  page.title = "Trade - Path of Exile 2";
  controller.apply({ enabled: false, title: null });
  controller.apply({ enabled: true, title: "High ES boots" });
  controller.apply({ enabled: false, title: null });

  assert.equal(page.title, "Trade - Path of Exile 2");
});

test("createTradePageTitleController keeps the official title separate when the watch name changes", () => {
  const page = { title: "Trade - Path of Exile 2" };
  const controller = createTradePageTitleController(page);

  controller.apply({ enabled: true, title: "Boots" });
  controller.apply({ enabled: true, title: "High ES boots" });

  assert.equal(page.title, "High ES boots");
  assert.equal(controller.getOfficialTitle(), "Trade - Path of Exile 2");
});

test("createTradePageTitleController does not rewrite an unchanged title", () => {
  let title = "Trade - Path of Exile 2";
  let writes = 0;
  const page = {
    get title() {
      return title;
    },
    set title(value) {
      writes += 1;
      title = value;
    }
  };
  const controller = createTradePageTitleController(page);

  controller.apply({ enabled: true, title: "High ES boots" });
  controller.apply({ enabled: true, title: "High ES boots" });

  assert.equal(writes, 1);
});
