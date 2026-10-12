const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),V=require('../balance/replay-verifier.cjs');
function shop(seed=911,version=C.BALANCE_RULES_VERSION){const r=C.createRun('reserve_fund',seed,{},version);r.stage=6;r.cash=200;C.makeShopOffers(r);return r;}
test('player shop unlocks on entry to stage five while rules ten keep their stage-six gate',()=>{
  for(let version=1;version<=9;version++){const r=shop(911,version);assert.equal(C.playerShopUnlocked(r),false);assert.equal(C.refreshPlayerShop(r),false);assert.deepEqual(C.ensurePlayerShop(r),[]);}
  const r=C.createRun('reserve_fund',911);r.stage=4;assert.equal(C.playerShopUnlocked(r),false);
  r.lastBattle={won:true};r.eventState.lastBattle=5;const g=C.createGame();g.run=r;
  assert.equal(C.continueRun(g,'next'),true);assert.equal(r.stage,5);assert.equal(C.playerShopUnlocked(r),true);assert.equal(r.playerShopOffers.length,3);
});

test('new shop ignores discounts and rules ten keep the original discount and gate',()=>{
  for(const version of [10,11]){
    const r=C.createRun('reserve_fund',911,{},version);r.stage=5;
    const discount=C.RANDOM_SKILLS.find(s=>s.effects.shopDiscount===1);
    for(let i=0;i<6;i++){const id=C.STARS[i].id;r.owned[id]={stars:1,train:0};r.slots[C.SLOTS[i].id]=id;r.roleSkillMap[id]=[discount.id];}
    assert.equal(C.playerShopUnlocked(r),version===11);
    const a=C.STARS.find(s=>s.tier==='A'),s=C.STARS.find(s=>s.tier==='S');
    assert.equal(C.playerShopPrice(r,a.id),version===11?14:8);
    assert.equal(C.playerShopPrice(r,s.id),version===11?24:18);
  }
});

