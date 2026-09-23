import assert from "node:assert/strict";
import test from "node:test";

import { createAsyncCache, InvalidatedRequestError } from "../src/lib/query-cache.ts";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const photoModule = {};
new Function("require", "exports", ts.transpileModule(await readFile(new URL("../src/lib/photo-cache.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(() => ({ createAsyncCache }), photoModule);
const { createPhotoCache, thumbnailPath } = photoModule;

const sessionCode = ts.transpileModule(await readFile(new URL("../src/lib/session-cache.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function sessionHarness() {
  let now = 0;
  let state = { status: "ready", account: { id: "user", status: "active", role: "member", leadershipMinistry: null, personId: "person", revision: 1 } };
  const listeners = [];
  const exports = {};
  new Function("require", "exports", sessionCode)((id) => {
    if (id === "./query-cache") return { InvalidatedRequestError, createAsyncCache: (options) => createAsyncCache({ ...options, now: () => now }) };
    if (id === "./session") return { getSessionState: () => state, subscribeSession: (listener) => listeners.push(listener) };
    if (id === "./supabase") return { isBackendConfigured: true };
    throw new Error(id);
  }, exports);
  return { ...exports, advance: (time) => { now += time; }, publish: (next) => { state = next; listeners.forEach((listener) => listener()); }, getState: () => state };
}

test("three datasets remain warm for ten tab cycles; refresh, expiry and writes reload", async () => {
  const session = sessionHarness();
  const topics = ["directory", "groups", "duty"];
  const caches = topics.map((topic) => session.createSessionCache([topic]));
  const reads = [0, 0, 0];
  const read = (index, fresh = false) => caches[index].load(topics[index], async () => ++reads[index], fresh);
  for (let cycle = 0; cycle < 10; cycle++) await Promise.all(topics.map((_, index) => read(index)));
  assert.deepEqual(reads, [1, 1, 1]);
  await read(1, true);
  assert.deepEqual(reads, [1, 2, 1]);
  session.invalidateData("directory", "duty");
  await Promise.all(topics.map((_, index) => read(index)));
  assert.deepEqual(reads, [2, 2, 2]);
  session.advance(300_000);
  await Promise.all(topics.map((_, index) => read(index)));
  assert.deepEqual(reads, [3, 3, 3]);
});

test("account scope changes clear snapshots, fail closed and reject pending callers", async () => {
  for (const change of [{ id: "other" }, { role: "editor" }, { revision: 2 }, { personId: "other-person" }, { leadershipMinistry: "deacon" }, { status: "revoked" }]) {
    const session = sessionHarness();
    const cache = session.createSessionCache(["directory"]);
    await cache.load("saved", async () => "private");
    let finish;
    const pending = cache.load("pending", () => new Promise((resolve) => { finish = resolve; }));
    await Promise.resolve();
    session.publish({ status: "ready", account: { ...session.getState().account, ...change } });
    finish("late private data");
    await assert.rejects(pending, /invalidated/);
    assert.equal(cache.peek("saved"), undefined);
  }
  const session = sessionHarness();
  const cache = session.createSessionCache(["directory"]);
  const firstScope = session.sessionCacheScope();
  const account = session.getState().account;
  session.publish({ status: "signed-out", account: null });
  await assert.rejects(cache.load("saved", async () => "should not load"), /invalidated/);
  session.publish({ status: "ready", account });
  assert.notEqual(session.sessionCacheScope(), firstScope);
});

test("same account token refresh preserves cache and unrelated invalidations do not evict it", async () => {
  const session = sessionHarness();
  const cache = session.createSessionCache(["directory"]);
  await cache.load("saved", async () => "private");
  session.publish({ ...session.getState(), account: { ...session.getState().account } });
  session.invalidateData("visits");
  assert.equal(await cache.load("saved", async () => "unexpected"), "private");
});

test("warm resources retain data through refresh errors, suppress blurred responses and seed remounts", async () => {
  const session = sessionHarness();
  const code = ts.transpileModule(await readFile(new URL("../src/lib/use-warm-resource.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let slots = [], cursor = 0, effect, cleanup;
  const react = {
    useCallback: (callback) => callback,
    useRef: (value) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
  };
  const exports = {};
  new Function("require", "exports", "setInterval", "clearInterval", code)((id) => {
    if (id === "react") return react;
    if (id === "expo-router") return { useFocusEffect: (callback) => { effect = callback; } };
    if (id === "react-native") return { Platform: { OS: "ios" }, AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) } };
    if (id === "./session-cache") return session;
    if (id === "./query-cache") return { InvalidatedRequestError };
    if (id === "./session") return { refreshSession: async () => {} };
    if (id === "./supabase") return { isBackendConfigured: true };
    throw new Error(id);
  }, exports, () => 1, () => {});
  let loader = async () => ["member"];
  const render = () => { cursor = 0; return exports.useWarmResource("directory", loader); };
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  assert.equal(render().status, "loading");
  cleanup = effect();
  await settle();
  const initial = render().data;
  assert.deepEqual(initial, ["member"]);
  cleanup();
  let reject;
  loader = () => new Promise((resolve, fail) => { reject = fail; });
  render(); cleanup = effect();
  await settle();
  assert.strictEqual(render().data, initial);
  assert.equal(render().status, "ready");
  reject(new Error("offline"));
  await settle();
  assert.strictEqual(render().data, initial);
  assert.equal(render().error, true);
  cleanup();
  let finish;
  loader = () => new Promise((resolve) => { finish = resolve; });
  render(); cleanup = effect();
  await settle();
  cleanup();
  finish(["late"]);
  await settle();
  assert.strictEqual(render().data, initial);
  slots = [];
  assert.deepEqual(render().data, ["late"]);
  session.publish({ status: "signed-out", account: null });
  assert.equal(render().data, undefined);
});

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
  await Promise.resolve();
  cache.clear();
  resolve("old account data");
  await assert.rejects(pending, /invalidated/);
  assert.equal(cache.get("session-a"), undefined);
});

test("stale snapshots are bounded and expire independently of freshness", async () => {
  let now = 0;
  const cache = createAsyncCache({ now: () => now, retainMs: 50, maxEntries: 2 });
  await cache.getOrLoad("first", async () => 1, 10);
  now = 10;
  assert.equal(cache.get("first"), undefined);
  assert.equal(cache.peek("first"), 1);
  now = 60;
  assert.equal(cache.peek("first"), undefined);
  for (const key of ["a", "b", "c"]) await cache.getOrLoad(key, async () => key, 10);
  assert.equal(cache.size(), 2);
  assert.equal(cache.peek("a"), undefined);
});

test("targeted invalidation does not discard unrelated requests or replacement loads", async () => {
  const cache = createAsyncCache();
  let finishOld;
  const old = cache.getOrLoad("a", () => new Promise((resolve) => { finishOld = resolve; }), 1000);
  const other = cache.getOrLoad("b", async () => "other", 1000);
  await Promise.resolve();
  cache.clear("a");
  const replacement = cache.getOrLoad("a", async () => "new", 1000);
  finishOld("old");
  await assert.rejects(old, /invalidated/);
  assert.equal(await other, "other");
  assert.equal(await replacement, "new");
  assert.equal(cache.get("a"), "new");
});

test("photos batch overlapping requests, share sources and renew separately from data", async () => {
  let now = 0;
  const calls = [];
  const cache = createPhotoCache(async (paths) => {
    calls.push(paths);
    return new Map(paths.map((path) => [path, `signed:${calls.length}:${path}`]));
  }, () => now);
  const [directory, groups] = await Promise.all([
    cache.sources(["a", "b"], "user:1"), cache.sources(["b", "c"], "user:1"),
  ]);
  assert.deepEqual(calls, [[thumbnailPath("a"), thumbnailPath("b"), thumbnailPath("c")]]);
  assert.strictEqual(directory.get("b"), groups.get("b"));
  for (let index = 0; index < 10; index++) await cache.sources(["a", "b", "c"], "user:1");
  assert.equal(calls.length, 1);
  now = 240_000;
  const renewed = await cache.sources(["b"], "user:1");
  assert.equal(calls.length, 2);
  assert.equal(renewed.get("b").cacheKey, groups.get("b").cacheKey);
  assert.notEqual(renewed.get("b").uri, groups.get("b").uri);
  await cache.sources(["b"], "user:2");
  await cache.sources(["b"], "user:2", "original");
  assert.deepEqual(calls.slice(2), [[thumbnailPath("b")], ["b"]]);
});

test("missing thumbnails never sign originals and failures can be retried", async () => {
  const calls = [];
  const cache = createPhotoCache(async (paths) => { calls.push(paths); return new Map(); });
  assert.equal((await cache.sources(["photo"], "user")).size, 0);
  assert.equal((await cache.sources(["photo"], "user")).size, 0);
  assert.deepEqual(calls, [[thumbnailPath("photo")], [thumbnailPath("photo")]]);
});

test("photo batches are bounded and session invalidation suppresses late sources", async () => {
  const batches = [];
  const cache = createPhotoCache(async (paths) => { batches.push(paths); return new Map(paths.map((path) => [path, path])); });
  await cache.sources(Array.from({ length: 999 }, (_, index) => String(index)), "user");
  assert.equal(batches.length, 10);
  assert.ok(batches.every((batch) => batch.length <= 100));
  let resolve;
  const delayed = createPhotoCache(() => new Promise((done) => { resolve = done; }));
  const pending = delayed.sources(["a"], "old");
  await Promise.resolve();
  await Promise.resolve();
  delayed.clear();
  resolve(new Map([[thumbnailPath("a"), "signed:old"]]));
  assert.equal((await pending).size, 0);
});
