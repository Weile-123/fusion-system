'use strict';
const {performance}=require('node:perf_hooks');
const fs=require('node:fs'),path=require('node:path');
const {C,clone,hash,manifest,normalize,initialize,assertState,loadBrowserCore}=require('./engine.cjs');
const {execute,snapshot,observe}=require('./driver.cjs');
const {createPolicy}=require('./policies.cjs');
function simulate(options={},core=C){
  const config=normalize(options),policy=createPolicy(config.policy,config.policySeed??(config.seed^0xc8013ea4));
  const started=performance.now(),{game,talentOffer,chosen}=initialize(core,config),initialGame=clone(game),journal=[],battles=[],events=[];
  let status='running',limit=null,error=null,actionsSinceBattle=0,highestAttempted=0,highestCleared=0,deathCause=null;
  const record={schemaVersion:2,policyVersion:2,config,mode:config.scenario?'scenario':'legal',sourceHashes:manifest(),rulesVersion:game.run.balanceRulesVersion||1,talentOffer,chosen,initialGame,journal,battles,events,states:[]};
  const onStep=options.onStep;delete config.onStep;
  try{
    assertState(core,game.run);
    while(status==='running'){
      const r=game.run;
      if(r.ended&&!r.randomEvent){status='death';break}
      if(!r.lastBattle&&!r.randomEvent&&r.stage>config.maxStage){status='censored';limit='stage';break}
      if(battles.length>=config.maxBattles&&!r.lastBattle&&!r.randomEvent){status='censored';limit='battles';break}
      if(performance.now()-started>=config.maxMs){status='censored';limit='time';break}
      if(journal.length>=config.maxActions||actionsSinceBattle>=config.maxActionsPerBattle){status='censored';limit='actions';break}
      const observation=observe(core,game,config),op=policy.choose(observation);
      const before=snapshot(core,game),beforeHash=hash(game),rngBefore=r.rng;
      const result=execute(core,game,op,config);assertState(core,game.run);
      const after=snapshot(core,game),row={index:journal.length,name:op.name,args:clone(op.args),stage:before.stage,beforeHash,afterHash:hash(game),rngBefore,rngAfter:r.rng,
        resources:{cashBefore:before.cash,cashAfter:after.cash,cashDelta:after.cash-before.cash,moraleBefore:before.morale,moraleAfter:after.morale,freeBefore:before.free,freeAfter:after.free},
        before,after};
      if(before.morale>0&&after.morale===0)deathCause=op.name==='resolveRandomEvent'?'event':'battle';
      if(op.name==='battle'){
        row.result=clone(result);battles.push({attempt:battles.length+1,...clone(result),before,after});
        highestAttempted=Math.max(highestAttempted,result.stage);if(result.won)highestCleared=Math.max(highestCleared,result.stage);
        policy.learn({beats:result.beats});actionsSinceBattle=0;
      }else actionsSinceBattle++;
      if(op.name==='resolveRandomEvent')events.push({id:op.args[0],stage:before.stage,choice:op.args[1],successRate:before.event.successRate,result:clone(result)});
      journal.push(row);record.states.push(clone(game.run));if(onStep)onStep({op,result,game,row,initialGame});
    }
  }catch(e){status='error';error={message:e.message,stack:e.stack}}
  record.outcome={status,limit,error,highestAttempted,highestCleared,stage:game.run.stage,battles:battles.length,actions:journal.length,wins:game.run.wins,losses:game.run.losses,
    finalCash:game.run.cash,finalMorale:game.run.morale,terminalCause:status==='death'?deathCause:null,elapsedMs:Math.round(performance.now()-started),finalHash:hash(game)};
  record.finalGame=clone(game);return record;
}
function replay(record,core=C){
  if(JSON.stringify(record.sourceHashes)!==JSON.stringify(manifest()))throw Error('Core files changed since recording');
  const game=clone(record.initialGame);
  for(const row of record.journal){
    if(hash(game)!==row.beforeHash)throw Error('Replay before mismatch at '+row.index);
    const result=execute(core,game,{name:row.name,args:row.args},record.config);
    if(row.result&&JSON.stringify(result)!==JSON.stringify(row.result))throw Error('Battle mismatch at '+row.index);
    assertState(core,game.run);if(hash(game)!==row.afterHash)throw Error('Replay after mismatch at '+row.index);
  }
  return {match:hash(game)===record.outcome.finalHash,steps:record.journal.length,battles:record.battles.length};
}
function validate(record){
  const browser=replay(record,loadBrowserCore()),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
  const cloudCore=require('../activity/cloudfunctions/activity_api/game/game-core.js'),shadow=clone(record.initialGame);
  let state=clone(record.initialGame.run),operations=[],steps=0,battles=0;
  for(const row of record.journal){
    execute(cloudCore,shadow,{name:row.name,args:row.args},record.config);
    if(hash(shadow)!==row.afterHash)throw Error('Cloud per-action mismatch '+row.index);
    if(row.name==='battle'){
      const checked=V.replay(state,operations,'battle',row.args[0]);
      if(JSON.stringify(checked.state)!==JSON.stringify(stateAfter(record,row.index)))throw Error('Cloud battle state mismatch '+row.index);
      if(JSON.stringify(checked.report)!==JSON.stringify(row.result))throw Error('Cloud report mismatch '+row.index);
      state=clone(checked.state);operations=[];battles++;
    }else{
      operations.push({action:row.name,args:row.args});
      // 结算、事件也即时重放；允许最后的确认动作处理死亡事件。
      const terminal=row.after.morale===0?'finish':'battle';
      if(row.name==='acknowledgeRandomEvent'&&row.after.morale===0){
        const checked=V.replay(state,operations,'finish');state=clone(checked.state);operations=[];
        if(JSON.stringify(state)!==JSON.stringify(stateAfter(record,row.index)))throw Error('Cloud event death mismatch');
      }else if(terminal==='finish'){
        const checked=V.replay(state,operations,'finish');state=clone(checked.state);operations=[];
        if(JSON.stringify(state)!==JSON.stringify(stateAfter(record,row.index)))throw Error('Cloud finish mismatch');
      }
    }
    steps++;
  }
  // 将最终尚未进入下一战的操作通过独立核心回放核对，避免强行增加一场战斗。
  if(operations.length){const g={run:clone(state),profile:cloudCore.createGame().profile};for(const op of operations)execute(cloudCore,g,{name:op.action,args:op.args},record.config);if(JSON.stringify(g.run)!==JSON.stringify(record.finalGame.run))throw Error('Cloud tail mismatch')}
  return {browserGlobal:browser,cloud:{match:true,steps,battles}};
}
function stateAfter(record,index){
  // 私有完整状态单独保存，逐步一致性无需重新构造或猜测字段。
  return record.states?.[index];
}
function writeRecord(record,file){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');return file}
module.exports={simulate,replay,validate,writeRecord};
