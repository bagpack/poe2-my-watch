export const DISPLAY_CURRENCY_OPTIONS = ["auto", "exalted", "divine", "chaos", "mirror"];

export function resolveDisplayCurrency({ snapshot, preference = "auto", referenceValue = null }) {
  if (!snapshot) {
    return "exalted";
  }

  if (preference !== "auto" && canDisplayCurrency(snapshot, preference)) {
    return preference;
  }

  const baseCurrency = snapshot.baseCurrency ?? "exalted";
  if (!canDisplayCurrency(snapshot, "exalted")) {
    return baseCurrency;
  }

  const value = typeof referenceValue === "number" ? referenceValue : snapshot.medianPrice;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return baseCurrency;
  }

  const rates = snapshot.conversionSnapshot?.rates;
  if (!rates) {
    return baseCurrency;
  }

  if (canDisplayCurrency(snapshot, "divine") && value >= rates.divine) {
    return "divine";
  }

  if (canDisplayCurrency(snapshot, "chaos") && value < 1 && rates.chaos > 0) {
    return "chaos";
  }

  return baseCurrency;
}

export function convertDisplayAmount({ amount, snapshot, displayCurrency }) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  const baseCurrency = snapshot?.baseCurrency ?? "exalted";
  if (displayCurrency === baseCurrency) {
    return amount;
  }

  if (!canDisplayCurrency(snapshot, displayCurrency)) {
    return null;
  }

  const rates = snapshot.conversionSnapshot.rates;
  if (baseCurrency === "exalted") {
    return amount / rates[displayCurrency];
  }

  if (displayCurrency === "exalted") {
    return amount * rates[baseCurrency];
  }

  return (amount * rates[baseCurrency]) / rates[displayCurrency];
}

export function formatDisplayPrice({ amount, snapshot, displayCurrency }) {
  const converted = convertDisplayAmount({ amount, snapshot, displayCurrency });
  if (converted === null) {
    return "-";
  }
  return `${formatNumber(converted)} ${formatCurrency(displayCurrency)}`;
}

export function canDisplayCurrency(snapshot, currency) {
  if (!snapshot || !currency) {
    return false;
  }

  const baseCurrency = snapshot.baseCurrency ?? "exalted";
  if (currency === baseCurrency) {
    return true;
  }

  const rates = snapshot.conversionSnapshot?.rates;
  return typeof rates?.[currency] === "number"
    && Number.isFinite(rates[currency])
    && rates[currency] > 0
    && typeof rates?.[baseCurrency] === "number"
    && Number.isFinite(rates[baseCurrency])
    && rates[baseCurrency] > 0;
}

export function formatCurrency(currency) {
  const labels = {
    exalted: "ex",
    divine: "div",
    chaos: "chaos",
    mirror: "mirror"
  };
  return labels[currency] ?? currency ?? "";
}

function formatNumber(value) {
  if (value >= 100) {
    return String(Math.round(value));
  }
  if (value >= 10) {
    return String(Number(value.toFixed(1)));
  }
  return String(Number(value.toFixed(2)));
}
