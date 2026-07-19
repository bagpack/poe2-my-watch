import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const surface of ["popup", "dashboard"]) {
  test(`${surface} keeps delete out of repeated watch rows and exposes it in detail`, async () => {
    const source = await readFile(new URL(`./src/${surface}/${surface}.js`, import.meta.url), "utf8");
    const listSource = functionSource(source, "renderWatchList", surface === "popup" ? "clearPopupWatchFilter" : "clearWatchFilter");
    const detailSource = functionSource(source, "renderDetail", "renderMetrics");

    assert.doesNotMatch(listSource, /deleteWatch|watch-delete/);
    assert.match(detailSource, /id="delete-watch"/);
    assert.match(detailSource, /<svg[^>]+aria-hidden="true"/);
    assert.doesNotMatch(detailSource, /deleteWatchAction/);
    assert.match(detailSource, /target="_blank"/);
    assert.doesNotMatch(detailSource, /<menu|more-actions/);
    if (surface === "popup") {
      assert.match(detailSource, /class="detail-actions"[\s\S]*trade-link[\s\S]*id="delete-watch"/);
      assert.doesNotMatch(detailSource, /detail-delete-row/);
    }
  });

  test(`${surface} uses the common trade link label`, async () => {
    const source = await readFile(new URL(`./src/${surface}/${surface}.js`, import.meta.url), "utf8");
    const detailSource = functionSource(source, "renderDetail", "renderMetrics");

    assert.match(detailSource, /<a[\s\S]*escapeHtml\(t\("openTrade"\)\)/);
  });

  test(`${surface} renders the trade link with the shared button style`, async () => {
    const [source, css] = await Promise.all([
      readFile(new URL(`./src/${surface}/${surface}.js`, import.meta.url), "utf8"),
      readFile(new URL(`./src/${surface}/${surface}.css`, import.meta.url), "utf8")
    ]);
    const detailSource = functionSource(source, "renderDetail", "renderMetrics");

    assert.match(detailSource, /<a class="trade-link"[\s\S]*target="_blank"/);
    assert.match(css, /\.trade-link\s*{[\s\S]*min-height:\s*44px;/s);
  });

  test(`${surface} aligns the watch name input with 44px detail actions`, async () => {
    const css = await readFile(new URL(`./src/${surface}/${surface}.css`, import.meta.url), "utf8");
    assert.match(css, /\.name-editor\s*{[^}]*min-height:\s*44px;/s);
  });
}

function functionSource(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start);
  assert.notEqual(start, -1, `${startName} must exist`);
  assert.notEqual(end, -1, `${endName} must exist after ${startName}`);
  return source.slice(start, end);
}
