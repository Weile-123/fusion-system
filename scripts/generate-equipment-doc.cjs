'use strict';
const fs=require('node:fs'),path=require('node:path'),C=require('../h5/game-core.js');
const lines=['# 当前装备数据','',`由\`scripts/generate-equipment-doc.cjs\`调用正式核心生成，共${C.GEAR.length}件；球衣${C.GEAR.filter(x=>x.slot==='球衣').length}件，非球衣传奇装备${C.GEAR.filter(x=>x.legendary).length}件。价格为基础奖金标价，天赋等可能改变实际价格。`, '', '规则说明见[装备与球衣](../玩法/装备与球衣.md)。',''];
for(const slot of [...new Set(C.GEAR.map(x=>x.slot))]){
 const pool=C.GEAR.filter(x=>x.slot===slot);lines.push(`## ${slot}（${pool.length}件）`,'','|品质|名称|基础买入／卖出|解锁要求|效果|','|---|---|---|---|---|');
 for(const x of pool)lines.push(`|${x.rarity}|${x.name}|${x.price} / ${x.sellPrice}|${x.unlockable?'需传奇商店解锁':'基础池'}|${x.description.replaceAll('|','\\|')}|`);
 lines.push('');
}
const out=path.join(__dirname,'..','docs','数据');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'装备数据.md'),lines.join('\n'));
