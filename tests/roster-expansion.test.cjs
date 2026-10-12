const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../h5/game-core.js'),D=require('../h5/game-data.js');
function lineup(ids,version=12){const r=C.createRun('__neutral__',911,{},version);r.offer=[];r.cash=100;for(const [slot,id]of Object.entries(ids)){r.slots[slot]=id;r.owned[id]={stars:1,train:0,trainedAt:0};}return r;}
const plain=v=>JSON.parse(JSON.stringify(v));
test('expansion keeps exact tier/bond counts and at least three bonds for every high-tier identity',()=>{
 assert.ok(C.BALANCE_RULES_VERSION>=12);assert.equal(C.STARS.length,135);assert.equal(new Set(C.STARS.map(p=>p.id)).size,135);
 assert.deepEqual(Object.fromEntries(['SSR','S','A','B','C'].map(t=>[t,C.STARS.filter(p=>p.tier===t).length])),{SSR:18,S:18,A:31,B:58,C:10});
 assert.deepEqual(Object.fromEntries([2,3,4,5].map(n=>[n,C.SYNERGIES.filter(b=>b.ids.length===n).length])),{2:71,3:24,4:6,5:7});
 for(const p of C.STARS.filter(p=>['S','SSR'].includes(p.tier)))assert.ok(C.starSynergies(p.id).length>=3,p.name);
 for(const b of C.SYNERGIES){assert.equal(new Set(b.ids).size,b.ids.length);assert.ok(b.ids.every(id=>C.BY_ID[id]&&!C.BY_ID[id].variantOf));}
 for(const name of ['灯泡组合','迈城谢幕季','1969抢七大战','香蕉船兄弟'])assert.ok(C.SYNERGIES.some(b=>b.name===name));
 const removed=new Set(['paint_dominators']);assert.ok(!C.SYNERGIES.some(b=>removed.has(b.id)));
 for(const old of D.PREVIOUS_CATALOG.SYNERGIES){const next=C.SYNERGIES.find(b=>b.id===old.id);if(next)assert.deepEqual(next.effect,old.effect);}
});
test('final edited LOGO description, twin-slot combat and three independent free operations are implemented',()=>{
 const r=lineup({mid:'logo_west'}),a=C.resolveTalentEffect(r,'mid');
 r.slots.mid=null;r.slots.handle='logo_west';const b=C.resolveTalentEffect(r,'handle');
 assert.deepEqual(a.dimensions,b.dimensions);assert.equal(a.allDimensions,10);assert.equal(b.allDimensions,10);assert.deepEqual(a.designEconomies,b.designEconomies);
 assert.match(C.BY_ID.logo_west.talentEffect.description,/中投槽或控球槽/);
 assert.equal(C.shopRefreshCost(r,'boost'),0);const before=JSON.stringify(r.playerEconomy);C.shopRefreshCost(r,'boost');C.shopRefreshCost(r,'gear');C.trainingCost(r,'logo_west');assert.equal(JSON.stringify(r.playerEconomy),before);
 assert.equal(C.refreshShop(r,'boost'),true);assert.equal(C.shopRefreshCost(r,'boost'),5);
 assert.equal(C.shopRefreshCost(r,'gear'),0);C.refreshShop(r,'gear');assert.equal(C.shopRefreshCost(r,'gear'),3);
 assert.equal(C.trainingCost(r,'logo_west'),0);assert.equal(C.train(r,'logo_west'),true);assert.ok(C.trainingCost(r,'logo_west')>0);
 assert.equal(r.cash,100);assert.equal(C.train(r,'logo_west'),false);
});
test('Wade is single-slot with victory +2; Wembanyama has no economy; Russell is defense only',()=>{
 const r=lineup({drive:'wade',def:'ring_russell'});assert.deepEqual(C.BY_ID.wade.talentEffect.slots,['drive']);assert.equal(C.resolveTalentEffect(r,'drive').winCash,2);assert.deepEqual(C.resolveTalentEffect(r,'drive').dimensions,{finishing:18,creation:6});
 assert.deepEqual(C.BY_ID.ring_russell.talentEffect.slots,['def']);assert.equal(C.resolveTalentEffect(r,'def').allDimensions,0);
 for(const slot of C.BY_ID.wembanyama.talentEffect.slots){const e=C.BY_ID.wembanyama.talentEffect.slotEffects[slot];assert.ok(!e.designEconomy&&!e.designEconomies&&!e.winCash&&!e.postBattleCash);}
 for(const id of ['skyhook_kareem','wolf_garnett','flash_wade','marshal_wilt']){const p=C.BY_ID[id];assert.equal(p.talentEffect.slotEffects[p.talentEffect.slots[1]].allDimensions,0);}
});
test('free refresh quotas survive movement, sale, upgrade, reload and failed actions',()=>{
 const r=lineup({mid:'west'});assert.equal(C.refreshShop(r,'boost'),true);
 r.slots.mid=null;r.slots.handle='west';assert.equal(C.shopRefreshCost(r,'boost'),5);
 r.slots.handle=null;r.bench=['west'];C.sellBench(r,0);r.owned.logo_west={stars:1,train:0,trainedAt:0};r.slots.mid='logo_west';
 assert.equal(C.shopRefreshCost(r,'boost'),5);assert.equal(C.trainingCost(r,'logo_west'),1);assert.equal(C.shopRefreshCost(r,'gear'),0);
 const saved=plain(r);C.restorePlayerEconomy(saved,r);assert.deepEqual(saved.playerEconomy,r.playerEconomy);assert.equal(C.shopRefreshCost(saved,'boost'),5);
 assert.equal(C.refreshShop(r,'gear'),true);assert.equal(C.shopRefreshCost(r,'gear'),3);
 const fresh=lineup({mid:'logo_west'});fresh.cash=0;fresh.owned.logo_west.trainedAt=1;const ledger=JSON.stringify(fresh.playerEconomy);assert.equal(C.train(fresh,'logo_west'),false);assert.equal(JSON.stringify(fresh.playerEconomy),ledger);
 fresh.refreshFree=1;C.refreshOffer(fresh);assert.ok(!Object.keys(fresh.playerEconomy.identities).length);
});
test('existing gear freebies take precedence and never consume the player coupon',()=>{
 const r=lineup({mid:'west'});r.gearRefreshFree=1;C.refreshShop(r,'gear');assert.deepEqual(r.playerEconomy.identities,{});assert.equal(C.shopRefreshCost(r,'gear'),0);C.refreshShop(r,'gear');assert.equal(C.shopRefreshCost(r,'gear'),3);
});
test('discounts only consume on success and use the appropriate slot and operations',()=>{
 const r=lineup({def:'wolf_garnett',handle:'beard_harden'});r.endless=true;r.stage=4;r.owned.wolf_garnett.train=3;assert.equal(C.trainingCost(r,'wolf_garnett'),14);assert.equal(C.train(r,'wolf_garnett'),true);r.stage=5;assert.equal(C.trainingCost(r,'wolf_garnett'),20);assert.equal(C.train(r,'wolf_garnett'),true);r.stage=6;assert.equal(C.trainingCost(r,'wolf_garnett'),29);
 r.refreshFree=0;assert.equal(C.recruitRefreshCost(r),3);C.refreshOffer(r);C.refreshOffer(r);assert.equal(C.recruitRefreshCost(r),5);
 const off=lineup({three:'beard_harden',inside:'wolf_garnett'});off.refreshFree=0;assert.equal(C.recruitRefreshCost(off),5);assert.equal(C.trainingCost(off,'wolf_garnett'),1);
 const shop=lineup({mid:'logo_west'});shop.stage=5;const offers=C.ensurePlayerShop(shop);for(const id of offers)assert.equal(C.playerShopPrice(shop,id),C.PLAYER_SHOP_PRICES[C.BY_ID[id].tier]);
});
test('Hakeem free basic boost observes stock, purchase caps and per-battle quota',()=>{
 const r=lineup({def:'dream_hakeem'});r.shopOffers.boost=['hot','focus'];const hot=C.BOOSTS.find(b=>b.id==='hot'),focus=C.BOOSTS.find(b=>b.id==='focus');assert.equal(C.boostPrice(r,hot),0);assert.equal(C.boostPrice(r,focus),9);
 assert.equal(C.buyBoost(r,'paint'),false);assert.equal(C.boostPrice(r,hot),0);assert.equal(C.buyBoost(r,'hot'),true);assert.equal(r.cash,100);assert.equal(C.boostPrice(r,hot),5);assert.equal(C.buyBoost(r,'hot'),false);
});
test('bonus cash uses victory slot snapshot, pays only on next, and windows reset after win or loss',()=>{
 const r=lineup({def:'garnett',mid:'west'}),game=C.createGame();game.run=r;
 C.refreshShop(r,'boost');r.lastBattle={won:true,playerStageCash:1};r.slots.def=null;
 const before=r.cash;assert.equal(C.continueRun(game,'next'),true);assert.equal(r.cash,before+1);assert.equal(C.shopRefreshCost(r,'boost'),0);assert.equal(C.continueRun(game,'next'),false);
 C.refreshShop(r,'boost');r.lastBattle={won:false,playerStageCash:0};const loss=r.cash;assert.equal(C.continueRun(game,'retry'),true);assert.equal(r.cash,loss);assert.equal(C.shopRefreshCost(r,'boost'),0);
 r.stage=10;r.lastBattle={won:true,playerStageCash:1};const final=r.cash;C.continueRun(game,'finish');assert.equal(r.cash,final);
});
test('new core preserves old backend states and battle replay for rules 1–11',()=>{
 const V=require('../activity/cloudfunctions/activity_api/verified-game.js');
 const old=require('../docs/balance/2026-10-12-球员羁绊更新/源码快照/activity/cloudfunctions/activity_api/game/game-core.js');
 for(let version=1;version<=11;version++)for(const seed of [911,81101,22]){
  const a=C.createRun('steady_interest',seed,{},version),b=old.createRun('steady_interest',seed,{},version);assert.deepEqual(plain(a),plain(b),'opening '+version);
  const ops=[];for(let i=0;i<6;i++){const id=a.offer[0];assert.deepEqual(C.recruit(a,id),old.recruit(b,id));ops.push({action:'recruit',args:[id]});if(i<5){C.makeOffer(a);old.makeOffer(b);ops.push({action:'makeOffer',args:[]});}}
  assert.deepEqual(plain(a),plain(b),'draft '+version);const g=C.createGame();g.run=a;const report=C.battle(g,'outside');const replay=V.replay(old.createRun('steady_interest',seed,{},version),ops,'battle','outside');assert.deepEqual(plain(a),plain(replay.state),'battle state '+version);assert.deepEqual(plain(report),plain(replay.report),'battle report '+version);
 }
 assert.equal(old.BALANCE_RULES_VERSION,11);
});
