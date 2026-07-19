import test from "node:test";
import assert from "node:assert/strict";
import { saveWatchNameIfChanged } from "./watch-name.js";

test("saveWatchNameIfChanged persists a changed watch name through the message seam", async () => {
  const calls = [];
  const result = await saveWatchNameIfChanged({
    watch: { id: "watch:1", name: "Boots" },
    inputValue: "  High ES boots  ",
    sendMessage: async (message) => {
      calls.push(message);
      return { ok: true, data: { watch: { id: "watch:1", name: "High ES boots" } } };
    }
  });

  assert.deepEqual(calls, [{
    type: "updateWatchName",
    payload: { watchId: "watch:1", name: "High ES boots" }
  }]);
  assert.deepEqual(result, {
    changed: true,
    watch: { id: "watch:1", name: "High ES boots" }
  });
});

test("saveWatchNameIfChanged restores unchanged input without sending a message", async () => {
  let called = false;
  const result = await saveWatchNameIfChanged({
    watch: { id: "watch:1", name: "Boots" },
    inputValue: " Boots ",
    sendMessage: async () => {
      called = true;
    }
  });

  assert.equal(called, false);
  assert.deepEqual(result, {
    changed: false,
    watch: { id: "watch:1", name: "Boots" }
  });
});

test("saveWatchNameIfChanged reports a failed watch name update", async () => {
  await assert.rejects(() => saveWatchNameIfChanged({
    watch: { id: "watch:1", name: "Boots" },
    inputValue: "High ES boots",
    sendMessage: async () => ({ ok: false, error: "watch_not_found" })
  }), /watch_not_found/);
});
