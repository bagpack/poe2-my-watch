import test from "node:test";
import assert from "node:assert/strict";
import { createBoxPlotScale } from "./boxplot-scale.js";

test("createBoxPlotScale maps values across the available width", () => {
  const scale = createBoxPlotScale({
    values: [10, 20, 30],
    width: 200
  });

  assert.equal(scale.x(10), 0);
  assert.equal(scale.x(20), 100);
  assert.equal(scale.x(30), 200);
});

test("createBoxPlotScale centers values when the range is flat", () => {
  const scale = createBoxPlotScale({
    values: [12, 12, 12],
    width: 200
  });

  assert.equal(scale.x(12), 100);
});
