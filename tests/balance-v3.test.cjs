const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../h5/game-core.js'),D=require('../h5/game-data.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
const routes=require('../scripts/data/diverse-rosters.json');
function roster(route,version=3){const run=C.createRun('steady_interest',911,{},version);run.slots=Object.fromEntries(C.SLOTS.map((s,i)=>[s.id,route.ids[i]]));run.bench=route.ids.slice(6);run.benchLimit=10;run.owned=Object.fromEntries(route.ids.map(id=>[id,{stars:3,train:3,trainedAt:0}]));return run;}
test('v3 soft bonus retains negative floor and legacy hard caps',()=>{
  for(const [input,value] of [[-60,-30],[20,20],[30,30],[40,35],[60,45],[100,65]])assert.equal(C.combatBonus({balanceRulesVersion:3},input),value);
  assert.equal(C.combatBonus({balanceRulesVersion:2},100),40);
  assert.equal(C.combatBonus({},100),40);
  for(const version of [1,2,3]){const run=C.createRun('steady_interest',911,{},version);assert.equal(run.balanceRulesVersion||1,version);assert.equal(C.synergiesForRun(run).length,version===3?100:84);}
});
test('new nested packages stack while v2 still selects the highest chain',()=>{
  for(const version of [2,3]){const run=C.createRun('steady_interest',911,{},version);for(const id of ['harper','jordan','pippen','rodman','longley'])run.owned[id]={stars:1,train:0};const ids=C.activeSynergies(run).map(b=>b.id);assert.ok(ids.includes('bulls_dynasty'));assert.equal(ids.includes('bull_triangle'),version===3);}
  assert.deepEqual(D.SYNERGIES.find(b=>b.name==='格林公式').ids,['durant','green']);
});

test('added bonds activate only with complete current-run membership and never on legacy runs',()=>{
  const previousIds=new Set(D.LEGACY_SYNERGIES.map(b=>b.id));
  const added=D.SYNERGIES.filter(b=>!previousIds.has(b.id));assert.equal(added.length,17);
  for(const bond of added){
    const game=C.createGame();game.profile.discovered=C.STARS.map(s=>s.id);
    const run=game.run=C.createRun('steady_interest',911);
    run.offer=[...bond.ids];run.collectedPlayers=[...bond.ids];
    assert.ok(!C.activeSynergies(run).some(b=>b.id===bond.id),bond.name);
    for(const absent of bond.ids){
      run.owned=Object.fromEntries(bond.ids.filter(id=>id!==absent).map(id=>[id,{stars:1,train:0}]));
      assert.ok(!C.activeSynergies(run).some(b=>b.id===bond.id),bond.name+' missing '+absent);
    }
    run.owned=Object.fromEntries(bond.ids.map(id=>[id,{stars:1,train:0}]));
    run.slots.three=bond.ids[0];run.bench=bond.ids.slice(1);
    assert.ok(C.activeSynergies(run).some(b=>b.id===bond.id),bond.name);
    for(const version of [1,2]){const legacy={...run,balanceRulesVersion:version};assert.ok(!C.activeSynergies(legacy).some(b=>b.id===bond.id),bond.name+' legacy '+version);}
    assert.ok(C.sellBench(run,0)>0);
    assert.ok(!C.activeSynergies(run).some(b=>b.id===bond.id),bond.name+' sold');
  }
});
test('no-death route matches the reference strength without any death member',()=>{
  const primary=routes.find(r=>r.name.includes('常规路线 1')),alternative=routes.find(r=>r.name.includes('Showtime＋公牛'));
  assert.ok(primary&&alternative);assert.equal(C.fused(roster(primary)).rating,195);assert.equal(C.fused(roster(alternative)).rating,195);
  for(const id of ['curry','klay','iguodala','durant','green'])assert.ok(!alternative.ids.includes(id));
});
test('all guide candidates and all supported rule versions replay identically on server',()=>{
  for(const route of routes){const run=roster(route),fused=C.fused(run);assert.ok(Number.isFinite(fused.rating));assert.equal(new Set(route.ids).size,16);}
  for(const version of [1,2,3]){const initial=roster(routes[0],version),game=C.createGame();game.run=structuredClone(initial);const report=C.battle(game,'outside'),replay=V.replay(initial,[],'battle','outside');assert.deepEqual(replay.state,game.run);assert.deepEqual(replay.report,report);}
  for(const name of ['game-data.js','game-core.js'])assert.equal(fs.readFileSync('h5/'+name,'utf8'),fs.readFileSync('activity/cloudfunctions/activity_api/game/'+name,'utf8'));
});

test('legacy recruit credits authorize new offers without permitting unpaid rerolls',()=>{
  const initial=roster(routes[0],2);initial.benchLimit=11;initial.cash=0;initial.free=0;initial.recruitCredits=2;initial.offer=[];
  const game=C.createGame();game.run=structuredClone(initial);
  const offer=C.makeOffer(game.run),id=offer[0];assert.equal(C.recruit(game.run,id).ok,true);C.makeOffer(game.run);
  const ops=[{action:'makeOffer',args:[]},{action:'recruit',args:[id]},{action:'makeOffer',args:[]}];
  const report=C.battle(game,'outside'),replayed=V.replay(initial,ops,'battle','outside');
  assert.deepEqual(replayed.state,game.run);assert.deepEqual(replayed.report,report);assert.equal(game.run.recruitCredits,1);
  for(const credits of [0,undefined]){const unpaid=structuredClone(initial);unpaid.recruitCredits=credits;assert.throws(()=>V.replay(unpaid,[{action:'makeOffer',args:[]}],'battle','outside'));}
});
