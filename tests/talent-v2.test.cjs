const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../h5/game-core.js');
function lineup(talent){
  const run=C.createRun(talent,911);
  ['chef_curry','air_jordan','king_lebron','showtime_magic','diesel_shaq','reaper_durant'].forEach((id,index)=>{run.slots[C.SLOTS[index].id]=id;run.owned[id]={stars:1,train:0,trainedAt:0}});
  return run;
}
test('migration retains legacy unlocks without giving them to new players',()=>{
  const old=C.createGame().profile;delete old.talentRulesVersion;
  Object.assign(old,{runs:3,wins:8,bestStage:10,bestEndless:13,discovered:C.STARS.slice(0,20).map(s=>s.id)});
  C.migrateTalentUnlocks(old);
  assert.equal(C.availableTalents(old).length,20);
  const snapshot=JSON.stringify(old);C.migrateTalentUnlocks(old);assert.equal(JSON.stringify(old),snapshot);
  const fresh=C.createGame().profile;C.migrateTalentUnlocks(fresh);assert.equal(C.availableTalents(fresh).length,13);
  fresh.bestStage=7;assert.equal(C.talentUnlocked(C.TALENTS.find(t=>t.id==='championship_budget'),fresh),false);
  fresh.wins=15;assert.equal(C.talentUnlocked(C.TALENTS.find(t=>t.id==='championship_budget'),fresh),true);
});
test('discount is twenty percent with integer rounding and dynasty gets five-dimensional bonus',()=>{
  const run=C.createRun('championship_budget',33);
  for(const item of C.GEAR)assert.equal(C.gearPrice(run,item),Math.max(1,Math.ceil(item.price*.8)));
  const dynasty=lineup('dynasty'),base=lineup('win_bonus');dynasty.gear=[];
  const a=C.fused(dynasty,'outside','collapse'),b=C.fused(base,'outside','collapse');
  assert.ok(C.COMBAT_LABELS&&Object.keys(C.COMBAT_LABELS).every(key=>a.dimensions[key]>b.dimensions[key]));
  assert.equal(dynasty.cash,16);assert.equal(C.openingEffect(dynasty).battleCash,-2);
});
test('bench talent survives maximum legacy capacity upgrades',()=>{
  const run=C.createRun('deep_bench',33,{benchSeat:5});assert.equal(run.benchLimit,14);
  const expandable=C.createRun('deep_bench',33);expandable.cash=100;
  while(C.expandBench(expandable)){}assert.equal(expandable.benchLimit,13);
});
test('captain heals only every second win, banks morale, and stops after ten grants',()=>{
  function win(wins,granted,morale){const game=C.createGame();game.run=lineup('captain');Object.assign(game.run,{wins,talentWinHealGranted:granted,morale});assert.equal(C.battle(game,'outside').won,true);return game.run}
  assert.equal(win(0,0,3).morale,3);
  const second=win(1,0,3);assert.equal(second.morale,4);assert.equal(second.talentWinHealGranted,1);
  const last=win(19,9,12);assert.equal(last.morale,13);assert.equal(last.talentWinHealGranted,10);
  const capped=win(21,10,12);assert.equal(capped.morale,12);assert.equal(capped.talentWinHealGranted,10);
});
test('phase specializations affect combat dimensions and have equal summed bonuses',()=>{
  const base=C.fused(lineup('win_bonus'),'outside','collapse');
  for(const id of ['phase_pressure','phase_patient','phase_tempo']){
    const effects=C.openingEffect({talent:id}).dimensions;
    assert.equal(Object.values(effects).reduce((sum,n)=>sum+n,0),16);
    const result=C.fused(lineup(id),'outside','collapse');
    for(const [key,n] of Object.entries(effects))assert.equal(result.dimensions[key]>base.dimensions[key],n>0,`${id}: ${key}`);
  }
});
test('client and cloud combat rules are identical',()=>{
  const fs=require('node:fs');assert.equal(fs.readFileSync('h5/game-core.js','utf8'),fs.readFileSync('activity/cloudfunctions/activity_api/game/game-core.js','utf8'));
});
