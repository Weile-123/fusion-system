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
  await store.syncToCloud(snapshot);assert.deepEqual(calls,['get','set']);
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

test('valid serialized SDK saves survive a failed device import',async()=>{
  const snapshot={version:1,profile:{legend:123,jerseyUnlocks:['lakers_jersey']},run:{stage:7}};
  let writes=0;
  const store=storageFor({indexedDB:{open(){throw Error('blocked')}},ColorboxAI:{storage:{getValue:async()=>({code:200,data:{mySupFusionGameV1:JSON.stringify(snapshot)}}),setValue:async()=>{writes++}}}});
  assert.equal(JSON.stringify(await store.load()),JSON.stringify(snapshot));assert.equal(store.loadError,'');assert.equal(writes,0);
});

test('failed SDK reads and corrupt local saves are distinguished from an empty save',async()=>{
  const failed=storageFor({ColorboxAI:{storage:{getValue:async()=>({code:403}),setValue:async()=>({ok:true})}}});
  assert.equal(await failed.load(),null);assert.ok(failed.loadError);
  const corrupt=storageFor({localStorage:{getItem:()=>'{broken',setItem(){}}});
  assert.equal(await corrupt.load(),null);assert.ok(corrupt.loadError);
  for(const data of [null,{}, {mySupFusionGameV1:null}]){
    const empty=storageFor({ColorboxAI:{storage:{getValue:async()=>({code:200,data}),setValue:async()=>({ok:true})}}});
    assert.equal(await empty.load(),null);assert.equal(empty.loadError,'');
  }
});

test('device read failures remain errors even when the cloud reports no save',async()=>{
 const store=storageFor({indexedDB:{open(){throw Error('unavailable')}},localStorage:{getItem(){return null}},ColorboxAI:{storage:{getValue:async()=>({code:200,data:null}),setValue:async()=>{}}}});
 assert.equal(await store.load(),null);assert.match(store.loadError,/读取失败/);
});

test('device mirror exists before pending IndexedDB writes and recovers the newest checkpoint',async()=>{
 const values=new Map(),indexedDB=fakeIndexedDB();
 const localStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const first=storageFor({indexedDB,localStorage});
 await first.save({version:1,savedAt:1,run:{cash:100}});
 const blocked=storageFor({indexedDB:{open(){return {}}},localStorage});
 const pending=blocked.save({version:1,savedAt:2,run:{cash:80},adReturnScreen:'roster'});
 assert.equal(JSON.parse(values.get('mySupFusionGameV1')).adReturnScreen,'roster');
 // A reopened WebView can have stale IndexedDB while the mirror already contains the checkpoint.
 const reload=storageFor({indexedDB,localStorage});assert.equal((await reload.load()).run.cash,80);
 // Avoid waiting for the deliberately stalled write in this test.
 void pending;
});

test('release startup waits for late SDK and restores purchased progress instead of creating an empty save',async()=>{
 const snapshot={version:1,profile:{legend:0,jerseyUnlocks:['owned']}};
 const window={indexedDB:fakeIndexedDB()};let writes=0;
 const actual=storageFor(window);actual.platformRequired=true;
 delete window.ColorboxAI;
 setTimeout(()=>{window.ColorboxAI={storage:{getValue:async()=>snapshot,setValue:async()=>{writes++}}}},10);
 assert.deepEqual(await actual.load(),snapshot);assert.equal(actual.loadError,'');assert.equal(writes,0);
 assert.deepEqual(await storageFor(window).load(),snapshot);
});

test('missing SDK in release reports a retryable error and never writes a blank save',async()=>{
 const values=new Map(),store=storageFor({localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}},
  {setTimeout(callback){queueMicrotask(callback);return 1},clearTimeout(){}});
 store.platformRequired=true;
 assert.equal(await store.load(),null);assert.match(store.loadError,/读取失败/);assert.equal(values.size,0);
});

test('existing nonempty device save needs no SDK readiness wait',async()=>{
 const snapshot={version:1,profile:{legend:1}},window={localStorage:{getItem:()=>JSON.stringify(snapshot)}};
 const store=storageFor(window);store.platformRequired=true;
 store.waitForPlatform=()=>{throw Error('must not wait')};assert.equal(JSON.stringify(await store.load()),JSON.stringify(snapshot));
});

test('release recovers an accidentally created empty device save from the platform backup',async()=>{
 const snapshot={version:1,profile:{legend:0,playerUnlocks:['jordan']}},values=new Map([['mySupFusionGameV1',JSON.stringify({version:1,profile:{legend:0}})]]);
 const store=storageFor({localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},ColorboxAI:{storage:{getValue:async()=>snapshot,setValue:async()=>({ok:true})}}});
 store.platformRequired=true;assert.deepEqual(await store.load(),snapshot);assert.equal(JSON.parse(values.get('mySupFusionGameV1')).profile.playerUnlocks[0],'jordan');
});

test('backup refuses lost ownership or training upgrades without replacing the previous backup',async()=>{
 const old={version:1,profile:{jerseyUnlocks:['owned'],trainingBase:{slots:{creation:2}},upgrades:{scouting:2}}};let writes=0;
 const store=storageFor({ColorboxAI:{storage:{getValue:async()=>old,setValue:async()=>{writes++;return {ok:true}}}}});
 for(const profile of [{legend:0},{...old.profile,trainingBase:{slots:{creation:1}}},{...old.profile,upgrades:{scouting:1}}])
  await assert.rejects(store.syncToCloud({version:1,profile}),/discard purchased/);
 assert.equal(writes,0);
 await store.syncToCloud({...old,profile:{...old.profile,legend:1}});assert.equal(writes,1);
});

test('background backup coalesces requests, retains failure, and retries without blocking device saves',async()=>{
 const timers=[],writes=[];let fail=true;
 const store=storageFor({indexedDB:fakeIndexedDB(),ColorboxAI:{storage:{getValue:async()=>null,setValue:async payload=>{if(fail)throw Error('offline');writes.push(payload);return {ok:true}}}}},
  {setTimeout(callback,ms){const id={callback,ms};timers.push(id);return id},clearTimeout(id){id.cancelled=true}});
 store.requestBackup({version:1,profile:{legend:1}});store.requestBackup({version:1,profile:{legend:2}});
 assert.equal(timers.filter(t=>t.ms===300).length,1);
 await store.flushBackup();assert.match(store.backupError,/offline/);assert.equal(store.pendingBackup.profile.legend,2);
 await store.save({version:1,profile:{legend:3}});assert.equal((await store.load()).profile.legend,3);
 fail=false;store.requestBackup({version:1,profile:{legend:3}});await store.flushBackup();
 assert.equal(writes.length,1);assert.equal(writes[0].mySupFusionGameV1.profile.legend,3);assert.equal(store.pendingBackup,null);
});
