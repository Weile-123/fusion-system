const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
function panel(seed=911){const g=C.createGame(),r=g.run=C.createRun('steady_interest',seed);for(const [i,id]of ['curry','lebron','magic','shaq','jordan','bird'].entries()){r.owned[id]={stars:1,train:0,trainedAt:0};r.slots[C.SLOTS[i].id]=id;r.roleSkillMap[id]=['sk_cmd_1'];}return g;}
function skill(r,id,...skills){r.roleSkillMap[id]=skills;}
test('112 unique basketball skills match every documented name, star and description',()=>{
  const text=fs.readFileSync('docs/玩法/完整词条库.md','utf8');assert.equal(C.RANDOM_SKILLS.length,112);assert.equal(new Set(C.RANDOM_SKILLS.map(s=>s.name)).size,112);
  const rows=[...text.matchAll(/^\| (sk_\w+) \| ([^|]+) \| ([^|]+) \|$/gm)];assert.equal(rows.length,112);
  for(const [_,id,name,description]of rows){assert.equal(C.SKILL_BY_ID[id].name,name);assert.equal(C.SKILL_BY_ID[id].description,description);}
  assert.deepEqual([1,2,3,4,5].map(n=>C.RANDOM_SKILLS.filter(s=>s.star===n).length),[11,18,27,31,25]);
});