test('main-mode three stars grant a second badge, sale removes earned extra badges only in new rules',()=>{
  for(const version of [10,11]){
    const r=shop(911,version),id=r.playerShopOffers[0];
    for(let i=0;i<3;i++){r.playerShopOffers=[id];assert.equal(C.buyShopPlayer(r,id).ok,true);}
    const first=r.roleSkillMap[id][0];assert.equal(r.owned[id].stars,3);assert.equal(r.roleSkillMap[id].length,2);
    const slot=C.SLOTS.find(s=>r.slots[s.id]===id);delete r.slots[slot.id];r.bench.push(id);
    assert.ok(C.sellBench(r,0)>0);assert.equal(r.roleSkillMap[id].length,version===11?1:2);
    r.playerShopOffers=[id];assert.equal(C.buyShopPlayer(r,id).ok,true);
    assert.equal(r.owned[id].stars,1);assert.equal(r.roleSkillMap[id][0],first);
    assert.equal(r.roleSkillMap[id].length,version===11?1:2);
  }
});
test('three unique offers follow A A and thirty-percent S, exclude full stars and never sell SSR',()=>{
  let s=0;for(let seed=1;seed<=1000;seed++){
    const r=shop(Math.imul(seed,2654435761)>>>0),offers=r.playerShopOffers;assert.equal(offers.length,3);assert.equal(new Set(offers).size,3);
    assert.equal(C.BY_ID[offers[0]].tier,'A');assert.equal(C.BY_ID[offers[1]].tier,'A');if(C.BY_ID[offers[2]].tier==='S')s++;
    assert.ok(offers.every(id=>['A','S'].includes(C.BY_ID[id].tier)));
  }assert.ok(s>250&&s<350,`S count ${s}`);
  const r=shop();for(const star of C.STARS.filter(x=>x.tier==='A'))r.owned[star.id]={stars:3,train:0};
  C.makePlayerShopOffers(r);assert.ok(r.playerShopOffers.every(id=>C.BY_ID[id].tier==='S'));
  for(const star of C.STARS.filter(x=>x.tier==='S'))r.owned[star.id]={stars:3,train:0};
  C.makePlayerShopOffers(r);assert.deepEqual(r.playerShopOffers,[]);
});
test('purchases preserve draft freebies and credit, transfer skill previews, upgrade and remove stock',()=>{
  const r=shop(911,11),id=r.playerShopOffers[0],preview=r.draftSkillPreview[id],cash=r.cash,free=r.free,offer=[...r.offer];
  assert.equal(C.playerShopPrice(r,id),14);const acquired=C.buyShopPlayer(r,id);assert.equal(acquired.ok,true);
  assert.equal(r.cash,cash-14);assert.equal(r.free,free);assert.deepEqual(r.offer,offer);assert.equal(r.roleSkillMap[id][0],preview);assert.equal(r.playerShopOffers.includes(id),false);
  const before=JSON.stringify(r);assert.equal(C.buyShopPlayer(r,id).ok,false);assert.equal(JSON.stringify(r),before);
  r.playerShopOffers=[id];assert.equal(C.buyShopPlayer(r,id).kind,'duplicate');assert.equal(r.owned[id].stars,2);
  r.playerShopOffers=[id];C.buyShopPlayer(r,id);assert.equal(r.owned[id].stars,3);r.playerShopOffers=[id];
  const maxed=JSON.stringify(r);assert.equal(C.buyShopPlayer(r,id).ok,false);assert.equal(JSON.stringify(r),maxed);
});
test('rule twelve keeps purchased player cards sold until refresh and blocks repeated purchases',()=>{
 const r=shop(),offers=[...r.playerShopOffers],id=offers[0];
 assert.equal(C.buyShopPlayer(r,id).ok,true);assert.deepEqual(r.playerShopOffers,offers);assert.deepEqual(r.playerShopSoldOffers,[id]);
 const before=JSON.stringify(r);assert.equal(C.buyShopPlayer(r,id).ok,false);assert.equal(JSON.stringify(r),before);
 for(const other of offers.slice(1))assert.equal(C.buyShopPlayer(r,other).ok,true);
 assert.deepEqual(C.ensurePlayerShop(r),offers);assert.equal(r.playerShopSoldOffers.length,3);
 assert.equal(C.refreshPlayerShop(r),true);assert.deepEqual(r.playerShopSoldOffers,[]);assert.equal(r.playerShopOffers.length,3);
});
test('refresh costs four, preserves sold stock and rejects invalid preparation phases',()=>{
  const r=shop();r.cash=3;const before=JSON.stringify(r);assert.equal(C.refreshPlayerShop(r),false);assert.equal(JSON.stringify(r),before);
  r.cash=100;const rng=r.rng;assert.equal(C.refreshPlayerShop(r),true);assert.equal(r.cash,96);assert.notEqual(r.rng,rng);
  for(const id of [...r.playerShopOffers])assert.equal(C.buyShopPlayer(r,id).ok,true);
  const sold=JSON.stringify(r);assert.deepEqual(C.ensurePlayerShop(r),r.playerShopSoldOffers);assert.equal(JSON.stringify(r),sold);
  for(const field of ['ended','lastBattle','pending','randomEvent','skillAdPick']){
    const blocked=shop();blocked[field]=true;const snapshot=JSON.stringify(blocked);assert.equal(C.refreshPlayerShop(blocked),false);assert.equal(C.buyShopPlayer(blocked,blocked.playerShopOffers[0]).ok,false);assert.equal(JSON.stringify(blocked),snapshot);
  }
});
test('full roster purchase uses existing replace and sell flow without losing the paid player',()=>{
  const r=shop(),id=r.playerShopOffers[0],others=C.STARS.filter(s=>s.id!==id).slice(0,12);
  for(const [i,star]of others.entries()){r.owned[star.id]={stars:1,train:0,trainedAt:0};if(i<6)r.slots[C.SLOTS[i].id]=star.id;else r.bench.push(star.id);}
  assert.equal(C.buyShopPlayer(r,id).kind,'pending');assert.equal(r.pending,id);
  const cash=r.cash;assert.equal(C.resolvePending(r,'sell'),true);assert.equal(r.pending,null);assert.equal(r.cash,cash+C.saleValue(id,1,r));
});
test('server replays shop initialization refresh purchase and rejects fabricated offers or legacy use',()=>{
  const r=shop(),id=r.playerShopOffers[0],operations=[{action:'refreshPlayerShop',args:[]}];
  C.refreshPlayerShop(r);const purchase=r.playerShopOffers[0];operations.push({action:'buyShopPlayer',args:[purchase]});C.buyShopPlayer(r,purchase);
  const replayed=V.replay(shop(),operations,'finish');const g=C.createGame();g.run=r;C.finishRun(g);assert.deepEqual(replayed.state,r);
  assert.throws(()=>V.replay(shop(),[{action:'buyShopPlayer',args:['not-a-player']}],'finish'),/无法|验证/);
  assert.throws(()=>V.replay(shop(911,9),[{action:'buyShopPlayer',args:[id]}],'finish'),/无法|验证/);
});
