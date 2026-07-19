import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["apps/extension", "scripts"];
const files = [];

function walk(path) {
  for (const entry of readdirSync(path)) {
    const child = join(path, entry);
    const stat = statSync(child);
    if (stat.isDirectory()) {
      walk(child);
      continue;
    }
    if (child.endsWith(".js")) {
      files.push(child);
    }
  }
}

for (const root of roots) {
  walk(root);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
