'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {C,loadBrowserCore}=require('../balance/engine.cjs');
const previous=require('../docs/balance/2026-10-12-球员羁绊更新/源码快照/h5/game-core.js');
test('rule13 preserves mainline opponent attributes and every previous rule curve',()=>{
  assert.ok(C.BALANCE_RULES_VERSION>=13);
  for(let stage=1;stage<=1000;stage++)assert.deepEqual(C.opponent({stage,balanceRulesVersion:12}),previous.opponent({stage,balanceRulesVersion:12}));
  for(let stage=1;stage<=10;stage++)assert.deepEqual(C.opponent({stage,balanceRulesVersion:13}),C.opponent({stage,balanceRulesVersion:12}));
  for(const balanceRulesVersion of [1,6,8,9,10,11])for(const stage of [1,10,11,20,50,100,456,1000])assert.deepEqual(C.opponent({stage,balanceRulesVersion}),previous.opponent({stage,balanceRulesVersion}));
});
test('endless relief stays small and strictly increasing with independent version caches',()=>{
  const browser=loadBrowserCore();let last=0;
  for(let stage=1;stage<=1000;stage++){
    const before=C.opponent({stage,balanceRulesVersion:12}),after=C.opponent({stage,balanceRulesVersion:13});
    assert.ok(after.rating>last);last=after.rating;
    if(stage>10){assert.ok(after.rating<before.rating);const scale=.97-.02*Math.min(9,stage-11)/9;assert.ok(Math.abs(after.rating-before.rating*scale)<=(stage===11?3:2))}
    if([1,10,11,20,21,50,100,456,1000].includes(stage))assert.deepEqual(JSON.parse(JSON.stringify(browser.opponent({stage,balanceRulesVersion:13}))),after);
  }
});
test('only the opponent curve changes in mainline replay',()=>{
  const config={policy:'expert',growthLevel:'full',seed:81101,ads:'rewarded-success',rulesVersion:13,maxStage:10,maxMs:60000};
  const {simulate}=require('../balance/runner.cjs');const old=simulate({...config,rulesVersion:12}),fresh=simulate(config);
  assert.notEqual(fresh.outcome.status,'error');assert.equal(old.outcome.highestCleared,fresh.outcome.highestCleared);
  const actions=r=>r.journal.map(({name,args,rngBefore,rngAfter,resources,result})=>({name,args,rngBefore,rngAfter,resources,result}));
  assert.deepEqual(actions(old),actions(fresh));
});
