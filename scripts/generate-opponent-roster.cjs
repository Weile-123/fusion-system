const fs = require('node:fs');
const path = require('node:path');
const C = require('../h5/game-core.js');

const run = C.createRun('outside', 1);
const lines = [
  '# 50 关对手名单与单挑属性',
  '',
  '此表由 `scripts/generate-opponent-roster.cjs` 根据正式游戏规则生成。第 1–10 关为主线，第 11–50 关为无尽挑战。赛前只显示球员、属性和战力；**倾向在游戏内隐藏**，仍参与出手和策略克制。',
  '',
  '每名对手保留原球员卡的六项强弱差异，再校准到逐关上升的五维战力。表中属性仅用于关卡对手，不改动可招募球员。第 44–50 关依次为杜兰特、魔术师、库里、科比、奥尼尔、詹姆斯、乔丹的 SSR 卡。',
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
  '第 51 关起按同一顺序反复挑战这七名 SSR。每完成一轮升一星，第 51–57 关为二星，第 107 关起为十星；十星之后继续提高关卡属性，防止新一轮难度回落。对手星级与战力会在赛前页和战报中显示。',
  '',
  '综合战力逐关上升，但实际胜率仍受对手的属性分布、出手方式、我方阵容及策略影响，需要继续试玩校准。',
  '');

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'opponent-roster.md'), lines.join('\n'));
