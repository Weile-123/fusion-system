const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js');

test('new economics preserve the old rules for existing saves',()=>{
  const fresh=C.createRun('steady_interest',911),old=C.createRun('steady_interest',911,{},1);
  assert.equal(fresh.cash,12);assert.equal(old.cash,16);
  assert.equal(C.recruitPackCost(fresh,10),72);assert.equal(C.recruitPackCost(old,10),76);
  for(const [run,costs] of [[fresh,[1,2,3]],[old,[4,7,11]]]){
    run.owned.curry={stars:1,train:0,trainedAt:0};
    for(let i=0;i<3;i++){run.owned.curry.train=i;assert.equal(C.trainingCost(run,'curry'),costs[i]);}
  }
  assert.equal(fresh.rng,old.rng);
});

test('recovery bonds count independent active wins and respect the health cap',()=>{
  const run=C.createRun('steady_interest',911),bonds=C.SYNERGIES.filter(b=>b.effect.winHeal);
  run.morale=1;
  C.recoverBondMorale(run,bonds);assert.equal(run.morale,1);
  C.recoverBondMorale(run,bonds);assert.equal(run.morale,2);
  C.recoverBondMorale(run,bonds);assert.equal(run.morale,3);
  C.recoverBondMorale(run,bonds);assert.equal(run.morale,5);
  C.recoverBondMorale(run,bonds);assert.equal(run.bondWinHealCounters.royal_recovery,1);
  C.recoverBondMorale(run,bonds.filter(b=>b.id!=='royal_recovery'));
  assert.equal(run.bondWinHealCounters.royal_recovery,1);
  C.recoverBondMorale(run,bonds);assert.equal(run.bondWinHealCounters.royal_recovery,0);
  run.morale=13;for(let i=0;i<12;i++)C.recoverBondMorale(run,bonds);assert.equal(run.morale,13);
  const old=C.createRun('steady_interest',911,{},1);assert.deepEqual(C.recoverBondMorale(old,bonds),[]);
});

test('guide lineup reaches the certified upper bound and satisfies recovery member constraints',()=>{
  const result=JSON.parse(require('node:child_process').execFileSync(process.execPath,['scripts/calculate-strongest-roster.cjs'],{encoding:'utf8'})).all;
  const run=C.createRun('steady_interest',911,{},2);
  run.slots=Object.fromEntries(C.SLOTS.map((slot,i)=>[slot.id,result.starterIds[i]]));
  run.bench=result.benchIds;run.owned=Object.fromEntries([...result.starterIds,...run.bench].map(id=>[id,{stars:3,train:3,trainedAt:0}]));
  assert.equal(C.fused(run).rating,255);assert.ok(result.certified);assert.ok(Math.abs(result.gap)<1e-8);
  const ids=new Set([...result.starterIds,...run.bench]);
  const royal=C.SYNERGIES.find(b=>b.id==='royal_recovery'),purple=C.SYNERGIES.find(b=>b.id==='purple_gold_recovery');
  assert.equal(royal.ids.length,3);
  for(const id of royal.ids){assert.equal(C.BY_ID[id].tier,'S');assert.ok(ids.has(id));}
  assert.equal(purple.ids.filter(id=>ids.has(id)).length,1);
});

test('authoritative battle replay reproduces recovery counters and overflow health',()=>{
  const V=require('../activity/cloudfunctions/activity_api/verified-game.js');
  const run=C.createRun('steady_interest',911),starters=['chef_curry','reaper_durant','king_lebron','showtime_magic','diesel_shaq','stone_duncan'];
  run.slots=Object.fromEntries(C.SLOTS.map((slot,i)=>[slot.id,starters[i]]));run.bench=['jordan','lebron','shaq'];
  run.owned=Object.fromEntries([...starters,...run.bench].map(id=>[id,{stars:3,train:3,trainedAt:0}]));
  run.morale=3;run.bondWinHealCounters.royal_recovery=1;
  const initial=structuredClone(run),game=C.createGame();game.run=run;
  const report=C.battle(game,'outside'),replayed=V.replay(initial,[],'battle','outside');
  assert.equal(report.won,true);assert.equal(run.morale,4);assert.equal(run.bondWinHealCounters.royal_recovery,0);
  assert.deepEqual(replayed.state,run);assert.deepEqual(replayed.report,report);
});
