// 固定种子战斗抽样；单关预构筑，不是完整对局的资金模拟。
const fs=require('node:fs'),path=require('node:path'),C=require('../h5/game-core.js');
const A=require('./audit-endless-balance.cjs');
const scenarios=[
  {id:'s_mature',label:'S成型',route:0,stars:3,jerseys:6,boosts:0},
  {id:'s_boosted',label:'S成型＋适量强化',route:0,stars:3,jerseys:6,boosts:2},
  {id:'s_perfect',label:'S完美',route:0,stars:10,jerseys:27,boosts:0},
  {id:'ssr_mature',label:'SSR成型',route:12,stars:3,jerseys:6,boosts:0},
  {id:'ssr_perfect',label:'SSR完美',route:12,stars:10,jerseys:27,boosts:0},
  {id:'ssr_boosted',label:'SSR完美＋适量强化',route:12,stars:10,jerseys:27,boosts:2}
];
function scenarioRun(scenario,stage){
  const r=A.setup(A.candidates[scenario.route],'chemistry',stage,.2,false);
  for(const own of Object.values(r.owned))own.stars=Math.min(own.stars,scenario.stars);
  A.wear(r,A.optimizeGear(r));
  r.gearReserve=r.gearReserve.slice(0,Math.max(0,scenario.jerseys-1));
  if(scenario.jerseys<27)r.eventState.bonuses={shooting:5,creation:5,finishing:5,perimeterStop:5,rimStop:5};
  r.boosts=C.BOOSTS.flatMap(b=>Array(Math.min(scenario.boosts,C.boostPurchaseLimit(r))).fill(b.id));
  return r;
}
function sample(run,count=400){
  const rates=[];
  for(const strategy of Object.keys(C.STRATEGIES)){
    let wins=0;
    for(let seed=1;seed<=count;seed++){
      const game=C.createGame();game.run=structuredClone(run);game.run.rng=seed*7919;
      wins+=C.battle(game,strategy).won?1:0;
    }
    rates.push({strategy,rate:wins/count});
  }
  rates.sort((a,b)=>b.rate-a.rate);
  return {stage:run.stage,player:C.fused(run,rates[0].strategy,C.opponent(run).strategy).rating,foe:C.opponent(run).rating,best:rates[0],rates,count};
}
if(require.main===module){
  const rows=[];
  for(const stage of [40,50,60,75,100,150,200,300])for(const scenario of scenarios)rows.push({...sample(scenarioRun(scenario,stage)),id:scenario.id,label:scenario.label});
  const output=path.join(__dirname,'../docs/无尽难度与战斗胜率测试-2026-10-10.md');
  fs.writeFileSync(output,`# 固定无尽难度与战斗胜率测试

## 取舍

按确认方案：采用固定关卡数值，照顾成熟阵容，允许极限配置领先。50关开始给常规成型阵容压力，不承诺从50关开始压过所有SSR、满训练与强化买满配置。未修改球员属性、成长、羁绊、战斗命中公式与前20关难度。

20～50关以126到500为指数连接；50关后目标 = 500 × (1 + (关卡−50)/125) × exp(0.004 × (关卡−50))。按对手原属性比例缩放，并保留取整、轮换及逐关递增校正；显示OVR可能与目标相差1。难度只读关卡与规则版本，不随玩家阵容调整。

## 测试场景

使用常规路线1及SSR替换版、羁绊化学反应天赋、局外训练加成满级，每名球员训练至关数20%。成型档为3星、6件球衣收藏、五维事件各+5%；完美档为该阶段满星、27件球衣及对应事件高奖励。装备逐部位按战力择优。适量强化为8类强化各2次（共16件），不是仅买2件；次数符合限制，但本测试不证明相应资金和刷新机会在实战均可实现。

每个场景、每个关卡、每种战术独立使用400个固定种子，报告三种战术中最高胜率；这是本地抽样结果，不是理论概率或全体玩家平均胜率。低投入阵容在后期应继续升星、训练、获取球衣、购买强化或升级SSR；本测试不要求停留3星的阵容能一路轻松通关。

## 结果

| 关卡 | 场景 | 玩家OVR | 对手OVR | 最优战术 | 抽样胜率 |
| --- | --- | ---: | ---: | --- | ---: |
${rows.map(r=>`| ${r.stage} | ${r.label} | ${r.player} | ${r.foe} | ${C.STRATEGIES[r.best.strategy].name} | ${(r.best.rate*100).toFixed(1)}% |`).join('\n')}

## 自动回归门槛

- 第1～20关与旧规则一致；1～1000关OVR严格递增，21关以后单关跳幅不超过6%，50→51关不超过2%。
- 50关S成型档最优战术抽样胜率在30%～70%之间；适量强化至少提高10个百分点。
- 50关S完美档胜率不低于75%，100关S完美档不低于35%；SSR完美档100关不低于80%、200关不低于45%，给成型与进阶养成留下有效区间。
- 100关SSR完美档比S成型档至少高25个百分点，确认养成优势不会被关卡自动抹平。
- 9条完美常规攻略路线在50关最优战术抽样胜率均不低于65%，防止只照顾一套构筑。
- 24组候选及SSR变体在50～1000关的战力、五维均为有限值，强化买满增幅有界；候选极限满训练档在1000关低于对手，避免在本测试区间长期失去挑战。
- 保存与重进、前端与云端结算一致；1～5版旧局的对手、强化规则及随机数序列保留。

重算：node scripts/audit-endless-winrates.cjs。测试：node --test tests/endless-growth.test.cjs。
`,'utf8');
  console.log(JSON.stringify({battles:rows.length*400*Object.keys(C.STRATEGIES).length,output,rows:rows.filter(r=>[50,100,200].includes(r.stage)).map(({rates,...r})=>r)},null,2));
}
module.exports={scenarios,scenarioRun,sample};
