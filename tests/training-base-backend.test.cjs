const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),B=require('../activity/cloudfunctions/activity_api/game/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
test('training costs use exact level prices and validate the complete purchase history',()=>{
 const training=C.normalizeTrainingBase();
 for(const group of Object.values(training))for(const key of Object.keys(group))group[key]=5;
 assert.equal(V.progressCost({trainingBase:training}),224000);assert.equal(V.reconcileProgress({}, {trainingBase:training},224000),224000);
 assert.throws(()=>V.reconcileProgress({}, {trainingBase:training},223999),/传奇点/);
 assert.equal(V.progressCost({trainingBase:{slots:{three:1},dimensions:{rimStop:2}}}),4200);
 for(const trainingBase of [null,[],5,{unknown:1},{slots:[]},{slots:null},{slots:{three:1.5}},{slots:{three:6}},{slots:{three:-1}},{slots:{three:'1'}},{slots:{unknown:1}},{dimensions:{shooting:Infinity}}])assert.throws(()=>V.progressCost({trainingBase}));
});
test('old clients preserve training records without gaining old-rule combat bonuses',()=>{
 const previous={trainingBase:{slots:{three:2},dimensions:{rimStop:1}},playerUnlocks:[C.LEGENDARY_PLAYERS[0].id]};
 const compatible=V.compatibleProgress(previous,{});assert.equal(V.reconcileProgress(previous,{},4000),3400);assert.equal(compatible.trainingBase.slots.three,2);assert.deepEqual(compatible.playerUnlocks,previous.playerUnlocks);
 compatible.trainingBase.slots.three=0;assert.equal(previous.trainingBase.slots.three,2);
 assert.throws(()=>V.reconcileProgress(previous,{trainingBase:{}},4000),/云端记录不一致/);
 for(let version=1;version<=16;version++){const a=B.createRun('steady_interest',81101,previous,version),b=B.createRun('steady_interest',81101,{},version);assert.equal(a.trainingBase,undefined);assert.deepEqual(B.fused(a),B.fused(b))}
});
test('frontend and backend replay full training with identical rule17 combat and settlement',()=>{
 const training=C.normalizeTrainingBase();for(const group of Object.values(training))for(const key of Object.keys(group))group[key]=5;
 const progress={trainingBase:training},initial=B.createRun('reserve_fund',911,progress,17),game=C.createGame();game.run=C.createRun('reserve_fund',911,progress,17);assert.deepEqual(game.run,initial);
 const operations=[];for(let i=0;i<6;i++){const id=game.run.offer[0];operations.push({action:'recruit',args:[id]});C.recruit(game.run,id);if(i<5){operations.push({action:'makeOffer',args:[]});C.makeOffer(game.run)}}
 const report=C.battle(game,'outside'),verified=V.replay(initial,operations,'battle','outside');assert.deepEqual(verified.report,report);assert.deepEqual(verified.state,game.run);
 C.finishRun(game);assert.deepEqual(V.replay(verified.state,[],'finish').state,game.run);
 assert.equal(initial.trainingBase.slots.three,5);assert.equal(initial.trainingBase.dimensions.rimStop,5);
});
