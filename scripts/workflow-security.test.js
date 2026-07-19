import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("release workflow pins third-party actions and separates build permissions", async () => {
  const workflow = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

  assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40} # v6\.0\.2/);
  assert.match(workflow, /uses: devcontainers\/ci@[0-9a-f]{40} # v0\.3/);
  assert.match(workflow, /uses: actions\/upload-artifact@[0-9a-f]{40} # v6\.0\.0/);
  assert.match(workflow, /uses: actions\/download-artifact@[0-9a-f]{40} # v6\.0\.0/);
  assert.match(workflow, /build:[\s\S]*?permissions:\s*contents: read/);
  assert.match(workflow, /release:[\s\S]*?permissions:\s*contents: write/);
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@(?![0-9a-f]{40}\b)[^\s]+/);
});

test("CI workflow pins every third-party action", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@(?![0-9a-f]{40}\b)[^\s]+/);
});
