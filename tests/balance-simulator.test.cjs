'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {C,clone,hash,initialize,normalize,loadBrowserCore}=require('../balance/engine.cjs');
const {enumerate,execute,observe}=require('../balance/driver.cjs');
const {simulate,replay,validate}=require('../balance/runner.cjs');
const {names}=require('../balance/policies.cjs');

test('expert does not oscillate between route placement and a higher OVR placement',()=>{
  const game=clone(require('./fixtures/balance-swap-cycle.json')),cfg=normalize({policy:'expert',growthLevel:'full',seed:40041});
  const policy=require('../balance/policies.cjs').createPolicy('expert',1);
  const states=new Set();
  for(let i=0;i<30;i++){
    const op=policy.choose(observe(C,game,cfg));
    if(op.name!=='swapPositions')break;
    const before=hash(game);assert.ok(!states.has(before),'Repeated swap state');states.add(before);execute(C,game,op,cfg);
    assert.ok(i<29,'Swap sequence did not converge');
  }
});

test('initial offers, shops, random consumption and profile agree across browser and Node initialization',()=>{
  const browser=loadBrowserCore();
  for(let seed=1;seed<=20;seed++)for(const policy of names){const cfg=normalize({seed,policy});assert.equal(hash(initialize(C,cfg)),hash(initialize(browser,cfg)))}
});

test('same seed and policy reproduce the entire legal trajectory',()=>{
  const a=simulate({seed:101,policy:'expert',maxStage:20}),b=simulate({seed:101,policy:'expert',maxStage:20});
  assert.notEqual(a.outcome.status,'error',a.outcome.error?.stack);assert.notEqual(b.outcome.status,'error',b.outcome.error?.stack);
  assert.deepEqual(a.journal,b.journal);assert.deepEqual(a.finalGame,b.finalGame);assert.equal(a.mode,'legal');
  assert.equal(replay(a).match,true);
});
test('all three policies agree with browser-global core and authoritative cloud replay',()=>{
  for(const policy of names){const r=simulate({seed:202,policy,maxStage:20});assert.notEqual(r.outcome.status,'error',r.outcome.error?.stack);const check=validate(r);assert.equal(check.browserGlobal.match,true);assert.equal(check.cloud.match,true)}
});

test('historical account progression is deterministic and does not gift run items',()=>{
  for(const growthLevel of ['none','half','full']){
    const cfg=normalize({seed:303,policy:'expert',growthLevel});
    const a=initialize(C,cfg),b=initialize(loadBrowserCore(),cfg);assert.equal(hash(a),hash(b));
    assert.equal(a.game.run.owned&&Object.keys(a.game.run.owned).length,0);
    assert.equal(a.game.profile.legend,0);
    if(growthLevel==='none')assert.equal(a.game.run.unlockedJerseys.length,0);
    if(growthLevel==='full')assert.equal(a.game.run.unlockedJerseys.length,15);
    const run=simulate({...cfg,maxStage:15});assert.notEqual(run.outcome.status,'error',run.outcome.error?.stack);assert.equal(validate(run).cloud.match,true);
  }
});

test('cash shortage with an outstanding offer allows battle and excludes unaffordable recruit',()=>{
  const cfg=normalize({seed:64}),{game}=initialize(C,cfg);
  for(let i=0;i<6;i++){C.makeOffer(game.run);C.recruit(game.run,game.run.offer[0])}
  C.makeOffer(game.run);game.run.cash=2;game.run.free=0;
  const ops=enumerate(C,game,cfg);assert.ok(ops.some(x=>x.name==='battle'));assert.ok(!ops.some(x=>x.name==='recruit'));
});
test('AI observes public information without RNG or hidden opponent strategy',()=>{
  const cfg=normalize({seed:5}),{game}=initialize(C,cfg),o=observe(C,game,cfg);
  assert.equal(o.rng,undefined);assert.equal(o.seed,undefined);assert.equal(o.opponent.strategy,undefined);assert.equal(o.opponentStrategy,undefined);assert.equal(o.event?.snapshot,undefined);
  assert.ok(Object.isFrozen(o));assert.ok(Object.isFrozen(o.actions));
  const before=hash(game);observe(C,game,cfg);assert.equal(hash(game),before);
  game.run.rng=123;const other=observe(C,game,cfg);assert.deepEqual(o,other);
});
test('limits are censored rather than failed and invalid actions spend nothing',()=>{
  const limited=simulate({seed:3,maxActions:1});assert.equal(limited.outcome.status,'censored');assert.equal(limited.outcome.limit,'actions');assert.equal(limited.outcome.terminalCause,null);
  const cfg=normalize({seed:7}),{game}=initialize(C,cfg),before=clone(game);
  assert.throws(()=>execute(C,game,{name:'train',args:['curry']},cfg),/Illegal action/);assert.deepEqual(game,before);
});
test('replay rejects altered trajectory and supports a labelled starting scenario',()=>{
  const r=simulate({seed:91,maxStage:2});assert.equal(replay(r).match,true);r.journal[0].args=['not-a-player'];assert.throws(()=>replay(r));
  const s=simulate({seed:3,maxStage:50,scenario:{label:'preset starting probe',stage:50,players:['curry','durant','lebron','magic','shaq','jordan'],cash:100,morale:3}});
  assert.equal(s.mode,'scenario');assert.equal(s.initialGame.run.stage,50);assert.notEqual(s.outcome.status,'error',s.outcome.error?.stack);
});
test('ads only exist in explicitly configured reward-success scenario',()=>{
  const cfg=normalize({seed:77}),{game}=initialize(C,cfg);
  for(let i=0;i<6;i++){if(!game.run.offer.length)C.makeOffer(game.run);C.recruit(game.run,game.run.offer[0])}
  assert.equal(enumerate(C,game,cfg).some(a=>a.name==='grantRewardedSOffer'),false);
  game.run.offer=[];assert.ok(enumerate(C,game,{...cfg,ads:'rewarded-success'}).some(a=>a.name==='grantRewardedSOffer'));
});
