import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertTagMatchesManifest,
  releaseArtifactName,
  validateArchiveEntries
} from "./release-artifact.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDirectory = join(repositoryRoot, "apps", "extension");
const manifest = JSON.parse(readFileSync(join(extensionDirectory, "manifest.json"), "utf8"));
const tag = process.argv[2] ?? `v${manifest.version}`;

assertTagMatchesManifest(tag, manifest.version);

const distDirectory = join(repositoryRoot, "dist");
const artifactPath = join(distDirectory, releaseArtifactName(tag));
mkdirSync(distDirectory, { recursive: true });
rmSync(artifactPath, { force: true });

run("zip", [
  "-q",
  "-r",
  artifactPath,
  "manifest.json",
  "popup.html",
  "dashboard.html",
  "_locales",
  "assets",
  "src",
  "-x",
  "src/*.test.js",
  "src/*/*.test.js",
  "*.DS_Store"
], extensionDirectory);

const entries = run("unzip", ["-Z1", artifactPath], repositoryRoot)
  .stdout
  .trim()
  .split("\n")
  .filter(Boolean);
validateArchiveEntries(entries);

console.log(artifactPath);

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`${command}_failed:${result.stderr.trim()}`);
  }
  return result;
}
