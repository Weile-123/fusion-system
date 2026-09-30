// 虎扑容器按存储技能统一读写并自动跨端同步；本地预览使用 IndexedDB。
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
  window.FusionStorage = {
    platformAvailable() {
      return !!(window.ColorboxAI && window.ColorboxAI.storage && window.ColorboxAI.storage.getValue && window.ColorboxAI.storage.setValue);
    },
    localAvailable() {
      return !!window.indexedDB;
    },
    available() {
      return this.localAvailable() || this.platformAvailable();
    },
    async load() {
      const key = 'mySupFusionGameV1';
      let local = null, platform = null;
      if (window.indexedDB) { try { local = await withStorageTimeout(fusionLocalStore.get(key)); } catch (_) {} }
      if (this.platformAvailable()) {
        try {
          const result = await withStorageTimeout(window.ColorboxAI.storage.getValue(key));
          platform = result?.data?.[key] ?? result?.[key] ?? result?.data ?? result ?? null;
        } catch (_) { this.syncError = '虎扑存档读取失败，本次使用设备存档'; }
      }
      const localTime = Number(local?.savedAt) || 0, platformTime = Number(platform?.savedAt) || 0;
      const value = local && (!platform || localTime > platformTime) ? local : platform;
      if (value === platform && value && window.indexedDB) {
        try { await withStorageTimeout(fusionLocalStore.set(key, value)); } catch (_) {}
      }
      if (value && this.platformAvailable()) {
        try { await this.writePlatform(key, value); this.syncError = ''; }
        catch (_) { this.syncError = '虎扑云同步失败，本次进度仍保留在设备中'; }
      }
      return value;
    },
    async writePlatform(key, value) {
      const payload = { [key]: value };
      const bytes = encodeURIComponent(JSON.stringify(payload)).replace(/%[0-9A-F]{2}/gi, 'x').length;
      if (bytes > 200 * 1024) throw new Error('save exceeds 200KB');
      if (!this.platformAvailable()) throw new Error('Colorbox storage unavailable');
      const result = await withStorageTimeout(window.ColorboxAI.storage.setValue({ [key]: value }));
      if (result && result.ok === false) throw new Error('save failed');
    },
    async save(value) {
      const key = 'mySupFusionGameV1';
      let uploaded = false;
      if (this.platformAvailable()) {
        try { await this.writePlatform(key, value); uploaded = true; this.syncError = ''; }
        catch (error) { this.syncError = '虎扑云同步失败，本次进度仍保留在设备中'; if (!window.indexedDB) throw error; }
      }
      if (window.indexedDB) {
        try { await withStorageTimeout(fusionLocalStore.set(key, value)); }
        catch (error) { if (!uploaded) throw error; }
      }
    }
  };
