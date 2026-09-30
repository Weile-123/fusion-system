const fs = require('node:fs');
const path = require('node:path');
const C = require('../h5/game-core.js');

const groups = [
  ['通用装备', 'global'],
  ['位置装备', 'position'],
  ['经典球衣', 'signature']
];
const lines = [
  '# 装备设计',
  '',
  '装备池固定 **42 件**：C 4、B 4、A 26、S 8；通用 16、位置 14、经典球衣 12。装备部位为护腕、球鞋、头带、球衣、戒指、战术板，上阵装备每部位限一件。非球衣部位只能拥有一件，必须出售现有装备后才能购买同部位新装备；球衣可以继续购买，所有已购球衣都会出现在更衣室的球衣收藏中，当前穿着的球衣标为“已装备”，其余球衣可随时点击“装备”换装。只有上阵装备提供战力。购买后的商品卡片留在当前批次中并盖“已售”印章，刷新后已持有的装备不会再次进入商店。装备商店品质权重为 C 50、B 30、A 16、S 4。',
  '',
  '12 件球衣在商店中不显示品质，统一按 A 档基础售价 **20 奖金**、出售价 **8 奖金**，每件六维属性总加成均为 18 点。开局天赋仍可能改变实际购买价。装备直接穿在融合球员身上，无需绑定球员；穿着的球衣按自身数值生效。',
  '',
  '球衣购买卡片与更衣室已装备卡片使用对应球队队徽的描边色和队徽背景，球衣收藏使用对应配色的号码球衣矢量图。30 张队徽存放在 `h5/assets/logos/`；商店的球衣测试入口使用独立预览存档，不影响正式对局。',
  '',
  '旧装备 ID 得以保留；五件移出球衣部位的装备转为其他部位。读取旧存档时，额外球衣移入球衣收藏；非球衣同部位多余装备按出售价格返还奖金。',
  ''
];
for (const [title, kind] of groups) {
  const items = C.GEAR.filter(item => item.kind === kind);
  lines.push(`## ${title}（${items.length} 件）`, '', '| 品质 | 名称 | 部位 / 球员主题 | 买入 / 卖出 | 效果 |', '| --- | --- | --- | --- | --- |');
  for (const item of items) {
    const owner = item.exclusivePlayer ? C.BY_ID[item.exclusivePlayer]?.name : '';
    const condition = kind === 'signature' ? `${item.slot} · ${owner}` : item.slot;
    lines.push(`| ${kind === 'signature' ? '统一 A 档' : item.rarity} | ${item.name} | ${condition} | ${item.price} / ${item.sellPrice} | ${item.description} |`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(__dirname, '../docs/equipment-design.md'), lines.join('\n'), 'utf8');
