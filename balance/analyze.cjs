#!/usr/bin/env node
'use strict';
// 只分析实际日志，不生成对局或改动游戏数值。
const fs=require('node:fs'),path=require('node:path');
const {C,manifest}=require('./engine.cjs');
const {names}=require('./policies.cjs');
const labels={random:'随机',novice:'新手',ordinary:'普通',expert:'高手',extreme:'极限有限搜索'};
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const pct=x=>x===null||x===undefined?'—':(100*x).toFixed(1)+'%';
const num=x=>x===null||x===undefined?'—':Number(x).toFixed(1);
function quantile(xs,p){const sorted=[...xs].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]}
function wilson(w,n){if(!n)return [null,null];const z=1.96,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-h,c+h]}
function csv(file,rows){fs.mkdirSync(path.dirname(file),{recursive:true});const keys=Object.keys(rows[0]||{}),q=v=>'"'+String(v??'').replaceAll('"','""')+'"';fs.writeFileSync(file,'\uFEFF'+keys.map(q).join(',')+'\n'+rows.map(r=>keys.map(k=>q(r[k])).join(',')).join('\n')+'\n')}
function table(headers,rows){return '| '+headers.join(' | ')+' |\n| '+headers.map(()=> '---').join(' | ')+' |\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n')}
function analyze(directory,reportFile){
  const current=manifest(),runs=[],usage={player:new Map(),gear:new Map(),bond:new Map()},eventRows=new Map(),styles=new Map(),cashActions=new Map(),stageRows=new Map();
  const summary={runs:0,actions:0,battles:0,events:0,errors:0,partial:0,resourceMismatch:0,maxRating:0,maxRatio:0,validation:[],modes:new Set(),hashes:new Set()};
  const detailedDir=path.join(directory,'analysis');fs.mkdirSync(detailedDir,{recursive:true});
  let strongest=null,weakest=null,largestGap=null;const anomalies=[];
  const stageKey=(p,s)=>p+':'+s;
  const getStage=(p,s)=>{
    const key=stageKey(p,s);if(!stageRows.has(key))stageRows.set(key,{policy:p,stage:s,reached:0,battles:0,wins:0,firstWins:0,deaths:0,eventDeaths:0,ratings:[],foes:[],ratios:[],growth:[],dimensions:{},foeDimensions:{}});return stageRows.get(key);
  };
  function exposure(kind,id,policy,b,seen,maxStage){
    const key=policy+':'+id,map=usage[kind];if(!map.has(key))map.set(key,{policy,id,runs:0,appearances:0,wins:0,first10Appearances:0,first10Wins:0,stageSum:0,highestSum:0});
    const row=map.get(key);row.appearances++;row.wins+=+b.won;row.stageSum+=b.stage;
    if(b.stage<=10){row.first10Appearances++;row.first10Wins+=+b.won}
    if(!seen.has(key)){seen.add(key);row.runs++;row.highestSum+=maxStage}
  }
  for(const policy of names){
    const folder=path.join(directory,policy),group=JSON.parse(fs.readFileSync(path.join(folder,'summary.json'),'utf8'));
    if(group.runs.length!==200)throw Error('Expected 200 runs for '+policy);
    for(const entry of group.runs){
      const r=JSON.parse(fs.readFileSync(entry.file,'utf8')),o=r.outcome;
      if(r.sourceHashes&&JSON.stringify(r.sourceHashes)!==JSON.stringify(current))throw Error('Source mismatch '+entry.file);
      const run={policy,seed:r.config.seed,...o,file:entry.file,mode:r.mode,partial:!!r.partial};runs.push(run);summary.runs++;
      summary.modes.add(r.mode);summary.hashes.add(JSON.stringify(r.sourceHashes));
      if(o.status==='error')summary.errors++;if(r.partial){summary.partial++;continue}
      summary.actions+=r.journal.length;summary.battles+=r.battles.length;summary.events+=r.events.length;
      const seen={player:new Set(),gear:new Set(),bond:new Set()},first=new Map();
      let maxPlayer=0,netCash=0;
      for(const j of r.journal){
        netCash+=j.resources.cashDelta;
        const x=cashActions.get(j.name)||{action:j.name,count:0,positive:0,negative:0};x.count++;x.positive+=Math.max(0,j.resources.cashDelta);x.negative+=Math.max(0,-j.resources.cashDelta);cashActions.set(j.name,x);
        if(j.resources.cashAfter<0||j.resources.moraleAfter<0||j.resources.moraleAfter>13)anomalies.push({policy,seed:run.seed,index:j.index,reason:'resource range'});
      }
      if(Math.abs(r.initialGame.run.cash+netCash-o.finalCash)>1e-7)summary.resourceMismatch++;
      for(const b of r.battles){
        const s=getStage(policy,b.stage);s.battles++;s.wins+=+b.won;
        if(!first.has(b.stage)){
          first.set(b.stage,b);s.reached++;s.firstWins+=+b.won;s.ratings.push(b.before.rating);s.foes.push(b.foeRating);s.ratios.push(b.before.rating/b.foeRating);
          const prev=first.get(b.stage-1);if(prev)s.growth.push((b.before.rating-prev.before.rating)/Math.max(1,prev.before.rating));
          for(const [k,v] of Object.entries(b.before.dimensions)){(s.dimensions[k]||=[]).push(v);(s.foeDimensions[k]||=[]).push(b.before.opponent.dimensions[k])}
        }
        maxPlayer=Math.max(maxPlayer,b.rating);summary.maxRating=Math.max(summary.maxRating,b.rating);
        const ratio=b.rating/b.foeRating;if(ratio>summary.maxRatio){summary.maxRatio=ratio;largestGap={policy,seed:run.seed,stage:b.stage,player:b.rating,foe:b.foeRating,ratio,slots:b.before.slots,bonds:b.before.bonds,gear:b.before.gear,file:entry.file}}
        for(const id of Object.keys(b.before.owned))exposure('player',id,policy,b,seen.player,o.highestCleared);
        for(const id of new Set([...b.before.gear,...b.before.gearReserve]))exposure('gear',id,policy,b,seen.gear,o.highestCleared);
        for(const id of b.before.bonds)exposure('bond',id,policy,b,seen.bond,o.highestCleared);
        const healing=b.before.bonds.some(id=>C.SYNERGIES.find(x=>x.id===id)?.effect.winHeal),d=b.before.dimensions;
        const style=healing?'回血羁绊':d.shooting>Math.max(d.finishing,d.rimStop)*1.1?'投射偏重':d.finishing>Math.max(d.shooting,d.rimStop)*1.1?'终结偏重':Math.max(d.rimStop,d.perimeterStop)>Math.max(d.shooting,d.finishing)*1.1?'防守偏重':'均衡';
        const bin=b.stage<=10?'1-10':b.stage<=20?'11-20':b.stage<=50?'21-50':b.stage<=100?'51-100':'101+';
        const key=policy+':'+style+':'+bin,x=styles.get(key)||{policy,style,bin,battles:0,wins:0,runs:new Set()};x.battles++;x.wins+=+b.won;x.runs.add(run.seed);styles.set(key,x);
      }
      if(o.status==='death'){const s=getStage(policy,o.stage);s.deaths++;s.eventDeaths+=+(o.terminalCause==='event')}
      for(const e of r.events){const x=eventRows.get(e.id)||{id:e.id,appearances:0,main:0,mainSuccess:0,safe:0,cash:0,bonus:0,life:0};x.appearances++;x.main+=+(e.choice==='main');x.safe+=+(e.choice==='safe');x.mainSuccess+=+(e.choice==='main'&&e.result.success);x.cash+=e.result.cash||0;x.bonus+=e.result.bonus||0;x.life+=e.result.life||0;eventRows.set(e.id,x)}
      const build={policy,seed:run.seed,highestAttempted:o.highestAttempted,highestCleared:o.highestCleared,status:o.status,limit:o.limit,maxRating:maxPlayer,talent:r.chosen,file:entry.file,
        slots:r.finalGame.run.slots,bonds:C.activeSynergies(r.finalGame.run).map(x=>x.id),gear:r.finalGame.run.gear,gearReserve:r.finalGame.run.gearReserve};
      if(!strongest||build.highestCleared>strongest.highestCleared||build.highestCleared===strongest.highestCleared&&maxPlayer>strongest.maxRating)strongest=build;
      if(o.status==='death'&&(!weakest||build.highestCleared<weakest.highestCleared))weakest=build;
    }
  }
  const summaries=names.map(policy=>{
    const xs=runs.filter(r=>r.policy===policy),valid=xs.filter(r=>r.status!=='error'&&!r.partial);
    const low=valid.map(r=>r.highestCleared),high=valid.map(r=>r.status==='censored'?Infinity:r.highestCleared);
    const row={policy,n:xs.length,death:xs.filter(r=>r.status==='death').length,censored:xs.filter(r=>r.status==='censored').length,error:xs.filter(r=>r.status==='error').length,
      mainClears:valid.filter(r=>r.highestCleared>=10).length,meanHighestObserved:avg(low),maxObserved:Math.max(...low),meanBattles:avg(valid.map(r=>r.battles)),meanElapsedMs:avg(valid.map(r=>r.elapsedMs))};
    for(const [label,p] of [['p50',.5],['p90',.9],['p99',.99]])row[label]={lower:quantile(low,p),upper:quantile(high,p)};
    return row;
  });
  const curves=[];
  for(const policy of names){
    const xs=runs.filter(r=>r.policy===policy&&r.status!=='error'),complete=xs.filter(r=>!r.partial);
    for(let stage=1;stage<=500;stage++){
      const s=getStage(policy,stage),reached=complete.filter(r=>r.highestAttempted>=stage).length,unknown=xs.filter(r=>r.status==='censored'&&(r.partial||r.highestAttempted<stage)).length;
      const [lower,upper]=wilson(s.firstWins,s.reached),row={policy,stage,reached,reachLower:reached/xs.length,reachUpper:(reached+unknown)/xs.length,
        conditionalDeathRate:s.reached?s.deaths/s.reached:null,firstBattleWinRate:s.reached?s.firstWins/s.reached:null,firstWinCiLower:lower,firstWinCiUpper:upper,
        attempts:s.battles,allBattleWinRate:s.battles?s.wins/s.battles:null,deaths:s.deaths,eventDeaths:s.eventDeaths,meanPlayer:avg(s.ratings),meanEnemy:avg(s.foes),meanRatio:avg(s.ratios),meanMatchedGrowth:avg(s.growth),growthPairs:s.growth.length};
      for(const k of Object.keys(s.dimensions)){row['player_'+k]=avg(s.dimensions[k]);row['enemy_'+k]=avg(s.foeDimensions[k])}curves.push(row);
    }
  }
  const curveKeys=['player_shooting','player_creation','player_finishing','player_perimeterStop','player_rimStop','enemy_shooting','enemy_creation','enemy_finishing','enemy_perimeterStop','enemy_rimStop'];
  for(const r of curves)for(const k of curveKeys)if(!Object.hasOwn(r,k))r[k]=null;
  const usageRows={};
  for(const [kind,map] of Object.entries(usage)){
    const catalog=kind==='player'?C.STARS:kind==='gear'?C.GEAR:C.SYNERGIES;
    const rows=[];for(const policy of names)for(const item of catalog){const x=map.get(policy+':'+item.id)||{policy,id:item.id,runs:0,appearances:0,wins:0,first10Appearances:0,first10Wins:0,stageSum:0,highestSum:0};rows.push({...x,name:item.name,runUsage:x.runs/200,battleWinRate:x.appearances?x.wins/x.appearances:null,first10WinRate:x.first10Appearances?x.first10Wins/x.first10Appearances:null,meanExposureStage:x.appearances?x.stageSum/x.appearances:null,meanObservedCleared:x.runs?x.highestSum/x.runs:null})}usageRows[kind]=rows;csv(path.join(detailedDir,kind+'-usage.csv'),rows);
  }
  const events=C.EVENTS.map(e=>({...(eventRows.get(e.id)||{id:e.id,appearances:0,main:0,mainSuccess:0,safe:0,cash:0,bonus:0,life:0}),name:e.name,category:e.category,appearancesPerRun:(eventRows.get(e.id)?.appearances||0)/1000}));
  csv(path.join(detailedDir,'events.csv'),events);csv(path.join(detailedDir,'stages.csv'),curves);csv(path.join(detailedDir,'resources.csv'),[...cashActions.values()]);
  csv(path.join(detailedDir,'styles.csv'),[...styles.values()].map(x=>({...x,runs:x.runs.size,winRate:x.wins/x.battles})));
  csv(path.join(detailedDir,'runs.csv'),runs.map(({file,error,...r})=>({...r,error:error?.message||'',file})));
  const analysis={summary:{...summary,modes:[...summary.modes],hashes:[...summary.hashes]},summaries,strongest,weakest,largestGap,anomalies,sourceHashes:current};
  fs.writeFileSync(path.join(detailedDir,'analysis.json'),JSON.stringify(analysis,null,2)+'\n');
  function interval(q){return q.upper===Infinity?`${q.lower}～未确定`:q.lower===q.upper?String(q.lower):`${q.lower}～${q.upper}`}
  const cohort=table(['策略','局数','死亡','截尾','主线通关','P50已通关','P90','P99','最高观察'],summaries.map(x=>[labels[x.policy],x.n,x.death,x.censored,`${x.mainClears}/200 (${pct(x.mainClears/200)})`,interval(x.p50),interval(x.p90),interval(x.p99),x.maxObserved]));
  const checkpoints=[1,5,10,11,20,21,30,40,50,75,100,150,200,300,500];
  const survival=table(['关卡',...names.map(p=>labels[p])],checkpoints.map(s=>[s,...names.map(p=>{const r=curves.find(x=>x.policy===p&&x.stage===s);return r.reachLower===r.reachUpper?pct(r.reachLower):`${pct(r.reachLower)}～${pct(r.reachUpper)}`})]));
  const power=table(['策略','关卡','到达局数','玩家基础OVR','对手OVR','首次战斗胜率','该关死亡率'],[10,20,30,40,50,75,100,150,200,300,500].flatMap(s=>names.map(p=>curves.find(x=>x.policy===p&&x.stage===s)).filter(x=>x.reached).map(x=>[labels[x.policy],x.stage,x.reached,num(x.meanPlayer),num(x.meanEnemy),`${pct(x.firstBattleWinRate)} (${pct(x.firstWinCiLower)}～${pct(x.firstWinCiUpper)})`,pct(x.conditionalDeathRate)])));
  function topUsage(kind){const rows=usageRows[kind].filter(x=>x.policy==='expert').sort((a,b)=>b.runs-a.runs).slice(0,12);return table(['名称','高手曾使用局数','使用率','相关战斗胜率','平均暴露关卡'],rows.map(x=>[x.name,x.runs,pct(x.runUsage),pct(x.battleWinRate),num(x.meanExposureStage)]))}
  const stylesTable=table(['策略','流派','关卡段','局数','战斗数','胜率'],[...styles.values()].filter(x=>['ordinary','expert','extreme'].includes(x.policy)&&x.battles>=30).map(x=>[labels[x.policy],x.style,x.bin,x.runs.size,x.battles,pct(x.wins/x.battles)]));
  const fatal=table(['策略','关卡','到达局数','最终死亡局数','条件死亡率'],[...stageRows.values()].filter(x=>x.reached>=30).sort((a,b)=>b.deaths/b.reached-a.deaths/a.reached).slice(0,15).map(x=>[labels[x.policy],x.stage,x.reached,x.deaths,pct(x.deaths/x.reached)]));
  const eventTable=table(['事件','出现次数','主选项次数','主选项成功','安全选择次数'],events.sort((a,b)=>b.appearances-a.appearances).slice(0,15).map(x=>[x.name,x.appearances,x.main,x.mainSuccess,x.safe]));
  const buildText=b=>`策略 ${labels[b.policy]}；种子 ${b.seed}；尝试 ${b.highestAttempted}、已通关 ${b.highestCleared}；状态 ${b.status}${b.limit?' / '+b.limit:''}；本局最高OVR ${b.maxRating}。\n\n最终六槽：${Object.values(b.slots).map(id=>C.BY_ID[id]?.name||id).join('、')}。\n\n最终羁绊：${b.bonds.map(id=>C.SYNERGIES.find(x=>x.id===id)?.name||id).join('、')||'无'}。`;
  const md=`# 1000局数值测试报告

## 范围与结果

2026年10月10日实际执行1000局，规则6，五类策略各200局，游戏种子20001～20200。全新账号、无广告、无局外升级、无传奇球衣/装备解锁；从第一关按真实经济成长。每局最多500关、2000场战斗、30000操作、每场前120操作、60秒，worker额外2秒关闭宽限。五批并行，耗时包含机器竞争，不代表真实玩家游玩时间。

实际记录${summary.actions}次操作、${summary.battles}场战斗、${summary.events}次事件结算；引擎异常${summary.errors}局、worker不完整记录${summary.partial}局、资源账本不一致${summary.resourceMismatch}局。正式配置没有修改，没有Git提交或生产部署。完整原始日志和CSV位于 artifacts/balance/batch-1000-20261010/。

这是当前有限启发式AI的表现。极限策略只搜索可见资源的局部换位，不保证全局最优；无广告、新账号条件不能外推至成熟账号。此前20局三路回放通过，本批没有声称逐局全部三路验证。

## 已通关关卡分布

${cohort}

P50/P90/P99使用已通关关卡，不把失败尝试关算作通关。截尾样本的真实终点未知：按当前已通关为下界、无穷为上界给出分位区间；未强行假定时间截尾独立。错误与不完整样本不参与分位计算。

## 各类玩家关卡存活曲线

${survival}

这里的存活为实际尝试到该关。区间下界是已确认到达率，上界额外允许所有此前截尾样本到达。截尾不是失败，不能用其停留关卡估计最终死亡率。完整1～500关数据见 analysis/stages.csv。

## 玩家与对手成长和逐关失败率

${power}

玩家基础OVR取每局该关第一次战斗前面板，避免重试局重复加权；战斗胜率采用每局首次尝试，括号为Wilson 95%区间。该关死亡率为最终死亡局/实际到达局，与单场败率不同。CSV另含全部尝试胜率、每个五维、同一局相邻关成长率及配对样本数。晚期低样本无法证明长期胜率接近0%或100%。

### 高死亡关卡

${fatal}

仅展示至少30局到达的关卡。死亡率受此前成长、士气和策略影响，不能直接认定关卡配置突增。21关与50关附近是否异常，应结合配对成长和固定构筑对照再判断。

## 球员 装备 羁绊使用与表现

使用率表示200局高手中至少在一场战斗持有/激活过。球员包括备战席，装备包括收藏。相关战斗胜率不等于因果收益：晚期取得的稀有物品天然聚集幸存者。完整五类策略、全部球员/装备/羁绊，含零使用记录，分别见 player-usage.csv、gear-usage.csv、bond-usage.csv。

### 球员

${topUsage('player')}

### 装备

${topUsage('gear')}

### 羁绊

${topUsage('bond')}

传奇解锁装备在本批默认账号中不可获取，零使用不表示它们弱。本批不能验收其回血或经济词条的平衡。

## 主要构筑流派

${stylesTable}

按战斗时实际状态分类：有回血羁绊优先归续航，其余按五维是否偏重10%分类。按关卡段展示至少30场的样本；依然是选择后的相关性，尚不是同预算、同关卡、同种子的因果对照。

## 表现最高与最低的观察样本

### 表现最高

${buildText(strongest)}

### 最早结束样本

${buildText(weakest)}

这两局只是本次观察的端点，不是理论最强/最弱构筑。原始路径保存在 analysis/analysis.json，包含种子、最终阵容和对应每局文件。

## 极端数值与状态

最高实战OVR ${summary.maxRating}；最大玩家/敌人实战OVR比 ${num(summary.maxRatio)}，来自${labels[largestGap.policy]}种子${largestGap.seed}第${largestGap.stage}关，玩家${largestGap.player}、敌人${largestGap.foe}。这是一场观察值，不证明可无限滚雪球。

额外资源范围检查异常${anomalies.length}条。每步由核心约束和状态检查拦截负奖金、非有限属性、重复持有和生命越界；没有把程序异常算为玩家死亡。核心战报仅保留末7条，本批不报告虚构的完整攻防回合数。

## 随机事件与资源

${eventTable}

完整36条事件出现、选择、判定结果、奖金、属性和生命净收益见 events.csv。这里只能统计出现频次，当前没有合格机会分母，不能把某条罕见事件的出现次数与其触发概率等同。资源账本见 resources.csv，统计每种操作净现金流；投资的净现金流不同于先扣本金再到账的总流水。

## 解释限制与调整建议

本批提供真实数据基线，不凭单个最大值调整正式数值。涉及回血叠加、属性收益、奖励差距的疑似项还需固定种子、预算和构筑对照。当前保留全部正式数值：事件70%基础概率与2.5个百分点/点、35%～90%限制，3组回血每2/3/4胜恢复1点并叠加、总生命13、胜利奖金90、现有固定无尽曲线。

建议顺序：先核查AI是否过度囤钱或忽视阵容改进，再做成熟账号与广告条件对照；随后对回血组合、投射/终结收益、50关斜率分别做独立实例实验。当前值保持，候选值待对照数据确定；预期分清策略缺陷与游戏配置影响。需要复验主线通关率、50/100关到达率、同预算胜率、平均生命净变化、构筑多样性及截尾率。尚未产生经验证的候选数值，不虚构预期提升百分比。
`;
  const verificationFile=path.join(detailedDir,'verification.json');
  let supplement='';
  if(fs.existsSync(verificationFile)){
    const v=JSON.parse(fs.readFileSync(verificationFile,'utf8'));
    if(JSON.stringify(v.sourceHashes)!==JSON.stringify(current))throw Error('Verification source mismatch');
    const steps=v.checks.reduce((n,x)=>n+x.cloud.steps,0),battles=v.checks.reduce((n,x)=>n+x.cloud.battles,0);
    const funds=table(['策略','死亡局数','死亡时奖金P50','死亡时奖金P90','死亡时仍有至少40奖金'],v.resources.map(x=>[labels[x.policy],x.n,x.deathCashP50,x.deathCashP90,`${x.deathsWithCashAtLeast40}/${x.n}`]));
    supplement=`\n## 本批抽样一致性验证与异常诊断\n\n各策略最高通关样本，以及最大战力比样本，共${v.checks.length}局、${steps}次操作、${battles}场战斗，均通过浏览器全局核心与云端核心/验证器回放。种子依次为 ${v.checks.map(x=>x.policy+':'+x.seed).join('、')}。这是Node中的真实代码回放，不是浏览器界面实战，且不代表1000局全量三路验证。\n\n随机策略种子20064重复执行后，在相同状态哈希发生相同错误；异常前15次操作也通过三路回放。连续刷新候选扣除奖金后，仅剩2奖金、0次免费招募，招募需要8奖金。驱动器仍枚举招募为合法动作，正式前后端核心都正确返回“奖金不足”。正式核心允许此时以完整阵容出战；驱动器却在有候选时只返回招募/刷新动作，遗漏离开招募后继续出战的路径。**这是模拟器动作枚举缺陷，不能记为游戏死亡或正式游戏数值BUG。** 本批保留其原始error，死亡与生存统计使用999局有效样本，其中随机策略199局。\n\n建议在下一版驱动器中按免费次数、招募券、奖励模式与奖金过滤候选招募，完整阵容时保留离开候选继续游戏的动作，并添加该种子的回归验证。本次不覆盖原始日志，不修改带指纹的驱动器，否则已有记录会失去原版本回放能力。修订后应使用新的版本目录重新跑基线。\n\n### 策略资源利用诊断\n\n${funds}\n\n高手/有限搜索策略未主动扩备战席，按局部收益和保留奖金门槛消费；大量死亡时仍持有可用奖金。剩余奖金不等于一定有有价值的购买项，但足以提示先核查策略而非直接降低关卡难度。当前策略不等于人类高玩或全局最优。本次无人到达50关，50～500关战斗胜率、传奇解锁物品与成熟账号极端构筑均**未被这批自然流程样本验证**。表中50关之后的0%是该账号/策略条件的到达率，不是该关战斗胜率。\n\n### 下一轮实验建议（正式数值保持）\n\n| 项目 | 当前设置 | 候选实验 | 原因与预期 | 复验指标 |\n| --- | --- | --- | --- | --- |\n| AI资源保留 | 非随机策略阶段4起保留至少8奖金；追加招募需现金≥40 | 仅模拟器策略候选：保留0/8/16；追加门槛24/40，配对种子 | 检查囤钱是否降低生存；不承诺一定提升 | 通关率、最终奖金、同关战力、失败原因 |\n| 阵容空间利用 | 启发式策略不主动扩备战席 | 有羁绊候选时搜索合法扩容与替换收益 | 检查局部搜索遗漏；所有花费使用正式价格 | 羁绊多样性、主线与50关到达率 |\n| 无尽固定曲线 | 20关后指数过渡；50关目标约500 | 正式系数暂不调整；增加明确局外进度的合法新局对照 | 本批50关无到达样本，无法支持降低或提高曲线 | 50/100/200关到达与条件胜率，极端构筑覆盖 |\n| 回血、事件、装备 | 正式回血2/3/4胜、生命上限13、事件70%基础概率 | 当前值保持；同预算可达构筑的单因素移除对照 | 使用率不能证明过强；传奇装备在新账号中不可得 | 每胜生命净增、战斗胜率、组合差异与置信区间 |\n\n以上为后续实验设计，尚未执行A/B，不把候选值当作正式调参建议或已证实收益。原始回放结果见 analysis/verification.json。\n`;
  }
  const byPolicy=Object.fromEntries(summaries.map(x=>[x.policy,x]));
  const beyond50=runs.filter(r=>!r.partial&&r.status!=='error'&&r.highestAttempted>=50).length;
  const highlights=`\n## 本批主要发现\n\n- 共执行${summary.runs}局；${runs.filter(x=>x.status==='death').length}局真实死亡，${summary.errors}局模拟器异常；${runs.filter(x=>x.status==='censored').length}局截尾。\n- 普通策略主线通关率${pct(byPolicy.ordinary.mainClears/200)}，高手${pct(byPolicy.expert.mainClears/200)}，有限搜索${pct(byPolicy.extreme.mainClears/200)}；普通/高手已通关P50分别为${interval(byPolicy.ordinary.p50)}/${interval(byPolicy.expert.p50)}关。\n- 最高已通关${strongest.highestCleared}关；${beyond50}局到达50关。${beyond50?'后期结论须结合逐关样本量。':'因此无法证明50～500关数值平衡。'}\n- 新账号无广告、无局外升级；这组数据不能代表成熟玩家，且策略资源分配仍有改进空间。\n- 正式数值保持，本次没有Git提交。\n`;
  fs.writeFileSync(reportFile,md.replace('## 已通关关卡分布',highlights+'\n## 已通关关卡分布')+supplement);console.log(JSON.stringify({report:reportFile,analysis:detailedDir,summary:analysis.summary,summaries,strongest,weakest,largestGap},null,2));return analysis;
}
if(require.main===module)analyze(path.resolve(process.argv[2]||'artifacts/balance/batch-1000-20261010'),path.resolve(process.argv[3]||'BALANCE_REPORT.md'));
module.exports={analyze,quantile,wilson};
