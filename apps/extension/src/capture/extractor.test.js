import test from "node:test";
import assert from "node:assert/strict";
import {
  createWatchName,
  extractSearchCondition,
  extractListingsFromTradeFetchResponse,
  extractListingsFromTradeFetchResponses,
  isPoe2TradeSearchUrl,
  parsePriceText,
  selectVisibleTradeListings
} from "./extractor.js";

test("isPoe2TradeSearchUrl only accepts official POE2 trade searches", () => {
  assert.equal(
    isPoe2TradeSearchUrl("https://www.pathofexile.com/trade2/search/poe2/Standard/abc"),
    true
  );
  assert.equal(
    isPoe2TradeSearchUrl("https://jp.pathofexile.com/trade2/search/poe2/Standard/abc"),
    true
  );
  assert.equal(
    isPoe2TradeSearchUrl("https://fr.pathofexile.com/trade2/search/poe2/Standard/abc"),
    true
  );
  assert.equal(
    isPoe2TradeSearchUrl("https://www.pathofexile.com/trade/search/Standard/abc"),
    false
  );
  assert.equal(
    isPoe2TradeSearchUrl("https://www.pathofexile.com.evil.example/trade2/search/poe2/Standard/abc"),
    false
  );
});

test("parsePriceText reads common POE2 currencies", () => {
  assert.deepEqual(parsePriceText("~price 12 exalted"), {
    amount: 12,
    currency: "exalted"
  });
  assert.deepEqual(parsePriceText("1.5 div"), {
    amount: 1.5,
    currency: "divine"
  });
  assert.deepEqual(parsePriceText("~price 0.5 mirror"), {
    amount: 0.5,
    currency: "mirror"
  });
});

test("extractListingsFromTradeFetchResponse reads listing prices and item names", () => {
  const listings = extractListingsFromTradeFetchResponse({
    result: [
      {
        id: "item-a",
        item: {
          name: "Rapture Knell",
          typeLine: "Advanced Shrine Sceptre"
        },
        listing: {
          indexed: "2026-06-28T00:00:00Z",
          price: {
            amount: 12,
            currency: "exalted"
          },
          account: {
            online: true
          }
        }
      }
    ]
  });

  assert.deepEqual(listings, [
    {
      externalListingId: "item-a",
      rawAmount: 12,
      rawCurrency: "exalted",
      indexedAt: "2026-06-28T00:00:00Z",
      sellerStatus: "online",
      itemName: "Rapture Knell Advanced Shrine Sceptre",
      position: 1
    }
  ]);
});

test("extractListingsFromTradeFetchResponses merges chunks and reindexes unique listings", () => {
  const listings = extractListingsFromTradeFetchResponses([
    tradeFetchResponse([
      tradeFetchEntry({ id: "item-a", amount: 4 }),
      tradeFetchEntry({ id: "item-b", amount: 6 })
    ]),
    tradeFetchResponse([
      tradeFetchEntry({ id: "item-b", amount: 3 }),
      tradeFetchEntry({ id: "item-c", amount: 8 })
    ])
  ]);

  assert.deepEqual(listings.map((listing) => listing.externalListingId), ["item-a", "item-b", "item-c"]);
  assert.deepEqual(listings.map((listing) => listing.rawAmount), [4, 3, 8]);
  assert.deepEqual(listings.map((listing) => listing.position), [1, 2, 3]);
});

test("selectVisibleTradeListings keeps visible order and prefers newer duplicate listings", () => {
  const listings = [
    tradeListing({ id: "item-a", amount: 10 }),
    tradeListing({ id: "item-b", amount: 20 }),
    tradeListing({ id: "item-a", amount: 5 }),
    tradeListing({ id: "item-c", amount: 30 })
  ];

  const selected = selectVisibleTradeListings({
    listings,
    visibleListingIds: ["item-c", "item-a"]
  });

  assert.deepEqual(selected.map((listing) => listing.externalListingId), ["item-c", "item-a"]);
  assert.deepEqual(selected.map((listing) => listing.rawAmount), [30, 5]);
  assert.deepEqual(selected.map((listing) => listing.position), [1, 2]);
});

