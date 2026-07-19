import { normalizeWatchSourceUrl } from "./watch-key.js";
import { extractTradeFetchQueryId, extractTradeSearchQueryId } from "./trade-url.js";

export { extractTradeSearchQueryId } from "./trade-url.js";

const DISABLED_DIRECTIVE = Object.freeze({ enabled: false, title: null });
const APP_SETTINGS_ID = "app";

export function normalizeAppSettings(settings) {
  return {
    id: APP_SETTINGS_ID,
    useWatchNameOnTradeSite: readWatchNameSetting(settings)
  };
}

export function createAppSettings({ useWatchNameOnTradeSite }) {
  if (typeof useWatchNameOnTradeSite !== "boolean") {
    throw new Error("invalid_trade_page_name_setting");
  }
  return { id: APP_SETTINGS_ID, useWatchNameOnTradeSite };
}

export function resolveTradePageTitleDirective({ settings, watches, sourceUrl, activeQueryId }) {
  if (!readWatchNameSetting(settings)) {
    return DISABLED_DIRECTIVE;
  }

  const queryId = extractTradeSearchQueryId(sourceUrl);
  if (!queryId || activeQueryId !== queryId) {
    return DISABLED_DIRECTIVE;
  }

  const normalizedSourceUrl = safelyNormalizeUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    return DISABLED_DIRECTIVE;
  }

  const watch = watches.find((candidate) => watchMatchesUrl(candidate, normalizedSourceUrl));
  const title = sanitizeTitle(watch?.name);
  return title ? { enabled: true, title } : DISABLED_DIRECTIVE;
}

export function createTradePageTitleSyncGuard(readCurrentUrl) {
  let revision = 0;
  return {
    begin(sourceUrl) {
      const requestRevision = ++revision;
      return {
        isCurrent: () => requestRevision === revision && sourceUrl === readCurrentUrl()
      };
    },
    invalidate() {
      revision += 1;
    }
  };
}

export function resolveConfirmedTradeSearchQueryId({ sourceUrl, responses, navigationVersion }) {
  const queryId = extractTradeSearchQueryId(sourceUrl);
  if (!queryId) {
    return null;
  }
  const confirmed = responses.some((payload) => (
    payload?.navigationVersion === navigationVersion
      && extractTradeFetchQueryId(payload?.url, sourceUrl) === queryId
  ));
  return confirmed ? queryId : null;
}

export function createTradePageTitleController(page) {
  let officialTitle = page.title;
  let directive = DISABLED_DIRECTIVE;
  let appliedTitle = null;

  return {
    apply(nextDirective) {
      rememberOfficialTitle();
      directive = normalizeDirective(nextDirective);
      appliedTitle = directive.enabled ? directive.title : null;
      writeTitle(appliedTitle ?? officialTitle);
    },
    enforce() {
      rememberOfficialTitle();
      if (appliedTitle && page.title !== appliedTitle) {
        writeTitle(appliedTitle);
      }
    },
    getOfficialTitle() {
      rememberOfficialTitle();
      return officialTitle;
    }
  };

  function rememberOfficialTitle() {
    if (!appliedTitle) {
      officialTitle = page.title;
      return;
    }
    if (page.title === appliedTitle) {
      return;
    }
    officialTitle = page.title;
  }

  function writeTitle(title) {
    if (page.title !== title) {
      page.title = title;
    }
  }
}

function watchMatchesUrl(watch, normalizedSourceUrl) {
  const watchUrl = safelyNormalizeUrl(watch?.normalizedSearchKey ?? watch?.sourceUrl);
  return watchUrl === normalizedSourceUrl;
}

function safelyNormalizeUrl(sourceUrl) {
  try {
    return normalizeWatchSourceUrl(sourceUrl);
  } catch {
    return null;
  }
}

function readWatchNameSetting(settings) {
  if (typeof settings?.useWatchNameOnTradeSite === "boolean") {
    return settings.useWatchNameOnTradeSite;
  }
  if (typeof settings?.useWatchTitleOnTradeSite === "boolean") {
    return settings.useWatchTitleOnTradeSite;
  }
  return true;
}

function sanitizeTitle(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function normalizeDirective(value) {
  const title = sanitizeTitle(value?.title);
  if (value?.enabled !== true || !title) {
    return DISABLED_DIRECTIVE;
  }
  return { enabled: true, title };
}
