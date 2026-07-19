import assert from "node:assert/strict";
import test from "node:test";
import { createCaptureResponseRequestCoordinator } from "./capture-response-request.js";

test("capture response coordinator resolves when the hook confirms the request", async () => {
  const postedMessages = [];
  const coordinator = createCaptureResponseRequestCoordinator({
    postMessage: (message, origin) => postedMessages.push({ message, origin }),
    origin: "https://www.pathofexile.com",
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {}
  });

  const ready = coordinator.request();
  const requestId = postedMessages[0].message.payload.requestId;

  assert.equal(coordinator.resolve(requestId), true);
  assert.equal(await ready, true);
  assert.equal(postedMessages[0].origin, "https://www.pathofexile.com");
});

test("capture response coordinator completes with false on an unavailable hook", async () => {
  const timers = [];
  const coordinator = createCaptureResponseRequestCoordinator({
    postMessage: () => {},
    origin: "https://www.pathofexile.com",
    setTimeoutImpl: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimeoutImpl: () => {}
  });

  const ready = coordinator.request();
  timers[0]();

  assert.equal(await ready, false);
});
