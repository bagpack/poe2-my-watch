import assert from "node:assert/strict";
import test from "node:test";
import { compareSnapshotsByCapturedAt, snapshotsForWatch } from "./watch-view.js";

test("snapshotsForWatch filters by watch and sorts by capture time", () => {
  const snapshots = [
    { id: "b", watchId: "watch-1", capturedAt: "2026-07-19T00:02:00.000Z" },
    { id: "other", watchId: "watch-2", capturedAt: "2026-07-19T00:00:00.000Z" },
    { id: "a", watchId: "watch-1", capturedAt: "2026-07-19T00:01:00.000Z" }
  ];

  assert.deepEqual(snapshotsForWatch(snapshots, "watch-1"), [snapshots[2], snapshots[0]]);
});

test("compareSnapshotsByCapturedAt uses id as a stable fallback", () => {
  assert.ok(compareSnapshotsByCapturedAt(
    { id: "a", capturedAt: "not-a-date" },
    { id: "b", capturedAt: "not-a-date" }
  ) < 0);
});
