const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js');
function lineup(progress={},version=17){
 const run=C.createRun('steady_interest',789,progress,version);
 C.SLOTS.forEach((slot,index)=>{const id=C.STARS.filter(p=>p.tier==='C')[index].id;run.slots[slot.id]=id;run.owned[id]={stars:1,train:0,trainedAt:0}});return run;
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('all eleven tracks purchase five independent levels with total cost 224000',()=>{
 const p=C.createGame().profile;p.legend=300000;
 for(const item of C.TRAINING_BASE_UPGRADES){for(let i=0;i<5;i++)assert.equal(C.buyTrainingBaseUpgrade(p,item.id),true);const before=JSON.stringify(p);assert.equal(C.buyTrainingBaseUpgrade(p,item.id),false);assert.equal(JSON.stringify(p),before)}
 assert.equal(p.legend,76000);assert.equal(C.buyTrainingBaseUpgrade({legend:599},'slot_three'),false);assert.equal(C.buyTrainingBaseUpgrade(p,'invalid'),false);
});
test('slot training increases only the selected slot score, by exactly ten percent',()=>{
 const before=C.fused(lineup()),after=C.fused(lineup({trainingBase:{slots:{three:5}}}));
 for(const slot of C.SLOTS)close(after.slotScores[slot.id],before.slotScores[slot.id]*(slot.id==='three'?1.10:1));
});
test('dimension training multiplies only the selected final dimension',()=>{
 const before=C.fused(lineup()),after=C.fused(lineup({trainingBase:{dimensions:{rimStop:5}}}));
 for(const key of Object.keys(C.COMBAT_LABELS))close(after.dimensions[key],before.dimensions[key]*(key==='rimStop'?1.10:1));
});
test('fully trained slots and dimensions compose to twenty-one percent',()=>{
 const training=C.normalizeTrainingBase();for(const group of Object.values(training))for(const key of Object.keys(group))group[key]=5;
 const before=C.fused(lineup()),after=C.fused(lineup({trainingBase:training}));
 for(const key of Object.keys(C.COMBAT_LABELS))close(after.dimensions[key],before.dimensions[key]*1.21);
});
test('old rules ignore training, new runs freeze levels independently of profile',()=>{
 const training={slots:{three:5},dimensions:{rimStop:5}};
 for(const version of [6,10,11,12,16])assert.deepEqual(C.fused(lineup({trainingBase:training},version)),C.fused(lineup({},version)));
 const run=lineup({trainingBase:training});training.slots.three=0;assert.equal(run.trainingBase.slots.three,5);
 const p=C.createGame().profile;p.legend=10000;C.buyTrainingBaseUpgrade(p,'slot_three');assert.equal(run.trainingBase.slots.three,5);
});
test('restore normalization rejects invalid values and clamps levels',()=>{
 const normalized=C.normalizeTrainingBase({slots:{three:Infinity,mid:7,inside:2.9,def:'5'},dimensions:{rimStop:-2,unknown:5}});
 assert.deepEqual(normalized.slots,{three:0,mid:5,drive:0,inside:2,def:0,handle:0});assert.equal(normalized.dimensions.rimStop,0);assert.ok(!Object.hasOwn(normalized.dimensions,'unknown'));
});
