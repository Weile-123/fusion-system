const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
const starters=['chef_curry','reaper_durant','king_lebron','showtime_magic','diesel_shaq','stone_duncan'];
function fixture(bondIds){
  const game=C.createGame(),run=game.run=C.createRun('steady_interest',911);
  run.slots=Object.fromEntries(C.SLOTS.map((s,i)=>[s.id,starters[i]]));
  run.bench=[...new Set(bondIds.flatMap(id=>C.SYNERGIES.find(b=>b.id===id).ids))];
  run.benchLimit=run.bench.length;
  run.owned=Object.fromEntries([...starters,...run.bench].map(id=>[id,{stars:3,train:3,trainedAt:0}]));
  run.morale=3;return game;
}
function fight(game,won=true){
  // Keep opponent difficulty fixed to isolate victory counting, without replacing battle().
  game.run.stage=won?1:150;game.run.lastBattle=null;
  for(let seed=911;seed<1911;seed++){
    const copy=structuredClone(game);copy.run.rng=seed;
    const report=C.battle(copy,'outside');
    if(report.won!==won)continue;
    const replay=V.replay({...structuredClone(game.run),rng:seed},[],'battle','outside');
    assert.deepEqual(replay.state,copy.run);
    game.run=copy.run;return report;
  }
  assert.fail('No deterministic battle fixture found');
}
for(const [id,period] of [['royal_recovery',2],['purple_gold_recovery',3],['champion_recovery',4]]){
  test(`${id}: actual battles heal every ${period} active wins; losses and inactive wins do not count`,()=>{
    const game=fixture([id]);game.run.wins=7;
    assert.ok(C.activeSynergies(game.run).some(b=>b.id===id));
    for(let i=1;i<period;i++){
      const report=fight(game);assert.equal(game.run.morale,3);assert.equal(game.run.bondWinHealCounters[id],i);
      const before=JSON.stringify(game.run);assert.equal(C.battle(game,'outside'),null);assert.equal(JSON.stringify(game.run),before);
      assert.ok(!report.detail.some(s=>s.includes('生命 +')));
    }
    const removed=C.SYNERGIES.find(b=>b.id===id).ids.find(x=>!starters.some(s=>C.identityOf(s)===x)),saved=game.run.owned[removed];
    delete game.run.owned[removed];game.run.bench=game.run.bench.filter(x=>x!==removed);
    fight(game);assert.equal(game.run.bondWinHealCounters[id],period-1);assert.equal(game.run.morale,3);
    game.run.owned[removed]=saved;game.run.bench.push(removed);
    fight(game,false);assert.equal(game.run.morale,2);assert.equal(game.run.bondWinHealCounters[id],period-1);
    // JSON round trip models persisted counters; UI restoration is tested in release-runtime.test.cjs.
    game.run=JSON.parse(JSON.stringify(game.run));
    const report=fight(game);assert.equal(game.run.morale,3);assert.equal(game.run.bondWinHealCounters[id],0);
    assert.ok(report.detail.some(s=>s.includes(C.SYNERGIES.find(b=>b.id===id).name)&&s.includes('生命 +1')));
  });
}
test('three healing bonds stack on the twelfth active win and cap at 13',()=>{
  const ids=['royal_recovery','purple_gold_recovery','champion_recovery'],game=fixture(ids);
  for(let win=1;win<=12;win++){
    fight(game);assert.equal(game.run.morale,Math.min(13,3+Math.floor(win/2)+Math.floor(win/3)+Math.floor(win/4)));
  }
  assert.equal(game.run.morale,13);
  for(const id of ids)assert.equal(game.run.bondWinHealCounters[id],0);
  for(const id of ids)game.run.bondWinHealCounters[id]=C.SYNERGIES.find(b=>b.id===id).effect.healEveryWins-1;
  game.run.morale=12;const report=fight(game);
  assert.equal(game.run.morale,13);assert.equal(report.detail.filter(s=>s.includes('生命 +1')).length,1);
});
test('ten-pack price and deductions agree for every talent across all supported rule versions',()=>{
  for(const version of [1,2,3])for(const talent of C.TALENTS){
    const run=C.createRun(talent.id,911,{},version),cost=Math.floor(C.recruitCost(run)*10*(version>=2?.9:.95));
    assert.equal(C.recruitPackCost(run),cost);
    run.cash=cost-1;const before=structuredClone(run);
    assert.equal(C.buyRecruitPack(run),false);assert.deepEqual(run,before);
    run.cash=cost;const free=run.free;
    assert.equal(C.buyRecruitPack(run),true);assert.equal(run.cash,0);assert.equal(run.free,free);assert.equal(run.offer.length,10);
  }
  const run=C.createRun('steady_interest',911);run.slots.handle='stockton';run.owned.stockton={stars:1,train:0,trainedAt:0};
  assert.equal(C.recruitPackCost(run),Math.floor(C.recruitCost(run)*9));
});
