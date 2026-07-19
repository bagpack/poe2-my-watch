import assert from "node:assert/strict";
import test from "node:test";
import { escapeAttribute, escapeHtml } from "./html.js";

test("escapeHtml escapes markup from external values", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("escapeAttribute escapes quotes from external values", () => {
  assert.equal(escapeAttribute('watch" onclick="alert(1)'), "watch&quot; onclick=&quot;alert(1)");
});
