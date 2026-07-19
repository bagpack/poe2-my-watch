(() => {
  const HOOK_SOURCE = "poe2-my-watch-fetch-hook";
  const CONTENT_SOURCE = "poe2-my-watch-content";
  const REQUEST_TYPE = "requestTradeFetchResponses";
  const RESPONSE_TYPE = "tradeFetchResponse";
  const RESPONSES_READY_TYPE = "tradeFetchResponsesReady";
  const LOCATION_CHANGED_TYPE = "tradeLocationChanged";
  const MAX_RESPONSES = 24;

  if (window.__poe2MyWatchFetchHookInstalled) {
    return;
  }
  window.__poe2MyWatchFetchHookInstalled = true;

  const capturedResponses = [];
  let navigationVersion = 0;
  let lastKnownUrl = window.location.href;

  function isTradeFetchUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return isPathOfExileHost(url.hostname)
        && url.pathname.startsWith("/api/trade2/fetch/");
    } catch {
      return false;
    }
  }

  function isPathOfExileHost(hostname) {
    return hostname === "pathofexile.com" || hostname.endsWith(".pathofexile.com");
  }

  function requestUrl(input) {
    if (typeof Request !== "undefined" && input instanceof Request) {
      return input.url;
    }
    return String(input ?? "");
  }

  function rememberTradeFetchResponse(url, response, requestNavigationVersion) {
    const payload = {
      url,
      response,
      capturedAt: new Date().toISOString(),
      navigationVersion: requestNavigationVersion
    };
    capturedResponses.push(payload);
    while (capturedResponses.length > MAX_RESPONSES) {
      capturedResponses.shift();
    }
    postCapturedResponse(payload);
  }

  function postCapturedResponse(payload) {
    window.postMessage({
      source: HOOK_SOURCE,
      type: RESPONSE_TYPE,
      payload
    }, window.location.origin);
  }

  function postAllCapturedResponses() {
    for (const payload of capturedResponses) {
      postCapturedResponse(payload);
    }
  }

  function postResponsesReady(requestId) {
    window.postMessage({
      source: HOOK_SOURCE,
      type: RESPONSES_READY_TYPE,
      payload: { requestId, navigationVersion }
    }, window.location.origin);
  }

  function postLocationChanged(previousUrl = lastKnownUrl) {
    if (window.location.href === previousUrl) {
      return;
    }
    lastKnownUrl = window.location.href;
    navigationVersion += 1;
    postLocationState(true);
  }

  function postLocationState(changed) {
    window.postMessage({
      source: HOOK_SOURCE,
      type: LOCATION_CHANGED_TYPE,
      payload: { url: window.location.href, navigationVersion, changed }
    }, window.location.origin);
  }

  function patchHistory() {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function patchedPushState(...args) {
      const previousUrl = window.location.href;
      const result = originalPushState.apply(this, args);
      postLocationChanged(previousUrl);
      return result;
    };
    window.history.replaceState = function patchedReplaceState(...args) {
      const previousUrl = window.location.href;
      const result = originalReplaceState.apply(this, args);
      postLocationChanged(previousUrl);
      return result;
    };
    window.addEventListener("popstate", postLocationChanged);
  }

  function patchFetch() {
    if (typeof window.fetch !== "function") {
      return;
    }

    const originalFetch = window.fetch;
    window.fetch = async function patchedFetch(input, init) {
      const url = requestUrl(input);
      const requestNavigationVersion = navigationVersion;
      const response = await originalFetch.apply(this, [input, init]);
      if (isTradeFetchUrl(url)) {
        captureFetchJson(url, response, requestNavigationVersion);
      }
      return response;
    };
  }

  function captureFetchJson(url, response, requestNavigationVersion) {
    response.clone().json()
      .then((json) => rememberTradeFetchResponse(url, json, requestNavigationVersion))
      .catch(() => {});
  }

  function patchXMLHttpRequest() {
    if (typeof window.XMLHttpRequest !== "function") {
      return;
    }

    const originalOpen = window.XMLHttpRequest.prototype.open;
    const originalSend = window.XMLHttpRequest.prototype.send;

    window.XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      this.__poe2MyWatchTradeFetchUrl = requestUrl(url);
      return originalOpen.call(this, method, url, ...rest);
    };

    window.XMLHttpRequest.prototype.send = function patchedSend(...args) {
      const url = this.__poe2MyWatchTradeFetchUrl;
      const requestNavigationVersion = navigationVersion;
      if (isTradeFetchUrl(url)) {
        this.addEventListener("load", () => {
          captureXhrJson(url, this, requestNavigationVersion);
        });
      }
      return originalSend.apply(this, args);
    };
  }

  function captureXhrJson(url, xhr, requestNavigationVersion) {
    if (xhr.response && typeof xhr.response === "object") {
      rememberTradeFetchResponse(url, xhr.response, requestNavigationVersion);
      return;
    }

    try {
      rememberTradeFetchResponse(url, JSON.parse(xhr.responseText), requestNavigationVersion);
    } catch {
      // Ignore non-JSON or partial responses from unrelated browser behavior.
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== CONTENT_SOURCE) {
      return;
    }
    if (event.data?.type !== REQUEST_TYPE) {
      return;
    }
    const requestId = event.data.payload?.requestId;
    postLocationState(false);
    postAllCapturedResponses();
    if (requestId) {
      postResponsesReady(requestId);
    }
  });

  patchFetch();
  patchXMLHttpRequest();
  patchHistory();
})();
