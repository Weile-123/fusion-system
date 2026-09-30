const fs = require('node:fs');
const path = require('node:path');
const D = require('../h5/game-data.js');

const csv = rows => '\ufeff' + rows
  .map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
  .join('\n') + '\n';
const outDir = path.join(__dirname, '..', 'docs', 'data');
fs.mkdirSync(outDir, { recursive: true });

function writeFileIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  fs.writeFileSync(file, content);
}

const players = D.STAR_ROWS.map(row => ({
  id: row[0], name: row[1], tier: row[2], role: row[3], team: row[4], best: D.LABELS[row[5]],
  attrs: Object.fromEntries(D.ATTRS.map((attr, index) => [attr, row[6][index]])),
  talent: row[7], talentEffect: D.TALENT_DETAILS[row[0]].description, variantOf: row[8] || ''
}));
const byId = Object.fromEntries(players.map(player => [player.id, player]));

writeFileIfChanged(path.join(outDir, 'my-game-players.csv'), csv([
  ['ID', '球员', '等级', '位置', '球队/标签', '推荐槽位', '三分', '中投', '突破', '控球', '篮下', '防守', '专属天赋', '技能效果', 'SSR原型'],
  ...players.map(player => [player.id, player.name, player.tier, player.role, player.team, player.best,
    ...D.ATTRS.map(attr => player.attrs[attr]), player.talent, player.talentEffect,
    player.variantOf ? byId[player.variantOf].name : ''])
]));

const mdCell = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
const playerInfo = [
  '# 当前全部球员信息', '',
  '> 本表由正式游戏数据自动生成。A/B/C、S 与 SSR 技能均已接入正式游戏。', '',
  '| 球员 | 等级 | 位置 | 推荐槽位 | 三分 | 中投 | 突破 | 控球 | 篮下 | 防守 | 技能 | 技能效果 |',
  '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ...players.map(player => `| ${[player.name, player.tier, player.role, player.best,
    ...D.ATTRS.map(attr => player.attrs[attr]), player.talent, player.talentEffect].map(mdCell).join(' | ')} |`), ''
].join('\n');
writeFileIfChanged(path.join(outDir, 'current-player-information.md'), playerInfo);

writeFileIfChanged(path.join(outDir, 'my-game-bonds.csv'), csv([
  ['羁绊', '人数', '成员', '效果'],
  ...D.SYNERGIES.map(bond => [bond.name, bond.ids.length, bond.ids.map(id => byId[id].name).join('、'), bond.description])
]));

const tierSummary = ['C', 'B', 'A', 'S', 'SSR'].map(tier => {
  const list = players.filter(player => player.tier === tier);
  const scores = list.map(player => player.attrs[D.ATTRS.find(attr => D.LABELS[attr] === player.best)]);
  return `| ${tier} | ${list.length} | ${Math.min(...scores)}–${Math.max(...scores)} |`;
}).join('\n');
const catalog = `# 球员与羁绊数据总表

本页由 \`scripts/generate-catalogs.cjs\` 从正式游戏数据生成。CSV 使用 UTF-8 BOM，可直接用 Excel 打开和筛选。

## 当前游戏

| 等级 | 卡牌数 | 推荐属性分布 |
| --- | ---: | ---: |
${tierSummary}

- [全部球员信息（Markdown）](data/current-player-information.md)
- [全部球员信息（CSV）](data/my-game-players.csv)
- [全部羁绊、成员与效果](data/my-game-bonds.csv)

当前共 ${players.length} 张卡（${players.filter(player => !player.variantOf).length} 名基础球员、${players.filter(player => player.variantOf).length} 张 SSR 异名卡）和 ${D.SYNERGIES.length} 组羁绊。
`;
writeFileIfChanged(path.join(__dirname, '..', 'docs', 'player-and-bond-catalog.md'), catalog);
console.log(`Generated ${players.length} cards and ${D.SYNERGIES.length} game bonds.`);
