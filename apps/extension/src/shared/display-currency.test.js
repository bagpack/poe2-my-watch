import test from "node:test";
import assert from "node:assert/strict";
import {
  DISPLAY_CURRENCY_OPTIONS,
  convertDisplayAmount,
  formatDisplayPrice,
  resolveDisplayCurrency
} from "./display-currency.js";

const exaltedSnapshot = {
  baseCurrency: "exalted",
  medianPrice: 374,
  conversionSnapshot: {
    rates: {
      exalted: 1,
      divine: 187,
      chaos: 7,
      mirror: 3121019.880845904
    }
  }
};

test("resolveDisplayCurrency chooses divine for large exalted values", () => {
  assert.equal(resolveDisplayCurrency({ snapshot: exaltedSnapshot }), "divine");
});

test("resolveDisplayCurrency respects watch preference when convertible", () => {
  assert.equal(resolveDisplayCurrency({
    snapshot: exaltedSnapshot,
    preference: "chaos"
  }), "chaos");
});

test("display currency options include mirror", () => {
  assert.deepEqual(DISPLAY_CURRENCY_OPTIONS, ["auto", "exalted", "divine", "chaos", "mirror"]);
});

test("convertDisplayAmount converts exalted values to mirror", () => {
  assert.equal(convertDisplayAmount({
    amount: 3121019.880845904,
    snapshot: exaltedSnapshot,
    displayCurrency: "mirror"
  }), 1);
  assert.equal(formatDisplayPrice({
    amount: 3121019.880845904,
    snapshot: exaltedSnapshot,
    displayCurrency: "mirror"
  }), "1 mirror");
});

test("convertDisplayAmount converts exalted normalized values to selected currency", () => {
  assert.equal(convertDisplayAmount({
    amount: 374,
    snapshot: exaltedSnapshot,
    displayCurrency: "divine"
  }), 2);
});

test("formatDisplayPrice renders the selected display currency", () => {
  assert.equal(formatDisplayPrice({
    amount: 374,
    snapshot: exaltedSnapshot,
    displayCurrency: "divine"
  }), "2 div");
});

test("resolveDisplayCurrency falls back to snapshot base when conversion rates are absent", () => {
  assert.equal(resolveDisplayCurrency({
    snapshot: {
      baseCurrency: "divine",
      medianPrice: 2
    },
    preference: "exalted"
  }), "divine");
});

test("convertDisplayAmount uses each snapshot's own conversion rate", () => {
  const olderSnapshot = {
    baseCurrency: "exalted",
    conversionSnapshot: {
      sourceEpoch: 100,
      rates: {
        exalted: 1,
        divine: 100,
        chaos: 5
      }
    }
  };
  const newerSnapshot = {
    baseCurrency: "exalted",
    conversionSnapshot: {
      sourceEpoch: 200,
      rates: {
        exalted: 1,
        divine: 200,
        chaos: 10
      }
    }
  };

  assert.equal(convertDisplayAmount({
    amount: 200,
    snapshot: olderSnapshot,
    displayCurrency: "divine"
  }), 2);
  assert.equal(convertDisplayAmount({
    amount: 200,
    snapshot: newerSnapshot,
    displayCurrency: "divine"
  }), 1);
});
