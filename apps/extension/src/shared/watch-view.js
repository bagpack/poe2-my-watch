export function snapshotsForWatch(snapshots, watchId) {
  return snapshots
    .filter((snapshot) => snapshot.watchId === watchId)
    .sort(compareSnapshotsByCapturedAt);
}

export function compareSnapshotsByCapturedAt(left, right) {
  const timeDiff = Date.parse(left.capturedAt) - Date.parse(right.capturedAt);
  if (timeDiff !== 0 && Number.isFinite(timeDiff)) {
    return timeDiff;
  }
  return String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

export function formatConversionSource(snapshot, translate, formatCurrency) {
  if (!snapshot) {
    return "";
  }
  if (snapshot.conversionSnapshot?.provider === "poe2scout") {
    return translate("conversionScout", { sourceEpoch: snapshot.conversionSnapshot.sourceEpoch });
  }
  return translate("conversionFallback", { currency: formatCurrency(snapshot.baseCurrency) });
}
