// 日常存档仅写设备；进入游戏和结束一局时显式通过 SDK 上传备份。
  function withStorageTimeout(task, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('storage timeout')), timeoutMs);
      Promise.resolve(task).then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); }
      );
    });
  }

  const fusionLocalStore = {
    open() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
        const request = window.indexedDB.open('mySupFusion', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('game');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('storage open failed'));
      });
    },
    async get(key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const request = db.transaction('game', 'readonly').objectStore('game').get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error || new Error('storage read failed'));
        request.transaction.oncomplete = () => db.close();
        request.transaction.onerror = () => db.close();
      });
    },
    async set(key, value) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('game', 'readwrite');
        transaction.objectStore('game').put(value, key);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(transaction.error || new Error('storage write failed')); };
        transaction.onabort = () => { db.close(); reject(transaction.error || new Error('storage write aborted')); };
      });
    }
  };
  const saveKey = 'mySupFusionGameV1';
  window.FusionStorage = {
    platformAvailable() { return !!(window.ColorboxAI?.storage?.getValue && window.ColorboxAI?.storage?.setValue); },
    localAvailable() { return !!(window.indexedDB || window.localStorage); },
    available() { return this.localAvailable() || this.platformAvailable(); },
    async readLocal() {
      await (this.localQueue || Promise.resolve()).catch(() => {});
      if (window.indexedDB) { try { const value = await withStorageTimeout(fusionLocalStore.get(saveKey)); if (value) return value; } catch (_) {} }
      try { return JSON.parse(window.localStorage?.getItem(saveKey) || 'null'); } catch (_) { return null; }
    },
    async load() {
      const local = await this.readLocal();
      if (local) return local;
      // One-time import of legacy SDK saves when this device has no local save.
      if (!this.platformAvailable()) return null;
      try {
        const result = await withStorageTimeout(window.ColorboxAI.storage.getValue(saveKey));
        if (result?.code != null && result.code !== 0 && result.code !== 200) return null;
        const candidate = result?.data?.[saveKey] ?? result?.[saveKey] ?? result?.data ?? result;
        if (candidate?.version !== 1) return null;
        await this.save(candidate);
        return candidate;
      } catch (_) { return null; }
    },
    async save(value) {
      const snapshot = JSON.parse(JSON.stringify(value));
      this.localQueue = (this.localQueue || Promise.resolve()).catch(() => {}).then(async () => {
        if (window.indexedDB) { try { await withStorageTimeout(fusionLocalStore.set(saveKey, snapshot)); return; } catch (_) {} }
        if (window.localStorage) { window.localStorage.setItem(saveKey, JSON.stringify(snapshot)); return; }
        throw new Error('Device storage unavailable');
      });
      return this.localQueue;
    },
    async writePlatform(key, value) {
      const payload = { [key]: value };
      const bytes = encodeURIComponent(JSON.stringify(payload)).replace(/%[0-9A-F]{2}/gi, 'x').length;
      if (bytes > 200 * 1024) throw new Error('Save exceeds 200KB');
      if (!this.platformAvailable()) throw new Error('Colorbox storage unavailable');
      const result = await withStorageTimeout(window.ColorboxAI.storage.setValue(payload), 15000);
      if (result?.ok === false || result?.code != null && result.code !== 0 && result.code !== 200) throw new Error('Cloud backup failed');
    },
    async syncToCloud(value) {
      if (!this.platformAvailable()) return false;
      const snapshot = JSON.parse(JSON.stringify(value));
      this.syncQueue = (this.syncQueue || Promise.resolve()).catch(() => {}).then(async () => {
        await this.writePlatform(saveKey, snapshot);
        return true;
      });
      return this.syncQueue;
    }
  };
