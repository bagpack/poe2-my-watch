const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function releaseArtifactName(tag) {
  if (!RELEASE_TAG_PATTERN.test(tag)) {
    throw new Error("release_tag_invalid");
  }
  return `poe2-my-watch-${tag}.zip`;
}

export function assertTagMatchesManifest(tag, manifestVersion) {
  if (!RELEASE_TAG_PATTERN.test(tag)) {
    throw new Error("release_tag_invalid");
  }
  if (tag.slice(1) !== manifestVersion) {
    throw new Error(`release_version_mismatch:${tag}:${manifestVersion}`);
  }
}

export function validateArchiveEntries(entries) {
  if (!entries.includes("manifest.json")) {
    throw new Error("archive_missing_manifest");
  }
  if (entries.some((entry) => entry.endsWith(".test.js"))) {
    throw new Error("archive_contains_test");
  }
  if (entries.some((entry) => entry.endsWith(".DS_Store"))) {
    throw new Error("archive_contains_metadata");
  }
}
