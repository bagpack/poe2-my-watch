export function createTitleChangeObserver({
  document,
  onChange,
  MutationObserverImpl = globalThis.MutationObserver,
  queueMicrotaskImpl = queueMicrotask
}) {
  const title = document.head?.querySelector("title");
  if (!title) {
    return () => {};
  }

  let scheduled = false;
  const observer = new MutationObserverImpl((mutations) => {
    if (!mutations.some((mutation) => mutation.type === "characterData" || mutation.type === "childList")) {
      return;
    }
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotaskImpl(() => {
      scheduled = false;
      onChange();
    });
  });
  observer.observe(title, { characterData: true, childList: true, subtree: true });
  return () => observer.disconnect();
}
