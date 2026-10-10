'use strict';
const {clone}=require('./engine.cjs');
const gameActions=new Set(['continueRun','resolveRandomEvent','acknowledgeRandomEvent']);
const action=(name,args=[],extra={})=>({name,args,...extra});
function enumerate(C,game,config){
  const r=game.run;if(r.randomEvent){
    const p=r.randomEvent;if(p.result)return [action('acknowledgeRandomEvent',[p.id])];
    const choices=C.eventChoices(r,p);
    return [action('resolveRandomEvent',[p.id,'main'],{event:choices,risk:choices.fatal}),action('resolveRandomEvent',[p.id,'safe'],{event:choices})];
  }
  if(r.ended)return [];
  if(r.pending)return [action('resolvePending',['sell']),...r.bench.map((_,i)=>action('resolvePending',['replace',i])),...C.SLOTS.filter(s=>r.slots[s.id]).map(s=>action('resolvePending',['replace-slot',s.id]))];
  if(r.lastBattle)return [action('continueRun',[r.lastBattle.won?'next':'retry'])];
  if(r.offerMode==='ten-batch')return [action('confirmRecruitBatch',[r.offer.map(()=>true)]),action('confirmRecruitBatch',[r.offer.map(()=>false)])];
  if(r.batchQueue?.length)return [action('advanceRecruitBatch')];
  const out=[];
  if(r.offer.length){
    if(r.offerMode==='rewarded-s'||r.free>0||r.recruitCredits>0||r.cash>=C.recruitCost(r))out.push(...r.offer.map(id=>action('recruit',[id])));
    if(C.starterCount(r)===6&&(r.refreshFree>0||r.cash>=5))out.push(action('refreshOffer'));
    if(C.starterCount(r)<6)return out;
  }
  if(!r.offer.length&&(r.free>0||r.recruitCredits>0||r.cash>=C.recruitCost(r)))out.push(action('makeOffer'));
  if(C.starterCount(r)<6)return out;
  if(!r.offer.length&&r.cash>=C.recruitPackCost(r,10))out.push(action('buyRecruitPack',[10]));
  if(config.ads==='rewarded-success'&&!r.rewardedRecruitUsed)out.push(action('grantRewardedSOffer'));
  for(const id of Object.keys(r.owned))if(r.owned[id].train<C.trainingLimit(r,id)&&(r.endless||r.owned[id].trainedAt!==r.stage)&&r.cash>=C.trainingCost(r,id))out.push(action('train',[id]));
  for(let i=0;i<r.bench.length;i++){
    out.push(action('sellBench',[i]));
    for(const slot of C.SLOTS)out.push(action('swapPositions',[{kind:'bench',key:i},{kind:'slot',key:slot.id}]));
  }
  for(let i=0;i<C.SLOTS.length;i++)for(let j=i+1;j<C.SLOTS.length;j++)out.push(action('swapPositions',[{kind:'slot',key:C.SLOTS[i].id},{kind:'slot',key:C.SLOTS[j].id}]));
  if(r.cash>=10&&r.benchLimit<C.benchExpansionLimit(r))out.push(action('expandBench'));
  for(const id of r.gearReserve)out.push(action('equipGear',[id]));
  for(const id of [...r.gear,...r.gearReserve])out.push(action('sellGear',[id]));
  for(const id of r.shopOffers.gear){const g=C.GEAR.find(g=>g.id===id);if(C.gearAvailable(r,g)&&r.cash>=C.gearPrice(r,g)&&![...r.gear,...r.gearReserve,...r.gearSoldOffers].includes(id)&&!C.gearStorageFull(r,g))out.push(action('buyGear',[id]))}
  for(const id of r.shopOffers.boost){const b=C.BOOSTS.find(b=>b.id===id);if(r.cash>=C.boostPrice(r,b)&&!r.boostBoughtOffers.includes(id)&&r.boosts.filter(x=>x===id).length<C.boostPurchaseLimit(r))out.push(action('buyBoost',[id]))}
  for(const kind of ['gear','boost'])if(r.cash>=C.shopRefreshCost(r,kind))out.push(action('refreshShop',[kind]));
  for(const id of Object.keys(C.STRATEGIES))out.push(action('battle',[id]));
  return out;
}
function execute(C,game,op,config){
  const allowed=enumerate(C,game,config);
  // 十连的每张候选独立保留/出售，允许全部1024种选择而不展开行动树。
  const customBatch=op.name==='confirmRecruitBatch'&&game.run.offerMode==='ten-batch'&&Array.isArray(op.args[0])&&op.args[0].length===10&&op.args[0].every(x=>typeof x==='boolean');
  if(!customBatch&&!allowed.some(a=>a.name===op.name&&JSON.stringify(a.args)===JSON.stringify(op.args)))throw Error('Illegal action '+JSON.stringify(op));
  const result=C[op.name](gameActions.has(op.name)||op.name==='battle'?game:game.run,...op.args);
  if(result===false||result===null||result?.ok===false)throw Error('Core rejected '+JSON.stringify(op));
  return result;
}
function snapshot(C,game){
  const r=game.run,f=C.fused(r),foe=C.opponent(r);
  return {stage:r.stage,cash:r.cash,morale:r.morale,free:r.free,wins:r.wins,losses:r.losses,
    slots:clone(r.slots),bench:[...r.bench],owned:clone(r.owned),gear:[...r.gear],gearReserve:[...r.gearReserve],boosts:[...r.boosts],
    dimensions:clone(f.dimensions),stats:clone(f.stats),rating:f.rating,bonds:f.bonds.map(b=>b.id),
    opponent:{id:foe.id,name:foe.name,rating:foe.rating,stats:clone(foe.stats),dimensions:clone(foe.dimensions)},
    event:r.randomEvent?clone(r.randomEvent):null,eventBonuses:clone(r.eventState?.bonuses||{}),objectives:require('./objectives.cjs').completion(C,r)};
}
const deterministic=new Set(['recruit','resolvePending','train','swapPositions','sellBench','equipGear','sellGear','buyGear','buyBoost','expandBench']);
function metrics(C,game){const r=game.run,f=C.fused(r),income=C.incomeBreakdown(r),goal=require('./objectives.cjs').completion(C,r),items=r.gear.map(id=>C.GEAR.find(x=>x.id===id));return {rating:f.rating,bonds:f.bonds.length,cash:r.cash,income:income.victoryBase+income.lineupIncome+income.interest+f.bonds.reduce((s,b)=>s+(b.effect?.winCash||0),0)+items.reduce((s,g)=>s+(g.winCash||0)+(g.battleCash||0)+(g.shopDiscount||0)+(g.counterCash||0)/3+(g.lossCash||0)/3,0),heals:f.bonds.reduce((s,b)=>s+(b.effect?.winHeal||0)/(b.effect?.healEveryWins||1),0)+items.reduce((s,g)=>s+(g.healEveryWins?1/g.healEveryWins:0),0),saves:items.filter(x=>x.preventDefeat).length,members:goal.members,correctSlots:goal.correctSlots,jerseys:goal.jerseys}}
function observe(C,game,config){
  const r=game.run,visible=snapshot(C,game),before=metrics(C,game),actions=enumerate(C,game,config);
  const shortlist={};
  if(config.policy==='expert')for(const s of C.SLOTS){
    const wanted=require('./objectives.cjs').routeSlots[s.id];
    shortlist[s.id]=new Set(r.bench.map((id,i)=>({id,i,score:C.playerScore(C.BY_ID[id],r.owned[id],s.id,r)})).sort((a,b)=>b.score-a.score).filter((x,i)=>i<2||C.identityOf(x.id)===wanted).map(x=>x.i));
  }
  for(const a of actions){
    if(a.name==='recruit'){const p=C.BY_ID[a.args[0]];a.player={id:p.id,identity:C.identityOf(p.id),tier:p.tier,best:p.best,attrs:clone(p.attrs),duplicate:!!r.owned[p.id],stars:r.owned[p.id]?.stars||0,starLimit:C.starLimit(r,p.id)}}
    if(['buyGear','equipGear','sellGear'].includes(a.name)){const g=C.GEAR.find(g=>g.id===a.args[0]);a.item=clone(g)}
    const dominatedSwap=config.policy==='expert'&&a.name==='swapPositions'&&a.args[0].kind==='bench'&&!shortlist[a.args[1].key].has(a.args[0].key);
    const unusedTrain=config.policy==='expert'&&a.name==='train'&&r.bench.includes(a.args[0])&&!Object.values(require('./objectives.cjs').routeSlots).includes(C.identityOf(a.args[0]));
    if(deterministic.has(a.name)&&!dominatedSwap&&!unusedTrain){
      const copy={run:clone(r),profile:clone(game.profile)};C[a.name](copy.run,...a.args);const after=metrics(C,copy);
      a.delta=Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
      if(config.policy==='expert'&&a.name==='train'){
        const wanted=Object.entries(require('./objectives.cjs').routeSlots).find(([,id])=>id===C.identityOf(a.args[0]));
        const i=r.bench.indexOf(a.args[0]);
        if(wanted&&i>=0){
          const oldRun=clone(r),newRun=clone(copy.run);
          C.swapBench(oldRun,i,wanted[0]);C.swapBench(newRun,i,wanted[0]);
          a.futureSlotGain=C.fused(newRun).rating-C.fused(oldRun).rating;
        }
      }
      if(config.policy==='expert'&&a.name==='resolvePending'){
        // 只在候选已公开后，评估将该候选换入每个位置。
        let best=after.rating;
        const id=r.pending,i=copy.run.bench.indexOf(id);
        if(i>=0)for(const s of C.SLOTS){const x=clone(copy.run);C.swapBench(x,i,s.id);best=Math.max(best,C.fused(x).rating)}
        a.searchGain=best-before.rating;
      }
      if(config.policy==='expert'&&a.name==='recruit'&&!r.owned[a.args[0]]){
        // 仅搜索已知、无随机结果的下一步换位；不生成未来候选、不调用战斗抽签。
        let best=after.rating;
        const i=copy.run.bench.indexOf(a.args[0]);
        if(i>=0)for(const s of C.SLOTS){const x=clone(copy.run);if(C.swapBench(x,i,s.id))best=Math.max(best,C.fused(x).rating)}
        a.searchGain=best-before.rating;
      }
    }
  }
  // 只暴露当前事件的明示内容，不暴露战后快照、隐藏随机状态。
  visible.event=r.randomEvent?{id:r.randomEvent.id,stage:r.randomEvent.stage,successRate:r.randomEvent.successRate,result:clone(r.randomEvent.result)}:null;
  visible.free=r.free;visible.starterCount=C.starterCount(r);visible.recruitPrice=C.recruitCost(r);
  visible.benchLimit=r.benchLimit;visible.benchMax=C.benchExpansionLimit(r);visible.endless=r.endless;
  visible.identities=Object.fromEntries(Object.keys(r.owned).map(id=>[id,C.identityOf(id)]));
  visible.prices=Object.fromEntries(Object.keys(r.owned).map(id=>[id,C.trainingCost(r,id)]));
  visible.pending=r.pending;visible.offerMode=r.offerMode;visible.actions=actions;
  visible.strategies=Object.fromEntries(Object.entries(C.STRATEGIES).map(([id,s])=>[id,{name:s.name,description:s.description}]));
  return freeze(visible);
}
function freeze(o){if(o&&typeof o==='object'){Object.freeze(o);for(const x of Object.values(o))freeze(x)}return o}
module.exports={enumerate,execute,snapshot,observe};
