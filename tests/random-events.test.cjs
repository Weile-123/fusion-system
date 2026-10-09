const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
function prepared(id='T01',version=4){
  const game=C.createGame(),e=C.EVENT_BY_ID[id],run=game.run=C.createRun('steady_interest',911,{},version);
  const ids=[...new Set([...e.players,'curry','lebron','magic','shaq','jordan','bird'])].slice(0,6);
  ids.forEach((id,i)=>{run.owned[id]={stars:1,train:0,trainedAt:0};run.slots[C.SLOTS[i].id]=id});
  run.stage=Math.max(6,e.minStage);run.wins=1;run.losses=e.afterLoss?1:0;run.cash=100;run.morale=e.type==='R'?2:3;
  run.lastBattle={stage:run.stage,won:!e.afterLoss,rating:100,goat:500,foe:'curry',strategy:'outside'};
  if(version>=4){run.lastBattle.eventSnapshot=C.eventBattleSnapshot(run);run.eventState.seen=C.EVENTS.filter(x=>x.id!==id).map(x=>x.id)}
  if(e.jersey)run.unlockedJerseys=[e.jersey];return game;
}
function show(game,id){game.run.rng=0;assert.equal(C.continueRun(game,game.run.lastBattle.won?'next':'retry'),true);assert.equal(game.run.randomEvent.id,id);return game.run.randomEvent}
test('event library exactly matches the 28 design entries and six existing jerseys',()=>{
  assert.equal(C.EVENTS.length,28);assert.equal(new Set(C.EVENTS.map(e=>e.id)).size,28);
  assert.deepEqual(['T','C','P','R','X'].map(t=>C.EVENTS.filter(e=>e.type===t).length),[13,9,4,1,1]);
  for(const e of C.EVENTS){assert.ok(e.story);assert.ok(e.rewardText);for(const id of e.players)assert.ok(C.BY_ID[id]);if(e.jersey)assert.equal(C.GEAR.find(g=>g.id===e.jersey).unlockable,true)}
});
test('bench and history do not meet event conditions; SSR identity on the panel does',()=>{
  const game=prepared('T01'),run=game.run,e=C.EVENT_BY_ID.T01;
  run.bench=['curry'];run.slots.three='duncan';run.owned.duncan={stars:1,train:0};
  assert.equal(C.eventEligible(run,e,C.eventBattleSnapshot(run)),false);
  const variant=C.STARS.find(s=>s.variantOf==='curry');assert.ok(variant);
  run.slots.three=variant.id;run.owned[variant.id]={stars:1,train:0};
  assert.equal(C.eventEligible(run,e,C.eventBattleSnapshot(run)),true);
  const duo=prepared('T06');duo.run.slots[C.SLOTS[1].id]='duncan';duo.run.owned.duncan={stars:1,train:0};duo.run.bench=['klay'];
  assert.equal(C.eventEligible(duo.run,C.EVENT_BY_ID.T06,C.eventBattleSnapshot(duo.run)),false);
});
test('event probability uses post-battle growth snapshot and universal events use panel mean',()=>{
  const game=prepared('T01'),snapshot=C.eventBattleSnapshot(game.run),e=C.EVENT_BY_ID.T01;
  const mean=snapshot.members.reduce((a,m)=>a+m.stats.three,0)/6;
  assert.equal(C.eventAbility(e,snapshot),(mean+snapshot.members.find(m=>m.id==='curry').stats.three)/2);
  const p=C.EVENT_BY_ID.P01;assert.equal(C.eventAbility(p,snapshot),snapshot.members.reduce((a,m)=>a+m.stats.handle,0)/6);
  const original=C.eventAbility(e,snapshot);game.run.owned.curry.stars=5;assert.equal(C.eventAbility(e,snapshot),original);
});
test('legacy versions do not insert events, and finishing the main route does not roll an event',()=>{
  for(const version of [1,2,3]){const g=prepared('T01',version);assert.equal(C.continueRun(g,'next'),true);assert.ok(!g.run.randomEvent)}
  const g=prepared();g.run.stage=10;const rng=g.run.rng;assert.equal(C.continueRun(g,'finish'),true);assert.equal(g.run.rng,rng);assert.equal(g.run.ended,true);assert.ok(!g.run.randomEvent);
});
test('pity advances only with candidates, caps at 60%, and an intervening battle is required',()=>{
  const g=prepared();g.run.rng=1900;C.continueRun(g,'next');assert.equal(g.run.eventState.misses,1);
  g.run.eventState.seen=C.EVENTS.map(e=>e.id);g.run.lastBattle={won:true,eventSnapshot:C.eventBattleSnapshot(g.run)};g.run.rng=1900;C.continueRun(g,'next');assert.equal(g.run.eventState.misses,1);
  const p=prepared();show(p,'T01');const last=p.run.eventState.lastBattle;C.resolveRandomEvent(p,'T01','safe');C.acknowledgeRandomEvent(p,'T01');
  p.run.lastBattle={won:true,eventSnapshot:{...C.eventBattleSnapshot(p.run),battle:last+1}};p.run.eventState.seen=[];p.run.rng=0;
  assert.equal(C.maybeTriggerEvent(p,'next'),false);
  p.run.lastBattle.eventSnapshot.battle=last+2;assert.equal(C.maybeTriggerEvent(p,'next'),true);
  for(let n=0;n<5;n++){const a=prepared();a.run.eventState.misses=n;a.run.rng=800;C.continueRun(a,'next');assert.equal(!!a.run.randomEvent,n>=3)}
});
for(const e of C.EVENTS){
  test(e.id+' main choice grants exactly its designed reward once',()=>{
    const g=prepared(e.id),r=g.run;show(g,e.id);r.rng=0;r.randomEvent.successRate=.9;
    const before=r.cash,result=C.resolveRandomEvent(g,e.id,'main');assert.equal(result.success,true);
    if(e.jersey){assert.ok([...r.gear,...r.gearReserve].includes(e.jersey));assert.ok(r.collectedJerseys.includes(e.jersey));assert.equal(r.eventState.jerseys,1)}
    else if(e.type==='R')assert.equal(r.morale,3);
    else if(e.type==='P'&&e.cost){assert.equal(r.cash,before+e.cost*2);assert.equal(r.stats.eventSpending,e.cost);assert.equal(r.stats.eventIncome,e.cost*3)}
    else assert.ok(r.eventState.bonuses[e.dimension]>0);
    const state=JSON.stringify(r);assert.equal(C.resolveRandomEvent(g,e.id,'main'),false);assert.equal(JSON.stringify(r),state);
    assert.equal(C.train(r,r.slots.three),false);assert.equal(C.battle(g,'outside'),null);assert.equal(C.continueRun(g,'next'),false);
    assert.equal(C.acknowledgeRandomEvent(g,e.id),true);assert.equal(C.acknowledgeRandomEvent(g,e.id),false);
    assert.ok(g.profile.discoveredEvents.includes(e.id));
  });
}
test('safe choices are free; technical events and review grant only +1%',()=>{
  for(const e of C.EVENTS){const g=prepared(e.id);show(g,e.id);const cash=g.run.cash,morale=g.run.morale,rng=g.run.rng;const result=C.resolveRandomEvent(g,e.id,'safe');assert.equal(g.run.cash,cash);assert.equal(g.run.morale,morale);assert.equal(g.run.rng,rng);assert.equal(result.bonus,e.type==='T'||e.id==='P05'?1:0);assert.equal(g.run.eventState.jerseys,0)}
});
test('failure loses only the designed cost and event defeat ends the run exactly once',()=>{
  for(const id of ['T01','P05','P01','P02','P03','C01','C07']){const g=prepared(id),r=g.run;show(g,id);r.rng=1900;r.randomEvent.successRate=.35;const before=r.cash;const result=C.resolveRandomEvent(g,id,'main');assert.equal(result.success,false);assert.equal(r.cash,before-C.EVENT_BY_ID[id].cost);assert.equal(r.morale,id.startsWith('C')?2:3);assert.equal(r.eventState.jerseys,0)}
  const g=prepared('C01');g.run.morale=1;show(g,'C01');assert.equal(C.eventChoices(g.run,g.run.randomEvent).fatal,true);g.run.rng=1900;g.run.randomEvent.successRate=.35;
  const wins=g.run.wins,losses=g.run.losses;C.resolveRandomEvent(g,'C01','main');assert.equal(g.run.ended,true);assert.equal(g.profile.runs,1);assert.equal(g.run.wins,wins);assert.equal(g.run.losses,losses);
  C.acknowledgeRandomEvent(g,'C01');assert.equal(g.profile.runs,1);
});
test('raw event bonuses cap at 15 and participate in the existing soft decay layer',()=>{
  const g=prepared('T01'),r=g.run;r.eventState.bonuses.shooting=14.5;show(g,'T01');assert.match(C.eventChoices(r,r.randomEvent).success,/0.5%/);C.resolveRandomEvent(g,'T01','safe');assert.equal(r.eventState.bonuses.shooting,15);C.acknowledgeRandomEvent(g,'T01');
  r.eventState.seen=[];assert.equal(C.eventEligible(r,C.EVENT_BY_ID.T01,C.eventBattleSnapshot(r)),false);
  const base=C.fused(r).dimensions.shooting;r.eventState.bonuses.shooting=0;assert.ok(base>C.fused(r).dimensions.shooting);
});
test('jersey qualification checks unlock, current locker ownership, limit and receipt',()=>{
  const g=prepared('T12'),r=g.run,e=C.EVENT_BY_ID.T12,snapshot=C.eventBattleSnapshot(r);
  r.unlockedJerseys=[];assert.equal(C.eventEligible(r,e,snapshot),false);r.unlockedJerseys=[e.jersey];r.gearReserve=[e.jersey];assert.equal(C.eventEligible(r,e,snapshot),false);
  r.gearReserve=[];r.eventState.jerseys=2;assert.equal(C.eventEligible(r,e,snapshot),false);r.eventState.jerseys=0;show(g,e.id);r.unlockedJerseys=[];const before=JSON.stringify(r);assert.equal(C.resolveRandomEvent(g,e.id,'main'),false);assert.equal(JSON.stringify(r),before);
  r.unlockedJerseys=[e.jersey];r.gear=[C.GEAR.find(x=>x.slot==='球衣'&&x.id!==e.jersey).id];r.rng=0;C.resolveRandomEvent(g,e.id,'main');assert.ok(r.gearReserve.includes(e.jersey));assert.equal(r.stats.gearPurchases,0);
});
test('pending event and settled result survive JSON restore without new random draws',()=>{
  const g=prepared('P01');show(g,'P01');const copy=JSON.parse(JSON.stringify(g.run));C.restoreEventState(copy,copy);assert.deepEqual(copy.randomEvent,g.run.randomEvent);
  C.resolveRandomEvent(g,'P01','main');const settled=JSON.parse(JSON.stringify(g)),rng=settled.run.rng,cash=settled.run.cash;C.restoreEventState(settled.run,settled.run);assert.equal(C.resolveRandomEvent(settled,'P01','main'),false);assert.equal(settled.run.rng,rng);assert.equal(settled.run.cash,cash);
});
test('server replays legal choices and rejects bypass, wrong ids and repeated payouts',()=>{
  const g=prepared('P01');show(g,'P01');const state=structuredClone(g.run);const ops=[{action:'resolveRandomEvent',args:['P01','main']},{action:'acknowledgeRandomEvent',args:['P01']}];
  C.resolveRandomEvent(g,'P01','main');C.acknowledgeRandomEvent(g,'P01');const result=V.replay(state,ops,'battle','outside');const report=C.battle(g,'outside');assert.deepEqual(result.report,report);assert.deepEqual(result.state,g.run);
  for(const operations of [[{action:'makeOffer',args:[]}],[{action:'resolveRandomEvent',args:['P02','main']}],[ops[0],ops[0]]])assert.throws(()=>V.replay(state,operations,'finish'),/验证失败/);
});
test('frontend and cloud use byte-identical core, event data and event engine',()=>{
  for(const file of ['game-core.js','event-data.js','event-system.js'])assert.equal(fs.readFileSync('h5/'+file,'utf8'),fs.readFileSync('activity/cloudfunctions/activity_api/game/'+file,'utf8'));
});
