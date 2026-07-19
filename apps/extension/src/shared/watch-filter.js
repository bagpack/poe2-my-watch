export function normalizeWatchFilterText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function filterWatches(watches, query) {
  const terms = normalizeWatchFilterText(query).split(" ").filter(Boolean);
  if (terms.length === 0) {
    return [...watches];
  }

  return watches.filter((watch) => {
    const searchableText = normalizeWatchFilterText(watch.name);
    return terms.every((term) => searchableText.includes(term));
  });
}
