const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),B=require('../activity/cloudfunctions/activity_api/game/game-core.js');

test('large victory rewards retain historical caps and use 120 only from rule 19',()=>{
 // Synthetic combat boundary fixture: oversized training guarantees a win at
 // a late stage. It tests reward clamping, not attainable player progression.
 for(const version of [1,4,5,18,19,20]){
  const game=C.createGame();game.run=C.createRun('reserve_fund',911,{},version);
  game.run.stage=100;game.run.cash=999;
  ['chef_curry','air_jordan','king_lebron','showtime_magic','diesel_shaq','reaper_durant'].forEach((id,i)=>{
   game.run.slots[C.SLOTS[i].id]=id;game.run.owned[id]={stars:5,train:100,trainedAt:0};
  });
  const backend=structuredClone(game),before=game.run.cash;
  const report=C.battle(game,'outside');B.battle(backend,'outside');
  assert.equal(report.won,true);assert.deepEqual(backend.run,game.run);
  const cap=version>=19?120:version>=5?90:Infinity;
  assert.equal(C.victoryRewardCap(game.run),cap);
  if(Number.isFinite(cap)){assert.equal(report.reward,cap);assert.ok(report.detail.includes('胜利奖金上限'+cap))}
  else assert.ok(report.reward>120);
  assert.equal(game.run.cash-before,report.reward);
 }
});
