export const SAVE_KEY = 'mySupFusion5v5GameV1';
export const DATABASE = 'mySupFusion5v5';
const timeout = task => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('存档同步超时')), 2500); Promise.resolve(task).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); }); });
function localTask(value, write = false) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('game');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('game', write ? 'readwrite' : 'readonly'), store = tx.objectStore('game'); let result = null;
      const req = write ? store.put(value, SAVE_KEY) : store.get(SAVE_KEY); req.onsuccess = () => { result = req.result; }; tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); }; tx.onabort = () => { db.close(); reject(tx.error || new Error('存档被中断')); };
    };
  });
}
export function validSave(v) { return v?.mode === '5v5' && v.version === 1 && v.profile && (!v.run || (Array.isArray(v.run.cards) && Array.isArray(v.run.lineup) && v.run.lineup.length === 5)); }
function unwrap(result) { let v = result?.data?.[SAVE_KEY] ?? result?.[SAVE_KEY] ?? result?.data ?? result; if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } } return validSave(v) ? v : null; }
export async function loadGame() {
  const api = globalThis.ColorboxAI?.storage;
  const results = await Promise.allSettled([globalThis.indexedDB ? timeout(localTask()) : Promise.resolve(null), api?.getValue ? timeout(api.getValue(SAVE_KEY)) : Promise.resolve(null)]);
  const saves = results.filter(r => r.status === 'fulfilled').map(r => unwrap(r.value)).filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return saves[0] || null;
}
export async function saveGame(game) {
  const value = { ...game, savedAt: Date.now() }, api = globalThis.ColorboxAI?.storage;
  if (new TextEncoder().encode(JSON.stringify({ [SAVE_KEY]: value })).length > 200 * 1024) throw new Error('存档超过大小限制');
  const jobs = [];
  if (globalThis.indexedDB) jobs.push(timeout(localTask(value, true)));
  if (api?.setValue) jobs.push(timeout(Promise.resolve(api.setValue({ [SAVE_KEY]: value })).then(v => { if (v?.ok === false) throw new Error('同步失败'); })));
  const results = await Promise.allSettled(jobs);
  if (!results.some(r => r.status === 'fulfilled')) throw new Error('存档失败，请勿关闭页面');
  return { synced: !!api?.setValue && results.at(-1)?.status === 'fulfilled' };
}
