const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),B=require('../activity/cloudfunctions/activity_api/game/game-core.js');
const unlocked=C.LEGENDARY_PLAYERS.map(star=>star.id);
test('SSR rotation eligibility uses the available pool and paid unlocks, never discovery',()=>{
 const profile=C.createGame().profile;profile.discovered=C.STARS.map(s=>s.id);
 assert.equal(C.availableSSRPlayers(profile).length,8);assert.equal(C.ssrRotationUnlocked(profile),false);
 profile.playerUnlocks=unlocked.slice(0,2);assert.equal(C.availableSSRPlayers(profile).length,10);assert.equal(C.ssrRotationUnlocked(profile),false);
 profile.playerUnlocks.push(unlocked[2]);assert.equal(C.availableSSRPlayers(profile).length,11);assert.equal(C.ssrRotationUnlocked(profile),true);
});
test('rotation is snapshotted into new runs and applies to every SSR draw while old rules remain unchanged',()=>{
 const profile={playerUnlocks:unlocked},pool=C.availableSSRPlayers(profile).map(s=>s.id),selected=pool.slice(0,10),excluded=pool.slice(10);
 const run=C.createRun('reserve_fund',911,{...profile,ssrRotation:selected});
 assert.deepEqual(run.ssrRotation,selected);assert.deepEqual(B.createRun('reserve_fund',911,{...profile,ssrRotation:selected}),run);
 for(const id of excluded)assert.equal(C.playerAvailable(run,id),false);
 assert.equal(C.playerAvailable(run,'jordan'),true);
 for(let i=0;i<100;i++){run.offer=[];run.noSSRDraws=99;C.makeOffer(run);assert.ok(run.offer.some(id=>C.BY_ID[id].tier==='SSR'));assert.ok(run.offer.every(id=>C.BY_ID[id].tier!=='SSR'||selected.includes(id)))}
 selected.pop();assert.equal(run.ssrRotation.length,10);
 for(const version of [12,18,19]){const old=C.createRun('reserve_fund',911,{...profile,ssrRotation:pool.slice(0,10)},version);assert.equal(old.ssrRotation,undefined);for(const id of excluded)assert.equal(C.playerAvailable(old,id),true)}
});
test('invalid local selections fall back to all unlocked SSRs without unlocking unavailable cards',()=>{
 const profile={playerUnlocks:unlocked.slice(0,3)},all=C.availableSSRPlayers(profile).map(s=>s.id);
 for(const selection of [null,[],all.slice(0,9),['invalid',...all.slice(0,9)]])assert.deepEqual(C.normalizeSSRRotation(profile,selection),all);
 const selected=[...all.slice(0,10),all[0],'invalid',unlocked[9]];assert.deepEqual(C.normalizeSSRRotation(profile,selected),all.slice(0,10));
 const run=C.createRun('reserve_fund',911,{...profile,ssrRotation:selected});assert.equal(C.playerAvailable(run,unlocked[9]),false);
});
test('ten, hundred and rewarded recruitment all respect rotation and match authoritative replay',()=>{
 const V=require('../activity/cloudfunctions/activity_api/verified-game.js'),progress={playerUnlocks:unlocked},selected=C.availableSSRPlayers(progress).slice(0,10).map(s=>s.id);
 for(const size of [10,100]){const run=C.createRun('reserve_fund',911,{...progress,ssrRotation:selected});run.offer=[];run.noSSRDraws=99;const offer=C.makeTenOffer(run,size);assert.equal(offer.length,size);assert.ok(offer.some(id=>C.BY_ID[id].tier==='SSR'));assert.ok(offer.every(id=>C.BY_ID[id].tier!=='SSR'||selected.includes(id)))}
 const run=C.createRun('reserve_fund',911,{...progress,ssrRotation:selected});run.offer=[];run.noSSRDraws=99;const before=structuredClone(run);C.grantRewardedSOffer(run);assert.ok(run.offer.some(id=>C.BY_ID[id].tier==='SSR'));assert.ok(run.offer.every(id=>C.BY_ID[id].tier!=='SSR'||selected.includes(id)));
 const finished=C.createGame();finished.run=structuredClone(run);C.finishRun(finished);assert.deepEqual(V.replay(before,[{action:'grantRewardedSOffer',args:[]}],'finish').state,finished.run);
});
