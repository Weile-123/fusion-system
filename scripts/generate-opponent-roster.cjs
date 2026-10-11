const fs = require('node:fs');
const path = require('node:path');
const C = require('../h5/game-core.js');

const run = C.createRun('outside', 1);
const lines = [
  '# 50 关对手名单与单挑属性',
  '',
  `此表由 \`scripts/generate-opponent-roster.cjs\` 根据正式游戏规则${C.BALANCE_RULES_VERSION}生成。第 1–10 关为主线，第 11–50 关为无尽挑战。赛前只显示球员、属性和战力；**倾向在游戏内隐藏**，仍参与出手和策略克制。`,
  '',
  '每名对手保留原球员卡的六项强弱差异，再校准到逐关上升的五维战力。表中属性仅用于关卡对手，不改动可招募球员。名单与OVR由当前规则实际计算，不沿用历史版本的固定名单。',
  '',
  '| 关卡 | 等级 | 对手 | 三分 | 中投 | 突破 | 控球 | 篮下 | 防守 | 战力 | 隐藏倾向 |',
  '| ---: | :---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
];

for (let stage = 1; stage <= 50; stage++) {
  run.stage = stage;
  const foe = C.opponent(run);
  const tier = C.BY_ID[foe.id].tier;
  lines.push(`| ${stage} | ${tier} | ${foe.name} | ${C.ATTRS.map(attr => foe.stats[attr]).join(' | ')} | ${foe.rating} | ${C.STRATEGIES[foe.strategy].name} |`);
}

lines.push('',
  '第51关起继续按正式核心中的无尽名单轮换。星级与关卡属性由当前规则确定，具体以游戏与实际成长参考为准。',
  '',
  '综合战力逐关上升，但实际胜率仍受对手的属性分布、出手方式、我方阵容及策略影响，需要继续试玩校准。',
  '');

const outDir=path.join(__dirname,'..','docs','数据');fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir, '关卡对手数据.md'), lines.join('\n'));
