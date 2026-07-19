import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSelectedWatchId } from "./ui-state.js";

test("reconcileSelectedWatchId keeps an existing selection", () => {
  assert.equal(reconcileSelectedWatchId("watch:b", [{ id: "watch:a" }, { id: "watch:b" }]), "watch:b");
});

test("reconcileSelectedWatchId selects the first remaining watch after external deletion", () => {
  assert.equal(reconcileSelectedWatchId("watch:deleted", [{ id: "watch:a" }]), "watch:a");
});

test("reconcileSelectedWatchId returns null for an empty list", () => {
  assert.equal(reconcileSelectedWatchId("watch:deleted", []), null);
});
