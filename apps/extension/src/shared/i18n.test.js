import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator, getUiLanguage, localizeStaticElements, translate } from "./i18n.js";

test("translate uses chrome.i18n messages with ordered substitutions", () => {
  const calls = [];
  const i18n = {
    getMessage(key, substitutions) {
      calls.push({ key, substitutions });
      return `${key}:${substitutions.join("|")}`;
    }
  };

  assert.equal(translate("saved", { priced: 12, total: 20 }, i18n), "saved:12|20");
  assert.deepEqual(calls, [{ key: "saved", substitutions: ["12", "20"] }]);
});

test("translate falls back when chrome.i18n has no message", () => {
  const i18n = {
    getMessage() {
      return "";
    }
  };

  assert.equal(translate("deleteConfirm", { name: "Boots" }, i18n), "Delete Boots and its saved snapshot history? This cannot be undone.");
});

test("createTranslator returns a scoped translator", () => {
  const t = createTranslator({
    getMessage(key) {
      return key === "auto" ? "Auto from chrome" : "";
    }
  });

  assert.equal(t("auto"), "Auto from chrome");
});

test("getUiLanguage reads chrome extension UI language", () => {
  assert.equal(getUiLanguage({ getUILanguage: () => "ja" }, "en-US"), "ja");
  assert.equal(getUiLanguage(null, "en-US"), "en-US");
});

test("translate substitutes review remediation count messages", () => {
  const i18n = {
    getMessage(key, substitutions) {
      return `${key}:${substitutions?.join(",")}`;
    }
  };

  assert.equal(translate("watchCount", { count: 3 }, i18n), "watchCount:3");
  assert.equal(translate("chartOmitted", { count: 2 }, i18n), "chartOmitted:2");
  assert.equal(translate("watchFilterCount", { visible: 2, total: 5 }, i18n), "watchFilterCount:2,5");
});

test("localizeStaticElements applies translated text and attributes", () => {
  const elements = [
    {
      getAttribute(name) { return name === "data-i18n-text" ? "watch" : null; },
      textContent: "",
      setAttribute() {}
    },
    {
      getAttribute(name) { return name === "data-i18n-title" ? "openDashboard" : null; },
      setAttribute(name, value) { this[name] = value; }
    },
    {
      getAttribute(name) { return name === "data-i18n-aria-label" ? "refresh" : null; },
      setAttribute(name, value) { this[name] = value; }
    },
    {
      getAttribute(name) { return name === "data-i18n-placeholder" ? "watchFilterPlaceholder" : null; },
      setAttribute(name, value) { this[name] = value; }
    }
  ];
  const root = { querySelectorAll: () => elements };

  localizeStaticElements(root, (key) => `translated:${key}`);

  assert.equal(elements[0].textContent, "translated:watch");
  assert.equal(elements[1]["title"], "translated:openDashboard");
  assert.equal(elements[2]["aria-label"], "translated:refresh");
  assert.equal(elements[3]["placeholder"], "translated:watchFilterPlaceholder");
});
