import assert from "node:assert/strict";
import test from "node:test";
import { withDatabase } from "./database-lifecycle.js";

test("withDatabase closes the connection after successful work", async () => {
  let closeCount = 0;
  const database = { close: () => { closeCount += 1; } };

  const result = await withDatabase({
    openDatabase: async () => database,
    work: async (openedDatabase) => openedDatabase
  });

  assert.equal(result, database);
  assert.equal(closeCount, 1);
});

test("withDatabase closes the connection after failed work", async () => {
  let closeCount = 0;
  const database = { close: () => { closeCount += 1; } };

  await assert.rejects(
    withDatabase({
      openDatabase: async () => database,
      work: async () => {
        throw new Error("request_failed");
      }
    }),
    /request_failed/
  );

  assert.equal(closeCount, 1);
});
