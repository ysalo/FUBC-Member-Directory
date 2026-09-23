import assert from "node:assert/strict";
import test from "node:test";

import { createAsyncCache } from "../src/lib/query-cache.ts";

test("async cache deduplicates concurrent loads and expires by injected clock", async () => {
  let now = 100;
  let loads = 0;
  const cache = createAsyncCache({ now: () => now });
  const load = async () => {
    loads += 1;
    return { value: loads };
  };

  const [first, second] = await Promise.all([
    cache.getOrLoad("directory:user:1", load, 30),
    cache.getOrLoad("directory:user:1", load, 30),
  ]);
  assert.strictEqual(first, second);
  assert.equal(first.value, 1);
  assert.equal(loads, 1);
  assert.equal(cache.get("directory:user:1")?.value, 1);

  now = 129;
  assert.equal(cache.get("directory:user:1")?.value, 1);
  now = 130;
  assert.equal(cache.get("directory:user:1"), undefined);
  assert.equal((await cache.getOrLoad("directory:user:1", load, 30)).value, 2);
  assert.equal(loads, 2);
});

test("failed loads are not cached and explicit invalidation removes values", async () => {
  let loads = 0;
  const cache = createAsyncCache({ now: () => 0 });
  await assert.rejects(cache.getOrLoad("key", async () => {
    loads += 1;
    throw new Error("temporary failure");
  }, 100), /temporary failure/);
  await assert.rejects(cache.getOrLoad("key", async () => {
    loads += 1;
    throw new Error("temporary failure");
  }, 100), /temporary failure/);
  assert.equal(loads, 2);

  await cache.getOrLoad("key", async () => "cached", 100);
  assert.equal(cache.size(), 1);
  cache.clear("key");
  assert.equal(cache.get("key"), undefined);
});

test("clearing while a request is pending prevents the old response from repopulating", async () => {
  let resolve;
  const cache = createAsyncCache({ now: () => 0 });
  const pending = cache.getOrLoad("session-a", () => new Promise((done) => { resolve = done; }), 100);
  cache.clear();
  resolve("old account data");
  assert.equal(await pending, "old account data");
  assert.equal(cache.get("session-a"), undefined);
});
