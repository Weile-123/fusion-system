import '../../h5/game-data.js';

const D = globalThis.SupFusionGameData;
export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
export const ATTRS = ['three', 'mid', 'drive', 'handle', 'inside', 'def', 'pass', 'rebound', 'stamina'];
export const LABELS = ['三分', '中投', '突破', '控球', '篮下', '防守', '传球', '篮板', '体能'];
const compatible = { PG: ['SG'], SG: ['PG', 'SF'], SF: ['SG', 'PF'], PF: ['SF', 'C'], C: ['PF'] };
export const PLAYERS = D.STAR_ROWS.map(row => {
  const pos = row[3] === 'G' ? 'SG' : row[3] === 'F' ? 'SF' : row[3];
  const a = Object.fromEntries(ATTRS.slice(0, 6).map((key, i) => [key, row[6][i]]));
  return { id: row[0], identity: typeof row[8] === 'string' ? row[8] : row[0], name: row[1], tier: row[2], pos, secondary: compatible[pos] || [], team: row[4], attrs: { ...a, pass: Math.round(a.handle * .75 + a.mid * .25), rebound: Math.round(a.inside * .55 + a.def * .45), stamina: row[2] === 'SSR' ? 96 : 80 + Math.round(a.drive / 10) } };
});
export const BY_ID = Object.fromEntries(PLAYERS.map(p => [p.id, p]));
export const TALENTS = [
  { id: 'space', name: '空间时代', text: '首发三分 +7；外线战术三分出手更多', stats: { three: 7 } },
  { id: 'paint', name: '禁区王朝', text: '首发篮下 +7、篮板 +4', stats: { inside: 7, rebound: 4 } },
  { id: 'defense', name: '铁血防线', text: '首发防守 +8', stats: { def: 8 } },
  { id: 'passing', name: '团队篮球', text: '首发传球 +8、控球 +3', stats: { pass: 8, handle: 3 } },
  { id: 'training', name: '球员学院', text: '训练花费 -2 奖金，最低 1', discount: 2 },
  { id: 'business', name: '冠军预算', text: '开局奖金 +12；每次获胜额外 +2 奖金', cash: 12, win: 2 },
  { id: 'rotation', name: '深度轮换', text: '体能 +10；兼任位置适配率提升至 100%', stats: { stamina: 10 } },
  { id: 'rebound', name: '二次进攻', text: '首发篮板 +10', stats: { rebound: 10 } },
  { id: 'transition', name: '快攻风暴', text: '首发突破 +7、体能 +4', stats: { drive: 7, stamina: 4 } },
  { id: 'balanced', name: '均衡体系', text: '首发前八项属性 +3', stats: Object.fromEntries(ATTRS.slice(0, 8).map(k => [k, 3])) },
  { id: 'bargain', name: '精明经理', text: '付费招募 -2 奖金；出售额外 +1 奖金', recruitDiscount: 2 },
  { id: 'clutch', name: '末节之王', text: '第四节投篮属性额外 +8', clutch: 8 }
];
export const GEARS = [
  { id: 'shoes1', name: '疾风战靴', slot: 'shoes', tier: 'B', cost: 6, stats: { drive: 4, stamina: 3 } },
  { id: 'shoes2', name: '射手之靴', slot: 'shoes', tier: 'A', cost: 10, stats: { three: 7, mid: 3 } },
  { id: 'shoes3', name: '冠军战靴', slot: 'shoes', tier: 'S', cost: 16, stats: { drive: 8, handle: 6, stamina: 5 } },
  { id: 'guard1', name: '启动护膝', slot: 'protect', tier: 'C', cost: 4, stats: { stamina: 5 } },
  { id: 'guard2', name: '铁壁护腕', slot: 'protect', tier: 'A', cost: 10, stats: { def: 7, rebound: 3 } },
  { id: 'guard3', name: '传奇护具', slot: 'protect', tier: 'S', cost: 16, stats: { def: 9, stamina: 8 } },
  { id: 'board1', name: '空间战术板', slot: 'board', tier: 'B', cost: 10, stats: { three: 3, pass: 2 } },
  { id: 'board2', name: '冠军战术板', slot: 'board', tier: 'S', cost: 20, stats: { pass: 5, handle: 3 } },
  { id: 'jersey1', name: '主场球衣', slot: 'jersey', tier: 'B', cost: 10, stats: { def: 3, stamina: 3 } },
  { id: 'jersey2', name: '王朝球衣', slot: 'jersey', tier: 'S', cost: 20, stats: { inside: 4, rebound: 4, def: 3 } }
];
const PAIRS = [
  ['水花兄弟', ['curry', 'klay'], { three: 6 }], ['OK组合', ['kobe', 'shaq'], { mid: 4, inside: 4 }],
  ['热火双核', ['lebron', 'wade'], { drive: 5, pass: 3 }], ['圣城基石', ['duncan', 'parker'], { def: 5, pass: 3 }],
  ['芝加哥双翼', ['jordan', 'pippen'], { mid: 4, def: 4 }], ['达拉斯双星', ['dirk', 'doncic'], { three: 4, pass: 4 }]
];
export function rng(seed) { let n = seed >>> 0; return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function random(g) { const next = rng(g.run.seed + g.run.counter++ * 7919); return next(); }
function sample(g, list, count) { const a = [...list]; const out = []; while (out.length < count && a.length) out.push(a.splice(Math.floor(random(g) * a.length), 1)[0]); return out; }
export const freshGame = () => ({ version: 1, mode: '5v5', savedAt: 0, profile: { legend: 0, bestOVR: 0, bestStage: 0, runs: 0, wins: 0 }, run: null });
const talent = r => TALENTS.find(t => t.id === r.talent) || { stats: {} };
export function fit(player, pos, r) { return player.pos === pos ? 1 : player.secondary.includes(pos) ? (r.talent === 'rotation' ? 1 : .95) : .8; }
export function bonds(players) {
  const out = [];
  const teams = new Map(); players.forEach(p => teams.set(p.team, (teams.get(p.team) || 0) + 1));
  for (const [team, n] of teams) if (n >= 2) out.push({ name: `${team}${n >= 3 ? '核心' : '连线'}`, stats: n >= 3 ? { pass: 4, def: 4, three: 2 } : { pass: 3, def: 2 } });
  for (const [name, ids, stats] of PAIRS) if (ids.every(id => players.some(p => p.identity === id))) out.push({ name, stats });
  return out;
}
export function playerStats(r, card, pos, activeBonds = []) {
  const p = BY_ID[card.id], mult = fit(p, pos, r), t = talent(r);
  const bonuses = [t.stats || {}, ...activeBonds.map(b => b.stats), ...card.gear.map(id => GEARS.find(g => g.id === id)?.stats || {}), ...Object.values(r.teamGear).map(id => GEARS.find(g => g.id === id)?.stats || {})];
  return Object.fromEntries(ATTRS.map(key => [key, Math.round((p.attrs[key] + (card.star - 1) * 5 + (key === 'stamina' ? 0 : card.training * 2) + bonuses.reduce((n, b) => n + (b[key] || 0), 0)) * mult)]));
}
export function playerOVR(r, card, pos = BY_ID[card.id].pos, activeBonds = []) {
  const a = playerStats(r, card, pos, activeBonds);
  const weights = { PG: [1, 1, 1, 2, .3, 1, 2, .3, .7], SG: [2, 2, 1, 1, .3, 1, 1, .3, .7], SF: [1, 1, 2, 1, 1, 2, 1, 1, .7], PF: [.5, 1, 1, .5, 2, 2, 1, 2, .7], C: [.2, 1, .5, .3, 3, 2, 1, 3, .7] }[pos];
  return Math.round(ATTRS.reduce((n, key, i) => n + a[key] * weights[i], 0) / weights.reduce((n, v) => n + v, 0));
}
export function starters(r) { return r.lineup.map(uid => r.cards.find(c => c.uid === uid)).filter(Boolean); }
export function teamOVR(r) { const b = bonds(starters(r).map(c => BY_ID[c.id])); return Math.round(r.lineup.reduce((n, uid, i) => { const c = r.cards.find(c => c.uid === uid); return n + (c ? playerOVR(r, c, POSITIONS[i], b) : 0); }, 0) / 5); }
function offers(g, pos) {
  const r = g.run, selected = [];
  for (let i = 0; i < 4; i++) {
    const roll = random(g), tier = roll < .005 && !pos ? 'SSR' : roll < .08 ? 'S' : roll < .35 ? 'A' : roll < .75 ? 'B' : 'C';
    const available = PLAYERS.filter(p => (!pos || (p.pos === pos && p.tier !== 'SSR')) && !selected.some(id => BY_ID[id].identity === p.identity) && (!pos || !r.cards.some(c => BY_ID[c.id].identity === p.identity)) && !r.cards.some(c => BY_ID[c.id].identity === p.identity && c.star >= (r.endless ? 5 : 3)));
    const pool = available.filter(p => p.tier === tier);
    const pick = sample(g, pool.length ? pool : available, 1)[0]; if (pick) selected.push(pick.id);
  }
  return selected;
}
function shop(g) { g.run.shop = sample(g, GEARS, 3).map(item => ({ id: item.id, bought: false })); }
export function startRun(g, seed = Date.now() >>> 0) {
  const next = structuredClone(g);
  next.run = { seed, counter: 0, stage: 1, wins: 0, losses: 0, morale: 3, gold: 20, cards: [], lineup: Array(5).fill(null), rotation: Array(5).fill(null), gear: [], teamGear: {}, talent: null, phase: 'talent', draftIndex: 0, choices: [], strategy: 'balanced', autoRotate: true, free: 1, recruitCount: 0, gearCount: 0, income: 20, peakOVR: 0, last: null, ended: false, settled: false, endless: false, trained: [], serial: 0 };
  next.run.talentChoices = sample(next, TALENTS, 3).map(t => t.id); shop(next); return next;
}
function addPlayer(g, id) {
  const r = g.run, p = BY_ID[id]; if (!p) throw new Error('球员不存在');
  const old = r.cards.find(c => BY_ID[c.id].identity === p.identity);
  if (old) { if (old.star >= (r.endless ? 5 : 3)) throw new Error('该球员已达到当前星级上限'); old.star++; if (p.tier === 'SSR') old.id = id; }
  else { if (r.cards.length >= 15) throw new Error('替补席已满，请先出售一名球员'); r.cards.push({ uid: `p${++r.serial}`, id, star: 1, training: 0, gear: [] }); }
  r.recruitCount++;
}
export function trainingCost(r, card) { return Math.max(1, (4 + card.training * 3) - (talent(r).discount || 0)); }
export function opponent(r) {
  const random = rng(r.seed + r.stage * 31337);
  const target = 62 + (Math.min(r.stage, 10) - 1) * 3 + Math.max(0, r.stage - 10) * 2;
  const players = POSITIONS.map(pos => {
    const pool = PLAYERS.filter(p => p.pos === pos && p.tier !== 'SSR');
    const p = pool[Math.floor(random() * pool.length)];
    const baseOVR = playerOVR({ talent: null, teamGear: {} }, { id: p.id, star: 1, training: 0, gear: [] }, pos);
    return { ...p, attrs: Object.fromEntries(ATTRS.map(k => [k, Math.max(15, Math.round(p.attrs[k] + target - baseOVR))])) };
  });
  return { name: ['街区联队', '城市精英', '区域劲旅', '锋线联盟', '铁血军团', '西部强敌', '东部霸主', '全明星队', '传奇联盟', '王朝守门人'][Math.min(r.stage, 10) - 1] || '无尽挑战者', ovr: Math.round(target), players };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function simulate(r) {
  if (starters(r).length !== 5) throw new Error('请先安排完整的五人首发阵容');
  const random = rng(r.seed + r.stage * 65537 + r.losses * 97), opp = opponent(r);
  const boxes = r.cards.map(c => ({ uid: c.uid, name: BY_ID[c.id].name, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, possessions: 0 }));
  const theirs = opp.players.map((p, i) => ({ ...boxes[0], uid: `o${i}`, name: p.name, points: 0 }));
  const lookup = uid => boxes.find(b => b.uid === uid);
  const fatigue = Object.fromEntries(r.cards.map(c => [c.uid, 0]));
  const quarters = [], logs = [], rotations = [], score = [0, 0]; let attacks = 0;
  function playPeriod(q, possessions) {
    const ids = [...r.lineup];
    if (q > 0 && r.autoRotate) {
      ids.forEach((uid, i) => { const reserve = r.rotation[i] ? r.cards.find(c => c.uid === r.rotation[i]) : r.cards.filter(c => !r.lineup.includes(c.uid) && !ids.includes(c.uid) && fit(BY_ID[c.id], POSITIONS[i], r) >= .95).sort((a, b) => playerOVR(r, b, POSITIONS[i]) - playerOVR(r, a, POSITIONS[i]))[0];
        if (reserve && !ids.includes(reserve.uid) && (fatigue[uid] || 0) > (fatigue[reserve.uid] || 0) + 5) { ids[i] = reserve.uid; rotations.push(`${q < 4 ? `第${q + 1}节` : '加时'} ${BY_ID[reserve.id].name}替换${BY_ID[r.cards.find(c => c.uid === uid).id].name}`); }
      });
    }
    const activeBonds = bonds(ids.map(uid => BY_ID[r.cards.find(c => c.uid === uid).id]));
    const us = ids.map((uid, i) => { const c = r.cards.find(card => card.uid === uid), a = playerStats(r, c, POSITIONS[i], activeBonds); const f = clamp(1 - (fatigue[uid] || 0) / (a.stamina * 2.4), .75, 1); return { uid, name: BY_ID[c.id].name, a: Object.fromEntries(ATTRS.map(k => [k, a[k] * f + (q === 3 && ['three', 'mid', 'inside'].includes(k) ? talent(r).clutch || 0 : 0)])) }; });
    const enemy = opp.players.map((p, i) => ({ uid: `o${i}`, name: p.name, a: p.attrs }));
    const before = [...score];
    for (let turn = 0; turn < possessions * 2; turn++) {
      const side = turn % 2, offense = side === 0 ? us : enemy, defense = side === 0 ? enemy : us, box = side === 0 ? lookup : uid => theirs.find(b => b.uid === uid);
      const strategy = side === 0 ? r.strategy : 'balanced';
      const weights = offense.map(p => Math.pow(strategy === 'space' ? p.a.three : strategy === 'paint' ? p.a.inside : (p.a.mid + p.a.drive) / 2, 2));
      let cursor = random() * weights.reduce((n, w) => n + w, 0), shooter = offense[4];
      for (let i = 0; i < 5; i++) { cursor -= weights[i]; if (cursor <= 0) { shooter = offense[i]; break; } }
      const defender = defense[offense.indexOf(shooter)], b = box(shooter.uid); attacks++; b.possessions++;
      if (random() < clamp(.12 + (defender.a.def - shooter.a.handle) / 550, .04, .22)) { b.turnovers++; (side === 0 ? theirs : boxes).find(v => v.uid === defender.uid).steals++; if (random() < .4) logs.push({ attack: attacks, quarter: q + 1, text: `${side === 0 ? '我方' : '对手'} ${shooter.name}被抢断`, score: [...score] }); continue; }
      const three = random() < (strategy === 'space' ? .56 : strategy === 'paint' ? .16 : .34);
      const skill = three ? shooter.a.three : strategy === 'paint' ? shooter.a.inside : (shooter.a.mid + shooter.a.drive + shooter.a.inside) / 3;
      const passing = offense.reduce((n, p) => n + p.a.pass, 0) / 5;
      const hit = clamp((three ? .35 : .57) + (skill - defender.a.def) / 180 + (passing - 75) / 650 + (strategy === 'transition' ? (shooter.a.stamina - 80) / 500 : 0), .15, .85);
      let points = 0, desc;
      if (random() < hit) { points = three ? 3 : 2; desc = three ? '三分命中' : '两分命中';
        if (random() < .65) { const helpers = offense.filter(p => p.uid !== shooter.uid); box(helpers[Math.floor(random() * helpers.length)].uid).assists++; }
      } else if (!three && random() < .15) { points = (random() < .8 ? 1 : 0) + (random() < .8 ? 1 : 0); desc = `罚球 ${points}/2`; }
      else { const offReb = offense.reduce((n, p) => n + p.a.rebound, 0) / 5, defReb = defense.reduce((n, p) => n + p.a.rebound, 0) / 5; const offensive = random() < clamp(.22 + (offReb - defReb) / 300, .1, .4); const rebTeam = offensive ? offense : defense; const rebounder = rebTeam.slice().sort((a, b) => b.a.rebound - a.a.rebound)[Math.floor(random() * 3)]; const ourRebound = (side === 0) === offensive; (ourRebound ? lookup : uid => theirs.find(v => v.uid === uid))(rebounder.uid).rebounds++;
        if (offensive && random() < .5) { points = 2; desc = '二次进攻得分'; } else { desc = '投篮未中'; if (!three && random() < .12) (side === 0 ? theirs : boxes).find(v => v.uid === defender.uid).blocks++; }
      }
      score[side] += points; b.points += points;
      if (points || random() < .15) logs.push({ attack: attacks, quarter: q + 1, text: `${side === 0 ? '我方' : '对手'} ${shooter.name} ${desc}${points ? ` +${points}` : ''}`, score: [...score] });
    }
    ids.forEach(uid => { fatigue[uid] += 16; });
    for (const c of r.cards) if (!ids.includes(c.uid)) fatigue[c.uid] = Math.max(0, fatigue[c.uid] - 12);
    quarters.push({ us: score[0] - before[0], them: score[1] - before[1] });
  }
  for (let q = 0; q < 4; q++) playPeriod(q, 12);
  let overtime = 0; while (score[0] === score[1] && overtime < 20) playPeriod(4 + overtime++, 3);
  // Rare repeated ties: a final free throw gives an explicit, recorded sudden-death result.
  if (score[0] === score[1]) { const side = random() < .5 ? 0 : 1; const b = side ? theirs[0] : lookup(r.lineup[0]); b.points++; score[side]++; quarters.push({ us: side ? 0 : 1, them: side ? 1 : 0 }); logs.push({ attack: ++attacks, quarter: quarters.length, text: `${b.name} 决胜罚球 +1`, score: [...score] }); }
  const mvp = boxes.slice().sort((a, b) => (b.points + b.rebounds + b.assists * 1.5 + b.steals * 2 + b.blocks * 2) - (a.points + a.rebounds + a.assists * 1.5 + a.steals * 2 + a.blocks * 2))[0];
  return { score, won: score[0] > score[1], quarters, boxes, theirs, logs, rotations, attacks, opponent: opp.name, stage: r.stage, mvp: mvp.name };
}
function spend(r, cost) { if (r.gold < cost) throw new Error('奖金不足'); r.gold -= cost; }
function settle(g) { const r = g.run; if (r.settled) return; r.ended = true; r.phase = 'report'; r.reward = Math.min(r.wins, 10) * 10 + Math.max(0, r.wins - 10) * 30; r.settled = true; g.profile.legend += r.reward; g.profile.runs++; g.profile.wins += r.wins; g.profile.bestOVR = Math.max(g.profile.bestOVR, r.peakOVR); g.profile.bestStage = Math.max(g.profile.bestStage, r.stage); }
export function act(game, action, payload) {
  const g = structuredClone(game), r = g.run; if (!r) throw new Error('请先开始新征程');
  if (r.ended) throw new Error('本局已结束');
  if (['lineup', 'rotation', 'sell', 'train', 'recruit', 'buy', 'equip', 'refresh', 'strategy', 'toggleRotation'].includes(action) && r.phase !== 'roster') throw new Error('请先返回阵容页面');
  if (action === 'talent') { if (r.phase !== 'talent' || !r.talentChoices.includes(payload)) throw new Error('请选择本局天赋'); r.talent = payload; r.gold += talent(r).cash || 0; r.income += talent(r).cash || 0; r.phase = 'draft'; r.choices = offers(g, 'PG'); }
  else if (action === 'pick') { if (!['draft', 'recruit'].includes(r.phase) || !r.choices.includes(payload)) throw new Error('请选择当前招募中的球员'); addPlayer(g, payload); r.choices = []; if (r.phase === 'draft') { r.lineup[r.draftIndex] = r.cards.at(-1).uid; r.draftIndex++; if (r.draftIndex === 5) r.phase = 'roster'; else r.choices = offers(g, POSITIONS[r.draftIndex]); } else r.phase = 'roster'; }
  else if (action === 'recruit') { if (r.cards.length >= 15) throw new Error('替补席已满，请先出售一名球员'); if (r.free > 0) r.free--; else spend(r, 8 - (talent(r).recruitDiscount || 0)); r.phase = 'recruit'; r.choices = offers(g); }
  else if (action === 'lineup') { const { uid, index } = payload; if (!r.cards.some(c => c.uid === uid) || index < 0 || index > 4) throw new Error('无效阵容'); const oldIndex = r.lineup.indexOf(uid); const old = r.lineup[index]; r.lineup[index] = uid; if (oldIndex >= 0) r.lineup[oldIndex] = old; r.rotation = r.rotation.map(v => r.lineup.includes(v) ? null : v); }
  else if (action === 'rotation') { const { uid, index } = payload; if (!Number.isInteger(index) || index < 0 || index > 4) throw new Error('无效轮换位置'); if (uid && (!r.cards.some(c => c.uid === uid) || r.lineup.includes(uid))) throw new Error('请选择替补席球员'); r.rotation = r.rotation.map(v => v === uid ? null : v); r.rotation[index] = uid || null; }
  else if (action === 'sell') { const c = r.cards.find(c => c.uid === payload); if (!c || r.lineup.includes(c.uid)) throw new Error('请先将球员移到替补席再出售'); r.gear.push(...c.gear); r.cards = r.cards.filter(v => v.uid !== c.uid); r.rotation = r.rotation.map(v => v === c.uid ? null : v); const cash = ({ C: 2, B: 3, A: 5, S: 8, SSR: 12 }[BY_ID[c.id].tier] || 2) * c.star + (r.talent === 'bargain' ? 1 : 0); r.gold += cash; }
  else if (action === 'train') { const c = r.cards.find(c => c.uid === payload); if (!c) throw new Error('球员不存在'); if (r.trained.includes(c.uid)) throw new Error('这名球员本关已训练'); if (c.training >= (r.endless ? Math.min(8, 3 + Math.floor((r.stage - 10) / 2)) : 3)) throw new Error('达到当前训练上限'); spend(r, trainingCost(r, c)); c.training++; r.trained.push(c.uid); }
  else if (action === 'refresh') { spend(r, 3); shop(g); }
  else if (action === 'buy') { const entry = r.shop[payload], item = GEARS.find(v => v.id === entry?.id); if (!item || entry.bought) throw new Error('装备已售出'); spend(r, item.cost); entry.bought = true; r.gear.push(item.id); r.gearCount++; }
  else if (action === 'equip') { const { id, uid } = payload, item = GEARS.find(v => v.id === id), at = r.gear.indexOf(id); if (!item || at < 0) throw new Error('装备不在仓库'); if (['board', 'jersey'].includes(item.slot)) { if (r.teamGear[item.slot]) r.gear.push(r.teamGear[item.slot]); r.teamGear[item.slot] = id; } else { const c = r.cards.find(v => v.uid === uid); if (!c) throw new Error('请选择球员'); const old = c.gear.find(v => GEARS.find(item => item.id === v).slot === item.slot); if (old) { c.gear = c.gear.filter(v => v !== old); r.gear.push(old); } c.gear.push(id); } r.gear.splice(at, 1); }
  else if (action === 'strategy') { if (!['balanced', 'space', 'paint', 'transition'].includes(payload)) throw new Error('无效战术'); r.strategy = payload; }
  else if (action === 'toggleRotation') r.autoRotate = !r.autoRotate;
  else if (action === 'battle') { if (r.phase !== 'roster') throw new Error('请先完成本次比赛结算'); r.peakOVR = Math.max(r.peakOVR, teamOVR(r)); r.last = simulate(r); const interest = Math.min(3, Math.floor(r.gold / 15)); const cash = (r.last.won ? 6 + Math.floor(r.stage / 3) + (talent(r).win || 0) : 3) + interest; r.last.reward = cash; r.last.interest = interest; r.gold += cash; r.income += cash; if (r.last.won) r.wins++; else { r.losses++; r.morale--; } r.phase = 'result'; }
  else if (action === 'next') { if (r.phase !== 'result') throw new Error('当前没有待结算比赛'); if (r.morale <= 0) settle(g); else if (r.last.won && r.stage === 10 && !r.endless) r.phase = 'champion'; else { if (r.last.won) { r.stage++; r.free = 1; r.trained = []; shop(g); } r.phase = 'roster'; } }
  else if (action === 'endless') { if (r.phase !== 'champion') throw new Error('请先完成主线十关'); r.endless = true; r.stage = 11; r.free = 1; r.trained = []; r.phase = 'roster'; shop(g); }
  else if (action === 'finish') { if (!['champion', 'roster'].includes(r.phase)) throw new Error('请先完成当前选择或比赛'); settle(g); }
  else throw new Error('操作不存在');
  r.peakOVR = Math.max(r.peakOVR, teamOVR(r)); return g;
}
