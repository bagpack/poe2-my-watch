import test from "node:test";
import assert from "node:assert/strict";

await import("./save-button-state.js");

const { describeSaveError, fallbackContentText } = globalThis.Poe2WatchSaveButtonState;

test("extension context invalidation requires a persistent reload message", () => {
  assert.deepEqual(describeSaveError(new Error("Extension context invalidated.")), {
    key: "reloadPage",
    values: {},
    persistent: true
  });
  assert.deepEqual(describeSaveError(new Error("extension_context_invalidated_reload_page")), {
    key: "reloadPage",
    values: {},
    persistent: true
  });
});

test("missing priced listings remains a temporary actionable error", () => {
  assert.deepEqual(describeSaveError(new Error("no_priced_listings")), {
    key: "noPricedListings",
    values: {},
    persistent: false
  });
});

test("unknown save errors are truncated for the translated fallback", () => {
  assert.deepEqual(describeSaveError(new Error("a".repeat(40))), {
    key: "saveFailed",
    values: { message: "a".repeat(28) },
    persistent: false
  });
});

test("reload guidance remains available when chrome i18n is invalidated", () => {
  assert.equal(fallbackContentText("reloadPage"), "Reload page");
});

test("watch-only saves have a clear fallback status", () => {
  assert.equal(fallbackContentText("watchSaved"), "Watch saved; no price snapshot.");
});
