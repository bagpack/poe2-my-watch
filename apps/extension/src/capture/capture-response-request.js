const DEFAULT_TIMEOUT_MS = 1000;

export function createCaptureResponseRequestCoordinator({
  postMessage,
  origin,
  source = "poe2-my-watch-content",
  type = "requestTradeFetchResponses",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
}) {
  let sequence = 0;
  const pendingRequests = new Map();

  return {
    request() {
      const requestId = `capture-${++sequence}`;
      const ready = new Promise((resolve) => {
        const timeoutId = setTimeoutImpl(() => {
          pendingRequests.delete(requestId);
          resolve(false);
        }, timeoutMs);
        pendingRequests.set(requestId, () => {
          clearTimeoutImpl(timeoutId);
          pendingRequests.delete(requestId);
          resolve(true);
        });
      });

      postMessage({
        source,
        type,
        payload: { requestId }
      }, origin);
      return ready;
    },

    resolve(requestId) {
      const resolveRequest = pendingRequests.get(requestId);
      if (!resolveRequest) {
        return false;
      }
      resolveRequest();
      return true;
    }
  };
}
