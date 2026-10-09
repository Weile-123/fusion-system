const fs=require('node:fs');
const C=require('../h5/game-core.js');
// Historical v2 hard-cap proof. New rules use calculate-diverse-rosters.cjs.
const createLegacyRun=C.createRun;
C.createRun=(talent,seed,progress)=>createLegacyRun(talent,seed,progress,2);
C.SYNERGIES=C.synergiesForRun({balanceRulesVersion:2});
// Compare intrinsic roster OVR: three stars, three training levels, no equipment,
// opening combat bonus, tactics, permanent upgrades or recovery value.
const slotWeights={three:{three:.65,mid:.2,handle:.15},mid:{mid:.55,drive:.25,three:.2},drive:{drive:.55,handle:.25,inside:.2},handle:{handle:.55,drive:.25,mid:.2},inside:{inside:.6,drive:.25,def:.15},def:{def:.6,inside:.25,handle:.15}};
const dimensions={shooting:{three:.5,mid:.35,handle:.15},creation:{handle:.5,drive:.3,mid:.2},finishing:{inside:.5,drive:.35,mid:.15},perimeterStop:{def:.5,handle:.3,drive:.2},rimStop:{def:.5,inside:.35,drive:.15}};
const slots=C.SLOTS.map(x=>x.id);
const coefficient=Object.fromEntries(slots.map(slot=>[slot,Object.values(dimensions).reduce((sum,w)=>sum+(w[slot]||0),0)/5]));
const grows=Object.fromEntries(C.STARS.map(star=>[star.id,Object.fromEntries(C.ATTRS.map(key=>[key,C.playerScore(star,{stars:3,train:3},key)]))]));
const score=(id,slot)=>Object.entries(slotWeights[slot]).reduce((sum,[key,w])=>sum+grows[id][key]*w,0);
function upperAssignment(pool){
  // For six distinct starters, an optimal assignment never needs a candidate
  // below the top six for a slot: at most five better candidates are occupied.
  const candidates=slots.map(slot=>pool.map(star=>({id:star.id,value:score(star.id,slot)*coefficient[slot]})).sort((a,b)=>b.value-a.value).slice(0,6));
  let best=-Infinity,bestIds;const chosen=[],used=new Set();
  function walk(index,total){if(index===6){if(total>best){best=total;bestIds=[...chosen]}return}
    for(const candidate of candidates[index])if(!used.has(candidate.id)){used.add(candidate.id);chosen.push(candidate.id);walk(index+1,total+candidate.value);chosen.pop();used.delete(candidate.id)}}
  walk(0,0);return {ids:bestIds,base:best,upper:best*1.4};
}
let seed=911;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function calculate(pool,tries=24){
  const bound=upperAssignment(pool),starters=bound.ids;
  const run=C.createRun('steady_interest',911);run.slots=Object.fromEntries(slots.map((slot,i)=>[slot,starters[i]]));run.benchLimit=10;
  const remaining=C.STARS.map(x=>x.id).filter(id=>!starters.includes(id));
  function evaluate(bench){run.bench=[...bench];run.owned=Object.fromEntries([...starters,...bench].map(id=>[id,{stars:3,train:3,trainedAt:0}]));const fused=C.fused(run);return {raw:Object.values(fused.dimensions).reduce((sum,n)=>sum+n,0)/5,fused}}
  // Among tied maxima, retain the requested S-tier recovery members.
  const preferred=['jordan','lebron','shaq','bird','magic','hakeem','kareem','klay','green','iguodala'];
  let best={...evaluate(preferred),bench:preferred};
  for(let attempt=0;attempt<tries;attempt++){
    let bench=[...remaining].sort(()=>random()-.5).slice(0,10),now=evaluate(bench);
    if(now.raw>best.raw)best={...now,bench:[...bench]};
    for(let step=0;step<2500;step++){
      const index=Math.floor(random()*10),candidate=remaining[Math.floor(random()*remaining.length)];if(bench.includes(candidate))continue;
      const next=[...bench];next[index]=candidate;const value=evaluate(next),temperature=.9*(1-step/2500);
      if(value.raw>=now.raw||random()<Math.exp((value.raw-now.raw)/Math.max(.01,temperature))){bench=next;now=value}
      if(now.raw>best.raw+1e-9)best={...now,bench:[...bench]};
      if(best.raw>=bound.upper-1e-8)break;
    }
    if(best.raw>=bound.upper-1e-8)break;
  }
  const final=evaluate(best.bench);
  return {stars:3,training:3,starterIds:starters,benchIds:best.bench,rating:final.fused.rating,rawRating:final.raw,upperBound:bound.upper,gap:bound.upper-final.raw,certified:bound.upper-final.raw<1e-8,dimensions:final.fused.dimensions,slotScores:final.fused.slotScores,bonds:final.fused.bonds.map(x=>({id:x.id,name:x.name,description:x.description})),starters:starters.map((id,i)=>({slot:slots[i],id,name:C.BY_ID[id].name,tier:C.BY_ID[id].tier})),bench:best.bench.map(id=>({id,name:C.BY_ID[id].name,tier:C.BY_ID[id].tier}))};
}
if(process.argv.includes('--baseline'))for(let i=C.SYNERGIES.length-1;i>=0;i--)if(C.SYNERGIES[i].effect.winHeal)C.SYNERGIES.splice(i,1);
const result={scope:'3 stars / 3 training / 6 starters + 10 bench / roster OVR only',all:calculate(C.STARS)};
fs.mkdirSync('.local-tools',{recursive:true});fs.writeFileSync('.local-tools/strongest-roster.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
