const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
function prepared(id='T01',version=C.BALANCE_RULES_VERSION){
  const game=C.createGame(),e=C.EVENT_BY_ID[id],run=game.run=C.createRun('steady_interest',911,{},version);
  const ids=[...new Set([...e.players,'curry','lebron','magic','shaq','jordan','bird'])].slice(0,6);
  ids.forEach((id,i)=>{run.owned[id]={stars:1,train:0,trainedAt:0};run.slots[C.SLOTS[i].id]=id});
  run.stage=Math.max(6,e.minStage);run.wins=1;run.losses=e.afterLoss?1:0;run.cash=100;run.morale=e.type==='R'?2:3;
  run.lastBattle={stage:run.stage,won:!e.afterLoss,rating:100,goat:500,foe:'curry',strategy:'outside'};
  if(version>=4){run.lastBattle.eventSnapshot=C.eventBattleSnapshot(run);run.eventState.seen=C.EVENTS.filter(x=>x.id!==id).map(x=>x.id)}
  if(e.jersey)run.unlockedJerseys=[e.jersey];return game;
}
function show(game,id){game.run.rng=0;assert.equal(C.continueRun(game,game.run.lastBattle.won?'next':'retry'),true);assert.equal(game.run.randomEvent.id,id);return game.run.randomEvent}
test('event library exactly matches the 36 design entries and six existing jerseys',()=>{
  assert.equal(C.EVENTS.length,36);assert.equal(new Set(C.EVENTS.map(e=>e.id)).size,36);
  assert.deepEqual(['T','C','P','R','X','H'].map(t=>C.EVENTS.filter(e=>e.type===t).length),[14,8,6,1,1,6]);
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
test('event thresholds ease success without changing the probability formula',()=>{
  for(const [stage,threshold] of [[1,70],[3,70],[4,85],[7,85],[8,100],[10,100],[11,101],[39,129],[40,130],[100,130]])assert.equal(C.eventDifficulty(stage),threshold);
  const g=prepared('T01');g.run.stage=8;g.run.lastBattle.eventSnapshot=C.eventBattleSnapshot(g.run);
  for(const member of g.run.lastBattle.eventSnapshot.members)member.stats.three=110;
  const pending=show(g,'T01');assert.equal(pending.difficulty,100);assert.ok(Math.abs(pending.successRate-.9)<1e-12);
  const equal=prepared('T01');for(const member of equal.run.lastBattle.eventSnapshot.members)member.stats.three=C.eventDifficulty(equal.run.stage);assert.ok(Math.abs(show(equal,'T01').successRate-.7)<1e-12);
});
test('legacy versions do not insert events, and finishing the main route does not roll an event',()=>{
  for(const version of [1,2,3]){const g=prepared('T01',version);assert.equal(C.continueRun(g,'next'),true);assert.ok(!g.run.randomEvent)}
  const g=prepared();g.run.stage=10;const rng=g.run.rng;assert.equal(C.continueRun(g,'finish'),true);assert.equal(g.run.rng,rng);assert.equal(g.run.ended,true);assert.ok(!g.run.randomEvent);
});

test('version four keeps its original event thresholds, probability and 15 percent limit',()=>{
  const game=prepared('T01',4),run=game.run,pending=show(game,'T01');
  assert.equal(pending.difficulty,105);
  assert.equal(pending.successRate,C.clamp(.65+(pending.ability-105)*.02,.35,.9));
  run.eventState.bonuses.shooting=14.5;
  assert.equal(C.resolveRandomEvent(game,'T01','safe').bonus,.5);
  assert.equal(run.eventState.bonuses.shooting,15);
  C.acknowledgeRandomEvent(game,'T01');run.eventState.seen=[];
  assert.equal(C.eventEligible(run,C.EVENT_BY_ID.T01,C.eventBattleSnapshot(run)),false);
  const copy=structuredClone(run);copy.eventState.bonuses.shooting=25;C.restoreEventState(copy,copy);
  assert.equal(copy.eventState.bonuses.shooting,15);
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
    else if(e.gear){assert.ok(r.gear.includes(e.gear));assert.equal(C.GEAR.find(g=>g.id===e.gear).rarity,'A')}
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
  for(const e of C.EVENTS){const g=prepared(e.id);show(g,e.id);const cash=g.run.cash,morale=g.run.morale,rng=g.run.rng;const result=C.resolveRandomEvent(g,e.id,'safe');assert.equal(g.run.cash,cash);assert.equal(g.run.morale,morale);assert.equal(g.run.rng,rng);assert.equal(result.bonus,(e.trialType||e.type)==='T'||e.id==='P05'?1:0);assert.equal(g.run.eventState.jerseys,0)}
});
test('failure loses only the designed cost and event defeat ends the run exactly once',()=>{
  for(const id of ['T01','P05','P01','P02','P03','C01','C07']){const g=prepared(id),r=g.run;show(g,id);r.rng=1900;r.randomEvent.successRate=.35;const before=r.cash;const result=C.resolveRandomEvent(g,id,'main');assert.equal(result.success,false);assert.equal(r.cash,before-C.EVENT_BY_ID[id].cost);assert.equal(r.morale,id.startsWith('C')?2:3);assert.equal(r.eventState.jerseys,0)}
  const g=prepared('C01');g.run.morale=1;show(g,'C01');assert.equal(C.eventChoices(g.run,g.run.randomEvent).fatal,true);g.run.rng=1900;g.run.randomEvent.successRate=.35;
  const wins=g.run.wins,losses=g.run.losses;C.resolveRandomEvent(g,'C01','main');assert.equal(g.run.ended,true);assert.equal(g.profile.runs,1);assert.equal(g.run.wins,wins);assert.equal(g.run.losses,losses);
  C.acknowledgeRandomEvent(g,'C01');assert.equal(g.profile.runs,1);
});
test('event bonuses accumulate beyond 15, survive restore and retain combat soft decay',()=>{
  const g=prepared('T01'),r=g.run;r.eventState.bonuses.shooting=14.5;show(g,'T01');assert.match(C.eventChoices(r,r.randomEvent).success,/3～5%/);C.resolveRandomEvent(g,'T01','safe');assert.equal(r.eventState.bonuses.shooting,15.5);C.acknowledgeRandomEvent(g,'T01');
  r.eventState.seen=[];assert.equal(C.eventEligible(r,C.EVENT_BY_ID.T01,C.eventBattleSnapshot(r)),true);
  const full=prepared('T01');full.run.eventState.bonuses.shooting=15;show(full,'T01');full.run.rng=0;full.run.randomEvent.successRate=.9;const result=C.resolveRandomEvent(full,'T01','main');assert.equal(result.success,true);assert.ok(result.bonus>=3&&result.bonus<=5);assert.equal(full.run.eventState.bonuses.shooting,15+result.bonus);
  r.eventState.bonuses.shooting=45;const copy=JSON.parse(JSON.stringify(r));C.restoreEventState(copy,copy);assert.equal(copy.eventState.bonuses.shooting,45);assert.equal(C.combatBonus(r,45),37.5);
  const boosted=C.fused(r).dimensions.shooting;r.eventState.bonuses.shooting=0;assert.ok(boosted>C.fused(r).dimensions.shooting);
});
test('fatal challenge consumes a rescue headband and saves a living result without settlement',()=>{
  const game=prepared('C01'),run=game.run;run.morale=1;run.gear=['legacy_recovery_band'];run.balanceRulesVersion=5;show(game,'C01');run.rng=1900;run.randomEvent.successRate=.35;
  assert.equal(C.eventChoices(run,run.randomEvent).fatal,false);
  const result=C.resolveRandomEvent(game,'C01','main');assert.equal(result.success,false);assert.equal(result.consumedGear,'legacy_recovery_band');assert.equal(run.morale,1);assert.equal(run.ended,false);assert.equal(game.profile.runs,0);assert.equal(run.gear.length,0);
  const restored=JSON.parse(JSON.stringify(run));C.restoreEventState(restored,restored);assert.equal(restored.randomEvent.result.consumedGear,'legacy_recovery_band');assert.equal(C.resolveRandomEvent(game,'C01','main'),false);assert.equal(C.acknowledgeRandomEvent(game,'C01'),true);assert.equal(run.ended,false);
});

test('jersey qualification checks unlock, current locker ownership, limit and receipt',()=>{
  const g=prepared('T12'),r=g.run,e=C.EVENT_BY_ID.T12,snapshot=C.eventBattleSnapshot(r);
  r.unlockedJerseys=[];assert.equal(C.eventEligible(r,e,snapshot),false);r.unlockedJerseys=[e.jersey];r.gearReserve=[e.jersey];assert.equal(C.eventEligible(r,e,snapshot),false);
  r.gearReserve=[];r.eventState.jerseys=2;assert.equal(C.eventEligible(r,e,snapshot),false);r.eventState.jerseys=0;show(g,e.id);r.unlockedJerseys=[];const before=JSON.stringify(r);assert.equal(C.resolveRandomEvent(g,e.id,'main'),false);assert.equal(JSON.stringify(r),before);
  r.unlockedJerseys=[e.jersey];r.gear=[C.GEAR.find(x=>x.slot==='球衣'&&x.id!==e.jersey).id];r.rng=0;C.resolveRandomEvent(g,e.id,'main');assert.ok(r.gearReserve.includes(e.jersey));assert.equal(r.stats.gearPurchases,0);
});
test('A gear gifts use spare storage, preserve existing gear and replay without duplicate rewards',()=>{
  for(const id of ['P06','P07']){
    const g=prepared(id),e=C.EVENT_BY_ID[id],item=C.GEAR.find(x=>x.id===e.gear),r=g.run;
    const sameSlot=C.GEAR.find(x=>x.slot===item.slot&&x.id!==item.id);
    r.gear=[sameSlot.id];assert.equal(C.eventEligible(r,e,C.eventBattleSnapshot(r)),true);
    r.gearReserve=[item.id];assert.equal(C.eventEligible(r,e,C.eventBattleSnapshot(r)),false);
    r.gearReserve=[];show(g,id);r.gearReserve=C.GEAR.filter(x=>x.slot!=='球衣'&&x.id!==item.id&&x.id!==sameSlot.id).slice(0,5).map(x=>x.id);const blocked=JSON.stringify(r);assert.equal(C.resolveRandomEvent(g,id,'main'),false);assert.equal(JSON.stringify(r),blocked);
    r.gearReserve=[];r.rng=0;r.randomEvent.successRate=.9;const state=structuredClone(r);
    C.resolveRandomEvent(g,id,'main');C.acknowledgeRandomEvent(g,id);assert.ok(r.gearReserve.includes(item.id));assert.ok(r.gear.includes(sameSlot.id));assert.equal(r.stats.gearPurchases,0);
    const replayed=V.replay(state,[{action:'resolveRandomEvent',args:[id,'main']},{action:'acknowledgeRandomEvent',args:[id]}],'battle','outside');
    C.battle(g,'outside');assert.deepEqual(replayed.state,r);
  }
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

test('all event stage, cash, seen and loss gates reject without granting rewards',()=>{
  for(const e of C.EVENTS){
    const g=prepared(e.id),r=g.run,s=C.eventBattleSnapshot(r);
    assert.equal(C.eventEligible(r,e,s),true,e.id);
    assert.equal(C.eventEligible(r,e,{...s,stage:e.minStage-1}),false,e.id+' stage');
    r.eventState.seen.push(e.id);assert.equal(C.eventEligible(r,e,s),false,e.id+' seen');r.eventState.seen=[];
    if(e.cost){r.cash=e.cost-1;assert.equal(C.eventEligible(r,e,s),false,e.id+' cash');r.cash=e.cost;assert.equal(C.eventEligible(r,e,s),true,e.id+' exact cash')}
    if(e.afterLoss){r.lastBattle.won=true;assert.equal(C.eventEligible(r,e,s),false,e.id+' after loss')}
  }
});

test('every probabilistic event failure gives only its advertised penalty and replays on cloud',()=>{
  for(const e of C.EVENTS.filter(e=>!['R','X'].includes(e.type))){
    const g=prepared(e.id),r=g.run;show(g,e.id);r.rng=1900;r.randomEvent.successRate=.35;
    const state=structuredClone(r),cash=r.cash,morale=r.morale,owned=[...r.gear,...r.gearReserve];
    const result=C.resolveRandomEvent(g,e.id,'main');assert.equal(result.success,false,e.id);assert.equal(result.bonus,0);assert.equal(r.cash,cash-e.cost);
    assert.equal(r.morale,morale-((e.trialType||e.type)==='C'?1:0));assert.deepEqual([...r.gear,...r.gearReserve],owned);assert.equal(r.eventState.jerseys,0);
    const settled=JSON.stringify(r);assert.equal(C.resolveRandomEvent(g,e.id,'main'),false);assert.equal(JSON.stringify(r),settled);
    const operations=[{action:'resolveRandomEvent',args:[e.id,'main']},{action:'acknowledgeRandomEvent',args:[e.id]}];
    C.acknowledgeRandomEvent(g,e.id);C.battle(g,'outside');assert.deepEqual(V.replay(state,operations,'battle','outside').state,r,e.id+' replay');
  }
});

test('event probability matches the formula at thresholds and clamping edges',()=>{
  for(const stage of [1,3,4,7,8,10,11,40,200])for(const delta of [-100,-14,-13,-1,0,1,7,8,100]){
    const g=prepared('T01'),r=g.run;r.stage=stage;r.lastBattle.eventSnapshot=C.eventBattleSnapshot(r);
    const difficulty=C.eventDifficulty(stage);for(const member of r.lastBattle.eventSnapshot.members)member.stats.three=difficulty+delta;
    const pending=show(g,'T01');assert.equal(pending.difficulty,difficulty);assert.ok(Math.abs(pending.successRate-C.clamp(.70+delta*.025,.35,.9))<1e-12);
  }
});

test('natural appearance and success rates agree with configured probabilities',()=>{
  const base=prepared('C04'),count=10000;
  for(const [misses,expected] of [[0,.3],[1,.4],[2,.5],[3,.6]]){
    let triggered=0;
    for(let n=1;n<=count;n++){const game=structuredClone(base);game.run.rng=Math.imul(n,2654435761)>>>0;game.run.eventState.misses=misses;if(C.maybeTriggerEvent(game,'next'))triggered++}
    assert.ok(Math.abs(triggered/count-expected)<.02,`appearance ${expected}: ${triggered/count}`);
  }
  const pending=structuredClone(base);show(pending,'C04');
  for(const rate of [.35,.70,.90]){
    let success=0;
    for(let n=1;n<=count;n++){const game=structuredClone(pending);game.run.rng=Math.imul(n,2654435761)>>>0;game.run.randomEvent.successRate=rate;if(C.resolveRandomEvent(game,'C04','main').success)success++}
    assert.ok(Math.abs(success/count-rate)<.02,`success ${rate}: ${success/count}`);
  }
});

test('technical reward ranges cover every allowed value and never increase unrelated dimensions',()=>{
  for(const id of ['T01','T06']){
    const base=prepared(id);show(base,id);const values=new Set(),e=C.EVENT_BY_ID[id];
    for(let n=1;n<=500;n++){const game=structuredClone(base);game.run.rng=Math.imul(n,2654435761)>>>0;game.run.randomEvent.successRate=.9;const result=C.resolveRandomEvent(game,id,'main');if(result.success){values.add(result.bonus);assert.deepEqual(Object.keys(game.run.eventState.bonuses),[e.dimension]);assert.equal(game.run.eventState.bonuses[e.dimension],result.bonus)}}
    assert.deepEqual([...values].sort(),id==='T01'?[3,4,5]:[5,6,7]);
  }
});
