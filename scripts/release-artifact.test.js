import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTagMatchesManifest,
  releaseArtifactName,
  validateArchiveEntries
} from "./release-artifact.js";

test("releaseArtifactName creates a versioned zip name", () => {
  assert.equal(releaseArtifactName("v0.1.0"), "poe2-my-watch-v0.1.0.zip");
});

test("assertTagMatchesManifest accepts the matching release tag", () => {
  assert.doesNotThrow(() => assertTagMatchesManifest("v0.1.0", "0.1.0"));
});

test("assertTagMatchesManifest rejects malformed and mismatched tags", () => {
  assert.throws(() => assertTagMatchesManifest("0.1.0", "0.1.0"), /release_tag_invalid/);
  assert.throws(() => assertTagMatchesManifest("v0.2.0", "0.1.0"), /release_version_mismatch/);
});

test("validateArchiveEntries accepts an installable extension archive", () => {
  assert.doesNotThrow(() => validateArchiveEntries([
    "manifest.json",
    "popup.html",
    "dashboard.html",
    "src/background/background.js",
    "_locales/en/messages.json",
    "assets/icon128.png"
  ]));
});

test("validateArchiveEntries rejects nested manifests and development files", () => {
  assert.throws(() => validateArchiveEntries(["apps/extension/manifest.json"]), /archive_missing_manifest/);
  assert.throws(() => validateArchiveEntries(["manifest.json", "src/example.test.js"]), /archive_contains_test/);
  assert.throws(() => validateArchiveEntries(["manifest.json", "src/shared/example.test.js"]), /archive_contains_test/);
  assert.throws(() => validateArchiveEntries(["manifest.json", ".DS_Store"]), /archive_contains_metadata/);
});
