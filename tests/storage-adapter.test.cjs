const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const runtime = fs.readFileSync('src/runtime-loader.js', 'utf8');
const adapter = fs.readFileSync('h5/storage-adapter.js', 'utf8');
assert.match(runtime, /await import\('\.\.\/h5\/storage-adapter\.js'\)/, 'storage adapter is loaded by the React runtime');
assert.ok(runtime.indexOf('storage-adapter.js') < runtime.indexOf('game-ui.js'), 'storage loads before the UI controller');
assert.match(adapter, /window\.FusionStorage/, 'storage adapter exists in its own module');

function fakeIndexedDB() {
  const values = new Map();
  return {
    open() {
      const request = { result: null, error: null };
      queueMicrotask(() => {
        request.result = {
          createObjectStore() {},
          close() {},
          transaction(_name, mode) {
            const tx = { error: null };
            tx.objectStore = () => ({
              get(key) {
                const read = { result: null, error: null, transaction: tx };
                queueMicrotask(() => {
                  read.result = values.get(key);
                  read.onsuccess();
                  tx.oncomplete?.();
                });
                return read;
              },
              put(value, key) {
                assert.equal(mode, 'readwrite');
                values.set(key, structuredClone(value));
                queueMicrotask(() => tx.oncomplete());
              }
            });
            return tx;
          }
        };
        request.onupgradeneeded();
        request.onsuccess();
      });
      return request;
    }
  };
}

function storageFor(window, timers = {}) {
  vm.runInNewContext(adapter, { window, Promise, setTimeout: timers.setTimeout || setTimeout, clearTimeout: timers.clearTimeout || clearTimeout });
  return window.FusionStorage;
}

test('storage initialization falls back when a platform request never resolves', async () => {
  const store = storageFor({ ColorboxAI: { storage: {
    getValue() { return new Promise(() => {}); },
    setValue() { return Promise.resolve({ ok: true }); }
  } } }, {
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {}
  });
  assert.equal(await store.load(), null);
});

test('local preview saves and restores a run after a page reload', async () => {
  const indexedDB = fakeIndexedDB();
  const first = storageFor({ indexedDB });
  assert.equal(first.available(), true);
  assert.equal(await first.load(), null);
  const snapshot = { version: 1, run: { stage: 4, cash: 18, gear: ['kobe_sleeve'], slots: { three: 'curry' } },
    profile: { legend: 12, upgrades: { startGold: 1 }, jerseyUnlocks: ['kobe_sleeve'], discovered: ['curry'] } };
  await first.save(snapshot);
  const reloaded = storageFor({ indexedDB });
  assert.deepEqual(await reloaded.load(), snapshot);
});

test('entering the Hupu container reads and syncs the newest save every time', async () => {
  const indexedDB = fakeIndexedDB();
  const oldSave = { version: 1, savedAt: 100, run: { stage: 3 }, profile: { legend: 9 } };
  const calls = [];
  let cloud = oldSave;
  const window = { indexedDB, ColorboxAI: { storage: {
    async getValue(key) { calls.push(['get', key]); return { [key]: cloud }; },
    async setValue(data) { calls.push(['set', data.mySupFusionGameV1.run.stage]); cloud = data.mySupFusionGameV1; return { ok: true }; }
  } } };
  const store = storageFor(window);
  assert.deepEqual(await store.load(), oldSave);
  assert.deepEqual(calls, [['get', 'mySupFusionGameV1'], ['set', 3]]);
  const nextSave = { ...oldSave, savedAt: 200, run: { stage: 4 }, profile: { legend: 5, upgrades: { startGold: 1 } } };
  await store.save(nextSave);
  assert.deepEqual(await storageFor(window).load(), nextSave);
  assert.deepEqual(calls, [['get', 'mySupFusionGameV1'], ['set', 3], ['set', 4], ['get', 'mySupFusionGameV1'], ['set', 4]]);
});

test('an older device save never replaces newer Hupu data', async () => {
  const indexedDB = fakeIndexedDB();
  const local = storageFor({ indexedDB });
  await local.save({ version: 1, savedAt: 100, run: { stage: 2 } });
  let uploaded;
  const store = storageFor({ indexedDB, ColorboxAI: { storage: {
    async getValue() { return { version: 1, savedAt: 200, run: { stage: 5 } }; },
    async setValue(value) { uploaded = value.mySupFusionGameV1; return { ok: true }; }
  } } });
  assert.equal((await store.load()).run.stage, 5);
  assert.equal(uploaded.run.stage, 5);
  assert.equal((await storageFor({ indexedDB }).load()).run.stage, 5);
});

test('a newer device save uploads to Hupu when the game opens', async () => {
  const indexedDB = fakeIndexedDB();
  await storageFor({ indexedDB }).save({ version: 1, savedAt: 300, run: { stage: 7 } });
  let uploaded;
  const store = storageFor({ indexedDB, ColorboxAI: { storage: {
    async getValue() { return { version: 1, savedAt: 200, run: { stage: 5 } }; },
    async setValue(value) { uploaded = value.mySupFusionGameV1; return { ok: true }; }
  } } });
  assert.equal((await store.load()).run.stage, 7);
  assert.equal(uploaded.run.stage, 7);
});

test('activity container falls back to Colorbox storage when local storage fails', async () => {
  const calls = [];
  const store = storageFor({
    indexedDB: { open() { throw new Error('fallback should not open'); } },
    ColorboxAI: { storage: {
      async getValue(key) { calls.push(['get', key]); return { mySupFusionGameV1: { version: 1 } }; },
      async setValue(value) { calls.push(['set', value.mySupFusionGameV1.version]); return { ok: true }; }
    } }
  });
  assert.deepEqual(await store.load(), { version: 1 });
  await store.save({ version: 1 });
  assert.deepEqual(calls, [['get', 'mySupFusionGameV1'], ['set', 1], ['set', 1]]);
});
