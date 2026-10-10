'use strict';
const {routeIds,routeSlots}=require('./objectives.cjs');
const names=['novice','ordinary','expert'];
function createPolicy(name,seed){
  if(!names.includes(name))throw Error('Unknown policy '+name);
  const memory=new Map();let previousBattle=null,paid=0,refreshes=0,key='';
  const target=id=>routeIds.includes(id);
  function quality(a,o){
    const d=a.delta;if(!d)return -Infinity;
    if(['sellBench','sellGear'].includes(a.name))return -Infinity;
    if(a.name==='expandBench')return name==='expert'&&o.benchLimit<10&&o.bench.length>=o.benchLimit-1?8:-Infinity;
    const cost=Math.max(0,-d.cash),gain=a.searchGain??d.rating;
    if(name==='novice')return gain-cost*.6;
    if(name==='ordinary')return gain*3+d.bonds*4+d.heals*35+d.income*2-cost*.6-(a.name==='buyBoost'?4:0);
    const temporary=a.name==='buyBoost';
    const pressure=o.rating/o.opponent.rating<(o.morale<=2?1.45:1.3);
    const trainStarter=a.name==='train'&&Object.values(o.slots).includes(a.args[0]);
    let score=gain*5+d.bonds*8+d.heals*70+d.income*5+d.members*22+d.correctSlots*18+d.jerseys*6+d.saves*18-cost*.12;
    if(temporary)score-=pressure?3:25;
    if(trainStarter)score+=1;
    if(a.futureSlotGain!==undefined)score+=a.futureSlotGain*5+.5;
    if(a.name==='equipGear'&&d.rating<=0&&d.heals<=0&&d.income<=0&&d.saves<=0)score=-Infinity;
    if(a.name==='resolvePending'&&gain<-8)score-=100;
    return score;
  }
  function choose(o){
    const turn=o.stage+':'+o.wins+':'+o.losses;if(turn!==key){key=turn;paid=0;refreshes=0}
    if(!o.actions.length)throw Error('No legal action');
    const first=o.actions[0];
    if(['acknowledgeRandomEvent','continueRun','advanceRecruitBatch'].includes(first.name))return first;
    if(first.name==='resolveRandomEvent'){
      const ev=first.event,p=o.event.successRate;
      const safe=first.risk||name!=='novice'&&(ev.failure.includes('生命')&&(o.morale<=2||p<.65)||ev.main.includes('支付')&&o.cash<16);
      return o.actions[safe?1:0];
    }
    if(first.name==='confirmRecruitBatch')return first;
    const recruits=o.actions.filter(a=>a.name==='recruit');
    if(recruits.length){
      const value=a=>{const p=a.player,d=a.delta,empty=!o.slots[p.best],rank={C:0,B:1,A:2,S:3,SSR:4}[p.tier];
        if(name==='novice')return Math.max(...Object.values(p.attrs));
        if(name==='ordinary')return (empty?35:0)+p.attrs[p.best]+(p.duplicate?12:0)+rank*3;
        const newGoal=target(p.identity)&&!Object.values(o.identities).includes(p.identity);
        const main=Object.values(routeSlots).includes(p.identity);
        return (empty?40:0)+(a.searchGain??d.rating)*14+d.bonds*12+d.heals*75+rank*3+p.attrs[p.best]*.1+d.cash+(newGoal?(main?45:30):0)+(target(p.identity)&&p.duplicate&&p.stars<p.starLimit?10:0);
      };
      return [...recruits].sort((a,b)=>value(b)-value(a))[0];
    }
    if(first.name==='resolvePending')return [...o.actions].sort((a,b)=>quality(b,o)-quality(a,o))[0];
    const ad=o.actions.find(a=>a.name==='grantRewardedSOffer');if(ad)return ad;
    const free=o.actions.find(a=>a.name==='makeOffer');if(free&&o.free>0)return free;
    const pressure=o.rating/o.opponent.rating<(o.morale<=2?1.45:1.3);
    const reserve=name==='expert'?(pressure?0:15):o.stage<=3?0:8;
    const ranked=o.actions.filter(a=>a.delta).map(a=>({a,score:quality(a,o)})).sort((a,b)=>b.score-a.score);
    const best=ranked.find(({a,score})=>score>.01&&(a.delta.cash>=0||o.cash+a.delta.cash>=reserve));
    if(best)return best.a;
    if(free){
      const pursuing=name==='expert'&&(o.objectives.members<16||o.objectives.maxStarMembers<16);
      const threshold=name==='expert'?(pressure?o.recruitPrice+5:pursuing?24:50):40;
      if(o.cash>=threshold&&paid<(name==='expert'?8:1)){paid++;return free}
    }
    const refresh=o.actions.find(a=>a.name==='refreshShop'&&a.args[0]==='gear');
    if(refresh&&o.cash>(name==='expert'?pressure?20:40:60)&&refreshes<(name==='expert'?3:1)){refreshes++;return refresh}
    const battles=o.actions.filter(a=>a.name==='battle');if(!battles.length)return first;
    let strategy;
    const known=memory.get(o.opponent.id);if(name==='expert'&&known)strategy=({collapse:'outside',outside:'drive',drive:'collapse'})[known];
    if(!strategy){const d=o.opponent.dimensions;strategy=d.finishing>d.shooting+5?'collapse':d.shooting>d.finishing+5?'drive':o.dimensions.shooting>o.dimensions.finishing?'outside':'drive'}
    previousBattle={id:o.opponent.id,strategy};return battles.find(a=>a.args[0]===strategy);
  }
  function learn(report){
    if(!previousBattle)return;const s=previousBattle.strategy;
    const foe=report.beats===0?s:report.beats===1?({outside:'collapse',drive:'outside',collapse:'drive'})[s]:({outside:'drive',drive:'collapse',collapse:'outside'})[s];
    memory.set(previousBattle.id,foe);previousBattle=null;
  }
  return {choose,learn};
}
module.exports={names,createPolicy};
