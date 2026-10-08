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


test('ordinary saves and loads use only the device even when SDK cloud storage is available', async () => {
  const calls=[], indexedDB=fakeIndexedDB();
  const window={indexedDB,ColorboxAI:{storage:{getValue:async()=>{calls.push('get');return {version:1,savedAt:999,run:{stage:9}}},setValue:async()=>{calls.push('set');return {ok:true}}}}};
  const store=storageFor(window),snapshot={version:1,savedAt:1,run:{stage:2}};
  await store.save(snapshot);assert.deepEqual(await store.load(),snapshot);assert.deepEqual(calls,[]);
  await store.syncToCloud(snapshot);assert.deepEqual(calls,['set']);
});

test('legacy platform saves import once and never replace an existing device save',async()=>{
  const calls=[],indexedDB=fakeIndexedDB(),snapshot={version:1,savedAt:1,run:{stage:3}};
  const window={indexedDB,ColorboxAI:{storage:{getValue:async()=>{calls.push('get');return snapshot},setValue:async()=>{calls.push('set');return {ok:true}}}}};
  const store=storageFor(window);assert.deepEqual(await store.load(),snapshot);assert.deepEqual(calls,['get']);
  await store.save({...snapshot,run:{stage:4}});assert.equal((await storageFor(window).load()).run.stage,4);assert.deepEqual(calls,['get']);
});

test('localStorage is a device-only fallback when IndexedDB fails',async()=>{
  const values=new Map(),calls=[];
  const store=storageFor({indexedDB:{open(){throw Error('blocked')}},localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},ColorboxAI:{storage:{getValue:async()=>null,setValue:async()=>{calls.push('set')}}}});
  await store.save({version:1,run:{stage:5}});assert.equal((await store.load()).run.stage,5);assert.deepEqual(calls,[]);
});

test('a stalled cloud backup cannot hold up subsequent device writes',async()=>{
  const indexedDB=fakeIndexedDB();let release;
  const store=storageFor({indexedDB,ColorboxAI:{storage:{getValue:async()=>null,setValue:()=>new Promise(resolve=>release=resolve)}}});
  const backup=store.syncToCloud({version:1,run:{stage:1}});
  await store.save({version:1,run:{stage:2}});await store.save({version:1,run:{stage:3}});
  assert.equal((await store.load()).run.stage,3);release({ok:true});await backup;
});

test('failed cloud backups preserve the local save and report failure for retry',async()=>{
  const indexedDB=fakeIndexedDB(),store=storageFor({indexedDB,ColorboxAI:{storage:{getValue:async()=>null,setValue:async()=>({code:403})}}});
  const snapshot={version:1,run:{stage:4}};await store.save(snapshot);
  await assert.rejects(store.syncToCloud(snapshot),/backup failed/);assert.deepEqual(await store.load(),snapshot);
});

test('device failure cannot silently turn ordinary saves into cloud writes',async()=>{
  const calls=[],store=storageFor({indexedDB:{open(){throw Error('blocked')}},ColorboxAI:{storage:{getValue:async()=>null,setValue:async()=>{calls.push('set')}}}});
  await assert.rejects(store.save({version:1}),/Device storage/);assert.deepEqual(calls,[]);
});
