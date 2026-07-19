((globalScope) => {
  const RELOAD_ERROR = "extension_context_invalidated_reload_page";

  function describeSaveError(error) {
    const message = String(error?.message ?? error ?? "save_failed");
    if (requiresPageReload(message)) {
      return { key: "reloadPage", values: {}, persistent: true };
    }
    if (message === "no_priced_listings") {
      return { key: "noPricedListings", values: {}, persistent: false };
    }
    return {
      key: "saveFailed",
      values: { message: message.slice(0, 28) },
      persistent: false
    };
  }

  function requiresPageReload(message) {
    return message === RELOAD_ERROR
      || message.toLowerCase().includes("extension context invalidated");
  }

  function fallbackContentText(key, values = {}) {
    const staticText = {
      noPricedListings: "Wait for priced listings",
      reloadPage: "Reload page",
      saveWatch: "Save watch",
      watchSaved: "Watch saved; no price snapshot.",
      saving: "Saving…"
    };
    if (key === "saved") return `Saved ${values.priced ?? 0}/${values.total ?? 0}`;
    if (key === "saveFailed") return `Save failed: ${values.message ?? "save_failed"}`;
    return staticText[key] ?? key;
  }

  globalScope.Poe2WatchSaveButtonState = Object.freeze({
    describeSaveError,
    fallbackContentText
  });
})(globalThis);
