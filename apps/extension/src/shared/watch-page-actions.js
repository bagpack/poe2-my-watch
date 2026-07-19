import { saveWatchNameIfChanged } from "./watch-name.js";

export async function runWithButtonFeedback({
  button,
  action,
  translate,
  setTimeoutImpl = setTimeout,
  feedbackDelayMs = 700
}) {
  const originalText = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = translate("refreshing");
  try {
    await action();
    button.textContent = translate("refreshDone");
  } catch (error) {
    button.textContent = translate("refreshFailed");
    throw error;
  } finally {
    setTimeoutImpl(() => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = originalText;
    }, feedbackDelayMs);
  }
}

export async function persistTradePageNameSetting({ input, currentValue, sendMessage }) {
  const useWatchNameOnTradeSite = input.checked;
  input.disabled = true;
  try {
    const response = await sendMessage({
      type: "updateAppSettings",
      payload: { useWatchNameOnTradeSite }
    });
    if (!response?.ok) throw new Error(response?.error ?? "update_settings_failed");
    return response.data.settings;
  } catch (error) {
    input.checked = currentValue === true;
    throw error;
  } finally {
    input.disabled = false;
  }
}

export function createWatchPageActions({
  state,
  sendMessage,
  render,
  showStatus,
  translate,
  confirmImpl = globalThis.confirm,
  focusAfterDelete
}) {
  return {
    persistNameIfChanged: (watch, input) => persistNameIfChanged({
      watch,
      input,
      sendMessage,
      render
    }),
    updateDisplayCurrency: (watchId, displayCurrencyPreference) => updateDisplayCurrency({
      state,
      watchId,
      displayCurrencyPreference,
      sendMessage,
      render
    }),
    deleteWatch: (watchId, button) => deleteWatch({
      state,
      watchId,
      button,
      sendMessage,
      render,
      showStatus,
      translate,
      confirmImpl,
      focusAfterDelete
    })
  };
}

async function persistNameIfChanged({ watch, input, sendMessage, render }) {
  const result = await saveWatchNameIfChanged({
    watch,
    inputValue: input.value,
    sendMessage
  });
  if (!result.changed) {
    input.value = watch.name;
    return;
  }

  Object.assign(watch, result.watch, { customName: true });
  render();
}

async function updateDisplayCurrency({
  state,
  watchId,
  displayCurrencyPreference,
  sendMessage,
  render
}) {
  const response = await sendMessage({
    type: "updateWatchSettings",
    payload: { watchId, displayCurrencyPreference }
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? "update_failed");
  }
  const watch = state.watches.find((item) => item.id === watchId);
  if (watch) {
    watch.displayCurrencyPreference = displayCurrencyPreference;
  }
  render();
}

async function deleteWatch({
  state,
  watchId,
  button,
  sendMessage,
  render,
  showStatus,
  translate,
  confirmImpl,
  focusAfterDelete
}) {
  const watch = state.watches.find((item) => item.id === watchId);
  const label = watch?.name ?? "watch";
  if (!confirmImpl(translate("deleteConfirm", { name: label }))) {
    return;
  }

  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    const response = await sendMessage({
      type: "deleteWatch",
      payload: { watchId }
    });
    if (!response?.ok) {
      throw new Error(response?.error ?? "delete_failed");
    }

    state.watches = state.watches.filter((item) => item.id !== watchId);
    state.snapshots = state.snapshots.filter((snapshot) => snapshot.watchId !== watchId);
    if (state.selectedWatchId === watchId) {
      state.selectedWatchId = state.watches[0]?.id ?? null;
    }
    render();
    showStatus(translate("watchDeleted", { name: label }));
    focusAfterDelete();
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }
}
