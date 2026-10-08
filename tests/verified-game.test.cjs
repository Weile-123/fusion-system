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
  const jersey=C.GEAR.find(item=>item.unlockable).id;
  assert.equal(V.reconcileProgress({}, {jerseyUnlocks:[jersey]},500),500);
  assert.throws(()=>V.reconcileProgress({}, {jerseyUnlocks:[jersey]},499),/传奇点记录/);
  assert.throws(()=>V.reconcileProgress({jerseyUnlocks:[jersey]}, {jerseyUnlocks:[]},1000),/不一致/);
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
