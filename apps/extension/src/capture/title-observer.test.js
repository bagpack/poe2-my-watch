import assert from "node:assert/strict";
import test from "node:test";
import { createTitleChangeObserver } from "./title-observer.js";

test("title observer watches the title element instead of the whole head", () => {
  const observed = [];
  const title = { nodeName: "TITLE" };
  const head = { querySelector: (selector) => selector === "title" ? title : null };
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe(target, options) {
      observed.push({ target, options });
    }

    disconnect() {}
  }

  createTitleChangeObserver({
    document: { head },
    onChange: () => {},
    MutationObserverImpl: FakeMutationObserver
  });

  assert.equal(observed[0].target, title);
  assert.deepEqual(observed[0].options, { characterData: true, childList: true, subtree: true });
});

test("title observer coalesces multiple title mutations into one callback", async () => {
  let observer;
  let changeCount = 0;
  const title = { nodeName: "TITLE" };
  const head = { querySelector: () => title };
  class FakeMutationObserver {
    constructor(callback) {
      observer = { callback };
    }

    observe() {}
    disconnect() {}
  }

  createTitleChangeObserver({
    document: { head },
    onChange: () => { changeCount += 1; },
    MutationObserverImpl: FakeMutationObserver,
    queueMicrotaskImpl: queueMicrotask
  });

  observer.callback([{ type: "characterData" }]);
  observer.callback([{ type: "childList" }]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(changeCount, 1);
});
