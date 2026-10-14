const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),B=require('../activity/cloudfunctions/activity_api/game/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
const snapshot=require('../docs/无尽关卡OVR曲线-2026-10-14.json');
test('implemented step curve matches all 990 approved points and preserves every anchor and earlier opponent',()=>{
 for(const r of snapshot.rows){assert.equal(C.opponent({stage:r.stage,balanceRulesVersion:22}).rating,r.candidateOVR,'stage '+r.stage);assert.equal(C.opponent({stage:r.stage,balanceRulesVersion:21}).rating,r.ovr);assert.equal(B.opponent({stage:r.stage,balanceRulesVersion:22}).rating,r.candidateOVR);if(r.stage%10===0&&r.stage>=50)assert.deepEqual(C.opponent({stage:r.stage,balanceRulesVersion:22}),C.opponent({stage:r.stage,balanceRulesVersion:21}));}
 for(let stage=1;stage<50;stage++)assert.deepEqual(C.opponent({stage,balanceRulesVersion:22}),C.opponent({stage,balanceRulesVersion:21}));
 assert.equal(C.opponent({stage:59,balanceRulesVersion:22}).rating,414);assert.equal(C.opponent({stage:60,balanceRulesVersion:22}).rating,522);
 for(let stage=1001;stage<=1020;stage++)assert.ok(C.opponent({stage,balanceRulesVersion:22}).rating>C.opponent({stage:stage-1,balanceRulesVersion:22}).rating);
});
function pityFixture(version){const r=C.createRun('steady_interest',20,{benchSeat:5},version);r.stage=21;r.endless=true;r.recruitGroups=10;r.slots=Object.fromEntries(C.SLOTS.map((s,i)=>[s.id,['curry','jordan','lebron','magic','shaq','duncan'][i]]));r.owned={};for(const id of Object.values(r.slots))r.owned[id]={stars:1,train:0,trainedAt:0};for(const s of C.STARS.filter(s=>s.tier==='SSR'&&C.playerAvailable(r,s.id)))r.owned[s.id]={stars:10,train:0,trainedAt:0};delete r.owned.king_lebron;r.bench=Object.keys(r.owned).filter(id=>!Object.values(r.slots).includes(id));r.offer=[];r.noSSRDraws=99;return r;}
test('reproduced normal-identity conflict retains old replay but new guarantee replaces that normal card',()=>{
 const old=pityFixture(21);C.makeOffer(old);assert.ok(old.offer.includes('lebron'));assert.ok(!old.offer.some(id=>C.BY_ID[id].tier==='SSR'));assert.equal(old.noSSRDraws,100);
 const r=pityFixture(22),initial=structuredClone(r);assert.equal(C.recruitableSSRPlayers(r).length,1);C.makeOffer(r);assert.ok(r.offer.includes('king_lebron'));assert.equal(r.noSSRDraws,0);assert.equal(new Set(r.offer.map(C.identityOf)).size,r.offer.length);
 const g=C.createGame();g.run=r;C.finishRun(g);assert.deepEqual(V.replay(initial,[{action:'makeOffer',args:[]}],'finish').state,r);
});
test('empty SSR pool preserves pity without claiming an eligible card and becomes available after sale',()=>{
 const r=pityFixture(22);r.owned.king_lebron={stars:10,train:0,trainedAt:0};r.bench.push('king_lebron');assert.equal(C.recruitableSSRPlayers(r).length,0);C.makeOffer(r);assert.equal(r.noSSRDraws,100);assert.ok(!r.offer.some(id=>C.BY_ID[id].tier==='SSR'));
 r.offer=[];C.sellBench(r,r.bench.indexOf('king_lebron'));assert.equal(C.recruitableSSRPlayers(r).length,1);C.makeOffer(r);assert.ok(r.offer.includes('king_lebron'));assert.equal(r.noSSRDraws,0);
});
test('new legendary unlock joins a manual rotation and new runs, without changing an existing run',()=>{
 const p=C.createGame().profile;p.playerUnlocks=C.LEGENDARY_PLAYERS.slice(0,3).map(s=>s.id);p.legend=400;p.ssrRotation=C.availableSSRPlayers(p).slice(0,10).map(s=>s.id);
 const run=C.createRun('steady_interest',22,{...p,ssrRotation:p.ssrRotation},22),before=structuredClone(run),prior=[...p.ssrRotation];const star=C.unlockLegendaryPlayer(p,()=>0);
 assert.ok(star);assert.equal(p.legend,0);assert.ok(p.ssrRotation.includes(star.id));assert.ok(prior.every(id=>p.ssrRotation.includes(id)));assert.deepEqual(run,before);
 const next=C.createRun('steady_interest',22,{...p,ssrRotation:p.ssrRotation},22);assert.ok(C.playerAvailable(next,star.id));assert.deepEqual(B.createRun('steady_interest',22,{...p,ssrRotation:p.ssrRotation},22),next);
});
test('ordinary, ten, hundred and advertised SSR draws respect the configured new-run rotation',()=>{
 const progress={playerUnlocks:C.LEGENDARY_PLAYERS.map(x=>x.id)},pool=C.availableSSRPlayers(progress).slice(0,10).map(x=>x.id);progress.ssrRotation=pool;
 for(const action of ['makeOffer','makeTenOffer','hundred','grantRewardedSOffer']){const r=C.createRun('steady_interest',20,progress,22);r.stage=21;r.recruitGroups=10;r.offer=[];r.noSSRDraws=99;if(action==='hundred')C.makeTenOffer(r,100);else C[action](r);assert.ok(r.offer.some(id=>C.BY_ID[id].tier==='SSR'));assert.ok(r.offer.every(id=>C.BY_ID[id].tier!=='SSR'||pool.includes(id)));}
});
test('new stepped-stage battle replays and snapshots retain identical RNG, rewards and state',()=>{
 for(const stage of [49,50,51,59,60,69,70,999,1000]){const r=pityFixture(22);r.stage=stage;r.noSSRDraws=0;const g=C.createGame();g.run=r;const initial=structuredClone(r),report=C.battle(g,'outside'),replay=V.replay(initial,[],'battle','outside');assert.deepEqual(report,replay.report);assert.deepEqual(r,replay.state);}
});
