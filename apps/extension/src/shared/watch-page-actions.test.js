import assert from "node:assert/strict";
import test from "node:test";
import {
  createWatchPageActions,
  persistTradePageNameSetting,
  runWithButtonFeedback
} from "./watch-page-actions.js";

test("runWithButtonFeedback restores the button after the feedback window", async () => {
  const callbacks = [];
  const button = {
    textContent: "更新",
    disabled: false,
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); }
  };

  await runWithButtonFeedback({
    button,
    action: async () => {},
    translate: (key) => ({ refreshing: "更新中", refreshDone: "完了" }[key]),
    setTimeoutImpl: (callback, delay) => callbacks.push({ callback, delay })
  });

  assert.equal(button.textContent, "完了");
  assert.equal(callbacks[0].delay, 700);
  callbacks[0].callback();
  assert.equal(button.textContent, "更新");
  assert.equal(button.disabled, false);
});

test("persistTradePageNameSetting restores the checkbox when saving fails", async () => {
  const input = { checked: false, disabled: false };

  await assert.rejects(
    persistTradePageNameSetting({
      input,
      currentValue: true,
      sendMessage: async () => ({ ok: false, error: "failed" })
    }),
    /failed/
  );

  assert.equal(input.checked, true);
  assert.equal(input.disabled, false);
});

test("watch page actions share display currency and deletion state transitions", async () => {
  const state = {
    watches: [{ id: "watch-1", name: "My watch" }],
    snapshots: [{ id: "snapshot-1", watchId: "watch-1" }],
    selectedWatchId: "watch-1"
  };
  const messages = [];
  let renderCount = 0;
  let statusMessage = "";
  const actions = createWatchPageActions({
    state,
    sendMessage: async (message) => {
      messages.push(message);
      return { ok: true };
    },
    render: () => { renderCount += 1; },
    showStatus: (message) => { statusMessage = message; },
    translate: (key) => key,
    confirmImpl: () => true,
    focusAfterDelete: () => {}
  });
  const button = {
    isConnected: true,
    disabled: false,
    setAttribute() {},
    removeAttribute() {}
  };

  await actions.updateDisplayCurrency("watch-1", "divine");
  await actions.deleteWatch("watch-1", button);

  assert.equal(messages[0].type, "updateWatchSettings");
  assert.equal(messages[1].type, "deleteWatch");
  assert.equal(state.watches.length, 0);
  assert.equal(state.snapshots.length, 0);
  assert.equal(state.selectedWatchId, null);
  assert.equal(renderCount, 2);
  assert.equal(statusMessage, "watchDeleted");
});