test('champion dividend is four stars in rule 9 and preserves historical five-star pools and saves',()=>{
  assert.equal(C.SKILL_BY_ID.sk_win_5.star,4);assert.equal(C.SKILL_BY_ID.sk_win_5.effects.winCash,3);
  for(const version of [7,8,9]){
    const r=panel().run;r.balanceRulesVersion=version;r.roleSkillMap.curry=['sk_cmd_1'];
    assert.equal(C.randomSkillsForRun(r).filter(s=>s.star===5).some(s=>s.id==='sk_win_5'),version<9);
    assert.equal(C.enterSkillAdPick(r,'curry',1),true);assert.equal(C.confirmSkillAdPick(r,'sk_win_5'),version<9);
    if(version>=9)C.cancelSkillAdPick(r);
    r.roleSkillMap.curry=['sk_win_5'];const copy=structuredClone(r);C.restoreRandomSkills(copy,r);
    assert.equal(C.getRoleSkills(copy,'curry')[0].skill.star,version<9?5:4);assert.equal(copy.roleSkillMap.curry[0],'sk_win_5');
  }
});
test('every random skill produces finite battle values and identical cloud battle and final settlement',()=>{
  for(const entry of C.RANDOM_SKILLS)for(const strategy of Object.keys(C.STRATEGIES))for(const seed of [911,81200]){
    const game=panel(seed),run=game.run;run.roleSkillMap={};skill(run,'curry',entry.id);
    const initial=structuredClone(run),rating=C.fused(run,strategy,C.opponent(run).strategy).rating;
    assert.ok(Number.isFinite(rating)&&rating>0,entry.id);
    const report=C.battle(game,strategy),cloud=V.replay(initial,[],'battle',strategy);
    assert.ok(report,entry.id);assert.ok(Number.isFinite(report.rating)&&Number.isFinite(report.reward),entry.id);
    assert.deepEqual(cloud.state,run,entry.id);assert.deepEqual(cloud.report,report,entry.id);
    const settled=V.replay(run,[],'finish');C.finishRun(game);assert.deepEqual(settled.state,run,entry.id);
  }
});
test('offer previews lock per character and tiers are approximately 20 percent each across seeds',()=>{
  const counts=[0,0,0,0,0];for(let seed=1;seed<=2000;seed++){const r=C.createRun('steady_interest',seed);for(const id of r.offer)counts[C.getRoleSkills(r,id)[0].skill.star-1]++;const prior=JSON.stringify(r.draftSkillPreview),rng=r.rng;C.makeOffer(r);assert.equal(r.rng,rng);assert.equal(JSON.stringify(r.draftSkillPreview),prior);}
  assert.ok(counts.every(n=>n>1350&&n<1850),counts.join(','));
});
test('acquisition consumes previews; same player keeps first skill on duplicate, sale and reacquisition',()=>{
  const r=C.createRun('steady_interest',914),id=r.offer[0],first=r.draftSkillPreview[id];assert.ok(C.recruit(r,id).ok);assert.equal(r.roleSkillMap[id][0],first);assert.equal(r.draftSkillPreview[id],undefined);
  r.offer=[id];r.free=1;C.recruit(r,id);assert.equal(r.roleSkillMap[id].length,1);
  r.offer=[id];r.free=1;C.recruit(r,id);assert.equal(r.roleSkillMap[id].length,2);assert.ok(C.SKILL_BY_ID[r.roleSkillMap[id][1]].star>=3);assert.notEqual(...r.roleSkillMap[id]);
  const old=[...r.roleSkillMap[id]];const slot=Object.keys(r.slots).find(k=>r.slots[k]===id);r.slots[slot]=null;delete r.owned[id];r.offer=[id];r.free=1;C.recruit(r,id);assert.deepEqual(r.roleSkillMap[id],old);
});
test('legacy runs do not draw or activate random skills and preserve their deterministic RNG',()=>{
  for(const version of [1,2,3,4,5,6]){const r=C.createRun('steady_interest',911,{},version);assert.equal(r.roleSkillMap,undefined);assert.deepEqual(C.getRoleSkills(r,r.offer[0]),[]);assert.equal(C.refreshRandomSkill(r,r.offer[0],1),false);}
  const legacy=C.createRun('steady_interest',911,{},6),server=require('../activity/cloudfunctions/activity_api/game/game-core.js').createRun('steady_interest',911,{},6);assert.deepEqual(legacy,server);
});
test('only full fusion panel activates skills; bench skills and preview skills cannot affect OVR',()=>{
  const r=panel().run;r.bench=['kobe'];r.owned.kobe={stars:1,train:0};const base=C.fused(r);skill(r,'kobe','sk_all_5');assert.equal(C.fused(r).rating,base.rating);
  r.roleSkillMap.curry=['sk_all_5'];assert.ok(C.fused(r).rating>base.rating);r.slots.three=null;assert.equal(C.activeRandomSkills(r).length,0);
});
test('numeric skill bonuses aggregate before the existing soft cap; tactical penalty and counter use actual matchup',()=>{
  const r=panel().run;for(const id of Object.values(r.slots))skill(r,id,'sk_cmd_5');const boosted=C.fused(r);assert.equal(C.randomSkillEffects(r).dimensions.creation,60);
  for(const id of Object.values(r.slots))skill(r,id,'sk_see_3');const baseline=C.fused(r,'outside','outside');r.roleSkillMap={};const penalized=C.fused(r,'outside','outside');assert.ok(baseline.dimensions.rimStop>penalized.dimensions.rimStop);
  skill(r,'curry','sk_ctr_5');const matched=C.fused(r,'outside','collapse').dimensions.shooting,unmatched=C.fused(r,'outside','drive').dimensions.shooting;r.roleSkillMap={};assert.ok(matched>C.fused(r,'outside','collapse').dimensions.shooting);assert.equal(unmatched,C.fused(r,'outside','drive').dimensions.shooting);assert.ok(boosted.rating>0);
});
test('each skill slot rerolls at 10/30/50, excludes all existing skills, and cannot reroll during blocked phases',()=>{
  const r=panel().run;r.cash=100;skill(r,'curry','sk_cmd_1','sk_cmd_5');
  for(const cost of [10,30,50]){const prior=[...r.roleSkillMap.curry],cash=r.cash;assert.equal(C.refreshRandomSkill(r,'curry',2),true);assert.equal(r.cash,cash-cost);assert.ok(!prior.includes(r.roleSkillMap.curry[1]));assert.ok(C.SKILL_BY_ID[r.roleSkillMap.curry[1]].star>=3);}
  const prior=JSON.stringify(r);assert.equal(C.refreshRandomSkill(r,'curry',2),false);assert.equal(JSON.stringify(r),prior);
  r.cash=0;assert.equal(C.refreshRandomSkill(r,'curry',1),false);r.cash=100;r.lastBattle={won:true};assert.equal(C.refreshRandomSkill(r,'curry',1),false);r.lastBattle=null;r.randomEvent={};assert.equal(C.refreshRandomSkill(r,'curry',1),false);
});
test('5-star ad selection can repeat after confirmation, can cancel, and rejects duplicates and non-5-star IDs',()=>{
  const g=panel(),r=g.run;assert.equal(C.enterSkillAdPick(r,'curry',1),true);assert.equal(C.battle(g,'outside'),null);assert.equal(C.refreshRandomSkill(r,'lebron',1),false);assert.equal(C.confirmSkillAdPick(r,'sk_cmd_1'),false);assert.equal(C.cancelSkillAdPick(r),true);assert.equal(r.skillAdPickUsed.curry,undefined);
  assert.equal(C.enterSkillAdPick(r,'curry',1),true);assert.equal(C.confirmSkillAdPick(r,'sk_all_5'),true);assert.equal(r.roleSkillMap.curry[0],'sk_all_5');
  const rng=r.rng,cash=r.cash;
  for(let i=0;i<8;i++){assert.equal(C.enterSkillAdPick(r,'curry',1),true);assert.equal(C.confirmSkillAdPick(r,r.roleSkillMap.curry[0]),false);const id=i%2?'sk_all_5':'sk_cmd_5';assert.equal(C.confirmSkillAdPick(r,id),true);assert.equal(r.roleSkillMap.curry[0],id);}
  assert.equal(r.rng,rng);assert.equal(r.cash,cash);assert.equal(r.skillRefreshCount.curry,undefined);
  assert.equal(C.enterSkillAdPick(r,'curry',1),true);const restored=structuredClone(r);C.restoreRandomSkills(restored,r);assert.deepEqual(restored.skillAdPick,r.skillAdPick);assert.equal(C.confirmSkillAdPick(restored,'sk_cmd_5'),true);
});
test('one extra skill refresh per preparation stacks with talent but not another player and resets on retry',()=>{
  const g=panel(),r=g.run;skill(r,'curry','sk_sup_4');skill(r,'lebron','sk_sup_4');r.cash=100;r.gearRefreshFree=1;
  assert.equal(C.shopRefreshCost(r,'gear'),0);C.refreshShop(r,'gear');assert.equal(C.shopRefreshCost(r,'gear'),0);C.refreshShop(r,'gear');assert.equal(C.shopRefreshCost(r,'gear'),3);
  r.lastBattle={won:false};C.continueRun(g,'retry');assert.equal(C.shopRefreshCost(r,'gear'),0);C.refreshShop(r,'gear');assert.equal(C.shopRefreshCost(r,'gear'),3);r.stage++;assert.equal(C.shopRefreshCost(r,'gear'),0);
  skill(r,'curry','sk_disc_3');skill(r,'lebron','sk_disc_3');const item=C.GEAR[0];assert.equal(C.gearPrice(r,item),Math.max(1,item.price-2));
});
test('probability and income skills affect combat, settle terminal rewards, and restore independent recovery counters',()=>{
  for(let seed=1;seed<=20;seed++){
    const g=panel(seed),r=g.run;r.roleSkillMap={};const base=structuredClone(r);skill(r,'curry','sk_inc_5');skill(r,'lebron','sk_win_5');skill(r,'magic','sk_gold_5');
    const plain=C.createGame();plain.run=base;const reference=C.battle(plain,'outside'),report=C.battle(g,'outside');assert.equal(report.won,reference.won);assert.equal(report.reward,reference.reward+6+(report.won?3:0));assert.match(report.detail.join(' '),/徽章奖金/);
    const restored=structuredClone(r);C.restoreRandomSkills(restored,r);assert.deepEqual(restored.roleSkillMap,r.roleSkillMap);
  }
  const g=panel(),r=g.run;skill(r,'curry','sk_heal_5');r.skillHealCounters['curry:sk_heal_5']=2;r.skillHealGranted['curry:sk_heal_5']=2;
  const restored=structuredClone(r);C.restoreRandomSkills(restored,r);assert.equal(restored.skillHealCounters['curry:sk_heal_5'],2);assert.equal(restored.skillHealGranted['curry:sk_heal_5'],2);
  skill(r,'curry','sk_mall_5');assert.equal(C.randomSkillEffects(r).turnoverReduction,.03);assert.equal(C.randomSkillEffects(r).clutchBonus,.03);assert.equal(C.randomSkillEffects(r).opponentPenalty,.03);
});
test('recovery continues beyond three granted points and still respects the 13 morale hard cap',()=>{
  for(const morale of [3,12,13]){
    let wins=0;
    for(let seed=1;seed<=20;seed++){
      const g=panel(seed),r=g.run,key='skill-sk_heal_5',grantedKey='curry:sk_heal_5';skill(r,'curry','sk_heal_5');r.morale=morale;r.skillHealCounters[key]=2;r.skillHealGranted[grantedKey]=6;
      const restored=structuredClone(r);C.restoreRandomSkills(restored,r);assert.equal(restored.skillHealGranted[grantedKey],6);
      const report=C.battle(g,'outside');if(!report.won)continue;wins++;
      assert.equal(r.morale,Math.min(13,morale+1));assert.equal(r.skillHealGranted[grantedKey],6+(morale<13?1:0));assert.equal(r.skillHealCounters[key],0);
    }
    assert.ok(wins>0);
  }
});
test('same-name recovery shares the source skill counter, survives rerolls and restores old local counters',()=>{
  const g=panel(911),r=g.run;skill(r,'curry','sk_heal_5');skill(r,'lebron','sk_heal_5');r.morale=3;
  assert.equal(C.battle(g,'outside').won,true);assert.equal(r.skillHealCounters['skill-sk_heal_5'],2);assert.equal(r.morale,3);
  const restored=structuredClone(r);C.restoreRandomSkills(restored,r);assert.equal(restored.skillHealCounters['skill-sk_heal_5'],2);
  r.lastBattle=null;skill(r,'curry','sk_cmd_1');skill(r,'curry','sk_heal_5');const plain=C.createGame();plain.run=structuredClone(r);skill(plain.run,'curry');skill(plain.run,'lebron');assert.equal(C.battle(plain,'outside').won,true);assert.equal(C.battle(g,'outside').won,true);assert.equal(r.morale,plain.run.morale+1);assert.equal(r.skillHealCounters['skill-sk_heal_5'],1);
  const old=panel().run;old.skillHealCounters={'curry:sk_heal_5':1,'lebron:sk_heal_5':1};C.restoreRandomSkills(old,old);assert.equal(old.skillHealCounters['skill-sk_heal_5'],2);assert.ok(old.roleSkillMap.curry.length);
});
test('historical rerolls preserve the deterministic draw sequence across both ordinary slots',()=>{
  const crypto=require('node:crypto'),trace=[];
  for(let seed=1;seed<=100;seed++)for(const slot of [1,2]){
    const r=panel(seed).run;r.balanceRulesVersion=8;r.cash=1000;skill(r,'curry','sk_cmd_1','sk_cmd_5');
    for(let i=0;i<3;i++){
      const prior=[...r.roleSkillMap.curry];let rng=r.rng;
      for(let draw=0;draw<2;draw++)rng=(Math.imul(rng,1664525)+1013904223)>>>0;
      assert.equal(C.refreshRandomSkill(r,'curry',slot),true);
      const selected=r.roleSkillMap.curry[slot-1];
      assert.ok(!prior.includes(selected));assert.ok(C.SKILL_BY_ID[selected].star>=(slot===1?1:3));assert.equal(r.rng,rng);
      trace.push([seed,slot,i,selected,r.rng]);
    }
  }
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(trace)).digest('hex'),'c9abfed6e7ea0cfe5f4822ab14c5448bf3d12a364d8a7cbf29ff7bbef3c7bf83');
});
test('invalid or stale ad selection slots cannot add hidden skills or consume an opportunity',()=>{
  for(const slot of [0,3,1.5,'1']){
    const r=panel().run;r.skillAdPick={playerId:'curry',slot};const before=JSON.stringify(r);assert.equal(C.confirmSkillAdPick(r,'sk_all_5'),false);assert.equal(JSON.stringify(r),before);
  }
});
test('ten-pull preview, batch acquisition and endless cap retain two ordinary skill slots',()=>{
  const r=C.createRun('steady_interest',19);C.makeTenOffer(r);assert.equal(r.offer.length,10);const previews={...r.draftSkillPreview};
  for(const id of r.offer)assert.ok(previews[id]);const ids=[...new Set(r.offer)];C.confirmRecruitBatch(r);
  while(r.pending){C.resolvePending(r,'sell');C.advanceRecruitBatch(r)}
  for(const id of ids)assert.equal(r.roleSkillMap[id][0],previews[id]);
  const id=Object.keys(r.owned)[0];for(let i=0;i<2;i++){r.offer=[id];r.free=1;C.recruit(r,id)}assert.equal(r.roleSkillMap[id].length,2);
  r.endless=true;r.stage=11;r.owned[id].stars=C.starLimit(r,id)-1;r.offer=[id];r.free=1;C.recruit(r,id);assert.equal(r.roleSkillMap[id].length,2);
});
test('round income pays again at the same stage on wins and losses without stage deduplication',()=>{
  const results=new Set();
  for(const stage of [1,1000]){
    const g=panel(911),r=g.run;r.stage=stage;r.skillStageCashPaid=stage;r.roleSkillMap={};const plain=C.createGame();plain.run=structuredClone(r);skill(r,'curry','sk_gold_5');
    const reference=C.battle(plain,'outside'),report=C.battle(g,'outside');assert.equal(report.won,reference.won);assert.equal(report.reward,reference.reward+3);results.add(report.won);
  }
  assert.equal(results.size,2);
});
test('server replays repeated ad picks deterministically and rejects unfinished picks, forged slots and stars',()=>{
  const initial=C.createRun('reserve_fund',125),r=structuredClone(initial),ops=[];const doAction=(action,...args)=>{const result=C[action](r,...args);assert.notEqual(result,false);ops.push({action,args});};
  for(let i=0;i<6;i++){doAction('recruit',r.offer[0]);if(i<5)doAction('makeOffer');}
  const id=Object.values(r.slots)[0];doAction('refreshRandomSkill',id,1);doAction('enterSkillAdPick',id,1);doAction('cancelSkillAdPick');doAction('enterSkillAdPick',id,1);const selected=C.RANDOM_SKILLS.find(s=>s.star===5&&!r.roleSkillMap[id].includes(s.id)).id;doAction('confirmSkillAdPick',selected);
  doAction('enterSkillAdPick',id,1);const second=C.RANDOM_SKILLS.find(s=>s.star===5&&!r.roleSkillMap[id].includes(s.id)).id;doAction('confirmSkillAdPick',second);
  const g=C.createGame();g.run=r;const report=C.battle(g,'outside'),replayed=V.replay(initial,ops,'battle','outside');assert.deepEqual(replayed.state,r);assert.deepEqual(replayed.report,report);
  assert.throws(()=>V.replay(initial,[...ops,{action:'enterSkillAdPick',args:[id,1]}],'battle','outside'),/验证失败/);
  assert.throws(()=>V.replay(initial,[...ops.slice(0,-1),{action:'confirmSkillAdPick',args:['sk_cmd_1']}],'battle','outside'),/验证失败/);
  assert.throws(()=>V.replay(initial,[...ops,{action:'refreshRandomSkill',args:[id,9]}],'battle','outside'),/验证失败/);
});