test("selectVisibleTradeListings rejects cached listings when visible ids are unavailable", () => {
  const selected = selectVisibleTradeListings({
    listings: [tradeListing({ id: "cached-item", amount: 10 })],
    visibleListingIds: []
  });

  assert.deepEqual(selected, []);
});

test("isPoe2TradeSearchUrl rejects non-HTTPS trade searches", () => {
  assert.equal(
    isPoe2TradeSearchUrl("http://www.pathofexile.com/trade2/search/poe2/Standard/abc"),
    false
  );
});

test("createWatchName uses representative item name before generic title", () => {
  const name = createWatchName({
    pageUrl: "https://jp.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/d88onbj5IJ",
    fallbackTitle: "Path of Exile",
    listings: [{ itemName: "Rapture Knell Advanced Shrine Sceptre" }]
  });

  assert.equal(name, "Rapture Knell Advanced Shrine Sceptre");
});

test("extractSearchCondition stores stable URL-derived search metadata", () => {
  const condition = extractSearchCondition({
    pageUrl: "https://jp.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/d88onbj5IJ",
    title: "Rare boots - Path of Exile",
    root: null
  });

  assert.deepEqual(condition, {
    title: "Rare boots",
    realm: "poe2",
    league: "Runes of Aldur",
    queryId: "d88onbj5IJ",
    sourceUrl: "https://jp.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/d88onbj5IJ",
    filters: []
  });
});

test("extractSearchCondition stores only specified filter values", () => {
  const root = fakeRoot([
    fakeFilter({
      id: "equipment.energy_shield",
      label: "Energy Shield",
      inputs: [{ tagName: "INPUT", type: "number", value: "120" }]
    }),
    fakeFilter({
      id: "equipment.evasion",
      label: "Evasion Rating",
      textContent: "Evasion Rating 0 100 200"
    }),
    fakeFilter({
      id: "equipment.armour",
      label: "Armour",
      inputs: [{ tagName: "INPUT", type: "number", value: "" }]
    }),
    fakeFilter({
      id: "trade.online",
      label: "Status",
      inputs: [{ tagName: "SELECT", value: "", selectedText: "Any" }]
    })
  ]);

  const condition = extractSearchCondition({
    pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/abc",
    root
  });

  assert.deepEqual(condition.filters, [
    {
      label: "equipment.energy_shield",
      value: "120"
    }
  ]);
});

function fakeRoot(nodes) {
  return {
    querySelectorAll(selector) {
      if (selector === "[data-filter-id]") {
        return nodes;
      }
      return [];
    }
  };
}

function tradeFetchResponse(result) {
  return { result };
}

function tradeFetchEntry({ id, amount }) {
  return {
    id,
    item: {
      typeLine: id
    },
    listing: {
      price: {
        amount,
        currency: "exalted"
      }
    }
  };
}

function tradeListing({ id, amount }) {
  return {
    externalListingId: id,
    rawAmount: amount,
    rawCurrency: "exalted",
    position: 1
  };
}

function fakeFilter({ id, label, inputs = [], textContent = "" }) {
  return {
    textContent,
    getAttribute(name) {
      return name === "data-filter-id" ? id : null;
    },
    querySelector(selector) {
      if (selector === ".filter-title, .title, label") {
        return { textContent: label };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector !== "input, select") {
        return [];
      }
      return inputs.map((input) => ({
        tagName: input.tagName,
        type: input.type ?? "",
        value: input.value ?? "",
        checked: input.checked ?? false,
        selectedOptions: input.selectedText ? [{ textContent: input.selectedText }] : []
      }));
    },
    closest() {
      return null;
    }
  };
}
