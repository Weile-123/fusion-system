const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');

test('rules six preserve the first twenty opponents and historical endless rules',()=>{
  for(let stage=1;stage<=20;stage++)assert.deepEqual(C.opponent({stage,balanceRulesVersion:6}),C.opponent({stage,balanceRulesVersion:5}));
  // 整数四舍五入可能使基点后一关OVR暂时相同。
  assert.ok(C.opponent({stage:25,balanceRulesVersion:6}).rating>C.opponent({stage:25,balanceRulesVersion:5}).rating);
  for(const version of [1,2,3,4,5])for(const [stage,rating] of [[100,551],[200,1031],[300,1494],[500,2394],[566,2684]]){
    assert.equal(C.opponent({stage,balanceRulesVersion:version}).rating,rating);
  }
});

test('endless opponents keep accelerating after max stars and exceed the current leading score',()=>{
  let previous=0;
  for(let stage=20;stage<=1000;stage++){
    const foe=C.opponent({stage,balanceRulesVersion:6});
    assert.ok(foe.rating>previous,'stage '+stage);previous=foe.rating;
    assert.ok(Object.values(foe.stats).every(value=>Number.isSafeInteger(value)&&value>0));
  }
  const ratings=[200,300,400,500,600,700].map(stage=>C.opponent({stage,balanceRulesVersion:6}).rating);
  for(let i=2;i<ratings.length;i++)assert.ok(ratings[i]-ratings[i-1]>ratings[i-1]-ratings[i-2]);
  assert.ok(C.opponent({stage:566,balanceRulesVersion:6}).rating>12605);
});

test('late endless battle replays identically on the server for rules five and six',()=>{
  for(const version of [5,6]){
    const state=C.createRun('steady_interest',911,{},version);
    state.stage=566;state.endless=true;
    ['chef_curry','air_jordan','king_lebron','showtime_magic','diesel_shaq','stone_duncan'].forEach((id,i)=>{
      state.slots[C.SLOTS[i].id]=id;state.owned[id]={stars:10,train:200,trainedAt:0};
    });
    const game=C.createGame();game.run=structuredClone(state);
    const report=C.battle(game,'outside'),replay=V.replay(state,[],'battle','outside');
    assert.deepEqual(replay.report,report);assert.deepEqual(replay.state,game.run);
    assert.equal(report.foeRating,version===5?2684:20200);
  }
});

test('fixed stage difficulty is smooth and independent of player strength or temporary boosts',()=>{
  const {scenarios,scenarioRun}=require('../scripts/audit-endless-winrates.cjs');
  let previous=C.opponent({stage:20,balanceRulesVersion:6}).rating;
  for(let stage=21;stage<=1000;stage++){
    const foe=C.opponent({stage,balanceRulesVersion:6});
    assert.ok(foe.rating>previous&&foe.rating/previous<=1.06,`stage ${stage}: ${previous} -> ${foe.rating}`);
    previous=foe.rating;
  }
  assert.ok(C.opponent({stage:51,balanceRulesVersion:6}).rating/C.opponent({stage:50,balanceRulesVersion:6}).rating<=1.02);
  for(const stage of [50,100,200,566])for(const scenario of scenarios){
    const run=scenarioRun(scenario,stage),before=JSON.stringify(run);
    assert.deepEqual(C.opponent(run),C.opponent({stage,balanceRulesVersion:6}));
    assert.equal(JSON.stringify(run),before,'opponent lookup must be read only');
  }
});

test('mature and perfect lineups retain useful win rates and boosts improve chances',()=>{
  const {scenarios,scenarioRun,sample}=require('../scripts/audit-endless-winrates.cjs');
  const rate=(id,stage)=>sample(scenarioRun(scenarios.find(s=>s.id===id),stage),400).best.rate;
  const mature=rate('s_mature',50),boosted=rate('s_boosted',50);
  assert.ok(mature>=.30&&mature<=.70,`mature fifty: ${mature}`);
  assert.ok(boosted>=mature+.10,`boosts: ${mature} -> ${boosted}`);
  assert.ok(rate('s_perfect',50)>=.75,'perfect S lineup should feel strong at fifty');
  assert.ok(rate('s_perfect',100)>=.35,'perfect S lineup should remain playable at one hundred');
  const perfectSSR=rate('ssr_perfect',100);
  assert.ok(perfectSSR>=.80,'SSR progression should preserve an enjoyable advantage');
  assert.ok(perfectSSR>=rate('s_mature',100)+.25,'building stronger players must matter');
  assert.ok(rate('ssr_perfect',200)>=.45,'avoid an unreasonable late-game difficulty wall');
});

