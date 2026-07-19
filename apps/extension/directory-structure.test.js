import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const extensionRoot = new URL("./", import.meta.url);

test("Chrome entry points follow responsibility-based directories", async () => {
  const manifest = JSON.parse(await read("manifest.json"));
  const popup = await read("popup.html");
  const dashboard = await read("dashboard.html");

  assert.equal(manifest.background.service_worker, "src/background/background.js");
  assert.deepEqual(manifest.content_scripts.map(({ js }) => js), [
    ["src/capture/page-fetch-hook.js"],
    ["src/capture/save-button-state.js", "src/capture/content-script.js"]
  ]);
  assert.deepEqual(manifest.web_accessible_resources[0].resources, [
    "src/capture/extractor.js",
    "src/capture/capture-response-request.js",
    "src/capture/title-observer.js",
    "src/shared/trade-page-title.js",
    "src/shared/watch-key.js",
    "src/shared/trade-url.js"
  ]);
  assert.match(popup, /src\/popup\/popup\.(?:css|js)/);
  assert.match(dashboard, /src\/dashboard\/dashboard\.(?:css|js)/);
});

test("capture scripts are injected across the trade2 SPA route", async () => {
  const manifest = JSON.parse(await read("manifest.json"));

  for (const contentScript of manifest.content_scripts) {
    assert.deepEqual(contentScript.matches, ["https://*.pathofexile.com/trade2*"]);
  }
  assert.deepEqual(manifest.web_accessible_resources[0].matches, [
    "https://*.pathofexile.com/*"
  ]);
});

test("responsibility directories contain their public modules", async () => {
  const paths = [
    "src/background/background.js",
    "src/capture/content-script.js",
    "src/popup/popup.js",
    "src/dashboard/dashboard.js",
    "src/shared/i18n.js",
    "src/shared/watch-name.js"
  ];

  await Promise.all(paths.map((path) => access(new URL(path, extensionRoot))));
});

test("content script loads the extractor from the capture boundary", async () => {
  const contentScript = await read("src/capture/content-script.js");
  assert.match(contentScript, /chrome\.runtime\.getURL\("src\/capture\/extractor\.js"\)/);
  assert.match(contentScript, /chrome\.runtime\.getURL\("src\/shared\/trade-page-title\.js"\)/);
  assert.match(contentScript, /chrome\.runtime\.getURL\("src\/capture\/capture-response-request\.js"\)/);
  assert.match(contentScript, /chrome\.runtime\.getURL\("src\/shared\/trade-url\.js"\)/);
  assert.match(contentScript, /chrome\.runtime\.getURL\("src\/capture\/title-observer\.js"\)/);
});

test("capture response collection waits for the hook completion message", async () => {
  const [contentScript, hook] = await Promise.all([
    read("src/capture/content-script.js"),
    read("src/capture/page-fetch-hook.js")
  ]);

  assert.match(contentScript, /await requestCapturedTradeFetchResponses\(\)/);
  assert.match(contentScript, /tradeFetchResponsesReady/);
  assert.doesNotMatch(contentScript, /setTimeout\(\(resolve\) => resolve\(\), 50\)/);
  assert.match(hook, /postResponsesReady\(requestId\)/);
});

test("external display values are escaped before popup and dashboard HTML insertion", async () => {
  const [popup, dashboard] = await Promise.all([
    read("src/popup/popup.js"),
    read("src/dashboard/dashboard.js")
  ]);

  assert.match(popup, /\$\{escapeHtml\(formatConversionSource\(latest, t, formatCurrency\)\)\}/);
  assert.match(dashboard, /\$\{escapeHtml\(formatRawPrice\(listing\)\)\}/);
});

test("content script keeps unverified DOM listings out of snapshots", async () => {
  const contentScript = await read("src/capture/content-script.js");

  assert.match(contentScript, /extractor\.selectVisibleTradeListings\(/);
  assert.match(contentScript, /const snapshotListings = hasPricedListings\(capturedListings\) \? capturedListings : \[\]/);
  assert.doesNotMatch(contentScript, /extractVisibleListings\(document\)/);
});

test("content script activates and deactivates around SPA trade navigation", async () => {
  const contentScript = await read("src/capture/content-script.js");

  assert.doesNotMatch(
    contentScript,
    /currentTradeNavigationVersion = 0;\s+if \(!isPoe2TradeSearchUrl\(window\.location\.href\)\) return;/
  );
  assert.match(contentScript, /activateTradeSearchPage\(\)/);
  assert.match(contentScript, /deactivateTradeSearchPage\(\)/);
  assert.match(contentScript, /handleTradeLocationChanged\(event\.data\.payload\)/);
});

test("content script does not request captured responses for unchanged location state", async () => {
  const contentScript = await read("src/capture/content-script.js");

  assert.match(
    contentScript,
    /if \(payload\?\.changed === false\) \{[\s\S]*?return;\s+\}\s+activateTradeSearchPage\(\)/
  );
});

test("global watch name setting is visibly on before stored settings load", async () => {
  const [popup, dashboard] = await Promise.all([
    read("popup.html"),
    read("dashboard.html")
  ]);

  for (const page of [popup, dashboard]) {
    assert.match(page, /<input id="trade-page-watch-name" type="checkbox" checked>/);
  }
});

test("trade page title sync reacts to SPA navigation and validates the active query", async () => {
  const [hook, contentScript] = await Promise.all([
    read("src/capture/page-fetch-hook.js"),
    read("src/capture/content-script.js")
  ]);

  assert.match(hook, /tradeLocationChanged/);
  assert.match(hook, /history\.pushState/);
  assert.match(hook, /history\.replaceState/);
  assert.match(hook, /navigationVersion/);
  assert.match(hook, /window\.location\.href === previousUrl/);
  assert.match(hook, /postLocationState\(false\)/);
  assert.match(contentScript, /createTradePageTitleSyncGuard/);
  assert.match(contentScript, /activeQueryId/);
});

async function read(path) {
  return readFile(new URL(path, extensionRoot), "utf8");
}
