'use strict';
// Candidate search results are retained as inputs; every score uses live rules.
const fs=require('node:fs'),C=require('../h5/game-core.js');
const routes=JSON.parse(fs.readFileSync('scripts/data/diverse-rosters.json','utf8'));
const results=routes.map(route=>{
  const run=C.createRun('steady_interest',911);run.benchLimit=10;
  run.slots=Object.fromEntries(C.SLOTS.map((slot,i)=>[slot.id,route.ids[i]]));run.bench=route.ids.slice(6);
  if(route.ids.length!==16||new Set(route.ids).size!==16||route.ids.some(id=>!C.BY_ID[id]))throw Error('Invalid roster: '+route.name);
  run.owned=Object.fromEntries(route.ids.map(id=>[id,{stars:3,train:3,trainedAt:0}]));
  const fused=C.fused(run),raw=Object.values(fused.dimensions).reduce((sum,n)=>sum+n,0)/5;
  return {...route,raw,rating:fused.rating,dimensions:fused.dimensions,bonds:fused.bonds.map(b=>b.name),starters:route.ids.slice(0,6).map((id,i)=>({slot:C.SLOTS[i].label,name:C.BY_ID[id].name})),bench:run.bench.map(id=>C.BY_ID[id].name)};
});
if(process.argv.includes('--write')){
  const normal=results.filter(r=>!r.ids.some(id=>C.BY_ID[id].tier==='SSR')),best=Math.max(...normal.map(r=>r.raw));
  let doc='# 多套阵容攻略（羁绊多样性版本）\n\n规则版本：3，更新日期：2026-10-09。\n\n## 比较口径\n\n六个融合位置＋十名备战，所有球员三星、训练三级；不计装备、开局战力、战术和局外升级。下表均由正式规则复算。回血与收入不加入OVR；备战需要先扩容到10位。搜索结果是高分候选，不是全局最优证明，成型成本、实际胜率需结合招募与敌方阵容判断。SSR路线单独比较。\n\n## 常规路线总览\n\n| 路线 | OVR | 未取整OVR | 距本表常规最高 |\n| --- | ---: | ---: | ---: |\n';
  for(const r of normal)doc+=`| ${r.name} | ${r.rating} | ${r.raw.toFixed(3)} | ${((best-r.raw)/best*100).toFixed(2)}% |\n`;
  doc+='\nShowtime＋公牛不含任何死亡五小成员，与原常规路线1同样显示195。名称带“备战变体”的路线主要更换备战席，不代表融合面板完全不同。选择路线时同时比较五维分布、成员重合与经济能力。\n';
  for(const r of results){
    doc+=`\n## ${r.name}\n\n**OVR ${r.rating}**（未取整 ${r.raw.toFixed(3)}）。${r.ids.some(id=>C.BY_ID[id].tier==='SSR')?'包含SSR，不能与常规路线视为同成本。':''}\n\n| 融合位置 | 球员 |\n| --- | --- |\n`;
    for(const p of r.starters)doc+=`| ${p.slot} | ${p.name} |\n`;
    doc+=`\n**备战十人：**${r.bench.join('、')}。\n\n**激活羁绊：**${r.bonds.join('、')}。\n\n**五维：**${Object.entries(r.dimensions).map(([key,value])=>C.COMBAT_LABELS[key]+' '+value.toFixed(2)).join('；')}。\n`;
    const sorted=Object.entries(r.dimensions).sort((a,b)=>b[1]-a[1]);doc+=`\n搭配侧重：${C.COMBAT_LABELS[sorted[0][0]]}、${C.COMBAT_LABELS[sorted[1][0]]}。前期先填满六位，再按已抽到的球员组成双人／三人羁绊，逐步替换成上表；不必为了终局五人羁绊放弃已成型的组合。\n`;
  }
  fs.writeFileSync('docs/多套阵容攻略-2026-10-09.md',doc);
}
console.log(JSON.stringify(results,null,2));
