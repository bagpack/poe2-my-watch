import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Japanese and English locales expose the same message keys", async () => {
  const [japanese, english] = await Promise.all([
    readLocale("ja"),
    readLocale("en")
  ]);

  assert.deepEqual(Object.keys(japanese).sort(), Object.keys(english).sort());
});

test("extension descriptions present trade link organization as the primary purpose", async () => {
  const [japanese, english] = await Promise.all([
    readLocale("ja"),
    readLocale("en")
  ]);

  assert.equal(
    english.appDescriptionManifest.message,
    "Save, organize, and reopen official Path of Exile 2 trade search links."
  );
  assert.equal(
    japanese.appDescriptionManifest.message,
    "Path of Exile 2公式トレード検索リンクを保存・整理し、必要なときに開き直せます。"
  );
  assert.equal(english.appDescription.message, english.appDescriptionManifest.message);
  assert.equal(japanese.appDescription.message, japanese.appDescriptionManifest.message);
});

test("watch name messages use name terminology in both locales", async () => {
  const [japanese, english] = await Promise.all([
    readLocale("ja"),
    readLocale("en")
  ]);

  assert.equal(japanese.tradePageWatchNameSetting.message, "トレードタブにwatch名を表示");
  assert.equal(japanese.watchNameLabel.message, "watch名");
  assert.equal(english.tradePageWatchNameSetting.message, "Use watch names on trade tabs");
  assert.equal(english.watchNameLabel.message, "Watch name");
});

test("watch heading is available through both extension locales", async () => {
  const [japanese, english] = await Promise.all([
    readLocale("ja"),
    readLocale("en")
  ]);

  assert.equal(japanese.watch.message, "watch");
  assert.equal(english.watch.message, "Watch");
});

async function readLocale(locale) {
  const url = new URL(`../../_locales/${locale}/messages.json`, import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}
