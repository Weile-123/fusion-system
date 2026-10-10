const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
function draft(seed=911){
  const run=C.createRun('reserve_fund',seed),operations=[];
  for(let i=0;i<6;i++){
    const id=run.offer[0];operations.push({action:'recruit',args:[id]});C.recruit(run,id);
    if(i<5){operations.push({action:'makeOffer',args:[]});C.makeOffer(run)}
  }
  return {run,operations};
}
test('authoritative seed and operation replay reproduce roster, money, RNG and combat',()=>{
  const {run,operations}=draft(),game=C.createGame();game.run=run;const report=C.battle(game,'outside');
  const replayed=V.replay(C.createRun('reserve_fund',911),operations,'battle','outside');
  assert.deepEqual(replayed.state,run);assert.deepEqual(replayed.report,report);
});
test('forged purchases, off-pool recruits, free rerolls and direct stat/RNG writes are rejected',()=>{
  const state=C.createRun('reserve_fund',911);
  for(const operation of [
    {action:'setRng',args:[0]},{action:'train',args:['__proto__']},{action:'train',args:[state.offer[0]]},{action:'makeOffer',args:[]},
    {action:'recruit',args:[C.STARS.find(s=>!state.offer.includes(s.id)).id]},
    {action:'buyBoost',args:['fake']},{action:'buyRecruitPack',args:[100]}
  ])assert.throws(()=>V.replay(state,[operation],'battle','outside'),/验证失败/);
});
test('locked metadata cannot exceed verified earnings or roll back spent upgrades',()=>{
  assert.equal(V.reconcileProgress({}, {startGold:1,jerseyUnlocks:[]},80),80);
  assert.throws(()=>V.reconcileProgress({}, {startGold:5},80),/传奇点记录/);
  assert.throws(()=>V.reconcileProgress({startGold:1},{startGold:0},1000),/不一致/);
  assert.throws(()=>V.progressCost({trainingBoost:99}),/无效/);
  assert.throws(()=>V.progressCost({jerseyUnlocks:['fake']}),/无效/);
  assert.throws(()=>V.progressCost({rarityBonus:5}),/字段无效/);
  const jersey=C.GEAR.find(item=>item.unlockable&&item.slot==='球衣').id;
  assert.equal(V.reconcileProgress({}, {jerseyUnlocks:[jersey]},500),500);
  assert.throws(()=>V.reconcileProgress({}, {jerseyUnlocks:[jersey]},499),/传奇点记录/);
  assert.throws(()=>V.reconcileProgress({jerseyUnlocks:[jersey]}, {jerseyUnlocks:[]},1000),/不一致/);
});
test('legendary equipment spend is verified independently of jersey records',()=>{
  const item=C.GEAR.find(g=>g.legendary),jersey=C.GEAR.find(g=>g.unlockable&&g.slot==='球衣');
  assert.equal(V.progressCost({gearUnlocks:[item.id],jerseyUnlocks:[jersey.id]}),800);
  assert.throws(()=>V.reconcileProgress({}, {gearUnlocks:[item.id]},299),/传奇点记录/);
  assert.equal(V.reconcileProgress({}, {gearUnlocks:[item.id]},300),300);
  assert.throws(()=>V.progressCost({gearUnlocks:[item.id,item.id]}),/无效/);
  assert.throws(()=>V.progressCost({gearUnlocks:[jersey.id]}),/无效/);
  assert.throws(()=>V.progressCost({jerseyUnlocks:[item.id]}),/无效/);
  assert.throws(()=>V.reconcileProgress({gearUnlocks:[item.id]}, {},1000),/不一致/);
});

test('server replays new unlocked gear purchases using identical fourth-slot random draws',()=>{
  const progress={startGold:5,gearUnlocks:C.GEAR.filter(g=>g.legendary).map(g=>g.id)};let state,item;
  for(let seed=1;seed<500;seed++){state=C.createRun('reserve_fund',seed,progress);item=state.shopOffers.gear.find(id=>C.GEAR.find(g=>g.id===id).legendary);if(item)break}
  assert.ok(item);const game=C.createGame();game.run=structuredClone(state);assert.equal(C.buyGear(game.run,item),true);C.finishRun(game);
  const result=V.replay(state,[{action:'buyGear',args:[item]}],'finish');assert.deepEqual(result.state,game.run);
  assert.deepEqual(require('node:fs').readFileSync(require.resolve('../h5/gear-catalog.js')),require('node:fs').readFileSync(require.resolve('../activity/cloudfunctions/activity_api/game/gear-catalog.js')));
});

