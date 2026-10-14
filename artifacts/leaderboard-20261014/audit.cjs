const fs=require('node:fs'),C=require('../../h5/game-core.js'),V=require('../../activity/cloudfunctions/activity_api/verified-game.js');
const original=require('./state-10415.json'),other=require('./state-2870.json');
const results=[];let replays=0;
for(const version of [17,20])for(const mode of ['original','remove-decisive','remove-both']){
  const state=structuredClone(original);state.balanceRulesVersion=version;state.ended=false;state.awarded=false;state.settlement=null;state.lastBattle=null;
  for(const id of Object.values(state.slots))state.roleSkillMap[id]=state.roleSkillMap[id].filter(x=>mode==='original'||(x!=='sk_mall_5'&&(mode!=='remove-both'||x!=='sk_cb_30')));
  const row={version,mode,stage:state.stage,player:C.fused(state).rating,enemy:C.opponent(state).rating,effects:C.fused(state).skillEffects,rates:[]};
  for(const strategy of Object.keys(C.STRATEGIES)){
    let wins=0;
    for(let i=0;i<1000;i++){
      const g=C.createGame();g.run=structuredClone(state);g.run.rng=(61001+i)*7919;const initial=structuredClone(g.run);const b=C.battle(g,strategy);if(!b)throw Error('rejected');wins+=+b.won;
      if(i===0){const r=V.replay(initial,[],'battle',strategy);if(JSON.stringify(r.report)!==JSON.stringify(b)||JSON.stringify(r.state)!==JSON.stringify(g.run))throw Error('Replay mismatch');replays++;}
    }
    row.rates.push({strategy,wins,n:1000,winRate:wins/1000});
  }results.push(row);
}
const final={label:'服务端最终阵容的单关对照夹具；解除已结束标记，独立种子单关抽样，不是完整对局复现',replays,battles:18000,results,training:{first:Object.values(original.slots).map(id=>({name:C.BY_ID[id].name,...original.owned[id]})),second:Object.values(other.slots).map(id=>({name:C.BY_ID[id].name,...other.owned[id]}))}};
fs.writeFileSync(__dirname+'/audit-result.json',JSON.stringify(final,null,2));console.log(JSON.stringify(final,null,2));
