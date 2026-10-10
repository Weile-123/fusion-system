/* 可复现随机事件状态机；前端与云函数共用。 */
(function(root){
  'use strict';
  const ALL_EVENTS=root.SupFusionEventData||(typeof require==='function'?require('./event-data.js'):null);
  const LEGACY_EVENTS=[{"id":"T01","name":"弧顶一千球","type":"T","category":"技巧较量","players":["curry"],"minStage":1,"afterLoss":false,"story":"散场后的球场只剩一盏灯，你照着库里的投篮影像反复校准弧顶出手，把远投变成单挑中可靠的一招。","attr":"three","dimension":"shooting","jersey":null,"cost":0,"rewardText":"投射威胁 +3～5% / +1%"},{"id":"T02","name":"碰撞后的第一步","type":"T","category":"技巧较量","players":["lebron"],"minStage":1,"afterLoss":true,"story":"你回看刚才被挡住的突破，再对照詹姆斯的启动影像练习压低重心；下一次碰撞后，你要继续踏出通向篮筐的第一步。","attr":"drive","dimension":"finishing","jersey":null,"cost":0,"rewardText":"禁区终结 +3～5% / +1%"},{"id":"T03","name":"左手试炼","type":"T","category":"技巧较量","players":["magic"],"minStage":1,"afterLoss":false,"story":"你暂停魔术师的一段持球影像，尝试只用左手藏住启动方向，再独自完成这次运球试炼。","attr":"handle","dimension":"creation","jersey":null,"cost":0,"rewardText":"持球创造 +3～5% / +1%"},{"id":"T04","name":"篮筐下的落点","type":"T","category":"技巧较量","players":["shaq"],"minStage":1,"afterLoss":false,"story":"你在篮下照着奥尼尔的低位影像练习占住落点，让陪练从不同角度贴近出手；熟悉篮下空间后，你要把这份判断用来封住终结路线。","attr":"inside","dimension":"rimStop","jersey":null,"cost":0,"rewardText":"护框强度 +3～5% / +1%"},{"id":"T05","name":"飞人的封线课","type":"T","category":"技巧较量","players":["jordan"],"minStage":1,"afterLoss":false,"story":"你暂停乔丹防守时横移的一帧，让陪练反复从侧翼启动；不伸手赌抢断，而是用一步滑动先封住突破方向。","attr":"def","dimension":"perimeterStop","jersey":null,"cost":0,"rewardText":"外线限制 +3～5% / +1%"},{"id":"T06","name":"水花的两种节奏","type":"T","category":"技巧较量","players":["curry","klay"],"minStage":1,"afterLoss":false,"story":"你回看水花搭档的出手影像，把持球后的远投与迅速收球投篮分别练成单挑招式，最后独自选择合适的节奏。","attr":"three","dimension":"shooting","jersey":null,"cost":0,"rewardText":"投射威胁 +5～7% / +1%"},{"id":"T07","name":"转身之前","type":"T","category":"技巧较量","players":["magic","kareem"],"minStage":1,"afterLoss":false,"story":"一段影像教你用眼神藏住方向，另一段教你用脚步保护收球；你要独自完成转身前的这次节奏变化。","attr":"handle","dimension":"creation","jersey":null,"cost":0,"rewardText":"持球创造 +5～7% / +1%"},{"id":"T08","name":"芝城镜像步","type":"T","category":"技巧较量","players":["jordan","pippen"],"minStage":1,"afterLoss":false,"story":"你把这对昔日搭档的试探与突破动作拆开练习，再让陪练识破第一步；第二次启动必须骗过同一双眼睛。","attr":"drive","dimension":"finishing","jersey":null,"cost":0,"rewardText":"禁区终结 +5～7% / +1%"},{"id":"T10","name":"魔鸟的预判笔记","type":"T","category":"技巧较量","players":["bird","magic"],"minStage":1,"afterLoss":false,"story":"你从这对老对手的交锋影像里寻找动作被识破的瞬间，练习在一对一防守中先读肩膀、再封路线。","attr":"def","dimension":"perimeterStop","jersey":null,"cost":0,"rewardText":"外线限制 +5～7% / +1%"},{"id":"T11","name":"篮筐前的最后一拍","type":"T","category":"技巧较量","players":["lebron","shaq"],"minStage":1,"afterLoss":false,"story":"你把追上突破者的速度与篮下等待的时机放在一起练习，要求自己最后一拍仍站在球与篮筐之间。","attr":"def","dimension":"rimStop","jersey":null,"cost":0,"rewardText":"护框强度 +5～7% / +1%"},{"id":"T12","name":"一秒拔起","type":"T","category":"技巧较量","players":["tmac"],"minStage":3,"afterLoss":false,"story":"旧影像里的干拔只有一瞬，你要在陪练贴身前完成收球、起跳和出手，才能接过那件1号球衣。","attr":"mid","dimension":"shooting","jersey":"tmac_magic_jersey","cost":0,"rewardText":"魔术·1号球衣 / 投射威胁 +1%"},{"id":"T13","name":"底角来信","type":"T","category":"技巧较量","players":["rayallen"],"minStage":3,"afterLoss":false,"story":"留在球场的一封信要求你从不同角度独自投进底角球，完成后便可领取20号球衣。","attr":"three","dimension":"shooting","jersey":"allen_celtics_jersey","cost":0,"rewardText":"凯尔特人·20号球衣 / 投射威胁 +1%"},{"id":"T14","name":"金鸡独立的平衡","type":"T","category":"技巧较量","players":["dirk"],"minStage":3,"afterLoss":false,"story":"你尝试把单脚后仰融入自己的单挑投篮，球衣保管人会看最后一次出手是否稳住。","attr":"mid","dimension":"shooting","jersey":"dirk_mavericks_jersey","cost":0,"rewardText":"独行侠·41号球衣 / 投射威胁 +1%"},{"id":"C01","name":"夜场擂台","type":"C","category":"单挑挑战","players":["jordan"],"minStage":5,"afterLoss":false,"story":"夜场擂主认出你的飞人式试探步，喊住正要离开的你，要求你用一次突破证明这招经得起贴身防守。","attr":"drive","dimension":"finishing","jersey":null,"cost":0,"rewardText":"禁区终结 +5%"},{"id":"C02","name":"一球封口","type":"C","category":"单挑挑战","players":["bird"],"minStage":1,"afterLoss":true,"story":"场边观众看见你练习伯德的投篮，却质疑刚才的失准；你可以接受一球定胜负，也可以离开。","attr":"three","dimension":"shooting","jersey":null,"cost":0,"rewardText":"投射威胁 +5%"},{"id":"C03","name":"铁闸通行证","type":"C","category":"单挑挑战","players":["duncan"],"minStage":3,"afterLoss":false,"story":"挑战者知道你学过邓肯的防守站位，要求你在半场守住他的突破，验证基本功能否变成单挑优势。","attr":"def","dimension":"perimeterStop","jersey":null,"cost":0,"rewardText":"外线限制 +5%"},{"id":"C04","name":"后仰对决","type":"C","category":"单挑挑战","players":["kobe"],"minStage":1,"afterLoss":false,"story":"一名老练的单挑客认出你练过科比的后仰，贴身压缩出手空间，要求你在干扰下完成这一球。","attr":"mid","dimension":"shooting","jersey":null,"cost":0,"rewardText":"投射威胁 +5%"},{"id":"C05","name":"低位重量","type":"C","category":"单挑挑战","players":["hakeem"],"minStage":1,"afterLoss":false,"story":"高大的挑战者要检验你的梦幻脚步，不许用远投解决这一球；你必须独自找到篮下转身终结的空间。","attr":"drive","dimension":"finishing","jersey":null,"cost":0,"rewardText":"禁区终结 +5%"},{"id":"C06","name":"一臂之内","type":"C","category":"单挑挑战","players":["russell"],"minStage":1,"afterLoss":false,"story":"你刚看完拉塞尔的防守影像，场边挑战者便标出一臂距离，要求你不抢断、不提前起跳，守住一次突破。","attr":"def","dimension":"perimeterStop","jersey":null,"cost":0,"rewardText":"外线限制 +5%"},{"id":"C07","name":"答案在脚下","type":"C","category":"单挑挑战","players":["iverson"],"minStage":3,"afterLoss":false,"story":"保管3号球衣的人让你先过掉眼前的贴身防守者，答案藏在第一次交叉步之后。","attr":"handle","dimension":null,"jersey":"iverson_sixers_jersey","cost":0,"rewardText":"76人·3号球衣"},{"id":"C08","name":"梦境转身","type":"C","category":"单挑挑战","players":["hakeem"],"minStage":3,"afterLoss":false,"story":"半场挑战者要求你在两次转身以内完成篮下终结，做到便交出珍藏的34号球衣。","attr":"drive","dimension":null,"jersey":"olajuwon_rockets_jersey","cost":0,"rewardText":"火箭·34号球衣"},{"id":"C09","name":"长臂下的出手","type":"C","category":"单挑挑战","players":["durant"],"minStage":3,"afterLoss":false,"story":"防守者高举双臂，要求你在有限的出手空间里完成一球，35号球衣就是这次试炼的奖品。","attr":"mid","dimension":null,"jersey":"durant_thunder_jersey","cost":0,"rewardText":"雷霆·35号球衣"},{"id":"P01","name":"球场补给摊","type":"P","category":"剧情抉择","players":[],"minStage":2,"afterLoss":false,"story":"管理员想在散场前摆一张补给桌，邀请你出一半成本，再用自己的招牌吸引观众。","attr":"handle","dimension":null,"jersey":null,"cost":5,"rewardText":"投入5：成功到账15（净赚10），失败本金损失 / 放弃，0收益"},{"id":"P02","name":"夜场灯光筹备","type":"P","category":"剧情抉择","players":[],"minStage":4,"afterLoss":false,"story":"场边商户愿意支持下一场夜间单挑，但先要你拿出场地准备金，并展示足够稳定的投篮。","attr":"three","dimension":null,"jersey":null,"cost":6,"rewardText":"投入6：成功到账18（净赚12），失败本金损失 / 放弃，0收益"},{"id":"P03","name":"单挑影像制作","type":"P","category":"剧情抉择","players":[],"minStage":6,"afterLoss":false,"story":"摄影师愿意制作你的单挑教学片，你需要先出制作费，再录出能卖得出去的持球演示。","attr":"handle","dimension":null,"jersey":null,"cost":8,"rewardText":"投入8：成功到账24（净赚16），失败本金损失 / 放弃，0收益"},{"id":"P05","name":"重写败局","type":"P","category":"剧情抉择","players":[],"minStage":1,"afterLoss":true,"story":"你想连夜改掉刚才的防守习惯，也可以只修正最明显的站位，给下次挑战留一点余地。","attr":"def","dimension":"perimeterStop","jersey":null,"cost":0,"rewardText":"全面复盘：外线限制 +3～5%，失败无奖励 / 修正站位：+1%"},{"id":"R01","name":"场边急救包","type":"R","category":"救援奇遇","players":[],"minStage":1,"afterLoss":false,"story":"管理员注意到你已经疲惫，拿出急救包和恢复补给，问你是否愿意付费处理再继续单挑。","attr":"handle","dimension":null,"jersey":null,"cost":8,"rewardText":"支付8：恢复1生命，最高3 / 暂不恢复：不扣钱"},{"id":"X01","name":"旧球场教学带","type":"X","category":"交易交换","players":[],"minStage":1,"afterLoss":false,"story":"看台下有人出售一盘旧教学带，内容专讲一对一的护球与节奏变化，观看权只需一笔奖金。","attr":"handle","dimension":"creation","jersey":null,"cost":6,"rewardText":"支付6：持球创造 +3% / 放弃：不扣钱"}];
  function buildSystem(C,legacy=false){
    const EVENTS=legacy?LEGACY_EVENTS:ALL_EVENTS;
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
      if(event.gear)return canReceiveGear(run,event.gear);
      if(legacy)return !event.dimension||(state.bonuses[event.dimension]||0)<15;
      return true;
    }
    function canReceiveGear(run,id){
      const item=C.GEAR.find(g=>g.id===id);if(!item||[...run.gear,...(run.gearReserve||[])].includes(id))return false;
      if(run.balanceRulesVersion>=5)return !C.gearStorageFull(run,item);
      return run.gear.length<(run.gearLimit||C.GEAR_LIMIT)&&!run.gear.some(id=>C.GEAR.find(g=>g.id===id)?.slot===item.slot);
    }
    function eventAbility(event,snapshot){
      const mean=members=>members.reduce((sum,m)=>sum+m.stats[event.attr],0)/members.length;
      const all=mean(snapshot.members),specified=event.players.length?mean(snapshot.members.filter(m=>event.players.includes(m.id))):all;
      return (all+specified)/2;
    }
    function eventDifficulty(stage){if(legacy)return stage<=3?80:stage<=7?105:stage<=10?125:125+(stage-10)*3;return stage<=3?70:stage<=7?85:stage<=10?100:Math.min(130,100+stage-10)}
    function eventChoices(run,pending){
      const event=byId[pending.id],kind=event.trialType||event.type;
      const amount=value=>legacy?Math.min(value,Math.max(0,15-(run.eventState.bonuses[event.dimension]||0))):value,dimension=C.COMBAT_LABELS[event.dimension];
      let main,safe,success,failure;
      if(event.gear){main='接受试用';success='获得 A级 '+C.GEAR.find(g=>g.id===event.gear).name;failure='无奖励'}
      else if(event.jersey){main=kind==='T'?'完成传承':'接受挑战';success='获得 '+C.GEAR.find(g=>g.id===event.jersey).name;failure=kind==='C'?'生命 -1':'无奖励'}
      else if(event.type==='R'){main='支付 8 奖金';success='恢复 1 生命（最高 3）';failure='';}
      else if(event.type==='X'){main='支付 6 奖金';success=dimension+' +'+amount(3)+'%';failure='';}
      else if(event.cost){main='投入 '+event.cost+' 奖金';success='到账 '+event.cost*3+'（净赚 '+event.cost*2+'）';failure='损失本金 '+event.cost;}
      else {main=kind==='C'?'接受挑战':event.id==='P05'?'全面复盘':'尝试突破';const range=kind==='C'?[5]:event.players.length===2?[5,6,7]:[3,4,5];const amounts=[...new Set(range.map(amount))];success=dimension+' +'+amounts[0]+(amounts.length>1?'～'+amounts.at(-1):'')+'%';failure=kind==='C'?'生命 -1':'无奖励';}
      const safeBonus=kind==='T'||event.id==='P05';
      safe=event.gear?'放弃试用':kind==='T'?'稳妥练习':event.id==='P05'?'修正站位':kind==='C'?'避开挑战':event.type==='R'?'暂不恢复':'放弃';
      const rescue=run.balanceRulesVersion>=5&&run.gear.some(id=>C.GEAR.find(g=>g.id===id)?.preventDefeat);
      return {main,safe,success,failure,safeReward:safeBonus?dimension+' +'+amount(1)+'%':'不扣费、无奖励',chance:!['R','X'].includes(event.type),fatal:kind==='C'&&run.morale===1&&!rescue};
    }
    function maybeTriggerEvent(game,choice){
      const run=game.run;if(!(run.balanceRulesVersion>=4)||!run.lastBattle||run.ended||choice==='finish'||run.randomEvent)return false;
      const snapshot=run.lastBattle.eventSnapshot;if(!snapshot||run.morale<=0)return false;
      const state=run.eventState||=fresh();if(snapshot.battle-state.lastBattle<2)return false;
      const candidates=EVENTS.filter(e=>eventEligible(run,e,snapshot));if(!candidates.length)return false;
      const chance=Math.min(.6,.3+.1*state.misses);
      if(C.nextRandom(run)>=chance){state.misses=Math.min(3,state.misses+1);return false}
      const event=candidates[Math.floor(C.nextRandom(run)*candidates.length)],ability=eventAbility(event,snapshot),difficulty=eventDifficulty(snapshot.stage);
      run.randomEvent={id:event.id,choice,stage:snapshot.stage,ability,difficulty,successRate:C.clamp((legacy?.65:.70)+(ability-difficulty)*(legacy?.02:.025),.35,.9),snapshot,result:null};
      state.seen.push(event.id);state.misses=0;state.lastBattle=snapshot.battle;
      game.profile.discoveredEvents=[...new Set([...(game.profile.discoveredEvents||[]),event.id])];
      return true;
    }
    function addBonus(run,key,amount){const state=run.eventState;const added=legacy?Math.min(amount,Math.max(0,15-(state.bonuses[key]||0))):amount;state.bonuses[key]=(state.bonuses[key]||0)+added;return added}
    function resolveRandomEvent(game,id,choice){
      const run=game?.run,pending=run?.randomEvent,event=byId[id],kind=event?.trialType||event?.type;
      if(!pending||!(run.balanceRulesVersion>=4)||pending.id!==id||pending.result||run.ended||!['main','safe'].includes(choice))return false;
      const result={choice,success:true,message:'已跳过，无损失。',cash:0,bonus:0,life:0,jersey:null,...(legacy?{}:{gear:null})};
      if(choice==='safe'){
        if(kind==='T'||event.id==='P05'){result.bonus=addBonus(run,event.dimension,1);result.message=C.COMBAT_LABELS[event.dimension]+' +'+result.bonus+'%'}
      }else{
        // 再次验证可变条件；seen 已在出现时记录，不在这里二次排除。
        if(run.cash<event.cost||event.jersey&&(!C.gearAvailable(run,C.GEAR.find(g=>g.id===event.jersey))||[...run.gear,...run.gearReserve].includes(event.jersey)||run.eventState.jerseys>=2)||event.type==='R'&&(run.morale>=3||run.eventState.recovered))return false;
        if(event.gear&&!canReceiveGear(run,event.gear))return false;
        run.cash-=event.cost;result.cash=-event.cost;
        run.stats.eventSpending=(run.stats.eventSpending||0)+event.cost;
        result.success=['R','X'].includes(event.type)||C.nextRandom(run)<pending.successRate;
        if(result.success){
          if(event.gear){const item=C.GEAR.find(g=>g.id===event.gear),occupied=run.gear.some(id=>C.GEAR.find(g=>g.id===id)?.slot===item.slot);(occupied||run.gear.length>=(run.gearLimit||C.GEAR_LIMIT)?run.gearReserve:run.gear).push(event.gear);result.gear=event.gear;result.message='获得 A级 '+C.GEAR.find(g=>g.id===event.gear).name}
          else if(event.jersey){
            const occupied=run.gear.some(id=>C.GEAR.find(g=>g.id===id)?.slot==='球衣');
            (occupied||run.gear.length>=(run.gearLimit||C.GEAR_LIMIT)?run.gearReserve:run.gear).push(event.jersey);
            run.collectedJerseys=[...new Set([...run.collectedJerseys,event.jersey])];run.eventState.jerseys++;result.jersey=event.jersey;result.message='获得 '+C.GEAR.find(g=>g.id===event.jersey).name;
          }else if(event.type==='R'){run.morale=Math.min(3,run.morale+1);run.eventState.recovered=true;result.life=1;result.message='生命 +1'}
          else if(event.cost&&event.type==='P'){run.cash+=event.cost*3;run.stats.eventIncome=(run.stats.eventIncome||0)+event.cost*3;result.cash=event.cost*2;result.message='到账 '+event.cost*3+' 奖金（净赚 '+result.cash+'）'}
          else {const reward=event.type==='X'?3:kind==='C'?5:(event.players.length===2?5:3)+Math.floor(C.nextRandom(run)*3);result.bonus=addBonus(run,event.dimension,reward);result.message=C.COMBAT_LABELS[event.dimension]+' +'+result.bonus+'%'}
        }else {if(kind==='C'){run.morale=Math.max(0,run.morale-1);result.life=-1}result.message=kind==='C'?'挑战失败，生命 -1':event.cost?'投资失败，损失本金 '+event.cost:'练习未成功，无奖励'}
      }
      const rescued=C.preventGearDefeat(run);if(rescued){result.consumedGear=rescued.id;result.life=0;result.message+='；'+rescued.name+'已消耗，生命恢复至1点'}
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
      run.eventState={seen:[...new Set((Array.isArray(state.seen)?state.seen:[]).filter(valid))],misses:number(state.misses,3),lastBattle:Number.isInteger(state.lastBattle)?state.lastBattle:-2,bonuses:Object.fromEntries(Object.keys(C.COMBAT_LABELS).map(k=>[k,number(state.bonuses?.[k],legacy?15:Number.MAX_SAFE_INTEGER)])),jerseys:number(state.jerseys,2),recovered:state.recovered===true};
      const p=source.randomEvent;
      if(p&&valid(p.id)&&['next','retry'].includes(p.choice)&&p.snapshot?.members?.length===6&&p.snapshot.members.every(m=>Object.hasOwn(C.BY_ID,m.id)&&C.ATTRS.every(attr=>Number.isFinite(m.stats?.[attr])))&&Number.isFinite(p.ability)&&Number.isFinite(p.difficulty)&&Number.isFinite(p.successRate)){
        run.randomEvent=JSON.parse(JSON.stringify(p));run.randomEvent.successRate=C.clamp(p.successRate,.35,.9);
      }
    }
    return {EVENTS,EVENT_BY_ID:byId,eventBattleSnapshot,eventChoices,eventEligible,eventAbility,eventDifficulty,maybeTriggerEvent,resolveRandomEvent,acknowledgeRandomEvent,restoreEventState};
  }
  function createSystem(C){
    const current=buildSystem(C),old=buildSystem(C,true);
    for(const name of ['eventBattleSnapshot','eventChoices','eventEligible','maybeTriggerEvent','resolveRandomEvent','acknowledgeRandomEvent','restoreEventState']){
      const modern=current[name];current[name]=function(first,...args){const run=first?.run||first;return (run?.balanceRulesVersion<5?old[name]:modern)(first,...args)};
    }
    return current;
  }
  const api={createSystem};if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SupFusionEventSystem=api;
})(typeof window!=='undefined'?window:globalThis);
