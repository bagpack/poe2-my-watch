export function createBoxPlotScale({ values, width }) {
  const numericValues = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const range = max - min;

  return {
    min,
    max,
    x(value) {
      if (range === 0) {
        return Math.round(width / 2);
      }
      return Math.round(((value - min) / range) * width);
    }
  };
}
