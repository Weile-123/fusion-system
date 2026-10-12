'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {C,initialize,normalize}=require('../balance/engine.cjs');
const {enumerate,observe,execute}=require('../balance/driver.cjs');
const {createPolicy,badgeValue}=require('../balance/policies.cjs');
test('rules12 applies the inherited stage multiplier while keeping its separate catalogue cache',()=>{
  for(const stage of [1,3,10,20,50,80,100]){
    const base=C.opponent({stage,balanceRulesVersion:8}).rating;
    const scale=stage<=3?1.03:stage<=10?1.03+.03*(stage-3)/7:stage<=20?1.06:stage<=50?1.06+.03*(stage-20)/30:1.09+.03*Math.min(30,stage-50)/30;
    const current=C.opponent({stage,balanceRulesVersion:12}).rating;
    assert.ok(Math.abs(current-base*scale)<=3,`stage ${stage}: ${current} vs ${base*scale}`);
  }
});
test('full account opens all new SSR candidates without granting any run players',()=>{
  const {game}=initialize(C,normalize({seed:81101,policy:'expert',growthLevel:'full',rulesVersion:12}));
  assert.deepEqual(new Set(game.run.unlockedPlayers),new Set(C.LEGENDARY_PLAYERS.map(p=>p.id)));
  assert.equal(Object.keys(game.run.owned).length,0);
  for(const id of game.run.unlockedPlayers)assert.equal(C.playerAvailable(game.run,id),true);
});
test('old-rule public player evaluation uses the frozen catalogue',()=>{
  const config=normalize({seed:81101,rulesVersion:11}),{game}=initialize(C,config);
  game.run.offer=['irving'];game.run.free=1;
  const player=observe(C,game,config).actions.find(a=>a.name==='recruit').player;
  assert.equal(player.tier,C.catalogForRun(game.run).BY_ID.irving.tier);
  assert.equal(player.tier,'B');
});
test('badge ads choose a better visible badge and remain usable after an earlier ad',()=>{
  const config=normalize({seed:81101,ads:'rewarded-success'}),{game}=initialize(C,config),r=game.run;
  for(let i=0;i<6;i++){if(!r.offer.length)C.makeOffer(r);C.recruit(r,r.offer[0]);}
  const id=Object.keys(r.owned)[0],skills=C.randomSkillsForRun(r),weak=[...skills].sort((a,b)=>badgeValue(a)-badgeValue(b))[0];
  r.roleSkillMap[id]=[weak.id];r.skillAdPickUsed[id]=[true];r.offer=[];
  const ad=enumerate(C,game,config).find(a=>a.name==='enterSkillAdPick'&&a.args[0]===id);assert.ok(ad);
  execute(C,game,ad,config);const options=observe(C,game,config),op=createPolicy('expert',1).choose(options);
  const value=badgeValue(options.actions.find(a=>a.args[0]===op.args[0]).skill);
  assert.equal(value,Math.max(...options.actions.map(a=>badgeValue(a.skill))));
  execute(C,game,op,config);assert.equal(enumerate(C,game,config).some(a=>a.name==='enterSkillAdPick'&&a.args[0]===id),false);
});
test('shop purchases are included as legal scored actions',()=>{
  const config=normalize({seed:81101}),{game}=initialize(C,config),r=game.run;
  for(let i=0;i<6;i++){if(!r.offer.length)C.makeOffer(r);C.recruit(r,r.offer[0]);}
  r.stage=5;r.offer=[];r.cash=100;C.makeShopOffers(r);
  const op=observe(C,game,config).actions.find(a=>a.name==='buyShopPlayer');assert.ok(op);assert.ok(op.delta);
  execute(C,game,op,config);assert.ok(r.owned[op.args[0]]||r.pending===op.args[0]);
});
