export function reconcileSelectedWatchId(selectedWatchId, watches) {
  if (watches.some((watch) => watch.id === selectedWatchId)) {
    return selectedWatchId;
  }
  return watches[0]?.id ?? null;
}
