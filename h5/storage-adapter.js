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
  function decodeSave(value) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { return null; } }
    return value && typeof value === 'object' && value.version === 1 ? value : null;
  }
  window.FusionStorage = {
    platformAvailable() { return !!(window.ColorboxAI?.storage?.getValue && window.ColorboxAI?.storage?.setValue); },
    localAvailable() { try { return !!(window.indexedDB || window.localStorage); } catch (_) { return false; } },
    available() { return this.localAvailable() || this.platformAvailable(); },
    async readLocal() {
      this.localReadError = '';
      await (this.localQueue || Promise.resolve()).catch(() => {});
      if (window.indexedDB) { try { const raw = await withStorageTimeout(fusionLocalStore.get(saveKey)), value = decodeSave(raw); if (value) return value; if (raw != null) this.localReadError = '设备存档格式无法识别'; } catch (_) {} }
      try { const raw = window.localStorage?.getItem(saveKey), value = decodeSave(raw); if (value) { this.localReadError = ''; return value; } if (raw != null) this.localReadError = '设备存档格式无法识别'; return null; } catch (_) { return null; }
    },
    async load() {
      this.loadError = '';
      const local = await this.readLocal();
      if (local) return local;
      // One-time import of legacy SDK saves when this device has no local save.
      if (!this.platformAvailable()) { this.loadError = this.localReadError; return null; }
      try {
        const result = await withStorageTimeout(window.ColorboxAI.storage.getValue(saveKey));
        if (result?.code != null && result.code !== 0 && result.code !== 200) throw new Error('云端存档读取失败');
        const raw = result?.data && Object.hasOwn(result.data, saveKey) ? result.data[saveKey]
          : result && Object.hasOwn(result, saveKey) ? result[saveKey]
          : result && Object.hasOwn(result, 'data') ? result.data : result;
        const candidate = decodeSave(raw);
        if (!candidate) {
          this.loadError = this.localReadError;
          if (raw != null && raw !== '' && raw !== 'null' && !(typeof raw === 'object' && !Object.keys(raw).length)) this.loadError = '存档格式无法识别';
          return null;
        }
        // A failed device import must not discard the only valid cloud backup.
        try { await this.save(candidate); } catch (_) {}
        return candidate;
      } catch (_) { this.loadError = '存档读取失败，请稍后重试'; return null; }
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