test('request digests distinguish branch edits and bind terminal operations',()=>{
  const commands=draft().operations;
  assert.equal(V.digest(0,commands,'battle','outside'),V.digest(0,structuredClone(commands),'battle','outside'));
  assert.notEqual(V.digest(0,commands,'battle','outside'),V.digest(0,commands,'battle','drive'));
  assert.notEqual(V.digest(0,commands,'battle','outside'),V.digest(1,commands,'battle','outside'));
});

test('shop, batch recruits, rewarded recruits, replacements and swaps replay without false rejection',()=>{
  const initial=C.createRun('deep_bench',911,{startGold:5,benchSeat:5});
  // This fixture is a previously verified snapshot, with legitimately earned cash.
  initial.cash=3000;
  const run=structuredClone(initial),operations=[];
  function perform(action,...args){const before=JSON.stringify(run),result=C[action](run,...args);if(before!==JSON.stringify(run))operations.push({action,args});return result}
  for(let i=0;i<6;i++){perform('recruit',run.offer[0]);if(i<5)perform('makeOffer')}
  perform('expandBench');perform('train',run.slots.three);perform('refreshOffer');perform('grantRewardedSOffer');perform('recruit',run.offer[0]);
  perform('buyRecruitPack',10);perform('confirmRecruitBatch',run.offer.map(()=>true));
  while(run.pending){perform('resolvePending','sell');perform('advanceRecruitBatch')}
  if(run.bench.length){perform('swapPositions',{kind:'bench',key:0},{kind:'slot',key:'three'});perform('sellBench',0)}
  perform('refreshShop','boost');perform('buyBoost',run.shopOffers.boost[0]);perform('refreshShop','gear');
  const gear=run.shopOffers.gear[0];perform('buyGear',gear);perform('sellGear',gear);
  const game=C.createGame();game.run=run;C.battle(game,'outside');
  assert.deepEqual(V.replay(initial,operations,'battle','outside').state,run);
});

test('each loss grants one free recruit and opening a retry result cannot grant it twice',()=>{
  let game;
  for(let seed=1;seed<100;seed++){
    const fixture=draft(seed);game=C.createGame();game.run=fixture.run;
    const free=game.run.free,report=C.battle(game,'outside');
    if(!report.won){assert.equal(game.run.free,free+1);assert.equal(C.continueRun(game,'retry'),true);assert.equal(game.run.free,free+1);assert.equal(C.continueRun(game,'retry'),false);assert.equal(game.run.free,free+1);return}
  }
  assert.fail('No loss fixture found');
});

test('version five equipment, events and shop actions replay over consecutive battles',()=>{
  for(let seed=1;seed<=12;seed++){
    const game=C.createGame(),run=game.run=C.createRun('steady_interest',seed,{gearStorage:5,gearUnlocks:C.GEAR.filter(g=>g.legendary).map(g=>g.id),jerseyUnlocks:C.GEAR.filter(g=>g.unlockable&&g.slot==='球衣').map(g=>g.id)});
    run.cash=3000;
    ['curry','jordan','lebron','magic','shaq','bird'].forEach((id,i)=>{run.owned[id]={stars:3,train:3,trainedAt:0};run.slots[C.SLOTS[i].id]=id});
    for(let n=0;n<25&&!run.ended;n++){
      const state=structuredClone(run),operations=[];
      const perform=(action,...args)=>{const before=JSON.stringify(run),result=C[action](['continueRun','resolveRandomEvent','acknowledgeRandomEvent'].includes(action)?game:run,...args);if(before!==JSON.stringify(run))operations.push({action,args});return result};
      if(run.lastBattle){perform('continueRun',run.lastBattle.won?'next':'retry');if(run.randomEvent){const id=run.randomEvent.id;perform('resolveRandomEvent',id,n%2?'safe':'main');perform('acknowledgeRandomEvent',id)}}
      if(run.ended){assert.deepEqual(V.replay(state,operations,'finish').state,run);break}
      perform('refreshShop','gear');for(const id of [...run.shopOffers.gear])perform('buyGear',id);
      const spare=run.gearReserve.find(id=>C.GEAR.find(g=>g.id===id)?.slot!=='球衣');if(spare)perform('equipGear',spare);
      if(C.gearReserveCount(run)>=10)perform('sellGear',run.gearReserve.find(id=>C.GEAR.find(g=>g.id===id)?.slot!=='球衣'));
      C.battle(game,'outside');assert.deepEqual(V.replay(state,operations,'battle','outside').state,run);
      assert.ok(C.gearReserveCount(run)<=10);assert.ok(run.morale<=13);
    }
  }
});
