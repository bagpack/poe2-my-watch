(() => {
  const HOOK_SOURCE = "poe2-my-watch-fetch-hook";
  const CONTENT_SOURCE = "poe2-my-watch-content";
  const REQUEST_TRADE_FETCH_RESPONSES = "requestTradeFetchResponses";
  const TRADE_FETCH_RESPONSE = "tradeFetchResponse";
  const TRADE_FETCH_RESPONSES_READY = "tradeFetchResponsesReady";
  const TRADE_LOCATION_CHANGED = "tradeLocationChanged";
  const MAX_CACHED_TRADE_FETCH_RESPONSES = 24;
  const tradeFetchResponses = [];
  const tradeFetchResponseKeys = new Set();
  const extractorPromise = import(chrome.runtime.getURL("src/capture/extractor.js"));
  const tradeUrlPromise = import(chrome.runtime.getURL("src/shared/trade-url.js"));
  const titleObserverPromise = import(chrome.runtime.getURL("src/capture/title-observer.js"));
  const captureResponseCoordinatorPromise = import(chrome.runtime.getURL("src/capture/capture-response-request.js"))
    .then(({ createCaptureResponseRequestCoordinator }) => createCaptureResponseRequestCoordinator({
      postMessage: (message, origin) => window.postMessage(message, origin),
      origin: window.location.origin,
      source: CONTENT_SOURCE,
      type: REQUEST_TRADE_FETCH_RESPONSES
    }));
  const tradePageTitlePromise = import(chrome.runtime.getURL("src/shared/trade-page-title.js"));
  const { describeSaveError, fallbackContentText } = globalThis.Poe2WatchSaveButtonState;
  let tradePageTitleController = null;
  let tradePageTitleSyncGuard = null;
  let readConfirmedTradeSearchQueryId = null;
  let currentTradeNavigationVersion = 0;
  let button = null;
  let tradePageTitleSetupPromise = null;
  let stopTradePageTitleObserver = null;
  let tradePageTitleSetupVersion = 0;
  let tradeUrlHelpers = null;

  window.addEventListener("message", handleHookMessage);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  tradeUrlPromise.then((helpers) => {
    tradeUrlHelpers = helpers;
    if (helpers.isPoe2TradeSearchUrl(window.location.href)) {
      activateTradeSearchPage();
    }
  }).catch((error) => {
    console.warn("PoE2 My Watch: trade URL helpers failed to load.", error);
  });

  function activateTradeSearchPage() {
    if (!button) {
      button = createSaveButton();
      document.body.append(button);
    }
    if (!tradePageTitleSetupPromise) {
      const setupVersion = ++tradePageTitleSetupVersion;
      tradePageTitleSetupPromise = setupTradePageTitle(setupVersion).catch((error) => {
        if (setupVersion === tradePageTitleSetupVersion) {
          tradePageTitleSetupPromise = null;
        }
        logTradePageTitleError(error);
      });
    }
    requestCapturedTradeFetchResponses().catch(() => {});
  }

  function deactivateTradeSearchPage() {
    tradePageTitleSetupVersion += 1;
    stopTradePageTitleObserver?.();
    stopTradePageTitleObserver = null;
    tradePageTitleSetupPromise = null;
    button?.remove();
    button = null;
    resetTradePageTitle();
  }

  function isPoe2TradeSearchUrl(value) {
    return tradeUrlHelpers?.isPoe2TradeSearchUrl(value) === true;
  }

  function isTradeFetchUrl(value, baseUrl = window.location.href) {
    return tradeUrlHelpers?.isPoe2TradeFetchUrl(value, baseUrl) === true;
  }

  function matchesPageQuery(fetchUrl, pageUrl) {
    const queryId = tradeUrlHelpers?.extractTradeSearchQueryId(pageUrl);
    if (!queryId) return false;
    return tradeUrlHelpers.extractTradeFetchQueryId(fetchUrl, pageUrl) === queryId;
  }

  async function readListingsFromCapturedTradeFetch(sourceUrl) {
    const extractor = await extractorPromise;
    await requestCapturedTradeFetchResponses();
    const visibleListingIds = extractor.extractVisibleListingIds(document);
    const responses = tradeFetchResponses
      .filter((payload) => matchesPageQuery(payload.url, sourceUrl))
      .map((payload) => payload.response);
    const listings = extractor.selectVisibleTradeListings({
      listings: extractor.extractListingsFromTradeFetchResponses(responses),
      visibleListingIds
    });
    console.info("PoE2 My Watch: captured trade fetch responses.", {
      chunks: responses.length,
      listings: listings.length,
      visibleListingIds: visibleListingIds.length
    });
    return listings;
  }

  function requestCapturedTradeFetchResponses() {
    return captureResponseCoordinatorPromise.then((coordinator) => coordinator.request());
  }

  function handleHookMessage(event) {
    if (event.source !== window || event.data?.source !== HOOK_SOURCE) return;
    if (event.data?.type === TRADE_LOCATION_CHANGED) {
      handleTradeLocationChanged(event.data.payload);
      return;
    }
    if (event.data?.type === TRADE_FETCH_RESPONSES_READY) {
      captureResponseCoordinatorPromise
        .then((coordinator) => coordinator.resolve(event.data.payload?.requestId))
        .catch(() => {});
      return;
    }
    if (event.data?.type !== TRADE_FETCH_RESPONSE) return;
    rememberTradeFetchResponse(event.data.payload);
    if (
      isPoe2TradeSearchUrl(window.location.href)
      && matchesPageQuery(event.data.payload?.url, window.location.href)
    ) {
      syncTradePageTitle().catch(logTradePageTitleError);
    }
  }

  function rememberTradeFetchResponse(payload) {
    if (!payload?.url || !isTradeFetchUrl(payload.url) || !payload.response) return;
    const key = `${payload.capturedAt ?? ""}:${payload.url}`;
    if (tradeFetchResponseKeys.has(key)) return;
    tradeFetchResponseKeys.add(key);
    tradeFetchResponses.push(payload);
    while (tradeFetchResponses.length > MAX_CACHED_TRADE_FETCH_RESPONSES) {
      const removed = tradeFetchResponses.shift();
      tradeFetchResponseKeys.delete(`${removed.capturedAt ?? ""}:${removed.url}`);
    }
  }

  function handleRuntimeMessage(message) {
    if (message?.type !== "tradePageTitleSettingsChanged") return;
    if (!isPoe2TradeSearchUrl(window.location.href)) return;
    syncTradePageTitle().catch(logTradePageTitleError);
  }

  async function setupTradePageTitle(setupVersion) {
    const {
      createTradePageTitleController,
      createTradePageTitleSyncGuard,
      resolveConfirmedTradeSearchQueryId
    } = await tradePageTitlePromise;
    if (setupVersion !== tradePageTitleSetupVersion || !isPoe2TradeSearchUrl(window.location.href)) {
      return;
    }
    tradePageTitleController = createTradePageTitleController(document);
    tradePageTitleSyncGuard = createTradePageTitleSyncGuard(() => window.location.href);
    readConfirmedTradeSearchQueryId = resolveConfirmedTradeSearchQueryId;
    const { createTitleChangeObserver } = await titleObserverPromise;
    const stopObserver = createTitleChangeObserver({
      document,
      onChange: () => syncTradePageTitle().catch(logTradePageTitleError)
    });
    if (setupVersion !== tradePageTitleSetupVersion) {
      stopObserver();
      return;
    }
    stopTradePageTitleObserver = stopObserver;
    await syncTradePageTitle();
  }

  async function syncTradePageTitle() {
    if (!isPoe2TradeSearchUrl(window.location.href)) return;
    if (!tradePageTitleController || !tradePageTitleSyncGuard) return;
    const sourceUrl = window.location.href;
    const request = tradePageTitleSyncGuard.begin(sourceUrl);
    const response = await sendRuntimeMessage({
      type: "readTradePageTitle",
      payload: {
        sourceUrl,
        activeQueryId: confirmedActiveQueryId(sourceUrl)
      }
    });
    if (!response?.ok) throw new Error(response?.error ?? "read_trade_page_title_failed");
    if (!request.isCurrent()) return;
    tradePageTitleController.apply(response.data);
  }

  function handleTradeLocationChanged(payload) {
    const navigationVersion = payload?.navigationVersion;
    const nextNavigationVersion = Number.isInteger(navigationVersion)
      ? navigationVersion
      : currentTradeNavigationVersion + 1;
    const versionChanged = nextNavigationVersion !== currentTradeNavigationVersion;
    currentTradeNavigationVersion = nextNavigationVersion;
    if (!isPoe2TradeSearchUrl(window.location.href)) {
      deactivateTradeSearchPage();
      return;
    }
    if (payload?.changed === false) {
      if (versionChanged) resetTradePageTitle();
      syncTradePageTitle().catch(logTradePageTitleError);
      return;
    }
    activateTradeSearchPage();
    resetTradePageTitle();
    requestCapturedTradeFetchResponses().catch(() => {});
    syncTradePageTitle().catch(logTradePageTitleError);
  }

  function resetTradePageTitle() {
    tradePageTitleSyncGuard?.invalidate();
    tradePageTitleController?.apply({ enabled: false, title: null });
  }

  function confirmedActiveQueryId(sourceUrl) {
    return readConfirmedTradeSearchQueryId?.({
      sourceUrl,
      responses: tradeFetchResponses,
      navigationVersion: currentTradeNavigationVersion
    }) ?? null;
  }

  function logTradePageTitleError(error) {
    console.warn("PoE2 My Watch: trade page title update skipped.", error);
  }

  function officialPageTitle() {
    return tradePageTitleController?.getOfficialTitle() ?? document.title;
  }

  async function saveSnapshot() {
    const extractor = await extractorPromise;
    const sourceUrl = window.location.href;
    let capturedListings = [];
    try {
      capturedListings = await readListingsFromCapturedTradeFetch(sourceUrl);
    } catch (error) {
      console.warn("PoE2 My Watch: captured trade fetch extraction failed; saving the watch without a snapshot.", error);
    }
    const snapshotListings = hasPricedListings(capturedListings) ? capturedListings : [];
    const pageTitle = officialPageTitle();

    const response = await sendRuntimeMessage({
      type: "saveWatchSnapshot",
      payload: {
        name: extractor.createWatchName({
          pageUrl: sourceUrl,
          listings: capturedListings,
          fallbackTitle: pageTitle
        }),
        sourceUrl,
        searchCondition: extractor.extractSearchCondition({
          pageUrl: sourceUrl,
          title: pageTitle,
          root: document
        }),
        listings: snapshotListings,
        now: new Date().toISOString()
      }
    });
    if (!response?.ok) throw new Error(response?.error ?? "save_failed");

    button.textContent = response.data.snapshot
      ? contentText("saved", {
        priced: response.data.snapshot.pricedListingCount,
        total: snapshotListings.length
      })
      : contentText("watchSaved");
    requestPopupOpen();
  }

  function hasPricedListings(listings) {
    return listings.some((listing) => (
      typeof listing.rawAmount === "number"
        && Number.isFinite(listing.rawAmount)
        && listing.rawAmount >= 0
        && typeof listing.rawCurrency === "string"
        && listing.rawCurrency.length > 0
    ));
  }

  function requestPopupOpen() {
    sendRuntimeMessage({ type: "openPopup" }).catch((error) => {
      console.warn("PoE2 My Watch: popup open request failed.", error);
    });
  }

  async function sendRuntimeMessage(message) {
    if (!chrome?.runtime?.id) throw new Error("extension_context_invalidated_reload_page");
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (String(error?.message ?? error).toLowerCase().includes("extension context invalidated")) {
        throw new Error("extension_context_invalidated_reload_page");
      }
      throw error;
    }
  }

  function createSaveButton() {
    const nextButton = document.createElement("button");
    nextButton.textContent = contentText("saveWatch");
    Object.assign(nextButton.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      padding: "8px 12px",
      background: "#1f6feb",
      color: "#fff",
      border: "0",
      borderRadius: "6px",
      cursor: "pointer"
    });
    nextButton.addEventListener("click", handleSaveClick);
    return nextButton;
  }

  async function handleSaveClick() {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = contentText("saving");
    let keepErrorVisible = false;
    try {
      await saveSnapshot();
    } catch (error) {
      const errorState = describeSaveError(error);
      button.textContent = contentText(errorState.key, errorState.values);
      keepErrorVisible = errorState.persistent;
      console.error(error);
    } finally {
      if (keepErrorVisible) {
        restoreSaveButtonInteraction();
      } else {
        setTimeout(resetSaveButton, 1500);
      }
    }
  }

  function restoreSaveButtonInteraction() {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }

  function resetSaveButton() {
    restoreSaveButtonInteraction();
    button.textContent = contentText("saveWatch");
  }

  function contentText(key, values = {}) {
    const placeholders = {
      saveFailed: ["message"],
      saved: ["priced", "total"]
    };
    const substitution = placeholders[key]?.map((name) => String(values[name] ?? ""));
    try {
      return chrome.i18n?.getMessage?.(key, substitution) || fallbackContentText(key, values);
    } catch {
      return fallbackContentText(key, values);
    }
  }
})();
