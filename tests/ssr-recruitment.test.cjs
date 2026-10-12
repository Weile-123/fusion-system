const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),path=require('node:path');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
const hasSSR=ids=>ids.some(id=>C.BY_ID[id].tier==='SSR');
test('rule15 has 3 or 4 percent from stage21 and preserves earlier probabilities',()=>{
 for(const talent of ['steady_interest','scouting_network'])for(const scouting of [0,5]){
  const old=C.createRun(talent,11,{scouting},14),r=C.createRun(talent,11,{scouting},15);
  for(const stage of [1,10,11,20]){old.stage=r.stage=stage;assert.deepEqual(C.tierOdds(r),C.tierOdds(old));}
  for(const stage of [21,22,456,10000]){r.stage=stage;old.stage=stage;assert.equal(C.tierOdds(r).SSR,talent==='scouting_network'?4:3);assert.ok(C.tierOdds(old).SSR<=2);}
 }
});
test('ordinary offer counts once, opening counts once, repeated display does not count',()=>{
 const r=C.createRun('steady_interest',1);assert.equal(r.recruitDraws,1);
 C.makeOffer(r);assert.equal(r.recruitDraws,1);
 r.offer=[];C.makeOffer(r);assert.equal(r.recruitDraws,2);
});
test('100th ordinary draw guarantees available SSR; a natural SSR resets the counter',()=>{
 const r=C.createRun('steady_interest',31);r.offer=[];r.noSSRDraws=99;
 C.makeOffer(r);assert.ok(hasSSR(r.offer));assert.equal(r.noSSRDraws,0);
 for(let i=0;i<600;i++){r.offer=[];const before=r.noSSRDraws;C.makeOffer(r);assert.equal(r.noSSRDraws,hasSSR(r.offer)?0:Math.min(100,before+1));assert.ok(r.noSSRDraws<100);}
});
test('ten draws count ten and retain the SSR at a pity boundary, including the last card',()=>{
 for(const misses of [90,95,99])for(let seed=1;seed<=40;seed++){
  const r=C.createRun('steady_interest',seed);r.noSSRDraws=misses;const draws=r.recruitDraws;
  C.makeTenOffer(r);assert.equal(r.recruitDraws,draws+10);assert.equal(r.offer.length,10);assert.ok(hasSSR(r.offer));assert.ok(r.noSSRDraws<10);
 }
 const r=C.createRun('steady_interest',7);r.forceRareRecruit=true;const before=r.recruitDraws;C.makeTenOffer(r);assert.equal(r.recruitDraws,before+10);
});
test('S ad, unaffordable purchase and reading probabilities do not consume SSR draws',()=>{
 const r=C.createRun('steady_interest',51,{},15),before=[r.recruitDraws,r.noSSRDraws];
 r.cash=0;assert.equal(C.buyRecruitPack(r),false);C.recruitProbabilitySummary(r);C.grantRewardedSOffer(r);
 assert.deepEqual([r.recruitDraws,r.noSSRDraws],before);
});

test('rule16 S ad counts once and cannot count again after repeat grant',()=>{
 const r=C.createRun('steady_interest',51);r.noSSRDraws=30;const before=r.recruitDraws;
 assert.ok(C.grantRewardedSOffer(r));assert.equal(r.recruitDraws,before+1);assert.equal(r.noSSRDraws,31);assert.ok(r.offer.every(id=>C.BY_ID[id].tier==='S'));
 const snapshot=JSON.stringify(r);assert.equal(C.grantRewardedSOffer(r),false);assert.equal(JSON.stringify(r),snapshot);
});
test('rule16 S ad at draw100 grants SSR, resets pity and has no duplicate identities',()=>{
 for(let seed=1;seed<=40;seed++){
  const r=C.createRun('steady_interest',seed);r.noSSRDraws=99;const before=r.recruitDraws;
  assert.ok(C.grantRewardedSOffer(r));assert.equal(r.recruitDraws,before+1);assert.equal(r.noSSRDraws,0);assert.equal(r.offer.filter(id=>C.BY_ID[id].tier==='SSR').length,1);
  assert.equal(new Set(r.offer.map(C.identityOf)).size,4);assert.equal(r.offerOdds.ssrGroup,100);
 }
});
test('ineligible S ad does not count and server replays ad guarantee identically',()=>{
 const blocked=C.createRun('steady_interest',1);blocked.pending='curry';const before=JSON.stringify(blocked);assert.equal(C.grantRewardedSOffer(blocked),false);assert.equal(JSON.stringify(blocked),before);
 const game=C.createGame();game.run=C.createRun('steady_interest',73);game.run.noSSRDraws=99;
 const initial=JSON.parse(JSON.stringify(game.run));C.grantRewardedSOffer(game.run);C.finishRun(game);
 assert.deepEqual(V.replay(initial,[{action:'grantRewardedSOffer',args:[]}],'finish').state,game.run);
});
test('empty eligible SSR pool preserves overdue guarantee until a card becomes eligible',()=>{
 const r=C.createRun('steady_interest',71);r.stage=21;r.endless=true;
 for(const s of C.STARS.filter(s=>s.tier==='SSR'&&C.playerAvailable(r,s.id)))r.owned[s.id]={stars:10,train:0};
 r.offer=[];r.noSSRDraws=99;C.makeOffer(r);assert.equal(r.noSSRDraws,100);assert.ok(!hasSSR(r.offer));
 delete r.owned.king_lebron;r.offer=[];C.makeOffer(r);assert.ok(hasSSR(r.offer));assert.equal(r.noSSRDraws,0);
});
test('frontend and authoritative replay agree on ten draw pity and settlement',()=>{
 const game=C.createGame();game.run=C.createRun('steady_interest',101);game.run.cash=1000;game.run.noSSRDraws=95;
 const initial=JSON.parse(JSON.stringify(game.run));assert.equal(C.buyRecruitPack(game.run,10),true);
 const selection=Array(10).fill(true);C.confirmRecruitBatch(game.run,selection);
 // Overflow must be resolved before settlement/replay.
 const ops=[{action:'buyRecruitPack',args:[10]},{action:'confirmRecruitBatch',args:[selection]}];
 while(game.run.pending){C.resolvePending(game.run,'sell');ops.push({action:'resolvePending',args:['sell']});}
 C.finishRun(game);const actual=V.replay(initial,ops,'finish');assert.deepEqual(actual.state,game.run);assert.equal(actual.state.recruitDraws,initial.recruitDraws+10);
});
