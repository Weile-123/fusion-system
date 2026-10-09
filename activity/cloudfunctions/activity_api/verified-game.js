'use strict';
const C=require('./game/game-core.js');
const crypto=require('crypto');
const actions=new Set(['makeOffer','ensureShop','buyRecruitPack','grantRewardedSOffer','recruit','confirmRecruitBatch','advanceRecruitBatch','resolvePending','swapPositions','sellBench','equipGear','expandBench','train','buyBoost','buyGear','replaceGear','sellGear','refreshShop','refreshOffer','continueRun','resolveRandomEvent','acknowledgeRandomEvent']);
function invalid(message='养成记录验证失败，请重新开局。'){throw Object.assign(new Error(message),{statusCode:409})}
function replay(state,operations,terminal,strategy){
  if(!state||!Array.isArray(operations)||operations.length>1500)invalid();
  const game=C.createGame();game.run=JSON.parse(JSON.stringify(state));
  for(const operation of operations){
    if(!operation||!actions.has(operation.action)||!Array.isArray(operation.args)||operation.args.length>3)invalid();
    const run=game.run,name=operation.action,args=operation.args;
    if(run.ended&&!(name==='acknowledgeRandomEvent'&&run.randomEvent?.result)||run.pending&&!['resolvePending'].includes(name)||run.lastBattle&&!['continueRun','resolveRandomEvent','acknowledgeRandomEvent'].includes(name))invalid();
    if(run.randomEvent&&!['resolveRandomEvent','acknowledgeRandomEvent'].includes(name))invalid();
    if(['resolveRandomEvent','acknowledgeRandomEvent'].includes(name)&&(!run.randomEvent||args[0]!==run.randomEvent.id))invalid();
    if(name==='resolveRandomEvent'&&(args.length!==2||!['main','safe'].includes(args[1])))invalid();
    if(name==='acknowledgeRandomEvent'&&args.length!==1)invalid();
    if(name==='makeOffer'&&(run.offer.length||C.starterCount(run)>=6&&!(run.recruitCredits>0)&&run.free<=0&&run.cash<C.recruitCost(run)))invalid();
    if(name==='buyRecruitPack'&&args[0]!==10)invalid();
    if(['train','recruit'].includes(name)&&(typeof args[0]!=='string'||!Object.hasOwn(C.BY_ID,args[0])))invalid();
    if(name==='refreshShop'&&!['boost','gear'].includes(args[0]||'boost'))invalid();
    if(name==='continueRun'&&(!run.lastBattle||!['next','retry','finish'].includes(args[0])))invalid();
    if(name==='continueRun'&&(run.lastBattle.won?!['next','finish'].includes(args[0]):args[0]!=='retry'))invalid();
    if(name==='continueRun'&&args[0]==='finish'&&(terminal!=='finish'||run.stage!==10))invalid();
    if(name==='confirmRecruitBatch'&&(!Array.isArray(args[0])||args[0].length!==10||args[0].some(value=>typeof value!=='boolean')))invalid();
    const before=JSON.stringify(run);
    const result=C[name](['continueRun','resolveRandomEvent','acknowledgeRandomEvent'].includes(name)?game:run,...args);
    if(result===false||result?.ok===false||before===JSON.stringify(run))invalid();
  }
  let report=null;
  if(terminal==='battle'){
    if(game.run.ended||game.run.lastBattle||game.run.pending||game.run.randomEvent||!Object.hasOwn(C.STRATEGIES,strategy))invalid();
    report=C.battle(game,strategy);if(!report)invalid();
  }else if(terminal==='finish'){
    if(!game.run.awarded)C.finishRun(game);
  }else if(terminal==='resume'){
    if(!C.reviveRun(game))invalid('当前对局不能复活。');
  }else invalid();
  return {state:game.run,report};
}
function digest(sequence,operations,terminal,strategy){return crypto.createHash('sha256').update(JSON.stringify({sequence,operations,terminal,strategy:strategy||''})).digest('hex')}
function progressCost(progress){
  if(!progress||typeof progress!=='object'||Array.isArray(progress))invalid('局外加成无效。');
  const keys=new Set([...C.META_UPGRADES.map(item=>item.id),'jerseyUnlocks']);
  if(Object.keys(progress).some(key=>!keys.has(key)))invalid('局外加成字段无效。');
  let cost=0;
  for(const item of C.META_UPGRADES){const level=progress[item.id]??0;if(!Number.isInteger(level)||level<0||level>item.prices.length)invalid('局外加成无效。');cost+=item.prices.slice(0,level).reduce((a,b)=>a+b,0)}
  const jerseys=progress.jerseyUnlocks??[];
  if(!Array.isArray(jerseys)||new Set(jerseys).size!==jerseys.length||jerseys.some(id=>!C.GEAR.some(item=>item.id===id&&item.unlockable)))invalid('球衣解锁记录无效。');
  return cost+jerseys.length*C.JERSEY_UNLOCK_PRICE;
}
function reconcileProgress(previous,requested,earned){
  const cost=progressCost(requested);progressCost(previous);
  for(const item of C.META_UPGRADES)if((requested[item.id]||0)<(previous[item.id]||0))invalid('局外加成与云端记录不一致。');
  if((previous.jerseyUnlocks||[]).some(id=>!(requested.jerseyUnlocks||[]).includes(id)))invalid('球衣解锁记录与云端不一致。');
  if(cost>earned)invalid('局外加成尚无已验证的传奇点记录；本局保留本地进度。');
  return cost;
}
module.exports={replay,digest,progressCost,reconcileProgress};