test('candidate player power and maximum boosts stay finite and late opponents catch extreme training',()=>{
  const A=require('../scripts/audit-endless-balance.cjs');
  for(const route of A.candidates)for(const stage of [50,100,200,500,1000]){
    const run=A.setup(route,'chemistry',stage,1,false);A.wear(run,A.optimizeGear(run));
    const plain=C.fused(run).rating;
    run.boosts=C.BOOSTS.flatMap(b=>Array(C.boostPurchaseLimit(run)).fill(b.id));
    const own=C.fused(run);
    assert.ok(Number.isSafeInteger(own.rating)&&own.rating>0,route.name);
    assert.ok(Object.values(own.dimensions).every(n=>Number.isFinite(n)&&n>0));
    assert.ok(own.rating>=plain&&own.rating/plain<=1.65,'temporary boosts must have bounded power');
    if(stage===1000)assert.ok(own.rating<C.opponent(run).rating,'extreme training must not dominate indefinitely');
  }
});

test('multiple completed conventional routes remain enjoyable at stage fifty',()=>{
  const {scenarios,scenarioRun,sample}=require('../scripts/audit-endless-winrates.cjs');
  const perfect=scenarios.find(s=>s.id==='s_perfect');
  for(let route=0;route<9;route++){
    const result=sample(scenarioRun({...perfect,route},50),400);
    assert.ok(result.best.rate>=.65,`route ${route}: ${result.best.rate}`);
  }
});

test('same-type boost caps apply per battle and survive refreshing and saving',()=>{
  for(const stage of [1,10,11,20,566]){
    const run=C.createRun('outside',709,{},6);run.stage=stage;run.endless=stage>10;run.cash=10000;
    const limit=stage<=10?2:10;
    assert.equal(C.boostPurchaseLimit(run),limit);
    for(let i=0;i<limit;i++){
      C.refreshShop(run,'boost');run.shopOffers.boost=['hot','paint','stopper','rhythm'];
      assert.equal(C.buyBoost(run,'hot'),true);
      assert.equal(C.buyBoost(run,'hot'),false);
    }
    C.refreshShop(run,'boost');run.shopOffers.boost=['hot','paint','stopper','rhythm'];
    const before=structuredClone(run);
    assert.equal(C.buyBoost(run,'hot'),false);assert.deepEqual(run,before);
    assert.equal(C.buyBoost(structuredClone(run),'hot'),false);
    assert.equal(C.buyBoost(run,'paint'),true);
    ['chef_curry','air_jordan','king_lebron','showtime_magic','diesel_shaq','stone_duncan'].forEach((id,i)=>{
      run.slots[C.SLOTS[i].id]=id;run.owned[id]={stars:3,train:0,trainedAt:0};
    });
    const game=C.createGame();game.run=run;C.battle(game,'outside');
    assert.deepEqual(run.boosts,[]);
    run.lastBattle=null;run.ended=false;run.shopOffers.boost=['hot'];run.boostBoughtOffers=[];
    assert.equal(C.buyBoost(run,'hot'),true);
  }
});

test('cloud replay accepts capped legal purchases and rejects an extra purchase',()=>{
  for(const stage of [10,11]){
    const initial=C.createRun('outside',99,{},6);initial.stage=stage;initial.endless=stage>10;initial.cash=10000;
    const run=structuredClone(initial),operations=[];const limit=C.boostPurchaseLimit(run);
    for(let attempts=0;run.boosts.filter(id=>id==='hot').length<limit&&attempts<200;attempts++){
      C.refreshShop(run,'boost');operations.push({action:'refreshShop',args:['boost']});
      if(run.shopOffers.boost.includes('hot')){assert.equal(C.buyBoost(run,'hot'),true);operations.push({action:'buyBoost',args:['hot']});}
    }
    assert.equal(run.boosts.filter(id=>id==='hot').length,limit);
    const game=C.createGame();game.run=structuredClone(run);C.finishRun(game);
    assert.deepEqual(V.replay(initial,operations,'finish').state,game.run);
    const capped=structuredClone(run);capped.shopOffers.boost=['hot'];capped.boostBoughtOffers=[];
    assert.throws(()=>V.replay(capped,[{action:'buyBoost',args:['hot']}],'finish'),error=>error.statusCode===409);
  }
});
