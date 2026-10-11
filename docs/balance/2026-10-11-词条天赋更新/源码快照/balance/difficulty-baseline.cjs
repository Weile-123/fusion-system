'use strict';
// Controlled formed-build benchmarks. Never modify production saves or award resources.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {C,manifest}=require('./engine.cjs');
const {profileFor,routeSlots,routeBench}=require('./objectives.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const jerseys=C.GEAR.filter(x=>x.slot==='球衣').map(x=>x.id);
const anchors=[1,5,10,11,20,30,40,50,75,100,150,200,300,500,1000];
function setup(spec,stage,peak=false){
  const profile=profileFor(C,spec.growth,61101);
  const r=C.createRun(spec.talent,61101,{...profile.upgrades,jerseyUnlocks:profile.jerseyUnlocks,gearUnlocks:profile.gearUnlocks},spec.rulesVersion??C.BALANCE_RULES_VERSION);
  r.stage=stage;r.endless=stage>10;r.slots={...spec.slots};r.bench=[...spec.bench];
  // Initial meta capacity can exceed the expansion limit; preserve that legal capacity.
  r.benchLimit=Math.max(r.benchLimit,C.benchExpansionLimit(r));
  populate(r,spec);
  r.gear=[...spec.gear];r.gearReserve=spec.jerseys.filter(id=>!r.gear.includes(id));r.collectedJerseys=[...spec.jerseys];
  r.eventState.seen=C.EVENTS.map(x=>x.id);r.eventState.bonuses=peak?eventCeiling(stage):{};
  r.boosts=peak?C.BOOSTS.flatMap(x=>Array(C.boostPurchaseLimit(r)).fill(x.id)):[];
  return r;
}
function populate(r,spec){
  r.owned=Object.fromEntries([...Object.values(r.slots),...r.bench].map(id=>[id,{
    stars:Math.max(1,Math.floor(C.starLimit(r,id)*spec.starRate)),
    train:Math.floor(Math.min(r.stage,C.trainingLimit(r,id))*spec.trainRate),trainedAt:0
  }]));
}
function eventCeiling(stage){
  const bonus={};
  for(const e of C.EVENTS){
    // Loose finite bound: assumes all eligible one-time dimension events succeeded at maximum reward.
    if(!e.dimension||e.jersey||e.minStage>stage)continue;
    const value=e.type==='X'?3:e.type==='C'?5:e.players.length===2?7:5;
    bonus[e.dimension]=(bonus[e.dimension]||0)+value;
  }
  return bonus;
}
function kit(r,spec,rarities){
  for(let pass=0;pass<2;pass++)for(const slot of [...new Set(C.GEAR.map(x=>x.slot))]){
    const rest=r.gear.filter(id=>C.GEAR.find(x=>x.id===id).slot!==slot);
    let best=null,score=-Infinity;
    for(const item of C.GEAR.filter(x=>x.slot===slot&&C.gearAvailable(r,x)&&(!rarities||rarities.includes(x.rarity))&&(slot!=='球衣'||spec.jerseys.includes(x.id)))){
      r.gear=[...rest,item.id];r.gearReserve=spec.jerseys.filter(id=>!r.gear.includes(id));
      const n=C.fused(r).rating;if(n>score){score=n;best=item.id;}
    }
    r.gear=best?[...rest,best]:rest;r.gearReserve=spec.jerseys.filter(id=>!r.gear.includes(id));
  }
  spec.gear=[...r.gear];return C.fused(r).rating;
}
function optimize(talent,stage,start=0){
  const spec={id:'high',label:'高阶：满配上限',growth:'full',talent,starRate:1,trainRate:1,slots:{...routeSlots},bench:[...routeBench],gear:[],jerseys:[...jerseys]};
  const r=setup(spec,stage);
  const pool=C.STARS.map(x=>x.id);
  if(start===1){
    const used=new Set();
    const score=(star,key)=>C.playerScore(star,{stars:C.starLimit(r,star.id),train:C.trainingLimit(r,star.id)},key,r);
    for(const slot of C.SLOTS){const id=C.STARS.filter(x=>!used.has(C.identityOf(x.id))).sort((a,b)=>score(b,slot.id)-score(a,slot.id)||a.id.localeCompare(b.id))[0].id;spec.slots[slot.id]=id;used.add(C.identityOf(id));}
    r.slots={...spec.slots};r.bench=routeBench.filter(id=>!used.has(C.identityOf(id)));
  }
  // Identity uniqueness keeps roster seats meaningful; SSR replaces its normal counterpart.
  const allowed=(id,removed)=>![...Object.values(r.slots),...r.bench].filter(x=>x!==removed).some(x=>C.identityOf(x)===C.identityOf(id));
  while(r.bench.length<r.benchLimit){const id=pool.find(id=>allowed(id));r.bench.push(id);}
  populate(r,spec);kit(r,spec);
  let evaluations=0;
  for(let round=0;round<3;round++){
    let changed=false;
    for(const slot of C.SLOTS){
      const old=r.slots[slot.id];let best=old,score=C.fused(r).rating;
      for(const id of pool){if(!allowed(id,old))continue;r.slots[slot.id]=id;populate(r,spec);const n=C.fused(r).rating;evaluations++;if(n>score){score=n;best=id;}r.slots[slot.id]=old;}
      r.slots[slot.id]=best;populate(r,spec);changed ||=best!==old;
    }
    for(let i=0;i<r.bench.length;i++){
      const old=r.bench[i];let best=old,score=C.fused(r).rating;
      for(const id of pool){if(!allowed(id,old))continue;r.bench[i]=id;populate(r,spec);const n=C.fused(r).rating;evaluations++;if(n>score){score=n;best=id;}r.bench[i]=old;}
      r.bench[i]=best;populate(r,spec);changed ||=best!==old;
    }
    kit(r,spec);if(!changed)break;
  }
  spec.slots={...r.slots};spec.bench=[...r.bench];spec.search={anchor:stage,start,evaluations,score:C.fused(r).rating};return spec;
}
function fixedSpecs(){
  const low={id:'low',label:'低阶：基础阵容',growth:'none',talent:'front_office',starRate:.25,trainRate:.25,slots:{three:'klay',mid:'booker',drive:'butler',handle:'parker',inside:'pau',def:'green'},bench:['ginobili','westbrook','lopez'],gear:[],jerseys:[]};
  const mid={id:'mid',label:'中阶：半养成阵容',growth:'half',talent:'chemistry',starRate:.5,trainRate:.5,slots:{three:'curry',mid:'dirk',drive:'wade',handle:'paul',inside:'jokic',def:'garnett'},bench:['klay','green','lebron','bosh','stockton','malone','pippen','jordan'],gear:[],jerseys:jerseys.filter(id=>!C.GEAR.find(x=>x.id===id).unlockable).slice(0,4)};
  kit(setup(low,50),low,['C','B']);kit(setup(mid,50),mid,['A']);return [low,mid];
}
function trials(spec,stage,peak=false,n=300){
  let wins=0;
  const base=setup(spec,stage,peak),d=C.fused(base).dimensions;
  // Uses only visible own dimensions, never reads the hidden enemy strategy.
  const strategy=d.shooting>=d.finishing?'outside':'drive';
  for(let i=0;i<n;i++){
    const r=clone(base);r.seed=r.rng=72101+i;r.lastBattle=null;
    const game={run:r,profile:C.createGame().profile};const b=C.battle(game,strategy);if(!b)throw Error('Battle rejected');wins+=Number(b.won);
  }
  const p=wins/n,z=1.96,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  return {stage,n,wins,rate:p,strategy,ci95:[wins===0?0:Math.max(0,center-half),wins===n?1:Math.min(1,center+half)]};
}
function generate(){
  const start=Date.now(),candidates=[];
  for(const stage of [11,50,1000])for(const {id:talent} of C.TALENTS){
    const bank=[optimize(talent,stage,0),optimize(talent,stage,1)],spec=bank.sort((a,b)=>b.search.score-a.search.score)[0];spec.search.totalEvaluations=bank.reduce((n,x)=>n+x.search.evaluations,0);candidates.push(spec);console.log(JSON.stringify({search:talent,stage,rating:spec.search.score,evaluations:spec.search.totalEvaluations}));
  }
  // A bank of independently legal builds yields a best-found envelope, not a continuous natural run.
  const specs=fixedSpecs();const series=specs.map(spec=>({id:spec.id,label:spec.label,spec,points:[]}));
  series.push({id:'high',label:'高阶：满配最佳已找到构筑',candidates,points:[]});
  for(let stage=1;stage<=1000;stage++){
    const enemy=C.opponent({stage,balanceRulesVersion:C.BALANCE_RULES_VERSION}).rating;
    for(const s of series){
      const bank=s.id==='high'?candidates:[s.spec];let best=null,index=0,peak=0;
      bank.forEach((spec,i)=>{const r=setup(spec,stage),f=C.fused(r);if(!best||f.rating>best.rating){best=f;index=i;}peak=Math.max(peak,C.fused(setup(spec,stage,true)).rating);});
      s.points.push({stage,player:best.rating,enemy,peak,candidate:index});
    }
  }
  for(const s of series){
    s.battles=anchors.map(stage=>{const p=s.points[stage-1],spec=s.id==='high'?candidates[p.candidate]:s.spec;return trials(spec,stage);});
    s.summary={lastPanelLead:s.points.filter(p=>p.player>=p.enemy).at(-1)?.stage||0,lastPeakLead:s.points.filter(p=>p.peak>=p.enemy).at(-1)?.stage||0};
    console.log(JSON.stringify({series:s.id,summary:s.summary}));
  }
  const hashes=manifest();for(const file of ['balance/difficulty-baseline.cjs','balance/reference-page.cjs'])hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return {schema:1,date:'2026-10-11',rulesVersion:C.BALANCE_RULES_VERSION,maxStage:1000,seed:61101,trialSeed:72101,elapsedMs:Date.now()-start,sourceHashes:hashes,eventCeiling:eventCeiling(1000),metaTotal:C.META_UPGRADES.reduce((n,x)=>n+x.prices.reduce((a,b)=>a+b,0),0),series};
}
function main(){
  const args=process.argv.slice(2),compare=args.includes('--compare')?args[args.indexOf('--compare')+1]:null;
  const out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'docs/balance/2026-10-11');
  const prior=compare?JSON.parse(fs.readFileSync(compare,'utf8')):null;
  const data=generate();fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'baseline.json'),JSON.stringify(data,null,2)+'\n');
  fs.writeFileSync(path.join(out,'curves.csv'),'\uFEFFtier,stage,player,enemy,peak,candidate\n'+data.series.flatMap(s=>s.points.map(p=>[s.id,p.stage,p.player,p.enemy,p.peak,p.candidate].join(','))).join('\n')+'\n');
  fs.writeFileSync(path.join(out,'index.html'),require('./reference-page.cjs').page(data));
  if(prior){
    const changes=data.series.flatMap(s=>anchors.map(stage=>{const old=prior.series.find(x=>x.id===s.id),before=old.points[stage-1],after=s.points[stage-1],bank=old.id==='high'?old.candidates:[old.spec],frozenPlayerAfter=Math.max(...bank.map(spec=>C.fused(setup(spec,stage)).rating));return {tier:s.id,stage,playerBefore:before.player,playerAfter:after.player,frozenPlayerAfter,enemyBefore:before.enemy,enemyAfter:after.enemy,ratioBefore:before.player/before.enemy,ratioAfter:after.player/after.enemy,gapDelta:(after.player-after.enemy)-(before.player-before.enemy)};}));
    fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify({note:'Envelope comparison includes re-optimized builds. Review candidate changes as well as core changes.',changes},null,2));
  }
  console.log('Reference written to '+out);
}
if(require.main===module)main();
module.exports={setup,eventCeiling,kit,optimize,fixedSpecs,trials,generate,anchors};
