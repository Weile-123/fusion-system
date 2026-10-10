'use strict';
const {rng}=require('./engine.cjs');
const names=['random','novice','ordinary','expert','extreme'];
function createPolicy(name,seed){
  if(!names.includes(name))throw Error('Unknown policy '+name);
  const random=rng(seed),memory=new Map();let previousBattle=null,paid=0,refreshes=0,key='';
  const pick=xs=>xs[Math.floor(random()*xs.length)];
  function choose(o){
    const turn=o.stage+':'+o.wins+':'+o.losses;if(turn!==key){key=turn;paid=0;refreshes=0}
    if(!o.actions.length)throw Error('No legal action');
    if(name==='random'){
      const a=pick(o.actions);return a.name==='confirmRecruitBatch'?{name:a.name,args:[a.args[0].map(()=>random()<.5)]}:a;
    }
    const first=o.actions[0];
    if(first.name==='acknowledgeRandomEvent'||first.name==='continueRun'||first.name==='advanceRecruitBatch')return first;
    if(first.name==='resolveRandomEvent'){
      if(name==='novice')return first.risk?o.actions[1]:first;
      const ev=first.event,p=o.event.successRate;
      const chooseSafe=first.risk||ev.failure.includes('生命')&&(o.morale<=2||p<.65)||ev.main.includes('支付')&&o.cash<24;
      return o.actions[chooseSafe?1:0];
    }
    if(first.name==='confirmRecruitBatch')return first;
    if(o.actions.some(a=>a.name==='recruit')){
      const recruits=o.actions.filter(a=>a.name==='recruit');
      if(name==='novice')return recruits.sort((a,b)=>Math.max(...Object.values(b.player.attrs))-Math.max(...Object.values(a.player.attrs)))[0];
      const value=a=>{
        const p=a.player,d=a.delta,empty=!o.slots[p.best],rank={C:0,B:1,A:2,S:3,SSR:4}[p.tier];
        if(name==='ordinary')return (empty?35:0)+p.attrs[p.best]+(p.duplicate?12:0)+rank*3;
        return (empty?30:0)+(name==='extreme'?a.searchGain:d.rating)*12+d.bonds*15+d.heals*40+rank*3+p.attrs[p.best]*.12+d.cash;
      };
      return recruits.sort((a,b)=>value(b)-value(a))[0];
    }
    if(first.name==='resolvePending')return [...o.actions].sort((a,b)=>quality(b)-quality(a))[0];
    const ad=o.actions.find(a=>a.name==='grantRewardedSOffer');if(ad)return ad;
    const free=o.actions.find(a=>a.name==='makeOffer');if(free&&o.free>0)return free;
    const deterministic=o.actions.filter(a=>a.delta);
    let ranked=deterministic.map(a=>({a,score:quality(a)})).sort((a,b)=>b.score-a.score);
    let best=ranked.find(({a,score})=>score>0&&a.name!=='expandBench'&&(a.delta.cash>=0||o.cash+a.delta.cash>=(o.stage<=3?0:8)));
    if(best){return best.a}
    if(free&&o.cash>=40&&paid<(name==='extreme'?3:name==='expert'?2:1)){paid++;return free}
    const refresh=o.actions.find(a=>a.name==='refreshShop'&&a.args[0]==='gear');
    if(refresh&&o.cash>60&&refreshes<(name==='extreme'?2:1)){refreshes++;return refresh}
    const battles=o.actions.filter(a=>a.name==='battle');
    if(!battles.length)return first;
    const known=memory.get(o.opponent.id);
    let strategy;
    if(name==='expert'||name==='extreme')strategy=known&&({collapse:'outside',outside:'drive',drive:'collapse'})[known];
    if(!strategy){const d=o.opponent.dimensions;strategy=d.finishing>d.shooting+5?'collapse':d.shooting>d.finishing+5?'drive':o.dimensions.shooting>o.dimensions.finishing?'outside':'drive'}
    previousBattle={id:o.opponent.id,strategy};return battles.find(a=>a.args[0]===strategy);
  }
  function quality(a){
    const d=a.delta;if(!d)return -Infinity;
    if(a.name==='sellBench'||a.name==='sellGear')return -Infinity;
    const gain=name==='extreme'&&a.searchGain!==undefined&&a.name!=='swapPositions'?a.searchGain:d.rating;
    if(name==='novice')return gain-(d.cash<0?-d.cash*.6:0);
    const cost=Math.max(0,-d.cash),factor=name==='ordinary'?.6:.35;
    return gain*3+d.bonds*(name==='ordinary'?4:12)+d.heals*35+d.income*2-cost*factor-(a.name==='buyBoost'?4:0);
  }
  function learn(report){
    if(!previousBattle)return;
    const s=previousBattle.strategy;
    const foe=report.beats===0?s:report.beats===1?({outside:'collapse',drive:'outside',collapse:'drive'})[s]:({outside:'drive',drive:'collapse',collapse:'outside'})[s];
    memory.set(previousBattle.id,foe);previousBattle=null;
  }
  return {choose,learn};
}
module.exports={names,createPolicy};
