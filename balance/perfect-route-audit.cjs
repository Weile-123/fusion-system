'use strict';
// Controlled prebuilt stress fixtures, never natural acquisition or user saves.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {C,manifest}=require('./engine.cjs');
const {routeSlots,routeBench}=require('./objectives.cjs');
const out=path.resolve('artifacts/balance/perfect-route-20261010');
const ids=[...Object.values(routeSlots),...routeBench];
const clone=x=>JSON.parse(JSON.stringify(x));
function liveCore(){const ctx=vm.createContext({});ctx.window=ctx;
  for(const name of ['game-data-DHBGtBOV.js','gear-catalog-JqgBiRLn.js','game-core-zTIm4Xol.js']){
    const s=fs.readFileSync('artifacts/balance-live-'+name,'utf8').replace(/export default ([^;]+);\s*$/,'$1;');vm.runInContext(s,ctx,{timeout:5000});
  }return ctx.SupFusionGameCore;
}
function setup(core,stage,mode={}){
  const jerseys=core.GEAR.filter(x=>x.slot==='球衣').map(x=>x.id),r=core.createRun('chemistry',1,{trainingBoost:3,filmStudy:3,gearStorage:5,jerseyUnlocks:jerseys,gearUnlocks:core.GEAR.filter(x=>x.legendary).map(x=>x.id)},core.BALANCE_RULES_VERSION);
  r.stage=stage;r.endless=true;r.benchLimit=10;r.free=0;r.offer=[];r.cash=0;
  const selected=ids.map((id,i)=>mode.ssr&&i<6?(core.STARS.find(s=>s.variantOf===id)?.id||id):id);
  r.slots=Object.fromEntries(core.SLOTS.map((s,i)=>[s.id,selected[i]]));r.bench=selected.slice(6);
  r.owned=Object.fromEntries(selected.map(id=>[id,{stars:core.starLimit(r,id),train:mode.trainingRate===undefined?stage:Math.floor(stage*mode.trainingRate),trainedAt:0}]));
  r.gear=[];r.gearReserve=mode.jerseys===false?[]:[...jerseys];r.collectedJerseys=[...r.gearReserve];
  if(r.eventState){r.eventState.seen=(core.EVENTS||[]).map(x=>x.id);r.eventState.bonuses={};}
  return r;
}
function kit(core,r,mode){
  const jerseys=mode.jerseys===false?[]:core.GEAR.filter(x=>x.slot==='球衣').map(x=>x.id);
  for(const slot of [...new Set(core.GEAR.map(x=>x.slot))].filter(x=>mode.jerseys!==false||x!=='球衣')){
    const old=r.gear.filter(id=>core.GEAR.find(x=>x.id===id).slot!==slot);let best=null,score=-Infinity;
    for(const item of core.GEAR.filter(x=>x.slot===slot&&(!core.gearAvailable||core.gearAvailable(r,x)))){
      r.gear=[...old,item.id];r.gearReserve=jerseys.filter(id=>!r.gear.includes(id));const n=core.fused(r).rating;
      if(n>score){score=n;best=item.id}
    }if(best){r.gear=[...old,best];r.gearReserve=jerseys.filter(id=>!r.gear.includes(id));}
  }
  return r;
}
function choose(r,memory){
  const foe=C.opponent(r),known=memory.get(foe.id);
  if(known)return ({collapse:'outside',outside:'drive',drive:'collapse'})[known];
  const d=foe.dimensions,us=C.fused(r).dimensions;
  return d.finishing>d.shooting+5?'collapse':d.shooting>d.finishing+5?'drive':us.shooting>us.finishing?'outside':'drive';
}
function learn(memory,b){const s=b.strategy;memory.set(b.foe,b.beats===0?s:b.beats===1?({outside:'collapse',drive:'outside',collapse:'drive'})[s]:({outside:'drive',drive:'collapse',collapse:'outside'})[s]);}
const modes=[
  {id:'route-full-jerseys',label:'路线1满星满训＋27球衣'},
  {id:'route-no-jerseys',label:'路线1满星满训，无球衣',jerseys:false},
  {id:'route-boost-upper',label:'路线1满星满训＋27球衣＋强化免费买满上界',boosts:true},
  {id:'ssr-full-upper',label:'六主力SSR替换满星满训＋27球衣上界',ssr:true}
];
const quantile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.ceil(a.length*p)-1];
function csv(name,rows){const h=Object.keys(rows[0]);fs.writeFileSync(path.join(out,name),'\uFEFF'+h.join(',')+'\n'+rows.map(x=>h.map(k=>JSON.stringify(x[k]??'')).join(',')).join('\n'));}
function main(){fs.mkdirSync(out,{recursive:true});const old=liveCore(),curves=[],terminals=[],trace=[],checks=[],gearSets={};
  for(const mode of modes){const initial=kit(C,setup(C,11,mode),mode);gearSets[mode.id]=initial.gear;
    for(let stage=11;stage<=1000;stage++){
      const r=setup(C,stage,mode);r.gear=[...initial.gear];r.gearReserve=mode.jerseys===false?[]:C.GEAR.filter(x=>x.slot==='球衣'&&!r.gear.includes(x.id)).map(x=>x.id);
      if(mode.boosts)r.boosts=C.BOOSTS.flatMap(x=>Array(C.boostPurchaseLimit(r)).fill(x.id));
      curves.push({mode:mode.id,stage,player:C.fused(r).rating,enemy:C.opponent(r).rating,liveEnemy:old.opponent({stage,balanceRulesVersion:old.BALANCE_RULES_VERSION}).rating});
    }
    for(let i=0;i<200;i++){
      const g=C.createGame();g.run=clone(initial);const r=g.run,seed=51001+i;r.seed=seed;r.rng=seed;const memory=new Map();let battles=0,highestCleared=10;
      while(!r.ended&&r.stage<=1000&&battles<5000){
        for(const [id,o] of Object.entries(r.owned)){o.stars=C.starLimit(r,id);o.train=C.trainingLimit(r,id);}
        if(mode.boosts)r.boosts=C.BOOSTS.flatMap(x=>Array(C.boostPurchaseLimit(r)).fill(x.id));
        const base=C.fused(r).rating,before=clone(r),b=C.battle(g,choose(r,memory));if(!b)throw Error('Battle rejected');battles++;learn(memory,b);
        trace.push({mode:mode.id,seed,attempt:battles,stage:b.stage,won:b.won,player:base,enemy:b.foeRating,morale:r.morale,cash:r.cash,strategy:b.strategy,rng:r.rng});
        if(i===0&&[50,200,400].includes(b.stage)&&!checks.some(x=>x.mode===mode.id&&x.stage===b.stage)){
          const replay=require('../activity/cloudfunctions/activity_api/verified-game.js').replay(before,[],'battle',b.strategy);
          if(JSON.stringify(replay.report)!==JSON.stringify(b)||JSON.stringify(replay.state)!==JSON.stringify(r))throw Error('Replay mismatch');checks.push({mode:mode.id,stage:b.stage,match:true});
        }
        if(b.won)highestCleared=r.stage;if(r.ended)break;
        if(!C.continueRun(g,b.won?'next':'retry')||r.randomEvent)throw Error('Unexpected continuation/event');
      }
      terminals.push({mode:mode.id,seed,status:r.ended?'death':'censored',highestCleared,terminalStage:r.stage,battles,cash:r.cash});
    }
    console.log(JSON.stringify({mode:mode.id,finished:200}));
  }
  const comparison=[];
  for(const stage of [11,20,30,40,50,75,100,150,200,300,400,500,566,1000]){
    const x=kit(C,setup(C,stage,{}),{}),y=kit(old,setup(old,stage,{}),{});
    comparison.push({stage,oldEnemy:old.opponent(y).rating,newEnemy:C.opponent(x).rating,oldFullPlayer:old.fused(y).rating,newFullPlayer:C.fused(x).rating});
  }
  const result={mode:'controlled-prebuilt-continuous-cap-not-natural',description:'Start stage11, morale3, all16 normal route players max stars and training refreshed to every stage cap for free. Full meta training/film. 27 jerseys or none, visible tactics with battle memory. Greedy gear selected at11 then fixed. Events and advertisements excluded; boosts only in explicitly free-boost upper group. No natural acquisition or financing claim.',sourceHashes:manifest(),liveVersion:old.BALANCE_RULES_VERSION,liveGear:old.GEAR.length,newGear:C.GEAR.length,gearSets,checks,comparison,summaries:modes.map(m=>{
    const a=terminals.filter(x=>x.mode===m.id),c=curves.filter(x=>x.mode===m.id),lastLead=c.filter(x=>x.player>=x.enemy).at(-1);
    return {...m,n:a.length,deaths:a.filter(x=>x.status==='death').length,censored:a.filter(x=>x.status==='censored').length,p10:quantile(a.map(x=>x.highestCleared),.1),p50:quantile(a.map(x=>x.highestCleared),.5),p90:quantile(a.map(x=>x.highestCleared),.9),max:Math.max(...a.map(x=>x.highestCleared)),persistentEnemyLeadFrom:lastLead?lastLead.stage+1:11};
  })};
  csv('curves.csv',curves);csv('terminal.csv',terminals);csv('battles.csv',trace);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main();
module.exports={setup,kit,liveCore};
