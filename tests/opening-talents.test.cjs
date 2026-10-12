const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../h5/game-core.js'),V=require('../balance/replay-verifier.cjs');
test('rule 9 keeps prior opponent curves intact and applies a smooth bounded increase with independent caches',()=>{
 const old=require('./helpers/load-frozen-core.cjs')(require('node:path').resolve(__dirname,'../docs/balance/2026-10-11-词条天赋更新/源码快照/h5'));
 let previous=0;
 for(let stage=1;stage<=1000;stage++){
  const current=C.opponent({stage,balanceRulesVersion:9});
  for(const version of [5,6,7,8])assert.deepEqual(C.opponent({stage,balanceRulesVersion:version}),old.opponent({stage,balanceRulesVersion:version}));
  const baseline=C.opponent({stage,balanceRulesVersion:8});
  assert.equal(current.id,baseline.id);assert.equal(current.strategy,baseline.strategy);assert.equal(current.stars,baseline.stars);
  assert.ok(current.rating>previous);assert.ok(current.rating>=baseline.rating*1.02&&current.rating<=baseline.rating*1.13);previous=current.rating;
 }
 const a=C.createRun('captain',81101,{},8),b=C.createRun('captain',81101,{},9);b.balanceRulesVersion=8;assert.deepEqual(b,a);
});
test('rule 8 opening values change while rule 7 retains its previous talent effects',()=>{
 assert.equal(C.BALANCE_RULES_VERSION, 16);assert.equal(C.createRun('reserve_fund',911).cash,27);assert.equal(C.createRun('reserve_fund',911,{},7).cash,20);
 assert.equal(C.openingEffect(C.createRun('scouting_network',911)).paidRecruitDelta,1);assert.equal(C.openingEffect(C.createRun('scouting_network',911,{},7)).paidRecruitDelta,2);
 assert.equal(C.createRun('star_workshop',911).benchLimit,4);assert.equal(C.createRun('star_workshop',911,{},7).benchLimit,5);
 assert.equal(C.talentForRun(C.createRun('win_bonus',911,{},7)).name,'赢球奖金');assert.equal(C.talentForRun(C.createRun('win_bonus',911)).name,'巨星传承');
});
test('off-court help requires ten distinct discovered events together with endless level 13',()=>{
 const p=C.createGame().profile,t=C.TALENTS.find(t=>t.id==='streak_bonus');p.bestEndless=13;p.wins=40;
 assert.equal(C.talentUnlocked(t,p),false);p.discoveredEvents=C.EVENTS.slice(0,9).map(e=>e.id);assert.equal(C.talentUnlocked(t,p),false);
 p.discoveredEvents.push(p.discoveredEvents[0],'invalid-event');assert.equal(C.talentUnlocked(t,p),false);
 p.discoveredEvents.push(C.EVENTS[9].id);p.wins=0;assert.equal(C.talentUnlocked(t,p),true);
 p.bestEndless=12;assert.equal(C.talentUnlocked(t,p),false);
 assert.deepEqual(C.talentForRun(C.createRun('streak_bonus',911,{},7)).unlock,{bestEndless:13,wins:40});
});
test('giant-star inheritance requires both career thresholds and grants a locked, unique third skill only once',()=>{
 const p=C.createGame().profile,t=C.TALENTS.find(t=>t.id==='win_bonus');assert.equal(C.availableTalents(p).length,12);p.wins=15;assert.equal(C.talentUnlocked(t,p),false);p.discovered=C.STARS.slice(0,20).map(s=>s.id);assert.equal(C.talentUnlocked(t,p),true);
 const initial=C.createRun('win_bonus',911),r=structuredClone(initial),id=r.offer[0],ops=[];
 function recruit(){r.offer=[id];r.free=1;assert.ok(C.recruit(r,id).ok)}recruit();recruit();recruit();assert.equal(r.owned[id].stars,3);assert.equal(r.roleSkillMap[id].length,3);assert.equal(new Set(r.roleSkillMap[id]).size,3);assert.equal(C.SKILL_BY_ID[r.roleSkillMap[id][2]].star,5);assert.equal(r.bonusSkillSlots[id],3);
 const before=JSON.stringify(r);assert.equal(C.refreshRandomSkill(r,id,3),false);assert.equal(C.enterSkillAdPick(r,id,3),false);assert.equal(JSON.stringify(r),before);
 r.endless=true;r.stage=11;r.owned[id].stars=C.starLimit(r,id)-1;recruit();assert.equal(r.roleSkillMap[id].length,3);
 const restored=structuredClone(r);C.restoreRandomSkills(restored,r);assert.deepEqual(restored.roleSkillMap,r.roleSkillMap);assert.deepEqual(restored.bonusSkillSlots,r.bonusSkillSlots);
});
test('full-star bonus acquisition is reproduced by the authoritative operation replay',()=>{
 const initial=C.createRun('win_bonus',911),id=initial.offer[0];initial.owned[id]={stars:2,train:0,trainedAt:0};initial.slots[C.SLOTS[0].id]=id;initial.roleSkillMap[id]=[initial.draftSkillPreview[id]];delete initial.draftSkillPreview[id];const r=structuredClone(initial),ops=[];
 for(let i=0;i<6;i++){const chosen=i===0?id:r.offer.find(id=>!r.owned[id]);assert.ok(C.recruit(r,chosen).ok);ops.push({action:'recruit',args:[chosen]});if(i<5){C.makeOffer(r);ops.push({action:'makeOffer',args:[]})}}
 assert.equal(r.roleSkillMap[id].length,3);const g=C.createGame();g.run=r;const report=C.battle(g,'outside');assert.ok(report);const result=V.replay(initial,ops,'battle','outside');assert.deepEqual(result.state,r);assert.deepEqual(result.report,report);
});
test('manager cashback requires the full purchase budget and cannot be collected twice',()=>{
 const r=C.createRun('front_office',911),item=C.GEAR.find(g=>!g.legendary&&!g.unlockable&&g.slot!=='球衣'&&!g.minStage),price=C.gearPrice(r,item);r.shopOffers.gear=[item.id];r.cash=price-1;assert.equal(C.buyGear(r,item.id),false);r.cash=price;assert.equal(C.buyGear(r,item.id),true);assert.equal(r.cash,Math.floor(price*.1));const cash=r.cash;assert.equal(C.buyGear(r,item.id),false);assert.equal(r.cash,cash);
 const old=C.createRun('front_office',911,{},7);assert.equal(C.gearPrice(old,item),Math.max(1,item.price-2));assert.equal(price,item.price);
});
test('training uses 1.5 growth points and rounds a 1.5 cost multiplier up; old talent keeps its sale bonus',()=>{
 const r=C.createRun('development',911),base=C.createRun('win_bonus',911),id='curry',own={stars:1,train:1};r.owned[id]={...own,trainedAt:0};base.owned[id]={...own,trainedAt:0};assert.equal(C.trainingCost(r,id),Math.ceil(C.trainingCost(base,id)*1.5));assert.equal(C.openingEffect(r).trainingGrowthDelta,.015);assert.equal(C.saleValue(id,2,r),C.saleValue(id,2,base));assert.ok(C.saleValue(id,2,C.createRun('development',911,{},7))>C.saleValue(id,2,r));
});
test('long-term contract combines the edited economy with mapped rim protection and finishing penalty',()=>{
 const e=C.openingEffect(C.createRun('steady_interest',911));assert.equal(e.stageCash,3);assert.equal(e.interestCap,2);assert.deepEqual(e.dimensions,{rimStop:30,finishing:-5});
});
test('deep bench scales activated bond rewards and leaves trigger intervals intact',()=>{
 const r=C.createRun('deep_bench',911);for(const id of ['lebron','wade','bosh'])r.owned[id]={stars:1,train:0};
 for(const b of C.activeSynergies(r)){const original=C.SYNERGIES.find(s=>s.id===b.id);for(const [key,value]of Object.entries(original.effect||{})){if(key==='dimensions')for(const [dim,n]of Object.entries(value))assert.equal(b.effect.dimensions[dim],n*1.3);else assert.equal(b.effect[key],key==='healEveryWins'?value:Math.floor(value*1.3))}}
 assert.ok(C.activeSynergies(r).length);assert.equal(C.benchExpansionLimit(r),10);assert.equal(C.benchExpansionLimit(C.createRun('deep_bench',911,{},7)),13);
});
test('off-court help guarantees event success, scales permanent rewards, and restores 100 percent chance',()=>{
 const g=C.createGame(),r=g.run=C.createRun('streak_bonus',911),event=C.EVENT_BY_ID.T01;
 ['curry','lebron','magic','shaq','jordan','bird'].forEach((id,i)=>{r.owned[id]={stars:1,train:0};r.slots[C.SLOTS[i].id]=id});r.lastBattle={won:true,eventSnapshot:C.eventBattleSnapshot(r)};
 r.randomEvent={id:event.id,choice:'next',stage:1,ability:0,difficulty:100,successRate:.35,snapshot:r.lastBattle.eventSnapshot,result:null};r.rng=4294967295;
 assert.match(C.eventChoices(r,r.randomEvent).success,/4.5～7.5%/);const before=r.eventState.bonuses.shooting||0,result=C.resolveRandomEvent(g,event.id,'main');assert.equal(result.success,true);assert.ok([4.5,6,7.5].includes(result.bonus));assert.equal(r.eventState.bonuses.shooting,before+result.bonus);
 const copy=structuredClone(r);C.restoreEventState(copy,r);assert.equal(copy.randomEvent.successRate,1);assert.equal(C.openingEffect(r).battleCash,-2);assert.equal(C.openingEffect(r).lossCash,-2);
});
test('captain can recover after ten lifetime grants but still observes the current morale ceiling',()=>{
 const g=C.createGame(),r=g.run=C.createRun('captain',911);
 ['chef_curry','air_jordan','king_lebron','showtime_magic','diesel_shaq','reaper_durant'].forEach((id,i)=>{r.owned[id]={stars:1,train:0};r.slots[C.SLOTS[i].id]=id});
 Object.assign(r,{wins:21,talentWinHealGranted:10,morale:12});assert.equal(C.battle(g,'outside').won,true);assert.equal(r.morale,13);assert.equal(r.talentWinHealGranted,11);
});
test('all 20 edited document entries match the implemented talent names and display effects',()=>{
 const text=fs.readFileSync('docs/玩法/开局天赋.md','utf8');for(const t of C.TALENTS){const i=text.indexOf('编号：`'+t.id+'`'),end=text.indexOf('\n### ',i);assert.ok(i>=0,t.id);const block=text.slice(i,end<0?undefined:end);for(const [label,value]of [['名称',t.name],['加成',t.gain],['代价',t.cost]])assert.ok(block.includes('| '+label+' | '+value+' |'),t.id+' '+label)}
});
