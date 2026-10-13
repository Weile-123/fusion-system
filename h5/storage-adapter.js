// 设备保存与平台备份独立，平台失败不能阻塞游戏操作。
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
  function emptyProgress(value) {
    const p = value?.profile;
    if (!p) return false;
    return !value.run && !(value.pendingCloudRuns?.length) &&
      !['runs','wins','clears','bestStage','highestStage','bestEndless','bestOvr','legend'].some(key => Number(p[key]) > 0) &&
      !['jerseyUnlocks','gearUnlocks','playerUnlocks','discovered'].some(key => p[key]?.length) &&
      !Object.values(p.upgrades || {}).some(level => Number(level) > 0) &&
      !Object.values(p.metaUnlocks || {}).some(ids => ids?.length) &&
      !Object.values(p.trainingBase || {}).some(group => Object.values(group || {}).some(level => Number(level) > 0));
  }
  function losesPurchases(next, previous) {
    const a=next?.profile,b=previous?.profile;
    if(!a||!b)return false;
    for(const key of ['jerseyUnlocks','gearUnlocks','playerUnlocks'])
      if((b[key]||[]).some(id=>!(a[key]||[]).includes(id)))return true;
    for(const key of Object.keys(b.metaUnlocks||{}))
      if((b.metaUnlocks[key]||[]).some(id=>!(a.metaUnlocks?.[key]||[]).includes(id)))return true;
    for(const key of Object.keys(b.upgrades||{}))
      if(Number(a.upgrades?.[key]||0)<Number(b.upgrades[key]||0))return true;
    for(const group of ['slots','dimensions'])for(const key of Object.keys(b.trainingBase?.[group]||{}))
      if(Number(a.trainingBase?.[group]?.[key]||0)<Number(b.trainingBase[group][key]||0))return true;
    return emptyProgress(next)&&!emptyProgress(previous);
  }
  window.FusionStorage = {
    platformAvailable() { return !!(window.ColorboxAI?.storage?.getValue && window.ColorboxAI?.storage?.setValue); },
    localAvailable() { try { return !!(window.indexedDB || window.localStorage); } catch (_) { return false; } },
    available() { return this.localAvailable() || this.platformAvailable() || this.platformRequired; },
    async waitForPlatform() {
      for(let elapsed=0;!this.platformAvailable()&&elapsed<3000;elapsed+=100)
        await new Promise(resolve=>setTimeout(resolve,100));
      if(!this.platformAvailable())throw new Error('Colorbox storage unavailable');
    },
    async readPlatform() {
      const result=await withStorageTimeout(window.ColorboxAI.storage.getValue(saveKey));
      if(result?.code!=null&&result.code!==0&&result.code!==200)throw new Error('Platform read failed');
      const raw=result?.data&&Object.hasOwn(result.data,saveKey)?result.data[saveKey]
        :result&&Object.hasOwn(result,saveKey)?result[saveKey]
        :result&&Object.hasOwn(result,'data')?result.data:result;
      const candidate=decodeSave(raw);
      if(!candidate&&raw!=null&&raw!==''&&raw!=='null'&&!(typeof raw==='object'&&!Object.keys(raw).length))throw new Error('Invalid platform save');
      this.platformChecked=true;this.platformSnapshot=candidate;
      return candidate;
    },
    async readLocal() {
      this.localReadError = '';
      await (this.localQueue || Promise.resolve()).catch(() => {});
      let local=null, indexed=null;
      try { const raw=window.localStorage?.getItem(saveKey);local=decodeSave(raw);if(raw!=null&&!local)this.localReadError='设备存档格式无法识别'; } catch (_) { this.localReadError='设备存档读取失败'; }
      if (window.indexedDB) { try { const raw=await withStorageTimeout(fusionLocalStore.get(saveKey));indexed=decodeSave(raw);if(raw!=null&&!indexed)this.localReadError='设备存档格式无法识别'; } catch (_) { this.localReadError='设备存档读取失败'; } }
      const value=local&&indexed?((Number(local.savedAt)||0)>=(Number(indexed.savedAt)||0)?local:indexed):local||indexed;
      if(value)this.localReadError='';
      return value;
    },
    async load() {
      this.loadError = '';
      const local = await this.readLocal();
      if (local && !(this.platformRequired && emptyProgress(local))) return local;
      // One-time import of legacy SDK saves when this device has no local save.
      if (!this.platformAvailable()&&!this.platformRequired) { this.loadError = this.localReadError; return local; }
      try {
        await this.waitForPlatform();
        const candidate = await this.readPlatform();
        if (!candidate) {
          this.loadError = this.localReadError;
          return local;
        }
        // A failed device import must not discard the only valid cloud backup.
        try { await this.save(candidate); } catch (_) {}
        return candidate;
      } catch (_) { this.loadError = '存档读取失败，请稍后重试'; return null; }
    },
    async save(value) {
      const snapshot = JSON.parse(JSON.stringify(value));
      // Keep a synchronous device mirror before a native ad can suspend this WebView.
      let mirrored=false;
      try { if(window.localStorage){window.localStorage.setItem(saveKey,JSON.stringify(snapshot));mirrored=true} } catch (_) {}
      this.localQueue = (this.localQueue || Promise.resolve()).catch(() => {}).then(async () => {
        if (window.indexedDB) { try { await withStorageTimeout(fusionLocalStore.set(saveKey, snapshot)); return; } catch (_) {} }
        if (mirrored) return;
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
        if(!this.platformChecked)await this.readPlatform();
        if(losesPurchases(snapshot,this.platformSnapshot))throw new Error('Backup would discard purchased progress');
        await this.writePlatform(saveKey, snapshot);
        this.platformSnapshot=snapshot;
        return true;
      });
      return this.syncQueue;
    },
    requestBackup(value) {
      this.pendingBackup=JSON.parse(JSON.stringify(value));
      this.backupBlocked=false;
      if(this.backupTimer==null&&!this.backupRunning)
        this.backupTimer=setTimeout(()=>{this.backupTimer=null;void this.flushBackup();},300);
    },
    async flushBackup() {
      if(this.backupRunning||!this.pendingBackup)return;
      if(this.backupTimer!=null){clearTimeout(this.backupTimer);this.backupTimer=null;}
      this.backupRunning=true;
      const snapshot=this.pendingBackup;
      try {
        if(!await this.syncToCloud(snapshot))throw new Error('Platform unavailable');
        this.backupError='';this.backupAttempts=0;
        if(this.pendingBackup===snapshot)this.pendingBackup=null;
      } catch(error) {this.backupError=error.message;this.backupBlocked=this.pendingBackup===snapshot&&/discard purchased|exceeds 200KB/.test(error.message);}
      finally {
        this.backupRunning=false;
        if(this.pendingBackup&&!this.backupBlocked)this.backupTimer=setTimeout(()=>{this.backupTimer=null;void this.flushBackup();},Math.min(60000,5000*2**Math.min(this.backupAttempts||0,4)));
        if(this.pendingBackup)this.backupAttempts=(this.backupAttempts||0)+1;
      }
    }
  };
