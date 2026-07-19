import {
  migrateSnapshotRecord,
  migrateWatchRecords
} from "../shared/watch-key.js";
import { DISPLAY_CURRENCY_OPTIONS } from "../shared/display-currency.js";
import {
  createAppSettings,
  normalizeAppSettings,
  resolveTradePageTitleDirective
} from "../shared/trade-page-title.js";
import { withDatabase } from "./database-lifecycle.js";
import {
  createSnapshot,
  createWatch,
  hasPricedListings,
  sanitizeWatchName
} from "./watch-record-factory.js";

(function registerPoe2WatchStore(globalScope) {
  const DB_NAME = "poe2-my-watch";
  const DB_VERSION = 4;
  const WATCHES_STORE = "watches";
  const SNAPSHOTS_STORE = "snapshots";
  const SETTINGS_STORE = "settings";
  const APP_SETTINGS_ID = "app";

  async function saveWatchSnapshot({ name, sourceUrl, searchCondition = null, listings = [], conversionSnapshot = null, now = new Date() }) {
    const capturedAt = typeof now === "string" ? new Date(now) : now;
    return withDatabase({
      openDatabase,
      work: async (database) => {
        const watch = createWatch({ name, sourceUrl, searchCondition, now: capturedAt });
        const snapshot = hasPricedListings(listings)
          ? createSnapshot({
            watchId: watch.id,
            sourceUrl: watch.sourceUrl,
            listings,
            conversionSnapshot,
            capturedAt: capturedAt.toISOString()
          })
          : null;

        await writeRecords(database, watch, snapshot);
        return { watch, snapshot };
      }
    });
  }

  async function readState() {
    return withDatabase({
      openDatabase,
      work: async (database) => {
        const watches = await readAll(database, WATCHES_STORE);
        const snapshots = await readAll(database, SNAPSHOTS_STORE);
        const settings = normalizeAppSettings(await readRecord(database, SETTINGS_STORE, APP_SETTINGS_ID));
        return {
          watches: watches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          snapshots: snapshots.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
          settings
        };
      }
    });
  }

  async function updateAppSettings({ useWatchNameOnTradeSite }) {
    const settings = createAppSettings({ useWatchNameOnTradeSite });
    return withDatabase({
      openDatabase,
      work: async (database) => {
        await writeRecord(database, SETTINGS_STORE, settings);
        return { settings };
      }
    });
  }

  async function readTradePageTitle({ sourceUrl, activeQueryId }) {
    return withDatabase({
      openDatabase,
      work: async (database) => {
        const [watches, storedSettings] = await Promise.all([
          readAll(database, WATCHES_STORE),
          readRecord(database, SETTINGS_STORE, APP_SETTINGS_ID)
        ]);
        return resolveTradePageTitleDirective({
          settings: normalizeAppSettings(storedSettings),
          watches,
          sourceUrl,
          activeQueryId
        });
      }
    });
  }

  async function updateWatchSettings({ watchId, displayCurrencyPreference }) {
    if (!DISPLAY_CURRENCY_OPTIONS.includes(displayCurrencyPreference)) {
      throw new Error("invalid_display_currency");
    }

    return withDatabase({
      openDatabase,
      work: async (database) => {
        const watch = await readRecord(database, WATCHES_STORE, watchId);
        if (!watch) {
          throw new Error("watch_not_found");
        }

        const nextWatch = {
          ...watch,
          displayCurrencyPreference,
          updatedAt: new Date().toISOString()
        };
        await writeRecord(database, WATCHES_STORE, nextWatch);
        return { watch: nextWatch };
      }
    });
  }

  async function updateWatchName({ watchId, name }) {
    const nextName = sanitizeWatchName(name);
    if (!nextName) {
      throw new Error("invalid_watch_name");
    }

    return withDatabase({
      openDatabase,
      work: async (database) => {
        const watch = await readRecord(database, WATCHES_STORE, watchId);
        if (!watch) {
          throw new Error("watch_not_found");
        }

        const nextWatch = {
          ...watch,
          name: nextName,
          customName: true,
          updatedAt: new Date().toISOString()
        };
        await writeRecord(database, WATCHES_STORE, nextWatch);
        return { watch: nextWatch };
      }
    });
  }

  async function deleteWatch({ watchId }) {
    if (typeof watchId !== "string" || watchId.trim().length === 0) {
      throw new Error("invalid_watch_id");
    }

    return withDatabase({
      openDatabase,
      work: (database) => deleteWatchRecords(database, watchId)
    });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = globalScope.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const database = request.result;
        if (!database.objectStoreNames.contains(WATCHES_STORE)) {
          const watches = database.createObjectStore(WATCHES_STORE, { keyPath: "id" });
          watches.createIndex("league", "league", { unique: false });
        } else {
          createMissingIndex(request.transaction.objectStore(WATCHES_STORE), "league", "league");
        }
        if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          const snapshots = database.createObjectStore(SNAPSHOTS_STORE, { keyPath: "id" });
          snapshots.createIndex("watchId", "watchId", { unique: false });
          snapshots.createIndex("capturedAt", "capturedAt", { unique: false });
          snapshots.createIndex("league", "league", { unique: false });
        } else {
          const snapshots = request.transaction.objectStore(SNAPSHOTS_STORE);
          createMissingIndex(snapshots, "watchId", "watchId");
          createMissingIndex(snapshots, "capturedAt", "capturedAt");
          createMissingIndex(snapshots, "league", "league");
        }
        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          database.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
        }
        if (event.oldVersion > 0 && event.oldVersion < 3) {
          migrateToCollisionFreeWatchIds(request.transaction);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function writeRecords(database, nextWatch, snapshot) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([WATCHES_STORE, SNAPSHOTS_STORE], "readwrite");
      const watches = transaction.objectStore(WATCHES_STORE);
      const snapshots = transaction.objectStore(SNAPSHOTS_STORE);
      const existingRequest = watches.get(nextWatch.id);

      existingRequest.onsuccess = () => {
        const existingWatch = existingRequest.result;
        watches.put(existingWatch ? mergeWatch(existingWatch, nextWatch) : nextWatch);
        if (snapshot) {
          snapshots.put(snapshot);
        }
      };
      existingRequest.onerror = () => reject(existingRequest.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function writeRecord(database, storeName, record) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function readRecord(database, storeName, id) {
    return new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly")
        .objectStore(storeName)
        .get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  function deleteWatchRecords(database, watchId) {
    return new Promise((resolve, reject) => {
      let deletedSnapshotCount = 0;
      const transaction = database.transaction([WATCHES_STORE, SNAPSHOTS_STORE], "readwrite");
      const watches = transaction.objectStore(WATCHES_STORE);
      const snapshots = transaction.objectStore(SNAPSHOTS_STORE);
      const snapshotKeysRequest = snapshots.index("watchId").getAllKeys(watchId);

      watches.delete(watchId);
      snapshotKeysRequest.onsuccess = () => {
        for (const key of snapshotKeysRequest.result) {
          snapshots.delete(key);
          deletedSnapshotCount += 1;
        }
      };
      snapshotKeysRequest.onerror = () => reject(snapshotKeysRequest.error);
      transaction.oncomplete = () => resolve({ deletedWatchId: watchId, deletedSnapshotCount });
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function readAll(database, storeName) {
    return new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly")
        .objectStore(storeName)
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function mergeWatch(existingWatch, nextWatch) {
    return {
      ...existingWatch,
      name: existingWatch.customName ? existingWatch.name : nextWatch.name,
      sourceUrl: nextWatch.sourceUrl,
      updatedAt: nextWatch.updatedAt,
      archivedAt: null,
      customName: existingWatch.customName ?? false,
      displayCurrencyPreference: existingWatch.displayCurrencyPreference ?? "auto",
      searchCondition: nextWatch.searchCondition ?? existingWatch.searchCondition ?? null
    };
  }

  function migrateToCollisionFreeWatchIds(transaction) {
    const watches = transaction.objectStore(WATCHES_STORE);
    const snapshots = transaction.objectStore(SNAPSHOTS_STORE);
    migrateWatchStore(watches);
    migrateSnapshotStore(snapshots);
  }

  function migrateWatchStore(store) {
    const request = store.getAll();
    request.onsuccess = () => {
      const watches = request.result;
      const migratedWatches = migrateWatchRecords({ watches, snapshots: [] }).watches;
      const migratedIds = new Set(migratedWatches.map((watch) => watch.id));
      for (const watch of watches) {
        if (!migratedIds.has(watch.id)) {
          store.delete(watch.id);
        }
      }
      for (const watch of migratedWatches) {
        store.put(watch);
      }
    };
  }

  function migrateSnapshotStore(store) {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const migrated = migrateSnapshotRecord(cursor.value);
      if (cursor.value.id !== migrated.id) {
        store.delete(cursor.primaryKey);
        store.put(migrated);
      }
      cursor.continue();
    };
  }

  function createMissingIndex(store, indexName, keyPath) {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, keyPath, { unique: false });
    }
  }

  globalScope.Poe2WatchStore = {
    saveWatchSnapshot,
    readState,
    updateAppSettings,
    readTradePageTitle,
    updateWatchSettings,
    updateWatchName,
    deleteWatch
  };
})(globalThis);
