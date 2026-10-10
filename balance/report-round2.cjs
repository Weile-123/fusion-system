'use strict';
const fs=require('node:fs'),path=require('node:path');
const {C,manifest}=require('./engine.cjs');
const {groups}=require('./suite.cjs');
const {completion,routeSlots,routeBench,profileFor}=require('./objectives.cjs');
const {validate}=require('./runner.cjs');
const dir=path.resolve('artifacts/balance/batch-2000-20261010-v3'),out=path.join(dir,'analysis');
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const q=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1]:null;
const pct=x=>x==null?'无样本':(100*x).toFixed(1)+'%';
const fmt=x=>x==null?'无样本':Number.isFinite(x)?x.toFixed(1):'未知';
const table=(h,rows)=>'| '+h.join(' | ')+' |\n| '+h.map(()=> '---').join(' | ')+' |\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n');
function csv(file,rows){const keys=[...new Set(rows.flatMap(x=>Object.keys(x)))],quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';fs.writeFileSync(path.join(out,file),'\uFEFF'+keys.map(quote).join(',')+'\n'+rows.map(r=>keys.map(k=>quote(r[k])).join(',')).join('\n')+'\n')}
function wilson(w,n){if(!n)return [null,null];const z=1.96,p=w/n,d=1+z*z/n,m=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [m-h,m+h]}
function evidenceSummary(summaries,stageRows,goalRows){
  const full=summaries.find(x=>x.id==='expert-full'),at50=stageRows.find(x=>x.group==='expert-full'&&x.stage===50);
  return `### 最值得关注的实际问题\n\n- **局外成长对入门成绩影响很大。**同一高手策略，零成长主线通关${pct(summaries[2].mainClears/400)}，满成长${pct(full.mainClears/400)}。这说明账号成长的作用明显；不能因此要求新玩家也达到满成长账号的成绩，也不能把差异全部归因于某一个天赋。\n- **本轮主要压力在构筑完成与40～60关生存。**满成长高手只有${full.everRoute}/400局完成路线1。${at50?.reached?`第50关有${at50.reached}局到达，平均玩家面板${fmt(at50.meanPlayer)}、对手${fmt(at50.meanEnemy)}，首次出战胜率${pct(at50.firstWinRate)}。对这些实际阵容而言，对手已经占优，并没有出现后期一直轻松碾压的结果。`:'第50关没有足够战绩可评价。'}是否打断了“阵容成型后的爽玩”，还需结合下面的成型者战绩及星级、训练进度判断，不能把未成型者一起当作完美阵容。\n- **奖金使用仍是策略限制。**新手/普通死亡时剩余奖金中位数为${summaries[0].medianCash}/${summaries[1].medianCash}；高手零/半/满为${summaries.slice(2).map(x=>x.medianCash).join('/')}。新手和普通策略没有取得球衣，说明其当前收益估值未覆盖球衣的收藏价值。其低成绩包含资源分配不足，不能直接证明正式经济必然不够用。\n- **结论范围。**本批无人通关100关，100～500关没有实际战斗覆盖；本批没有发现持续到500关的滚雪球案例，也没有证明这类案例不存在。${summaries.every(x=>x.allTargets===0)?'全部量化目标同时完成的自然样本为0，无法回答满星满训完美构筑的最终极限。':''}本轮只测规则6的新开局，不覆盖旧存档和旧榜单中的构筑。\n\n**我的判断：局外成长带来的变强是清楚的；新账号入门、路线1成型机会和成型后的体验仍有疑点。目前适合继续做针对性策略对照，不适合宣称已经完成全面平衡，也不应仅凭这些有限AI成绩直接下调关卡。**\n\n`;
}
function main(){
  fs.mkdirSync(out,{recursive:true});const hashes=manifest(),summaries=[],runRows=[],stageRows=[],events=new Map(),usage=new Map(),checks=[],ledger=[],goalRows=[],anomalies=[],alignment=[];
  let actions=0,battles=0,eventCount=0;const maxCases=[];
  for(const g of groups){
    const batch=JSON.parse(fs.readFileSync(path.join(dir,g.id,'summary.json'),'utf8'));if(batch.runs.length!==400)throw Error('Incomplete '+g.id);
    const rows=[],stages=new Map(),resources=new Map();let strongest=null;
    const getStage=s=>{if(!stages.has(s))stages.set(s,{group:g.id,stage:s,attempts:0,wins:0,firstWins:0,reached:0,deaths:0,ratings:[],foes:[],ratios:[],growth:[],playerDims:{},enemyDims:{}});return stages.get(s)};
    for(const entry of batch.runs){
      const r=JSON.parse(fs.readFileSync(entry.file,'utf8')),o=r.outcome;
      if(r.sourceHashes&&JSON.stringify(r.sourceHashes)!==JSON.stringify(hashes))throw Error('Source mismatch '+entry.file);
      if(r.config.policy!==g.policy||r.config.growthLevel!==g.growthLevel)throw Error('Group mismatch');
      const row={group:g.id,seed:r.config.seed,file:entry.file,...o,partial:!!r.partial};rows.push(row);runRows.push(row);
      if(r.partial||o.status==='error'){anomalies.push({group:g.id,seed:r.config.seed,status:o.status,limit:o.limit,error:o.error});continue}
      const goal=completion(C,r.finalGame.run);Object.assign(row,goal);
      let reachedGoal=false,starGoal=false,firstRoute=null,firstFullStars=null,maxJerseys=0,maxMembers=0,maxRating=0,routeCorrect=0,everSixGear=false,everAllJerseys=false,allTargets=false,maxTrained=0,first=new Map(),cashNet=0;
      for(const j of r.journal){
        cashNet+=j.resources.cashDelta;
        const a=resources.get(j.name)||{group:g.id,action:j.name,count:0,income:0,spent:0};a.count++;a.income+=Math.max(0,j.resources.cashDelta);a.spent+=Math.max(0,-j.resources.cashDelta);resources.set(j.name,a);
        const x=j.after.objectives;maxJerseys=Math.max(maxJerseys,x.jerseys);maxMembers=Math.max(maxMembers,x.members);routeCorrect=Math.max(routeCorrect,x.correctSlots);everSixGear||=x.equipmentSlots===6;everAllJerseys||=x.jerseysComplete;maxTrained=Math.max(maxTrained,x.trainedStarters);
        if(x.routeComplete&&!reachedGoal){reachedGoal=true;firstRoute=j.stage}
        if(j.after.stage>10&&x.maxStarMembers===16&&!starGoal){starGoal=true;firstFullStars=j.stage}
        if(j.after.stage>10&&x.routeComplete&&x.maxStarMembers===16&&x.trainedStarters===6&&x.jerseysComplete&&x.equipmentSlots===6)allTargets=true;
      }
      if(Math.abs(r.initialGame.run.cash+cashNet-o.finalCash)>1e-7)throw Error('Cash ledger mismatch');
      Object.assign(row,{everRoute:reachedGoal,everAllStars:starGoal,firstRoute,firstFullStars,maxJerseys,maxMembers,maxCorrectSlots:routeCorrect,everSixGear,everAllJerseys,maxTrained,allTargets});
      goalRows.push({group:g.id,seed:r.config.seed,highestCleared:o.highestCleared,...goal,everRoute:reachedGoal,firstRoute,everAllStars:starGoal,firstFullStars,maxJerseys,maxMembers,maxCorrectSlots:routeCorrect,everSixGear,everAllJerseys,maxTrained,allTargets});
      actions+=r.journal.length;battles+=r.battles.length;eventCount+=r.events.length;
      for(const b of r.battles){
        maxRating=Math.max(maxRating,b.rating);const s=getStage(b.stage);s.attempts++;s.wins+=+b.won;
        if(!first.has(b.stage)){first.set(b.stage,b);s.reached++;s.firstWins+=+b.won;s.ratings.push(b.before.rating);s.foes.push(b.foeRating);s.ratios.push(b.before.rating/b.foeRating);const prev=first.get(b.stage-1);if(prev)s.growth.push((b.before.rating-prev.before.rating)/prev.before.rating);
          for(const [k,v] of Object.entries(b.before.dimensions)){(s.playerDims[k]||=[]).push(v);(s.enemyDims[k]||=[]).push(b.before.opponent.dimensions[k])}
        }
        for(const [kind,ids] of [['player',Object.keys(b.before.owned)],['gear',[...b.before.gear,...b.before.gearReserve]],['bond',b.before.bonds]])for(const id of new Set(ids)){
          const key=g.id+':'+kind+':'+id,x=usage.get(key)||{group:g.id,kind,id,runs:new Set(),battles:0,wins:0,stageSum:0};x.runs.add(r.config.seed);x.battles++;x.wins+=+b.won;x.stageSum+=b.stage;usage.set(key,x);
        }
      }
      if(o.status==='death'&&o.terminalCause==='battle')getStage(o.stage).deaths++;
      for(const e of r.events){const key=g.id+':'+e.id,x=events.get(key)||{group:g.id,id:e.id,name:C.EVENTS.find(x=>x.id===e.id)?.name,count:0,main:0,success:0,safe:0};x.count++;x.main+=+(e.choice==='main');x.success+=+(e.choice==='main'&&e.result.success);x.safe+=+(e.choice==='safe');events.set(key,x)}
      row.maxRating=maxRating;
      if(g.policy==='expert'){
        const j=r.journal.findLast(x=>x.name==='battle');
        if(j&&j.index>0){
          const trial=JSON.parse(JSON.stringify(r.states[j.index-1])),owned=Object.keys(trial.owned);
          const choices=Object.entries(routeSlots).map(([slot,id])=>({slot,id,candidate:owned.filter(x=>C.identityOf(x)===id).sort((a,b)=>C.playerScore(C.BY_ID[b],trial.owned[b],slot,trial)-C.playerScore(C.BY_ID[a],trial.owned[a],slot,trial))[0]}));
          if(choices.every(x=>x.candidate)){
            const before=C.fused(trial).rating;let swaps=0;
            for(const {slot,candidate} of choices){if(trial.slots[slot]===candidate)continue;const from=trial.bench.includes(candidate)?{kind:'bench',key:trial.bench.indexOf(candidate)}:{kind:'slot',key:Object.keys(trial.slots).find(s=>trial.slots[s]===candidate)};
              if(!C.swapPositions(trial,from,{kind:'slot',key:slot}))throw Error('Illegal alignment diagnostic');swaps++;
            }
            alignment.push({group:g.id,seed:r.config.seed,stage:j.stage,currentRating:before,routeRating:C.fused(trial).rating,swaps,delta:C.fused(trial).rating-before});
          }
        }
      }
      if(!strongest||o.highestCleared>strongest.highestCleared||o.highestCleared===strongest.highestCleared&&maxRating>strongest.maxRating){
        const last=r.battles.at(-1);strongest={...row,talent:r.chosen,slots:r.finalGame.run.slots,bench:r.finalGame.run.bench,owned:r.finalGame.run.owned,gear:r.finalGame.run.gear,gearReserve:r.finalGame.run.gearReserve,bonds:C.activeSynergies(r.finalGame.run).map(x=>x.id),lastPlayer:last?.before.rating,lastEnemy:last?.foeRating,lastStrategyPlayer:last?.rating,lastDimensions:last?.before.dimensions,lastEnemyDimensions:last?.before.opponent.dimensions,boosts:last?.before.boosts};
      }
    }
    const valid=rows.filter(x=>!x.partial&&x.status!=='error'),low=valid.map(x=>x.highestCleared),high=valid.map(x=>x.status==='censored'?Infinity:x.highestCleared);
    const summary={...g,n:rows.length,valid:valid.length,deaths:valid.filter(x=>x.status==='death').length,censored:rows.filter(x=>x.status==='censored').length,errors:rows.filter(x=>x.status==='error').length,mainClears:valid.filter(x=>x.highestCleared>=10).length,p50:q(low,.5),p50Upper:q(high,.5),p90:q(low,.9),p99:q(low,.99),max:Math.max(...low),meanCleared:mean(low),meanCash:mean(valid.map(x=>x.finalCash)),medianCash:q(valid.map(x=>x.finalCash),.5),everRoute:valid.filter(x=>x.everRoute).length,everAllStars:valid.filter(x=>x.everAllStars).length,everSixGear:valid.filter(x=>x.everSixGear).length,everAllJerseys:valid.filter(x=>x.everAllJerseys).length,maxMembers:Math.max(...valid.map(x=>x.maxMembers)),maxJerseys:Math.max(...valid.map(x=>x.maxJerseys)),eventDeaths:valid.filter(x=>x.terminalCause==='event').length};
    summary.allTargets=valid.filter(x=>x.allTargets).length;
    summaries.push(summary);maxCases.push(strongest);ledger.push(...resources.values());
    for(let stage=1;stage<=1000;stage++){
      const s=getStage(stage),unknown=rows.filter(x=>x.status==='censored'&&(x.partial||x.highestAttempted<stage)).length,[lo,hi]=wilson(s.firstWins,s.reached);
      const x={group:g.id,stage,reached:s.reached,reachLower:s.reached/rows.length,reachUpper:(s.reached+unknown)/rows.length,attempts:s.attempts,firstWins:s.firstWins,firstWinRate:s.reached?s.firstWins/s.reached:null,firstWinCiLow:lo,firstWinCiHigh:hi,allWinRate:s.attempts?s.wins/s.attempts:null,battleDeaths:s.deaths,conditionalBattleDeathRate:s.reached?s.deaths/s.reached:null,meanPlayer:mean(s.ratings),meanEnemy:mean(s.foes),meanRatio:mean(s.ratios),meanPlayerGrowth:mean(s.growth),growthPairs:s.growth.length};
      for(const k of Object.keys(C.COMBAT_LABELS)){x['player_'+k]=mean(s.playerDims[k]||[]);x['enemy_'+k]=mean(s.enemyDims[k]||[])}stageRows.push(x);
    }
    if(strongest){const record=JSON.parse(fs.readFileSync(strongest.file,'utf8'));checks.push({group:g.id,seed:strongest.seed,file:strongest.file,...validate(record)})}
  }
  const paired=[];
  for(const other of ['expert-half','expert-full']){
    const base=runRows.filter(x=>x.group==='expert-none'&&!x.partial&&x.status==='death'),differences=[];
    for(const b of base){const t=runRows.find(x=>x.group===other&&x.seed===b.seed&&!x.partial&&x.status==='death');if(t)differences.push(t.highestCleared-b.highestCleared)}
    paired.push({comparison:other+' vs expert-none',n:differences.length,meanDifference:mean(differences),medianDifference:q(differences,.5),better:differences.filter(x=>x>0).length,same:differences.filter(x=>x===0).length,worse:differences.filter(x=>x<0).length});
  }
  for(const g of groups)for(const [kind,items] of [['player',C.STARS],['gear',C.GEAR],['bond',C.SYNERGIES]])for(const item of items){const key=g.id+':'+kind+':'+item.id;if(!usage.has(key))usage.set(key,{group:g.id,kind,id:item.id,runs:new Set(),battles:0,wins:0,stageSum:0})}
  const usageRows=[...usage.values()].map(x=>({...x,runs:x.runs.size,usageRate:x.runs.size/400,winRate:x.battles?x.wins/x.battles:null,meanStage:x.battles?x.stageSum/x.battles:null,name:(x.kind==='player'?C.STARS:x.kind==='gear'?C.GEAR:C.SYNERGIES).find(y=>y.id===x.id)?.name}));
  csv('runs.csv',runRows.map(({error,...x})=>({...x,error:error?.message||''})));csv('stages.csv',stageRows);csv('goals.csv',goalRows);csv('events.csv',[...events.values()]);csv('usage.csv',usageRows);csv('resources.csv',ledger);csv('paired-growth.csv',paired);
  csv('route-alignment.csv',alignment);
  const result={total:runRows.length,actions,battles,eventCount,summaries,maxCases,paired,checks,anomalies,alignment,sourceHashes:hashes};fs.writeFileSync(path.join(out,'analysis.json'),JSON.stringify(result,null,2));
  const summaryTable=table(['测试组','主线通关','一半对局过到','最好10%的门槛','最好1%的门槛','最高通关','截尾/错误'],summaries.map(x=>[x.label,`${x.mainClears}/400 (${pct(x.mainClears/400)})`,x.p50Upper===x.p50?x.p50:`至少${x.p50}（终点未定）`,x.p90,x.p99,x.max,`${x.censored}/${x.errors}`]));
  const survival=table(['实际挑战到的关卡',...groups.map(x=>x.label)],[5,10,11,20,21,30,40,50,60,75,100,150,200,300,500,1000].map(s=>[s,...groups.map(g=>{const x=stageRows.find(x=>x.group===g.id&&x.stage===s);return x.reachUpper===x.reachLower?pct(x.reachLower):`${pct(x.reachLower)}～${pct(x.reachUpper)}`})]));
  const powers=table(['测试组','关卡','到达局数','玩家战力','对手战力','首次出战胜率'],[10,20,21,30,40,50,60,75,100,150,200,300,500,1000].flatMap(s=>groups.map(g=>({g,x:stageRows.find(x=>x.group===g.id&&x.stage===s)})).filter(({x})=>x.reached).map(({g,x})=>[g.label,s,x.reached,fmt(x.meanPlayer),fmt(x.meanEnemy),`${pct(x.firstWinRate)}（95%区间${pct(x.firstWinCiLow)}～${pct(x.firstWinCiHigh)}）`])));
  const goals=table(['测试组','曾完成路线1','曾达到16名目标成员满星','最多收齐目标成员','最多同时持有球衣','死亡时剩余奖金中位数'],summaries.map(x=>[x.label,`${x.everRoute}/400`,`${x.everAllStars}/400`,`${x.maxMembers}/16`,x.maxJerseys,x.medianCash]));
  const upgrades=table(['局外升级','零成长','半成长','满成长'],C.META_UPGRADES.map(x=>[x.name,0,Math.round(x.prices.length/2),x.prices.length]));
  const findings=table(['测试组','关卡','挑战到的局数','在这一关最终死亡','条件死亡比例'],stageRows.filter(x=>x.reached>=40).sort((a,b)=>b.conditionalBattleDeathRate-a.conditionalBattleDeathRate).slice(0,15).map(x=>[groups.find(g=>g.id===x.group).label,x.stage,x.reached,x.battleDeaths,pct(x.conditionalBattleDeathRate)]));
  const pairedTable=table(['账号比较（同种子）','完整配对数','平均多过几关','多过/一样/少过的局数'],paired.map(x=>[x.comparison,x.n,fmt(x.meanDifference),`${x.better}/${x.same}/${x.worse}`]));
  const cases=maxCases.map(x=>{const p=id=>C.BY_ID[id]?.name||id;return `### ${groups.find(g=>g.id===x.group).label}：最高通关${x.highestCleared}关\n\n种子 **${x.seed}**；终止状态${x.status}${x.limit?'（'+x.limit+'）':''}。最后挑战${x.highestAttempted}关，玩家面板${x.lastPlayer}、对手${x.lastEnemy}；加入本次战术后玩家${x.lastStrategyPlayer}。\n\n- 六名主力：${Object.entries(x.slots).map(([s,id])=>C.LABELS[s]+'：'+p(id)).join('；')}。\n- 备战：${x.bench.map(p).join('、')||'无'}。\n- 装备：${x.gear.map(id=>C.GEAR.find(g=>g.id===id)?.name||id).join('、')||'无'}。\n- 路线成员${x.members}/16、正确主力位置${x.correctSlots}/6；目标成员达到当前星级上限${x.maxStarMembers}/16。\n- 球衣持有${x.jerseys}/${x.jerseyPool}；六名主力训练次数为${Object.values(x.slots).map(id=>p(id)+' '+x.owned[id].train).join('、')}。\n- 当前关训练上限${x.stage>10?x.stage:3}；最终剩余奖金${x.finalCash}。\n`}).join('\n');
  const trainingBudget=table(['目标关卡','六名主力从零训练到该关上限所需奖金（无训练折扣）','理论最多胜利奖金（每关仅胜一次）'],[20,30,50,100].map(stage=>{let costs=0;const r=C.createRun('reserve_fund',1);r.talent='phase_tempo';r.stage=stage;r.endless=true;r.owned.durant={stars:1,train:0,trainedAt:0};for(let i=0;i<stage;i++){r.owned.durant.train=i;costs+=C.trainingCost(r,'durant')}return [stage,costs*6,stage*90]}));
  const noLate=summaries.every(x=>x.max<50);
  const expertNone=summaries.find(x=>x.id==='expert-none'),expertFull=summaries.find(x=>x.id==='expert-full');
  const conclusions=`## 最后总结：这套数值现在合理吗？\n\n**结论：本轮可以说明这些账号和策略的实际难度，但不能据此宣布游戏整体已经平衡。**\n\n1. **入门体验**：新手/普通无局外成长的主线通关率分别为${pct(summaries[0].mainClears/400)}、${pct(summaries[1].mainClears/400)}。如果你的定位是“大部分第一次玩的用户应通关主线”，这与目标有明显距离；如果定位是需要多次挑战的游戏，则不能只凭这一比例认定太难。\n2. **局外成长价值**：高手零成长与满成长的最高通关分别为${expertNone.max}、${expertFull.max}，中位数分别为${expertNone.p50}、${expertFull.p50}；应结合下面的同种子比较看平均改善，不能只看最幸运的一局。账号池改变后，后续抽签会分叉，同种子不意味着两组每次事件都相同。\n3. **成型体验**：高手三组完成路线1的局数分别为${summaries.slice(2).map(x=>x.everRoute+'/400').join('、')}。未成型就结束时，不能回答“这套满星满训完美阵容最多能打到哪里”。必须把成型困难与成型后强度分开。\n4. **满训目标与经济有冲突**：无尽训练上限每关继续增加。见下面的理论成本，追求六名主力始终满训，需要与招募、装备、球衣及强化争夺奖金；满训不能被当成普通玩家自然能完成的常规目标。这里只比较价格与胜利奖金上限，实际还有利息、出售、事件和失败补偿，不能把它当作完整收入证明。\n5. **长期曲线**：${noLate?'本轮仍无人到达50关，50关以后的胜率没有实际战斗样本，不能确认“彻底杜绝数值崩坏”，也不能确认后期合理。':'后期判断只能覆盖实际到达且样本足够的关卡；达到更远关卡的少数幸存者不能代表所有玩家。'}\n6. **策略的界限**：高手是朝目标构筑推进、兼顾生存的自动策略，并非全局最优证明。它只看当前候选、商店和阵容，不偷看随机数或未来。装备优先考虑当前战力、回血和经济，再在已有装备中调整；不会凭空配齐全图鉴装备。“最优”在此指策略对当前可见资源的选择，不能证明不存在更强的人类玩法。\n\n### 优先处理的问题\n\n| 问题 | 本轮证据 | 建议与当前值 | 需要再验证 |\n| --- | --- | --- | --- |\n| 主线是否过难 | 上述新手/普通400局的真实通关比例 | 当前主线配置保留；先确定首局与多次挑战的目标通关率 | 更贴近人类的策略、重复挑战、生涯天赋对照 |\n| 成型前就被淘汰 | 路线1完成次数与终止关卡 | 当前抽卡和关卡数值保持；分别测“获取成员慢”与“成型时实力不足” | 同预算下增加抽卡/训练投入的配对策略实验 |\n| 六名主力满训并非现实常规目标 | 当前训练价格、动态训练上限与理论成本 | 价格仍为1/2/3/16/22/29/37/46/56/67，随后每次67；不直接改值 | 实际训练次数、现金流、训练与强化的边际收益 |\n| 后期结论容易失真 | 存活表中的后期到达人数 | 固定无尽曲线保留；不能用无样本关卡的0%到达率当成0%战斗胜率 | 成型自然样本及明确标记的固定构筑对照，两者分开 |\n\n本轮未执行候选正式数值A/B，因此没有凭空给出某个正式参数应改成多少，也没有承诺调整后的收益。**先修正测试覆盖与成型目标的口径，再决定是否改游戏；正式数值本轮全部保持。**\n`;
  const md=`# 第二轮数值测试：五组各400局\n\n${conclusions}\n\n## 1. 一眼看懂结果\n\n${summaryTable}\n\n“一半对局过到”是已通关关卡的中位数；“最好10%/1%的门槛”是P90/P99。主线通关指打赢第10关。关卡上限1000、每局180秒、最多2000场战斗和30000操作，达到限制记截尾，不算失败。异常单独列出。共${runRows.length}局、${actions}次操作、${battles}场战斗、${eventCount}次事件结算。\n\n## 2. 怎么测的\n\n仅保留新手、普通、高手三个策略；高手分零/半/满成长，所以共五组。每组400个独立新局，种子40001～40400。每局从第1关开始，奖金全部按正式核心收入与支出获得，广告统一关闭。局外进度是本轮指定的历史账号条件，不给对局赠送球员、装备或额外现金。局内初始奖金增加只来自正式“启动资金”等效果。\n\n${upgrades}\n\n半成长为等级一半四舍五入：五级项3级、三级项2级、一级项1级。半成长解锁8/15件传奇球衣、5/10件传奇装备、4/7个需要解锁的天赋；按独立固定种子选择解锁名单。满成长解锁全部。未额外伪造生涯纪录；实际生涯条件在本局开局账号中为零。解锁只扩大池子，不直接持有物品。\n\n高手的目标为攻略常规路线1：主力${Object.values(routeSlots).map(id=>C.BY_ID[id].name).join('、')}；十名备战${routeBench.map(id=>C.BY_ID[id].name).join('、')}。SSR同人物按正式identity规则计入成员，实际名称与成长记录保留。先活下来，再逐步扩容、替换、训练、升星、购买与收藏球衣；没有强塞完整阵容。\n\n新手优先看表面属性，普通考虑空缺和基础收益；高手同时考虑羁绊、回血、经济和目标成员，危险时允许降低现金保留。备战换位搜索包含每个位置最强的两个当前属性候选以及对应目标成员；它是有限搜索，不能称为全局最优。未知未来候选、敌方隐藏战术、随机事件和RNG均不传给策略。对手战术只通过已经发生的克制结果学习。\n\n### 满训为什么很难\n\n${trainingBudget}\n\n这只是正式价格的理论计算，不是另外模拟出的一批战绩；最高90奖金是每场胜利上限，不代表每局真的拿到90。训练折扣、天赋、其他收入和实际选择另见资源日志。\n\n## 3. 有多少人能走到后面\n\n${survival}\n\n表中是实际挑战到该关的比例，不是该关的战斗胜率；11关到达率等于10关已通关率（不含未确认继续的截尾）。截尾出现时给已确认到达率与可能上界，异常不计为死亡，不能补成成功。\n\n## 4. 玩家战力与对手比较\n\n${powers}\n\n玩家为该关首次战斗前面板，未加入所选战术；统计每局第一次出战，避免把反复重试当成更多玩家。对手为基础面板。95%区间是胜率的不确定范围；后期人数少时，即使显示100%也不能认定稳定无敌。完整逐关五维、成长与胜率见 stages.csv。\n\n### 最容易结束的关卡（至少40局到达）\n\n${findings}\n\n这里是挑战过该关的人中最终因战斗死在该关的比例，不是每场战斗败率。事件死亡另外计数，不能直接判定某一关存在数值突跳。\n\n## 5. 高手有没有完成你要求的构筑\n\n${goals}\n\n路线完成要求16名成员齐全且六名主力在对应位置；“满星”要求无尽阶段所有16名目标成员达到各自星级上限。训练单独记录是否达到当关上限，无法达到一个永久不变的“满训”。球衣必须实际取得才计持有，解锁不算收集；三组可购买球衣池大小分别12/20/27，所以收藏数量不能直接等同于账号强度。\n\n### 局外成长到底帮助了多少\n\n${pairedTable}\n\n这里只计算两组都正常死亡的同种子配对；截尾或异常不当作最终终点。配对设计减少开局差异，开池和天赋候选变化仍会影响后续随机轨迹，不声称完全控制随机结果。\n\n## 6. 每组走得最远的一局\n\n${cases}\n\n这些是本次观测的最高样本，不是理论最强阵容；最终死亡阵容也可能在失败前因临时选择、复苏装备消耗而变化。完整日志保存每关战前、战后状态，包含每个动作的奖金前后值与净变化。\n\n## 7. 验证、复现和后续使用\n\n正式批次前15局小样本已通过浏览器全局核心/云端核心与验证器回放；本批五组最高通关样本再次回放，结果：${checks.every(x=>x.cloud.match&&x.browserGlobal.match)?'全部一致':'存在不一致'}。这种验证是Node代码回放，不是真机UI实战。源代码指纹保持一致；前端、云函数与正式数值均未修改，未提交Git。上轮1000局原始报告与代码快照在 artifacts/balance/batch-1000-20261010/，与本轮分开。\n\n原始2000局及CSV在 artifacts/balance/batch-2000-20261010-v3/。analysis/analysis.json 保存最高样本、种子、源文件哈希与回放结果；runs.csv 每局结果；goals.csv 构筑完成度；stages.csv 逐关曲线；usage.csv 球员/装备/羁绊使用与相关胜率；events.csv 事件出现及选择；resources.csv 资源流。使用率与相关胜率不能证明某装备或羁绊因果上过强。\n\n复现命令：\n\n\`\`\`powershell\nnode balance/suite.cjs\nnode balance/report-round2.cjs\nnode balance/cli.cjs validate --file <analysis.json中的原始文件路径>\n\`\`\`\n\n本轮错误/不完整样本${anomalies.length}条，详见 analysis.json；截尾样本保留，不计玩家死亡。当前战报只保留最后7条攻防文本，不伪造完整攻防次数。\n`;
  const collectionTable=table(['测试组','曾装备齐六栏','曾收齐本账号可买球衣','所有量化目标同一时刻完成'],summaries.map(x=>[x.label,`${x.everSixGear}/400`,`${x.everAllJerseys}/400`,`${x.allTargets}/400`]));
  const alignmentTable=table(['高手账号','最后一战已持有六名目标主力的局数','按攻略摆位后平均战力变化','战力提高/不变/降低'],groups.filter(x=>x.policy==='expert').map(g=>{const a=alignment.filter(x=>x.group===g.id);return [g.label,a.length,fmt(mean(a.map(x=>x.delta))),`${a.filter(x=>x.delta>0).length}/${a.filter(x=>x.delta===0).length}/${a.filter(x=>x.delta<0).length}`]}));
  const extra=`### 装备、球衣与完整目标\n\n${collectionTable}\n\n最后一列要求在同一时刻：无尽阶段路线1成型、16名目标成员满星、六名主力达到当关训练上限、球衣全部实际取得、装备六栏齐全。装备齐全只是可量化的完成度，不冒充“全图鉴最优”。如果这一列为0，本批就没有“所有条件都满足之后能到几关”的自然样本，不能把其他样本的最高关卡当作这个答案。\n\n### 攻略位置与当前实战实力的关系\n\n${alignmentTable}\n\n这是额外的面板诊断，不是新增战绩：克隆最后一战前的真实状态，仅对已经持有的球员调用合法换位，再用真实fused计算面板；不加钱、不升星、不增加训练、不模拟新的随机战斗。攻略的195战力是统一三星、三级训练、不计装备的比较口径；实战成员成长不同，强行照搬位置可能降低即时战力。统计结果不能证明策略是全局最优，但能帮助区分“还没收齐”与“已有球员如何摆”。明细见 route-alignment.csv。\n\n`;
  const formed=groups.filter(g=>g.policy==='expert').map(g=>{const a=goalRows.filter(x=>x.group===g.id&&x.everRoute);return [g.label,a.length,q(a.map(x=>x.firstRoute),.5)??'无样本',q(a.map(x=>x.highestCleared),.5)??'无样本',a.length?Math.max(...a.map(x=>x.highestCleared)):'无样本',q(a.map(x=>Math.max(0,x.highestCleared-x.firstRoute+1)),.5)??'无样本']});
  const formedText='### 只看曾完成路线1的对局\n\n'+table(['高手账号','局数','首次成型关中位数','最终通关中位数','最高通关','首次成型关起又通关的关数中位数'],formed)+'\n\n这里仅要求路线1的16名成员和六个主力位置齐全，不要求满星满训。最后一列从首次成型关开始计已通关数；后续可能因即时战力重新换位，不代表始终保持攻略位置。成型者本来就是筛选出的幸存者，不能与未成型者直接比较并认定因果收益。全体最高战绩与路线1成型者最高战绩须分别看。\n\n';
  const finalMd=md.replace('### 优先处理的问题',evidenceSummary(summaries,stageRows,goalRows)+'### 优先处理的问题').replace('### 局外成长到底帮助了多少',extra+formedText+'### 局外成长到底帮助了多少');
  fs.writeFileSync('BALANCE_REPORT.md',finalMd);fs.writeFileSync(path.join(dir,'BALANCE_REPORT.md'),finalMd);console.log(JSON.stringify({summaries,actions,battles,eventCount,anomalies,checks:checks.map(x=>({group:x.group,seed:x.seed,match:x.cloud.match}))},null,2));
}
if(require.main===module)main();
