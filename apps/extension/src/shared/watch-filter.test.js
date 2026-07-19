import test from "node:test";
import assert from "node:assert/strict";
import { filterWatches, normalizeWatchFilterText } from "./watch-filter.js";

const watches = [
  { id: "boots-standard", name: "High ES Boots", league: "Standard" },
  { id: "boots-runes", name: "Movement Boots", league: "Runes of Aldur" },
  { id: "gloves-runes", name: "Rare Gloves", league: "Runes of Aldur" }
];

test("normalizeWatchFilterText folds width, case, and repeated whitespace", () => {
  assert.equal(normalizeWatchFilterText("  ＨＩＧＨ   ES　Boots  "), "high es boots");
});

test("filterWatches matches watch names by partial text", () => {
  assert.deepEqual(filterWatches(watches, "HIGH es").map(({ id }) => id), ["boots-standard"]);
  assert.deepEqual(filterWatches(watches, "move").map(({ id }) => id), ["boots-runes"]);
});

test("filterWatches does not match league text", () => {
  assert.deepEqual(filterWatches(watches, "aldur"), []);
});

test("filterWatches combines multiple terms with AND", () => {
  assert.deepEqual(filterWatches(watches, "movement boots").map(({ id }) => id), ["boots-runes"]);
});

test("filterWatches returns every watch for an empty query without mutating input", () => {
  const result = filterWatches(watches, "　 ");

  assert.deepEqual(result, watches);
  assert.notEqual(result, watches);
});

test("filterWatches supports Japanese partial matches", () => {
  const japanese = [{ id: "jp", name: "移動速度付きブーツ", league: "スタンダード" }];

  assert.deepEqual(filterWatches(japanese, "速度 ブーツ"), japanese);
});
