// node scripts/audit-endless-balance.cjs
// 使用正式核心计算压力场景；不是从第一关开始的资金可达性模拟。
const fs=require('node:fs'),path=require('node:path'),C=require('../h5/game-core.js');
const routes=require('./data/diverse-rosters.json');
const candidates=[...routes,...routes.map(r=>({name:r.name+'（SSR替换）',ids:r.ids.map(id=>C.STARS.find(s=>s.variantOf===id)?.id||id)}))];
const jerseys=C.GEAR.filter(x=>x.slot==='球衣').map(x=>x.id);
function setup(route,talent,stage,rate,boosted){
  const r=C.createRun(talent,911,{trainingBoost:3,filmStudy:3,gearStorage:5,jerseyUnlocks:C.GEAR.filter(x=>x.unlockable&&x.slot==='球衣').map(x=>x.id),gearUnlocks:C.GEAR.filter(x=>x.legendary).map(x=>x.id)},6);
  r.stage=stage;r.endless=stage>10;r.benchLimit=10;
  r.slots=Object.fromEntries(C.SLOTS.map((s,i)=>[s.id,route.ids[i]]));r.bench=route.ids.slice(6);
  r.owned=Object.fromEntries(route.ids.map(id=>[id,{stars:C.starLimit(r,id),train:Math.min(C.trainingLimit(r,id),Math.floor(stage*rate)),trainedAt:0}]));
  r.gear=[];r.gearReserve=[...jerseys];
  for(const e of C.EVENTS)if(stage>=e.minStage&&e.dimension&&e.players.every(id=>route.ids.slice(0,6).some(x=>C.identityOf(x)===id))){
    // 压力上界：相关事件均取高奖励，不约束触发机会与奖金。
    const gain=e.jersey?1:e.cost?3:e.type==='C'?5:e.players.length>1?7:5;
    r.eventState.bonuses[e.dimension]=(r.eventState.bonuses[e.dimension]||0)+gain;
  }
  if(boosted)r.boosts=C.BOOSTS.flatMap(b=>Array(C.boostPurchaseLimit(r)).fill(b.id));
  return r;
}
function wear(r,gear){r.gear=gear;r.gearReserve=jerseys.filter(id=>!gear.includes(id))}
function optimizeGear(r){
  for(const slot of [...new Set(C.GEAR.map(x=>x.slot))]){
    let best,score=-Infinity;const old=r.gear.filter(id=>C.GEAR.find(x=>x.id===id).slot!==slot);
    for(const item of C.GEAR.filter(x=>x.slot===slot)){wear(r,[...old,item.id]);const n=C.fused(r).rating;if(n>score){score=n;best=item.id}}
    wear(r,[...old,best]);
  }return [...r.gear];
}
if(require.main===module){
const kits=[];
for(const route of candidates)for(const {id:talent} of C.TALENTS)for(const boosted of [false,true]){
  kits.push({route,talent,gear:optimizeGear(setup(route,talent,200,.2,boosted))});
}
const modes=[{key:'normal',rate:.2,boosted:false},{key:'capped',rate:.2,boosted:true},{key:'maximum',rate:1,boosted:true}];
function bestFor(stage,mode,pool){
  const foe=C.opponent({stage,balanceRulesVersion:6});let best;
  for(const kit of pool){const r=setup(kit.route,kit.talent,stage,mode.rate,mode.boosted);wear(r,kit.gear);
    for(const strategy of Object.keys(C.STRATEGIES)){const rating=C.fused(r,strategy,foe.strategy).rating;if(!best||rating>best.rating)best={rating,kit,strategy};}
  }return best;
}
const checkpoints=[1,10,11,20,21,30,50,100,150,200,250,300,350,400,450,500,566,600,700,800,900,1000];
const finalists=new Set();const anchors=[];
for(const stage of checkpoints){const row={stage};for(const mode of modes){const best=bestFor(stage,mode,kits);finalists.add(best.kit);row[mode.key]=best.rating;}anchors.push(row);}
const pool=[...finalists],rows=[];
for(let stage=1;stage<=1000;stage++){
  const row={stage,foe:C.opponent({stage,balanceRulesVersion:6}).rating};
  for(const mode of modes)row[mode.key]=bestFor(stage,mode,pool).rating;
  rows.push(row);
}
for(const anchor of anchors)for(const mode of modes)if(rows[anchor.stage-1][mode.key]!==anchor[mode.key])throw Error('候选抽样结果不一致');
const output=path.join(__dirname,'../docs/无尽逐关强度对比-2026-10-10.md');
const sample=checkpoints.filter(s=>s>=20).map(s=>rows[s-1]);
const header='| 关卡 | 对手 | 玩家：20%训练，未强化 | 玩家：20%训练，强化买满 | 玩家：满训练，强化买满 |\n| --- | ---: | ---: | ---: | ---: |\n';
const table=list=>header+list.map(r=>`| ${r.stage} | ${r.foe} | ${r.normal} | ${r.capped} | ${r.maximum} |`).join('\n');
const tailStart=key=>{for(let i=rows.length-1;i>=0;i--)if(rows[i][key]>=rows[i].foe)return rows[i].stage+1;return 1};
const text=`# 无尽逐关强度对比（规则6，10月10日最新调整）

## 本次规则

- 同类赛前强化按每场计数：第1～10关最多2次，第11关起最多10次；不同类型分别计数。刷新、退出重进不重置；战斗结算清空，重试也算下一场。
- 第20关为指数基点，21～50关目标为 126 × exp(ln(500/126) × (关卡−20)/30)；50关后目标为 500 × (1+(关卡−50)/125) × exp(0.004 × (关卡−50))。按原属性比例缩放、取整并保留逐关递增校正。第1～20关不变；1～5版旧对局保留原规则。
- 采用固定关卡曲线，完全不读取玩家战力。按已确认取舍，照顾成熟阵容并允许极限配置领先；50关开始给常规成型阵容压力，不要求在50关压过所有极限配置。胜率与成型条件见[无尽难度与战斗胜率测试](无尽难度与战斗胜率测试-2026-10-10.md)。

## 比较条件与限制

调用正式 fused / opponent 计算，单位为OVR。比较现有12条攻略阵容及其SSR替换版本，共24组候选，20种天赋和3种战术。装备按部位择优，不是全局组合穷举。${checkpoints.length}个抽样关卡搜索全部候选，再用胜出候选（${pool.length}组装备配置）计算1～1000每一关。每关数值是该候选集合中的高值，不是所有可能阵容的理论最大值。

全部场景均假设球星达到该阶段星级上限、局外训练加成满级、全部27件球衣已收集、对应属性事件取高奖励；前10关训练遵守3级上限。20%训练指每名球员训练 floor(关卡×0.2) 级；满训练指该关允许的最高等级。强化买满指8类强化各买到2/10次上限。未限制招募、训练、收藏与强化的资金及商店刷新机会，是偏向玩家的压力场景，不能当作玩家实际平均强度或从第1关的可达性证明。

在第1～1000关的本次候选中，对手从第${tailStart('normal')}关起持续高于20%训练未强化档；第${tailStart('capped')}关起持续高于20%训练强化买满档；第${tailStart('maximum')}关起持续高于满训练强化买满档。此前仍允许玩家领先，不能据此保证所有玩家、所有战术每场都输赢一致，OVR比较也不等于胜率。

## 抽样

${table(sample)}

## 每关完整数据（1～1000）

${table(rows)}

## 重算

运行 node scripts/audit-endless-balance.cjs 可生成本表。仅本地计算，不写生产榜单、不部署云函数。
`;
fs.writeFileSync(output,text,'utf8');
console.log(JSON.stringify({finalists:pool.length,sample,tailStart:{normal:tailStart('normal'),capped:tailStart('capped'),maximum:tailStart('maximum')},output},null,2));
}
module.exports={setup,wear,optimizeGear,candidates};
