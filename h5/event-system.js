/* 可复现随机事件状态机；前端与云函数共用。 */
(function(root){
  'use strict';
  const EVENTS=root.SupFusionEventData||(typeof require==='function'?require('./event-data.js'):null);
  function createSystem(C){
    const byId=Object.fromEntries(EVENTS.map(e=>[e.id,e]));
    const fresh=()=>({seen:[],misses:0,lastBattle:-2,bonuses:{},jerseys:0,recovered:false});
    function eventBattleSnapshot(run){
      const members=C.SLOTS.map(slot=>{const id=run.slots[slot.id];return {id:C.identityOf(id),stats:Object.fromEntries(C.ATTRS.map(attr=>[attr,C.playerScore(C.BY_ID[id],run.owned[id],attr,run)]))}});
      return {members,stage:run.stage,battle:run.wins+run.losses};
    }
    function eventEligible(run,event,snapshot){
      if(!snapshot||snapshot.members.length!==6||snapshot.stage<event.minStage||event.players.some(id=>!snapshot.members.some(m=>m.id===id)))return false;
      if(event.afterLoss&&run.lastBattle?.won!==false)return false;
      const state=run.eventState;
      if(state.seen.includes(event.id)||run.cash<event.cost)return false;
      if(event.type==='R')return run.morale>0&&run.morale<3&&!state.recovered;
      if(event.jersey)return state.jerseys<2&&C.gearAvailable(run,C.GEAR.find(g=>g.id===event.jersey))&&![...run.gear,...run.gearReserve].includes(event.jersey);
      return !event.dimension||(state.bonuses[event.dimension]||0)<15;
    }
    function eventAbility(event,snapshot){
      const mean=members=>members.reduce((sum,m)=>sum+m.stats[event.attr],0)/members.length;
      const all=mean(snapshot.members),specified=event.players.length?mean(snapshot.members.filter(m=>event.players.includes(m.id))):all;
      return (all+specified)/2;
    }
    function eventDifficulty(stage){return stage<=3?80:stage<=7?105:stage<=10?125:125+(stage-10)*3}
    function eventChoices(run,pending){
      const event=byId[pending.id],remaining=event.dimension?Math.max(0,15-(run.eventState.bonuses[event.dimension]||0)):0;
      const amount=value=>Math.min(value,remaining),dimension=C.COMBAT_LABELS[event.dimension];
      let main,safe,success,failure;
      if(event.jersey){main=event.type==='T'?'完成传承':'接受挑战';success='获得 '+C.GEAR.find(g=>g.id===event.jersey).name;failure=event.type==='C'?'生命 -1':'无奖励'}
      else if(event.type==='R'){main='支付 8 奖金';success='恢复 1 生命（最高 3）';failure='';}
      else if(event.type==='X'){main='支付 6 奖金';success=dimension+' +'+amount(3)+'%';failure='';}
      else if(event.cost){main='投入 '+event.cost+' 奖金';success='到账 '+event.cost*3+'（净赚 '+event.cost*2+'）';failure='损失本金 '+event.cost;}
      else {main=event.type==='C'?'接受挑战':event.id==='P05'?'全面复盘':'尝试突破';const range=event.type==='C'?[5]:event.players.length===2?[5,6,7]:[3,4,5];const amounts=[...new Set(range.map(amount))];success=dimension+' +'+amounts[0]+(amounts.length>1?'～'+amounts.at(-1):'')+'%';failure=event.type==='C'?'生命 -1':'无奖励';}
      const safeBonus=event.type==='T'||event.id==='P05';
      safe=event.type==='T'?'稳妥练习':event.id==='P05'?'修正站位':event.type==='C'?'避开挑战':event.type==='R'?'暂不恢复':'放弃';
      return {main,safe,success,failure,safeReward:safeBonus?dimension+' +'+amount(1)+'%':'不扣费、无奖励',chance:!['R','X'].includes(event.type),fatal:event.type==='C'&&run.morale===1};
    }
    function maybeTriggerEvent(game,choice){
      const run=game.run;if(!(run.balanceRulesVersion>=4)||!run.lastBattle||run.ended||choice==='finish'||run.randomEvent)return false;
      const snapshot=run.lastBattle.eventSnapshot;if(!snapshot||run.morale<=0)return false;
      const state=run.eventState||=fresh();if(snapshot.battle-state.lastBattle<2)return false;
      const candidates=EVENTS.filter(e=>eventEligible(run,e,snapshot));if(!candidates.length)return false;
      const chance=Math.min(.6,.3+.1*state.misses);
      if(C.nextRandom(run)>=chance){state.misses=Math.min(3,state.misses+1);return false}
      const event=candidates[Math.floor(C.nextRandom(run)*candidates.length)],ability=eventAbility(event,snapshot),difficulty=eventDifficulty(snapshot.stage);
      run.randomEvent={id:event.id,choice,stage:snapshot.stage,ability,difficulty,successRate:C.clamp(.65+(ability-difficulty)*.02,.35,.9),snapshot,result:null};
      state.seen.push(event.id);state.misses=0;state.lastBattle=snapshot.battle;
      game.profile.discoveredEvents=[...new Set([...(game.profile.discoveredEvents||[]),event.id])];
      return true;
    }
    function addBonus(run,key,amount){const state=run.eventState;const added=Math.min(amount,Math.max(0,15-(state.bonuses[key]||0)));state.bonuses[key]=(state.bonuses[key]||0)+added;return added}
    function resolveRandomEvent(game,id,choice){
      const run=game?.run,pending=run?.randomEvent,event=byId[id];
      if(!pending||!(run.balanceRulesVersion>=4)||pending.id!==id||pending.result||run.ended||!['main','safe'].includes(choice))return false;
      const result={choice,success:true,message:'已跳过，无损失。',cash:0,bonus:0,life:0,jersey:null};
      if(choice==='safe'){
        if(event.type==='T'||event.id==='P05'){result.bonus=addBonus(run,event.dimension,1);result.message=C.COMBAT_LABELS[event.dimension]+' +'+result.bonus+'%'}
      }else{
        // 再次验证可变条件；seen 已在出现时记录，不在这里二次排除。
        if(run.cash<event.cost||event.jersey&&(!C.gearAvailable(run,C.GEAR.find(g=>g.id===event.jersey))||[...run.gear,...run.gearReserve].includes(event.jersey)||run.eventState.jerseys>=2)||event.type==='R'&&(run.morale>=3||run.eventState.recovered))return false;
        run.cash-=event.cost;result.cash=-event.cost;
        run.stats.eventSpending=(run.stats.eventSpending||0)+event.cost;
        result.success=['R','X'].includes(event.type)||C.nextRandom(run)<pending.successRate;
        if(result.success){
          if(event.jersey){
            const occupied=run.gear.some(id=>C.GEAR.find(g=>g.id===id)?.slot==='球衣');
            (occupied||run.gear.length>=(run.gearLimit||C.GEAR_LIMIT)?run.gearReserve:run.gear).push(event.jersey);
            run.collectedJerseys=[...new Set([...run.collectedJerseys,event.jersey])];run.eventState.jerseys++;result.jersey=event.jersey;result.message='获得 '+C.GEAR.find(g=>g.id===event.jersey).name;
          }else if(event.type==='R'){run.morale=Math.min(3,run.morale+1);run.eventState.recovered=true;result.life=1;result.message='生命 +1'}
          else if(event.cost&&event.type==='P'){run.cash+=event.cost*3;run.stats.eventIncome=(run.stats.eventIncome||0)+event.cost*3;result.cash=event.cost*2;result.message='到账 '+event.cost*3+' 奖金（净赚 '+result.cash+'）'}
          else {const reward=event.type==='X'?3:event.type==='C'?5:(event.players.length===2?5:3)+Math.floor(C.nextRandom(run)*3);result.bonus=addBonus(run,event.dimension,reward);result.message=C.COMBAT_LABELS[event.dimension]+' +'+result.bonus+'%'}
        }else {if(event.type==='C'){run.morale=Math.max(0,run.morale-1);result.life=-1}result.message=event.type==='C'?'挑战失败，生命 -1':event.cost?'投资失败，损失本金 '+event.cost:'练习未成功，无奖励'}
      }
      pending.result=result;
      if(run.morale<=0)run.lastBattle.legendEarned=C.finishRun(game);
      return result;
    }
    function acknowledgeRandomEvent(game,id){
      const run=game?.run,pending=run?.randomEvent;if(!pending||!(run.balanceRulesVersion>=4)||pending.id!==id||!pending.result)return false;
      run.randomEvent=null;if(!run.ended)C.advanceAfterBattle(game,pending.choice);return true;
    }
    function restoreEventState(run,source){
      if(!(run.balanceRulesVersion>=4))return;
      const state=source.eventState||{},valid=id=>Object.hasOwn(byId,id),number=(n,max,fallback=0)=>Number.isFinite(n)?C.clamp(n,0,max):fallback;
      run.eventState={seen:[...new Set((Array.isArray(state.seen)?state.seen:[]).filter(valid))],misses:number(state.misses,3),lastBattle:Number.isInteger(state.lastBattle)?state.lastBattle:-2,bonuses:Object.fromEntries(Object.keys(C.COMBAT_LABELS).map(k=>[k,number(state.bonuses?.[k],15)])),jerseys:number(state.jerseys,2),recovered:state.recovered===true};
      const p=source.randomEvent;
      if(p&&valid(p.id)&&['next','retry'].includes(p.choice)&&p.snapshot?.members?.length===6&&p.snapshot.members.every(m=>Object.hasOwn(C.BY_ID,m.id)&&C.ATTRS.every(attr=>Number.isFinite(m.stats?.[attr])))&&Number.isFinite(p.ability)&&Number.isFinite(p.difficulty)&&Number.isFinite(p.successRate)){
        run.randomEvent=JSON.parse(JSON.stringify(p));run.randomEvent.successRate=C.clamp(p.successRate,.35,.9);
      }
    }
    return {EVENTS,EVENT_BY_ID:byId,eventBattleSnapshot,eventChoices,eventEligible,eventAbility,eventDifficulty,maybeTriggerEvent,resolveRandomEvent,acknowledgeRandomEvent,restoreEventState};
  }
  const api={createSystem};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SupFusionEventSystem=api;
})(typeof window!=='undefined'?window:globalThis);
