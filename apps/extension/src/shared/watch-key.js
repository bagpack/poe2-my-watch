export function normalizeWatchSourceUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key.startsWith("__cf_")) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

export function createWatchId(sourceUrl) {
  return `watch:url:${normalizeWatchSourceUrl(sourceUrl)}`;
}

export function migrateWatchRecords({ watches, snapshots }) {
  const watchIds = new Map(watches.map((watch) => [watch.id, createWatchId(watch.sourceUrl)]));
  const originalWatchesById = new Map(watches.map((watch) => [watch.id, watch]));
  const migratedWatchesById = new Map();

  for (const watch of watches) {
    const nextId = watchIds.get(watch.id);
    const existingTarget = originalWatchesById.get(nextId);
    const migratedWatch = migrateWatchRecord(existingTarget ?? watch);
    if (!migratedWatchesById.has(nextId) || watch.id === nextId) {
      migratedWatchesById.set(nextId, migratedWatch);
    }
  }

  return {
    watches: [...migratedWatchesById.values()],
    snapshots: snapshots.map((snapshot) => migrateSnapshotRecord(snapshot, watchIds))
  };
}

export function migrateWatchRecord(watch) {
  const normalizedSourceUrl = normalizeWatchSourceUrl(watch.sourceUrl);
  return {
    ...watch,
    id: createWatchId(normalizedSourceUrl),
    normalizedSearchKey: normalizedSourceUrl
  };
}

export function migrateSnapshotRecord(snapshot, watchIds = new Map()) {
  const watchId = watchIds.get(snapshot.watchId) ?? createWatchId(snapshot.sourceUrl);
  return {
    ...snapshot,
    id: `snapshot:${watchId}:${snapshot.capturedAt ?? snapshot.id}`,
    watchId
  };
}
