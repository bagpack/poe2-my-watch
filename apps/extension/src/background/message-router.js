import { extractTradeLeague } from "../shared/trade-url.js";

export async function handleExtensionMessage(message, services) {
  if (!message || typeof message.type !== "string") {
    return { ok: false, error: "invalid_message" };
  }

  if (message.type === "openPopup") {
    const result = await openPopup(services);
    return { ok: true, data: result };
  }

  const store = resolveStore(services);
  if (message.type === "saveWatchSnapshot") {
    const payload = await enrichSnapshotPayload(message.payload, services);
    const result = await store.saveWatchSnapshot(payload);
    await notifyTradePageTitleChanged(services);
    return { ok: true, data: result };
  }

  if (message.type === "readState") {
    const state = await store.readState();
    return { ok: true, data: state };
  }

  if (message.type === "readTradePageTitle") {
    const directive = await store.readTradePageTitle(message.payload);
    return { ok: true, data: directive };
  }

  if (message.type === "updateAppSettings") {
    const result = await store.updateAppSettings(message.payload);
    await notifyTradePageTitleChanged(services);
    return { ok: true, data: result };
  }

  if (message.type === "updateWatchSettings") {
    const result = await store.updateWatchSettings(message.payload);
    return { ok: true, data: result };
  }

  if (message.type === "updateWatchName") {
    const result = await store.updateWatchName(message.payload);
    await notifyTradePageTitleChanged(services);
    return { ok: true, data: result };
  }

  if (message.type === "deleteWatch") {
    const result = await store.deleteWatch(message.payload);
    await notifyTradePageTitleChanged(services);
    return { ok: true, data: result };
  }

  return { ok: false, error: "unknown_message_type" };
}

async function notifyTradePageTitleChanged(services) {
  if (typeof services?.notifyTradePageTitleChanged !== "function") {
    return;
  }
  try {
    await services.notifyTradePageTitleChanged();
  } catch (error) {
    resolveLogger(services)?.warn?.("PoE2 My Watch: trade page title update skipped.", error);
  }
}

function hasPricedListings(listings) {
  return Array.isArray(listings) && listings.some((listing) => (
    typeof listing?.rawAmount === "number"
      && Number.isFinite(listing.rawAmount)
      && listing.rawAmount >= 0
      && typeof listing.rawCurrency === "string"
      && listing.rawCurrency.trim().length > 0
  ));
}

async function openPopup(services) {
  if (typeof services?.openPopup !== "function") {
    return { opened: false, reason: "unsupported" };
  }

  try {
    await services.openPopup();
    return { opened: true };
  } catch (error) {
    resolveLogger(services)?.warn?.("PoE2 My Watch: popup open skipped.", error);
    return { opened: false, reason: error?.message ?? "open_popup_failed" };
  }
}

function resolveStore(services) {
  return services?.store ?? services;
}

async function enrichSnapshotPayload(payload, services) {
  const provider = services?.conversionSnapshotProvider;
  if (!provider || !payload?.sourceUrl || !hasPricedListings(payload.listings)) {
    return payload;
  }

  const capturedAt = payload.now ?? new Date().toISOString();
  const conversionSnapshot = await readConversionSnapshot({
    provider,
    sourceUrl: payload.sourceUrl,
    capturedAt,
    logger: resolveLogger(services)
  });
  if (!conversionSnapshot) {
    return payload;
  }

  return {
    ...payload,
    conversionSnapshot,
    now: capturedAt
  };
}

async function readConversionSnapshot({ provider, sourceUrl, capturedAt, logger }) {
  try {
    return await provider({
      league: extractTradeLeague(sourceUrl),
      capturedAt
    });
  } catch (error) {
    logger?.warn?.("PoE2 My Watch: conversion snapshot skipped.", error);
    return null;
  }
}

function resolveLogger(services) {
  if (services && Object.hasOwn(services, "logger")) {
    return services.logger;
  }
  return console;
}
