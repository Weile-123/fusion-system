const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),Cloud=require('../activity/cloudfunctions/activity_api/game/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
const ids=['chef_curry','air_jordan','king_lebron','showtime_magic','diesel_shaq','stone_duncan'];
function panel(version=21){const g=C.createGame(),r=g.run=C.createRun('steady_interest',61001,{},version);r.stage=100;r.endless=true;r.bench=[];r.owned={};r.roleSkillMap={};for(const [i,id]of ids.entries()){r.slots[C.SLOTS[i].id]=id;r.owned[id]={stars:10,train:20,trainedAt:0};r.roleSkillMap[id]=['sk_cb_30'];}return g;}
test('six repeated badges activate probability effects once and retain attribute stacking',()=>{
  const r=panel().run,e=C.randomSkillEffects(r);assert.equal(e.allDimensions,30);assert.equal(e.clutchBonus,.02);assert.equal(e.opponentPenalty,.02);assert.equal(e.turnoverReduction,.02);
});
test('different badge names share an effect limit; every category takes its strongest value independently',()=>{
  const r=panel().run;for(const id of ids)r.roleSkillMap[id]=['sk_cb_30','sk_mall_5'];
  let e=C.randomSkillEffects(r);assert.equal(e.allDimensions,30);for(const key of ['clutchBonus','opponentPenalty','turnoverReduction'])assert.equal(e[key],.03);
  r.roleSkillMap[ids[0]]=['sk_mcl_4','sk_mat_4'];e=C.randomSkillEffects(r);assert.equal(e.clutchBonus,.04);assert.equal(e.opponentPenalty,.04);assert.equal(e.turnoverReduction,.03);
  const before=structuredClone(r.roleSkillMap);r.slots=Object.fromEntries(Object.entries(r.slots).reverse());assert.deepEqual(C.randomSkillEffects(r),e);assert.deepEqual(r.roleSkillMap,before);
});
test('stronger bench and preview badges do not count; changing lineup and restored saves recompute maxima',()=>{
  const r=panel().run;r.bench=['kobe'];r.owned.kobe={stars:3,train:0,trainedAt:0};r.roleSkillMap.kobe=['sk_mcl_4','sk_mat_4'];r.draftSkillPreview.durant='sk_mcl_4';assert.equal(C.randomSkillEffects(r).clutchBonus,.02);
  assert.ok(C.swapBench(r,0,'three'));assert.equal(C.randomSkillEffects(r).clutchBonus,.04);
  const restored=structuredClone(r);C.restoreRandomSkills(restored,r);assert.deepEqual(C.randomSkillEffects(restored),C.randomSkillEffects(r));
  assert.ok(C.swapBench(r,0,'three'));assert.equal(C.randomSkillEffects(r).clutchBonus,.02);
});
test('historical rules 7 through 20 keep additive effects and frontend/cloud agree',()=>{
  for(let version=7;version<=21;version++){const r=panel(version).run;for(const id of ids)r.roleSkillMap[id]=['sk_cb_30','sk_mall_5'];const e=C.randomSkillEffects(r);assert.deepEqual(Cloud.randomSkillEffects(structuredClone(r)),e);const single=C.randomSkillForRun(r,'sk_cb_30').effects,second=C.randomSkillForRun(r,'sk_mall_5').effects;for(const key of ['clutchBonus','opponentPenalty','turnoverReduction'])assert.ok(Math.abs(e[key]-(version>=21?Math.max(single[key],second[key]):6*(single[key]+second[key])))<1e-12);}
});
test('battle, cash, healing, RNG and final state replay identically under new and old rules',()=>{
  for(const version of [17,20,21])for(const strategy of Object.keys(C.STRATEGIES)){const g=panel(version);for(const id of ids)g.run.roleSkillMap[id]=['sk_cb_30','sk_mall_5'];const initial=structuredClone(g.run),report=C.battle(g,strategy),replay=V.replay(initial,[],'battle',strategy);assert.deepEqual(replay.report,report);assert.deepEqual(replay.state,g.run);}
});
