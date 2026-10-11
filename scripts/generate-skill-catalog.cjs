'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('docs/玩法/完整词条库.md','utf8'),skills=[];
let star=0;
const dims={'投射威胁':'shooting','禁区终结':'finishing','持球创造':'creation','外线限制':'perimeterStop','护框强度':'rimStop'};
for(const line of source.split(/\r?\n/)){
  const tier=line.match(/^## ([1-5])星/);if(tier)star=+tier[1];
  const row=line.match(/^\| (sk_\w+) \| ([^|]+) \| ([^|]+) \|$/);if(!row)continue;
  const effects={dimensions:{}};
  for(let part of row[3].split(/；(?![^（]*）)/)){
    part=part.replace(/。$/,'');let m;
    if(m=part.match(/^外线拉开克制护框收缩时，投射威胁 \+([\d.]+)%/))effects.outsideCounterBonus=+m[1];
    else if(m=part.match(/^(投射威胁|禁区终结|持球创造|外线限制|护框强度) \+([\d.]+)%/))effects.dimensions[dims[m[1]]]=+m[2];
    else if(m=part.match(/^全能力 \+([\d.]+)%/))effects.allDimensions=+m[1];
    else if(m=part.match(/^对手命中率 -([\d.]+) 个百分点/))effects.opponentPenalty=+m[1]/100;
    else if(m=part.match(/^我方失误率 -([\d.]+) 个百分点/))effects.turnoverReduction=+m[1]/100;
    else if(m=part.match(/^关键分命中率 \+([\d.]+) 个百分点/))effects.clutchBonus=+m[1]/100;
    else if(m=part.match(/^战后奖金 \+(\d+)/))effects.battleCash=+m[1];
    else if(m=part.match(/^胜利奖金 \+(\d+)/))effects.winCash=+m[1];
    else if(m=part.match(/^每轮奖金 \+(\d+)/))effects.stageCash=+m[1];
    else if(m=part.match(/^装备售价 -(\d+)/))effects.shopDiscount=+m[1];
    else if(part.startsWith('免除战术'))effects.ignoreStrategyPenalty=true;
    else if(part.startsWith('每轮免费刷新'))effects.freeGearRefresh=true;
    else if(m=part.match(/^每 (\d+) 场胜利士气 \+(\d+)/)){effects.healEveryWins=+m[1];effects.winHeal=+m[2];}
    else throw Error('未识别效果：'+part);
  }
  skills.push({id:row[1],name:row[2],star,description:row[3],effects});
}
assert.equal(skills.length,112);assert.equal(new Set(skills.map(s=>s.name)).size,112);
const file='h5/game-data.js';let code=fs.readFileSync(file,'utf8');
code=code.replace(/  const RANDOM_SKILLS=[\s\S]*?;\r?\n(?=  return \{)/,'');
code=code.replace('  return {RANDOM_SKILLS,ATTRS,','  return {ATTRS,');
code=code.replace('  return {ATTRS,','  const RANDOM_SKILLS='+JSON.stringify(skills,null,2)+';\n  return {RANDOM_SKILLS,ATTRS,');
assert.ok(code.includes('return {RANDOM_SKILLS,ATTRS,'));fs.writeFileSync(file,code);
console.log('生成112条篮球随机词条。');
