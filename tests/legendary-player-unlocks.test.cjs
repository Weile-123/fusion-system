const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js');
test('400 points unlock one of the ten new SSR cards without repetition or discovery',()=>{
 const p=C.createGame().profile;p.legend=4000;
 assert.equal(C.LEGENDARY_PLAYERS.length,10);
 for(let i=0;i<10;i++){const star=C.unlockLegendaryPlayer(p,()=>.9);assert.equal(star.tier,'SSR');assert.equal(p.legend,4000-(i+1)*400);assert.equal(new Set(p.playerUnlocks).size,i+1);assert.deepEqual(p.discovered,[]);}
 assert.equal(C.unlockLegendaryPlayer(p),null);assert.equal(p.legend,0);
 const poor=C.createGame().profile;poor.legend=399;assert.equal(C.unlockLegendaryPlayer(poor),null);assert.equal(poor.legend,399);assert.deepEqual(poor.playerUnlocks,[]);
});
test('unlock changes only the next run pool and preserves the eight existing SSR cards',()=>{
 const p=C.createGame().profile;p.legend=400;const oldRun=C.createRun('steady_interest',91,p.upgrades);
 const card=C.unlockLegendaryPlayer(p,()=>0);
 assert.equal(C.playerAvailable(oldRun,card.id),false);
 const run=C.createRun('steady_interest',91,{...p.upgrades,playerUnlocks:p.playerUnlocks});
 assert.equal(C.playerAvailable(run,card.id),true);
 for(const star of C.LEGENDARY_PLAYERS)assert.equal(C.playerAvailable(run,star.id),star.id===card.id);
 for(const star of C.STARS.filter(s=>s.tier==='SSR'&&!C.LEGENDARY_PLAYERS.includes(s)))assert.equal(C.playerAvailable(oldRun,star.id),true);
 p.playerUnlocks.push(C.LEGENDARY_PLAYERS[1].id);assert.equal(C.playerAvailable(run,C.LEGENDARY_PLAYERS[1].id),false);
 assert.deepEqual(C.createRun('steady_interest',91,{playerUnlocks:['unknown',card.id,card.id]}).unlockedPlayers,[card.id]);
});
test('normal and ten-card recruit pools exclude locked SSR and can recruit the unlocked one',()=>{
 const id=C.LEGENDARY_PLAYERS[0].id;let seen=false;
 for(let seed=1;seed<=500;seed++){
  for(const unlocked of [[],[id]]){const r=C.createRun('scouting_network',seed,{playerUnlocks:unlocked});r.stage=10;r.owned={};r.offer=[];
   for(let n=0;n<10;n++){C.makeTenOffer(r);for(const card of r.offer){assert.ok(C.playerAvailable(r,card));if(card===id)seen=true;}}
  }
 }
 assert.equal(seen,true);
});
test('unlock alone does not collect a card; recruitment and settlement add it to the existing codex',()=>{
 const game=C.createGame();game.profile.legend=400;const card=C.unlockLegendaryPlayer(game.profile,()=>0);
 game.run=C.createRun('steady_interest',66,{playerUnlocks:game.profile.playerUnlocks});
 assert.deepEqual(game.profile.discovered,[]);assert.deepEqual(game.run.collectedPlayers,[]);
 game.run.offer=[card.id];assert.equal(C.recruit(game.run,card.id).ok,true);
 assert.ok(game.run.collectedPlayers.includes(card.id));C.finishRun(game);
 assert.ok(game.profile.discovered.includes(card.id));
});
