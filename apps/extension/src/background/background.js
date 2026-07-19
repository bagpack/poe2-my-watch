import "./indexed-db-store.js";
import { handleExtensionMessage } from "./message-router.js";
import { fetchPoe2ScoutConversionSnapshot } from "./poe2scout-rate-provider.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleExtensionMessage(message, {
    store: globalThis.Poe2WatchStore,
    conversionSnapshotProvider: fetchPoe2ScoutConversionSnapshot,
    openPopup: () => chrome.action.openPopup(),
    notifyTradePageTitleChanged
  })
    .then(sendResponse)
    .catch((error) => {
      console.error("PoE2 My Watch: background message failed.", error);
      sendResponse({
        ok: false,
        error: error.message
      });
    });

  return true;
});

async function notifyTradePageTitleChanged() {
  const tabs = await chrome.tabs.query({
    url: "https://*.pathofexile.com/trade2/search/poe2/*"
  });
  await Promise.allSettled(tabs.map((tab) => {
    if (!tab.id) return Promise.resolve();
    return chrome.tabs.sendMessage(tab.id, { type: "tradePageTitleSettingsChanged" });
  }));
}
