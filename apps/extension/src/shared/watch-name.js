export async function saveWatchNameIfChanged({ watch, inputValue, sendMessage }) {
  const nextName = inputValue.trim();
  if (!nextName || nextName === watch.name) {
    return { changed: false, watch };
  }

  const response = await sendMessage({
    type: "updateWatchName",
    payload: { watchId: watch.id, name: nextName }
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? "update_watch_name_failed");
  }

  return {
    changed: true,
    watch: response.data.watch
  };
}
