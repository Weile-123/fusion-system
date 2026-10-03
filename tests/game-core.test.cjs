const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const C = require('../h5/game-core.js');

const H5_ROOT = path.join(__dirname, '../h5');
const readH5 = (...parts) => fs.readFileSync(path.join(H5_ROOT, ...parts), 'utf8');
const readRoot = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
const readStyles = () => [
  ...fs.readdirSync(path.join(H5_ROOT, 'styles')).filter(file => file.endsWith('.css')).map(file => readH5('styles', file)),
  readH5('ssr-card.css')
].join('\n');

test('production JavaScript chunks remain valid ES modules', () => {
  const assets = path.join(__dirname, '../dist/assets');
  for (const file of fs.readdirSync(assets).filter((name) => name.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: fs.readFileSync(path.join(assets, file), 'utf8'),
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${file} failed syntax validation:\n${result.stderr}`);
  }
});

test('application shell is owned by Vite and React with external styles', () => {
  const html = readRoot('index.html');
  const app = readRoot('src', 'App.jsx');
  const styles = readRoot('src', 'styles.js');
  const tailwind = readH5('styles', 'tailwind.css');
  const pages = ['home', 'talent', 'recruit', 'roster', 'shop', 'duel', 'result', 'report', 'profile', 'pointshop'];
  assert.doesNotMatch(html, /<style(?:\s|>)/);
  assert.doesNotMatch(html, /<main id=/);
  assert.match(html, /id="root"/);
  assert.match(html, /src="\/src\/main\.jsx"/);
  assert.match(styles, /\.\.\/h5\/styles\/base\.css/);
  assert.match(styles, /\.\.\/h5\/styles\/tailwind\.css/);
  assert.match(tailwind, /\.contents\{/);
  assert.match(tailwind, /\.grid-cols-2\{/);
  for (const page of pages) {
    assert.match(app, new RegExp(`['"]${page}['"]`));
  }
});

test('Vite entry mounts all React screens and preserves the validated game runtime', () => {
  const html = readRoot('index.html');
  const main = readRoot('src', 'main.jsx');
  const app = readRoot('src', 'App.jsx');
  const screens = readRoot('src', 'react-screens.jsx');
  const runtime = readRoot('src', 'runtime-loader.js');
  const config = readRoot('vite.config.mjs');
  const ui = readH5('game-ui.js');

  assert.match(html, /id="root"/);
  assert.match(html, /src="\/src\/main\.jsx"/);
  assert.match(main, /createRoot\(document\.getElementById\('root'\)\)/);
  assert.match(app, /id="page-root"/);
  assert.match(app, /const screens = \['home', 'leaderboard', 'talent', 'recruit', 'roster', 'shop', 'duel', 'result', 'report', 'profile', 'pointshop'\]/);
  assert.match(app, /installReactScreens/);
  assert.match(screens, /function HomeScreen/);
  assert.match(screens, /function TalentScreen/);
  assert.match(screens, /function TopBar/);
  assert.match(screens, /heartFillHeight = 18 \* \(morale \/ 3\)/);
  assert.match(screens, /clipPath="url\(#life-heart-fill\)"/);
  assert.doesNotMatch(screens, /fillOpacity=\{morale \/ 3\}/);
  assert.match(screens, /function DuelScreen/);
  assert.match(screens, /function ResultScreen/);
  assert.match(screens, /function CareerReportScreen/);
  assert.match(screens, /data-act="battle"/);
  assert.match(screens, /function MarkupScreen/);
  assert.match(ui, /Object\.values\(els\)\.forEach\(adoptReactRenderer\)/);
  assert.match(screens, /element\.dataset\.renderer = 'react'/);
  assert.match(screens, /data-act="begin"/);
  assert.match(runtime, /await import\('\.\.\/h5\/game-core\.js'\)/);
  assert.match(runtime, /await import\('\.\.\/h5\/game-ui\.js'\)/);
  assert.match(config, /publicDir:\s*false/);
  assert.match(config, /legacyStaticAssets/);
});

test('React markup conversion and top-bar rendering avoid unsafe HTML injection', () => {
  const screens = readRoot('src', 'react-screens.jsx');
  const ui = readH5('game-ui.js');
  assert.doesNotMatch(screens, /DOMParser|innerHTML|insertAdjacentHTML/);
  assert.match(screens, /function parseGeneratedMarkup/);
  assert.match(screens, /const allowedTags = new Set/);
  assert.match(screens, /const allowedAttributes = new Set/);
  assert.match(screens, /lowerName === 'src'.*assets/);
  assert.doesNotMatch(screens, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(ui, /\.innerHTML\s*=/);
  assert.match(ui, /header\.replaceChildren\(\)/);
  assert.match(ui, /strong\.textContent=String\(value\)/);
});

function draftedRun(seed = 42) {
  const run = C.createRun('outside', seed);
  for (let i = 0; i < 6; i++) {
    const offer = C.makeOffer(run);
    assert.equal(new Set(offer).size, 4);
    const result = C.recruit(run, offer[0]);
    assert.equal(result.ok, true);
  }
  assert.equal(C.starterCount(run), 6);
  return run;
}

test('fourth edition player and synergy data forms a complete network', () => {
  const basePlayers = C.STARS.filter(star => !star.variantOf);
  const variants = C.STARS.filter(star => star.variantOf);
  assert.equal(basePlayers.length, 110);
  assert.equal(variants.length, 8);
  assert.deepEqual(
    Object.fromEntries(['C', 'B', 'A', 'S', 'SSR'].map(tier => [tier, C.STARS.filter(star => star.tier === tier).length])),
    { C: 11, B: 53, A: 32, S: 14, SSR: 8 }
  );
  assert.equal(C.BY_ID.harden.tier, 'S');
  assert.equal(C.BY_ID.jokic.tier, 'A');
  assert.equal(C.BY_ID.fisher.tier, 'C');
  assert.equal(C.SYNERGIES.length, 81);
  assert.deepEqual(
    Object.fromEntries([2, 3, 4, 5].map(size => [size, C.SYNERGIES.filter(bond => bond.ids.length === size).length])),
    { 2: 44, 3: 17, 4: 15, 5: 5 }
  );
  const covered = new Set(C.SYNERGIES.flatMap(bond => bond.ids));
  assert.deepEqual(basePlayers.filter(star => !covered.has(star.id)).map(star => star.id), []);
  assert.deepEqual(C.STARS.filter(star => C.starSynergies(star.id).length === 0).map(star => star.id), []);
  for (const bond of C.SYNERGIES) {
    assert.equal(new Set(bond.ids).size, bond.ids.length);
    assert.ok(bond.ids.every(id => C.BY_ID[id] && !C.BY_ID[id].variantOf));
    assert.ok(bond.description.length > 0);
    assert.ok(Object.keys(bond.effect.dimensions).every(key => Object.hasOwn(C.COMBAT_LABELS, key)));
    assert.equal(bond.effect.stats, undefined);
  }
});

test('all cards use six attributes with distinct tier strengths and weaknesses', () => {
  assert.deepEqual(C.ATTRS, ['three', 'mid', 'drive', 'handle', 'inside', 'def']);
  assert.equal(C.LABELS.inside, '篮下');
  assert.equal(C.LABELS.post, undefined);
  assert.equal(C.LABELS.rebound, undefined);
  const ceilings = { C: 90, B: 91, A: 96, S: 103, SSR: 128 };
  const mainFloors = { C: 78, B: 79, A: 86, S: 94, SSR: 120 };
  for (const star of C.STARS) {
    assert.deepEqual(Object.keys(star.attrs), C.ATTRS);
    assert.ok(Object.values(star.attrs).every(value => value <= ceilings[star.tier]));
    assert.ok(star.attrs[star.best] >= mainFloors[star.tier]);
    if (star.tier !== 'SSR') assert.equal(star.attrs[star.best], Math.max(...Object.values(star.attrs)));
    assert.ok(C.ATTRS.includes(star.talentEffect.attr));
    assert.match(star.talentEffect.description, /安排在.+槽/);
    assert.match(star.talentEffect.description, /%|奖金/);
  }
  const talentTemplates = {
    three: { dimensions: { shooting: 6 } },
    mid: { dimensions: { shooting: 4.2, creation: 1.8 } },
    drive: { dimensions: { creation: 2.4, finishing: 3.6 } },
    handle: { dimensions: {}, postBattleCash: 1 },
    inside: { dimensions: { finishing: 10 } },
    def: { dimensions: { perimeterStop: 2.5, rimStop: 2.5, creation: 5 } }
  };
  for (const tier of ['C', 'B', 'A']) {
    const stars = C.STARS.filter(star => star.tier === tier);
    assert.ok(stars.length > 0);
    assert.ok(stars.every(star => star.talentEffect.attr === star.best));
    assert.ok(stars.every(star => star.talentEffect.slots.length === 1 && star.talentEffect.slots[0] === star.best));
    assert.ok(stars.every(star => {
      const expected = talentTemplates[star.best];
      return Object.entries(expected.dimensions).every(([key,value]) => Math.abs(star.talentEffect.dimensions[key]-value)<1e-9)
        && Object.keys(star.talentEffect.dimensions).length === Object.keys(expected.dimensions).length
        && (star.talentEffect.postBattleCash || 0) === (expected.postBattleCash || 0);
    }));
  }
  assert.equal(C.BY_ID.benwallace.tier, 'B');
  assert.equal(C.BY_ID.benwallace.best, 'def');
  assert.ok(C.BY_ID.benwallace.attrs.def > C.BY_ID.benwallace.attrs.three);
  assert.equal(C.BY_ID.durant.tier, 'S');
  assert.equal(C.BY_ID.durant.attrs.drive, 90);
  assert.equal(C.BY_ID.durant.attrs.inside, 84);
  for (const [tier, lower, upper] of [['C', 55, 62], ['B', 65, 71], ['A', 73, 79], ['S', 80, 86]]) {
    const stars = C.STARS.filter(star => star.tier === tier);
    const mean = stars.reduce((sum, star) => sum + C.ATTRS.reduce((total, attr) => total + star.attrs[attr], 0) / C.ATTRS.length, 0) / stars.length;
    assert.ok(mean >= lower && mean <= upper, `${tier} mean ${mean.toFixed(1)} should stay inside its reference-based band`);
  }
});

test('SSR cards include eight distinct legends with a defense specialist', () => {
  const expected = [
    ['king_lebron', '天选·詹姆斯', [99, 108, 125, 110, 121, 112], '霸王踏步'],
    ['air_jordan', 'GOAT·乔丹', [94, 125, 121, 106, 113, 120], '神之领域'],
    ['mamba_kobe', '黑曼巴·科比', [108, 120, 117, 108, 108, 117], '曼巴时刻'],
    ['chef_curry', '三分王·库里', [125, 118, 111, 118, 99, 91], '三分引力'],
    ['diesel_shaq', '大鲨鱼·奥尼尔', [85, 94, 97, 90, 128, 125], '禁区粉碎'],
    ['stone_duncan', '石佛·邓肯', [88, 104, 96, 91, 122, 128], '石佛镇守'],
    ['showtime_magic', '魔术师·约翰逊', [91, 104, 110, 125, 111, 103], '表演时刻'],
    ['reaper_durant', '死神·杜兰特', [116, 122, 115, 109, 112, 105], '死神终结']
  ];
  assert.deepEqual(
    C.STARS.filter(star => star.tier === 'SSR').map(star => [star.id, star.name, C.ATTRS.map(attr => star.attrs[attr]), star.talent]),
    expected
  );
  const ssr = C.STARS.filter(star => star.tier === 'SSR');
  assert.ok(ssr.every(star => star.maxStars === 10));
  assert.deepEqual(C.BY_ID.king_lebron.talentEffect.slots, ['drive', 'handle']);
  assert.equal(C.BY_ID.air_jordan.talentEffect.slotEffects.mid.dimensions.shooting, 21);
  assert.equal(C.BY_ID.mamba_kobe.talentEffect.slotEffects.drive.strategyDimensions.drive.shooting, 7);
  assert.equal(C.BY_ID.chef_curry.talentEffect.slotEffects.three.dimensions.shooting, 35);
  assert.deepEqual(C.BY_ID.diesel_shaq.talentEffect.slotEffects.def.dimensions, { finishing: 18, perimeterStop: 9, rimStop: 9 });
  assert.equal(C.BY_ID.stone_duncan.best, 'def');
  assert.equal(C.BY_ID.stone_duncan.attrs.def, Math.max(...Object.values(C.BY_ID.stone_duncan.attrs)));
  assert.deepEqual(C.BY_ID.stone_duncan.talentEffect.slotEffects.def.dimensions, { perimeterStop: 17.5, rimStop: 17.5 });
  assert.equal(C.BY_ID.stone_duncan.talentEffect.slotEffects.def.strategyDimensions.collapse.finishing, 12);
  assert.equal(C.BY_ID.showtime_magic.talentEffect.slotEffects.handle.postBattleCash, 3);
  assert.equal(C.BY_ID.showtime_magic.talentEffect.slotEffects.handle.recruitDiscount, 1);
  assert.equal(C.BY_ID.reaper_durant.talentEffect.slotEffects.mid.allDimensions, 12);
});

test('SSR talents activate their slot, strategy, and economy branches', () => {
  const curry = C.createRun('outside', 20260922);
  curry.offer = [];
  curry.owned.chef_curry = { stars: 1, train: 0, trainedAt: 0 };
  curry.slots.three = 'chef_curry';
  const outside = C.fused(curry, 'outside');
  const collapse = C.fused(curry, 'collapse');
  assert.deepEqual(outside.stats, collapse.stats);
  assert.ok(outside.dimensions.creation > collapse.dimensions.creation);
  assert.equal(outside.talentEffects[0].dimensions.shooting, 35);

  const magic = C.createRun('outside', 20260922);
  magic.offer = [];
  magic.owned.showtime_magic = { stars: 1, train: 0, trainedAt: 0 };
  magic.slots.handle = 'showtime_magic';
  assert.equal(C.recruitCost(magic), 7);
  assert.equal(C.fused(magic).talentEffects[0].postBattleCash, 3);
  magic.slots.handle = null;
  magic.slots.three = 'showtime_magic';
  assert.equal(C.recruitCost(magic), 8);
  assert.equal(C.fused(magic).talents.length, 0);
});

test('approved player specialties use their revised recommended slots', () => {
  const revised = {
    barkley: 'drive', butler: 'drive', payton: 'handle', dumars: 'mid', harper: 'handle',
    marion: 'drive', laimbeer: 'three', bosh: 'mid', griffin: 'drive', aaron_gordon: 'drive',
    lopez: 'three', fox: 'mid', caruso: 'handle', anunoby: 'drive'
  };
  for (const [id, best] of Object.entries(revised)) assert.equal(C.BY_ID[id].best, best);
  const unchanged = { kawhi: 'def', embiid: 'inside', green: 'def', iguodala: 'def', jokic: 'inside' };
  for (const [id, best] of Object.entries(unchanged)) assert.equal(C.BY_ID[id].best, best);
});

test('requested three four and five player bonds use the approved members', () => {
  const expected = {
    four_shooting_guards: ['kobe', 'tmac', 'carter', 'iverson'],
    banana_boat: ['lebron', 'wade', 'paul', 'melo'],
    draft_96: ['kobe', 'iverson', 'nash', 'rayallen'],
    european_kings: ['dirk', 'pau', 'jokic', 'doncic'],
    bad_boys: ['isiah', 'dumars', 'laimbeer', 'rodman'],
    four_centers: ['hakeem', 'shaq', 'robinson', 'ewing'],
    bucks_system: ['giannis', 'lillard', 'holiday', 'lopez'],
    death_lineup: ['curry', 'klay', 'iguodala', 'durant', 'green'],
    bulls_dynasty: ['harper', 'jordan', 'pippen', 'rodman', 'longley'],
    ok_dynasty: ['fisher', 'kobe', 'fox', 'horry', 'shaq'],
    showtime_five: ['magic', 'byron_scott', 'worthy', 'ac_green', 'kareem'],
    final_answer: ['magic', 'jordan', 'lebron', 'duncan', 'shaq'],
    thunder_three: ['durant', 'westbrook', 'harden'],
    heat_big_three: ['lebron', 'wade', 'bosh'],
    celtic_big_three: ['pierce', 'garnett', 'rayallen'],
    bull_triangle: ['jordan', 'pippen', 'rodman'],
    nets_big_three: ['durant', 'harden', 'irving'],
    lob_city: ['paul', 'griffin', 'deandre'],
    celtic_dynasty: ['bird', 'mchale', 'parish'],
    ok3: ['westbrook', 'george', 'melo'],
    gdp: ['duncan', 'parker', 'ginobili'],
    mamba_students: ['kobe', 'irving', 'tatum'],
    cavs_big_three: ['lebron', 'irving', 'love'],
    era_shooters: ['reggie', 'rayallen', 'curry'],
    seven_seconds: ['nash', 'amare', 'marion'],
    nuggets_core: ['jokic', 'murray', 'aaron_gordon'],
    scoring_kaleidoscope: ['kobe', 'melo', 'durant'],
    floor_generals: ['paul', 'kidd', 'nash'],
    violent_dunkers: ['wilkins', 'carter', 'griffin']
  };
  for (const [id, ids] of Object.entries(expected)) {
    assert.deepEqual(C.SYNERGIES.find(bond => bond.id === id)?.ids, ids, id);
  }
  assert.equal(C.SYNERGIES.some(bond => bond.name === '03黄金一代'), false);
  assert.deepEqual(C.SYNERGIES.find(bond => bond.id === 'banana_boat').ids, ['lebron', 'wade', 'paul', 'melo']);
});

test('adjacent bond sizes do not repeat the same complete core', () => {
  const overlaps = [2, 3, 4].flatMap(size => {
    const smaller = C.SYNERGIES.filter(bond => bond.ids.length === size);
    const larger = C.SYNERGIES.filter(bond => bond.ids.length === size + 1);
    return smaller.flatMap(core => larger.filter(group => core.ids.every(id => group.ids.includes(id))).map(group => [core.name, group.name]));
  });
  assert.deepEqual(overlaps, []);
});

test('every base S player belongs to at least one four-player bond', () => {
  const fourPlayerIds = new Set(C.SYNERGIES.filter(bond => bond.ids.length === 4).flatMap(bond => bond.ids));
  const missing = C.STARS.filter(player => player.tier === 'S' && !player.variantOf && !fourPlayerIds.has(player.id)).map(player => player.name);
  assert.deepEqual(missing, []);
});

test('bond budgets rise by group size and recurring cash consumes power budget', () => {
  const budget = bond => Object.values(bond.effect.dimensions).reduce((sum, value) => sum + value, 0)
    + (bond.effect.winCash + bond.effect.stageCash) * 4
    + bond.effect.freeRecruit * 6;
  const ranges = { 2: [7, 9], 3: [12, 17], 4: [19, 22], 5: [27, 43] };
  for (const bond of C.SYNERGIES) {
    const [min, max] = ranges[bond.ids.length];
    assert.ok(budget(bond) >= min - 1e-8 && budget(bond) <= max + 1e-8, bond.name + ': ' + budget(bond));
  }
});

test('multi-player bonds provide varied combat, economy, and recruit effects without morale bonuses', () => {
  const multi = C.SYNERGIES.filter(bond => bond.ids.length >= 3);
  assert.ok(multi.filter(bond => bond.effect.stageCash > 0).length >= 10);
  assert.ok(multi.filter(bond => bond.effect.winCash > 0).length >= 10);
  assert.ok(multi.filter(bond => bond.effect.freeRecruit > 0).length >= 3);
  assert.deepEqual(multi.filter(bond => 'morale' in bond.effect || /士气/.test(bond.description)), []);
});

test('hard four and five player bonds trade attribute points for reference-scale economy rewards', () => {
  const byId = id => C.SYNERGIES.find(bond => bond.id === id).effect;
  assert.equal(byId('banana_boat').stageCash, 3);
  assert.equal(byId('four_shooting_guards').winCash, 2);
  assert.equal(byId('bulls_dynasty').stageCash, 4);
  assert.equal(byId('ok_dynasty').winCash, 3);
  assert.equal(byId('death_lineup').freeRecruit, 2);
  assert.deepEqual([byId('final_answer').stageCash, byId('final_answer').winCash], [4, 3]);
  assert.equal(Math.round(Object.values(byId('final_answer').dimensions).reduce((sum,value)=>sum+value,0)), 15);
  assert.deepEqual(Object.keys(byId('final_answer').dimensions).sort(), Object.keys(C.COMBAT_LABELS).sort());
  assert.equal(C.SYNERGIES.filter(bond => bond.ids.length === 2 && (bond.effect.stageCash || bond.effect.winCash)).length, 10);
});

test('Warriors bonds stack while completed upgrade chains keep only their highest package', () => {
  const run = C.createRun('outside', 9);
  for (const id of ['curry', 'klay', 'green']) run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  assert.deepEqual(C.activeSynergies(run).map(bond => bond.id).sort(), ['splash', 'warrior_brain']);
  for (const id of ['iguodala', 'durant']) run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  assert.deepEqual(C.activeSynergies(run).filter(bond => ['splash','warrior_brain','death_lineup'].includes(bond.id)).map(bond => bond.id).sort(), ['death_lineup','splash','warrior_brain']);

  const bucks = C.createRun('outside', 11);
  for (const id of ['giannis','lillard','holiday','lopez']) bucks.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  const bucksSystem = C.activeSynergies(bucks).find(bond => bond.id === 'bucks_system');
  assert.deepEqual(bucksSystem.ids, ['giannis','lillard','holiday','lopez']);
  assert.equal(bucksSystem.effect.winCash, 2);
  assert.equal(Math.round(Object.values(bucksSystem.effect.dimensions).reduce((sum,value)=>sum+value,0)), 12);

  const bulls = C.createRun('outside', 10);
  for (const id of ['jordan', 'pippen', 'rodman']) bulls.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  assert.deepEqual(C.activeSynergies(bulls).filter(bond => bond.chainId === 'bulls_dynasty').map(bond => bond.id), ['bull_triangle']);
  for (const id of ['harper', 'longley']) bulls.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  assert.deepEqual(C.activeSynergies(bulls).filter(bond => bond.chainId === 'bulls_dynasty').map(bond => bond.id), ['bulls_dynasty']);
});
test('the six mandatory opening drafts exclude recruited players', () => {
  const run = C.createRun('outside', 20260921);
  const recruited = new Set();
  for (let pick = 0; pick < 6; pick++) {
    assert.equal(run.offer.length, 4);
    assert.equal(new Set(run.offer).size, 4);
    assert.ok(run.offer.every(id => !recruited.has(id)));
    const selected = run.offer[0];
    assert.equal(C.recruit(run, selected).ok, true);
    recruited.add(selected);
    if (pick < 5) C.makeOffer(run);
  }
  assert.equal(recruited.size, 6);
  assert.equal(C.starterCount(run), 6);
});

test('draft rarity uses lower opening weights and keeps SSR group-based', () => {
  const run = C.createRun('outside', 11);
  const early = C.tierOdds(run);
  assert.deepEqual(early, { C: 64.8, B: 30, A: 5, S: 0.2, SSR: 0.8 });
  run.offer = [];
  run.recruitGroups = 6;
  assert.deepEqual(C.tierOdds(run), { C: 57.3, B: 30, A: 12, S: 0.7, SSR: 0.8 });
  run.stage = 5;
  assert.deepEqual(C.tierOdds(run), { C: 27, B: 27, A: 40, S: 6, SSR: 0.8 });
  run.stage = 8;
  assert.deepEqual(C.tierOdds(run), { C: 15, B: 21, A: 54, S: 10, SSR: 0.8 });
  run.rarityBonus = 5;
  const upgraded = C.tierOdds(run);
  assert.ok(upgraded.S > 10);
  assert.ok(upgraded.SSR > 0.8);
  assert.ok(Math.abs(['C', 'B', 'A', 'S'].reduce((sum, tier) => sum + upgraded[tier], 0) - 100) < 1e-9);
});

test('SSR is rolled once per four-player group and never appears twice', () => {
  const run = C.createRun('outside', 20260922);
  run.offer = [];
  run.recruitGroups = 6;
  let ssrGroups = 0;
  for (let group = 0; group < 20000; group++) {
    run.offer = [];
    const offer = C.makeOffer(run);
    const ssrCount = offer.filter(id => C.BY_ID[id].tier === 'SSR').length;
    assert.ok(ssrCount <= 1);
    if (ssrCount) ssrGroups++;
  }
  const observed = ssrGroups / 20000;
  assert.ok(observed > 0.006 && observed < 0.01, observed);
});

test('rare recruit guarantee places one SSR and one S in every generated offer', () => {
  const run = C.createRun('outside', 20260929);
  run.forceRareRecruit = true;
  for (let group = 0; group < 40; group++) {
    run.offer = [];
    const tiers = C.makeOffer(run).map(id => C.BY_ID[id].tier);
    assert.ok(tiers.includes('SSR'), tiers.join(','));
    assert.ok(tiers.includes('S'), tiers.join(','));
  }
});

test('draft pity guarantees A and S tiers at the documented thresholds', () => {
  const aRun = C.createRun('outside', 99);
  aRun.offer = [];
  aRun.recruitGroups = 6;
  aRun.noAPlusGroups = 3;
  assert.ok(C.makeOffer(aRun).some(id => ['A', 'S', 'SSR'].includes(C.BY_ID[id].tier)));

  const sRun = C.createRun('outside', 101);
  sRun.offer = [];
  sRun.recruitGroups = 6;
  sRun.noSPlusGroups = 11;
  assert.ok(C.makeOffer(sRun).some(id => ['S', 'SSR'].includes(C.BY_ID[id].tier)));
});

test('opening A and B guarantees do not promote the guaranteed card to S', () => {
  let groups = 0, aGroups = 0, sGroups = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const run = C.createRun('outside', seed);
    for (let pick = 0; pick < 6; pick++) {
      const offer = C.makeOffer(run), tiers = offer.map(id => C.BY_ID[id].tier);
      groups++;
      if (tiers.some(tier => ['A', 'S', 'SSR'].includes(tier))) aGroups++;
      if (tiers.some(tier => ['S', 'SSR'].includes(tier))) sGroups++;
      C.recruit(run, offer[0]);
    }
  }
  assert.ok(aGroups / groups < .42, aGroups / groups);
  assert.ok(sGroups / groups < .025, sGroups / groups);
});

test('mobile shell locks outer scrolling and resets the active inner screen', () => {
  const css = readStyles();
  const ui = readH5('game-ui.js');
  assert.match(css, /html,body\{[^}]*overflow:hidden;[^}]*overscroll-behavior:none/);
  assert.match(css, /\.screen\{[^}]*overflow-y:auto;[^}]*overscroll-behavior-y:contain/);
  assert.match(ui, /els\[id\]\?\.scrollTo\(\{top:0,behavior:'auto'\}\)/);
  assert.doesNotMatch(ui, /window\.scrollTo/);
});

test('home artwork is full bleed while scores and actions retain safe spacing', () => {
  const css = readStyles();
  const screens = readRoot('src', 'react-screens.jsx');
  const ui = readH5('game-ui.js');
  assert.match(css, /\.app\.home-mode #home\{padding-left:0;padding-right:0\}/);
  assert.match(css, /#home \.home-label,#home \.home-hero\{padding-left:21px;padding-right:21px\}/);
  assert.match(css, /#home \.home-scores\{left:21px;right:21px\}/);
  assert.match(css, /#home \.home-primary,#home \.home-entry-row\{margin-top:10px\}/);
  assert.doesNotMatch(screens, /home-game-logo/);
  assert.doesNotMatch(ui, /home-game-logo/);
  assert.match(ui, /home-pointshop" data-act="pointshop">点数商店<\/button><button class="home-secondary home-profile" data-act="profile">传奇档案<\/button>/);
});

test('GOAT peak, reference merit, settlement unlocks, and permanent upgrades share one progression model', () => {
  const early = C.createRun('outside', 1);
  early.stage = 5;
  assert.equal(C.legendPoints(early), 0);
  early.lastBattle = { won: true };
  assert.equal(C.legendPoints(early), 50);

  const game = C.createGame(), run = game.run = draftedRun();
  run.stage = 13;
  run.endless = true;
  run.endlessWins = 3;
  run.maxGoat = 777;
  run.collectedJerseys = ['curry_wrist'];
  const ownedAtSettlement = Object.keys(run.owned);
  assert.equal(C.finishRun(game), 350);
  assert.equal(game.profile.legend, 350);
  assert.equal(game.profile.runs, 1);
  assert.equal(game.profile.clears, 1);
  assert.equal(game.profile.highestStage, 13);
  assert.equal(game.profile.bestGoat, 777);
  assert.deepEqual(new Set(game.profile.discovered), new Set(ownedAtSettlement));
  assert.deepEqual(game.profile.jerseys, ['curry_wrist']);
  assert.equal(C.finishRun(game), 0);

  assert.equal(C.buyMetaUpgrade(game.profile, 'startGold'), true);
  const upgraded = C.createRun('outside', 2, game.profile.upgrades);
  assert.equal(upgraded.cash, C.createRun('outside', 2).cash + 5);
  assert.equal(game.profile.legend, 270);
});

test('profile and top bar expose GOAT, three catalogs, and point shop without the old career block', () => {
  const css = readStyles();
  const app = readRoot('src', 'App.jsx');
  const ui = readH5('game-ui.js');
  assert.match(ui, /metric\('GOAT',liveGoat,'top-goat'\)/);
  assert.match(ui, /最高GOAT分/);
  assert.match(ui, /data-id="jerseys">球衣图鉴/);
  assert.match(ui, /const catalogJerseyIds=new Set\(\[\.\.\.\(p\.jerseys\|\|\[\]\),\.\.\.\(p\.jerseyUnlocks\|\|\[\]\)\]\)/);
  assert.match(ui, /profile-star-card \$\{tierClass\[star\.tier\]\}/);
  assert.match(css, /profile-star-card\)\.tier-c\{--player-material:/);
  assert.match(css, /#profile \.catalog \.profile-star-card\{[^}]*background:var\(--player-material\)/);
  assert.match(css, /profile-jersey-catalog \.equipment-reserve-card\.jersey-equipment/);
  assert.match(css, /meta-jersey\.unlocked\.jersey-equipment/);
  assert.doesNotMatch(ui, /jersey-collection-preview">\$\{jerseyArtwork\(item\)\}<span>球衣<\/span>/);
  assert.match(ui, /function renderPointShop\(\)/);
  assert.match(ui, /C\.finishRun\(game\);save\(\);await finishCloudRun\(r\);startNewJourney\(\)/);
  assert.doesNotMatch(ui, /<h2>生涯纪录<\/h2>|<h2>后续开放<\/h2>/);
  assert.match(app, /['"]pointshop['"]/);
  assert.match(ui, /classList\.toggle\('pointshop-mode',id==='pointshop'\)/);
  assert.match(css, /\.app\.pointshop-mode \.top\{display:none\}/);
  assert.match(css, /\.app\.pointshop-mode #pointshop\.active\{[^}]*margin-top:0;[^}]*padding-top:15px/);
  assert.match(css, /\.app\.profile-mode #profile\.active\{[^}]*margin-top:0;[^}]*padding-top:15px/);
  assert.match(css, /#profile \.profile-status\{[^}]*margin:10px 0/);
  assert.match(css, /#profile \.profile-tabs\{[^}]*margin:0 0 10px/);
  assert.match(ui, /profileSlideFrom=profileTab/);
  assert.match(ui, /pointShopSlideFrom=pointShopTab/);
  assert.match(ui, /key="profile-\$\{profileFromIndex\}-\$\{profileTabIndex\}"/);
  assert.match(ui, /key="pointshop-\$\{pointShopFromIndex\}-\$\{pointShopTabIndex\}"/);
  assert.match(ui, /key="shop-\$\{fromIndex\}-\$\{tabIndex\}"/);
  assert.match(ui, /--tab-index:\$\{profileTabIndex\};--from-tab:\$\{/);
  assert.match(ui, /--tab-index:\$\{pointShopTabIndex\};--from-tab:\$\{/);
  assert.match(css, /@keyframes profile-tab-slide/);
  assert.match(css, /@keyframes shop-tab-slide/);
  assert.match(css, /#profile \.profile-catalog-panel\{flex:0 1 auto;[^}]*overflow-y:auto/);
  assert.match(ui, /<div class="eyebrow">LEGACY<\/div>/);
  assert.match(ui, /data-act="pointshop-tab" data-id="upgrades">天赋加成<\/button>/);
  assert.match(ui, /data-act="pointshop-tab" data-id="jerseys">传奇球衣<\/button>/);
  assert.match(ui, /data-act="jersey-unlock"/);
  assert.match(css, /#home \.home-pointshop\{[^}]*background:/);
  assert.doesNotMatch(ui, /LEGACY · 局外成长|图鉴内容在每局结算|<h2>永久增幅<\/h2>|<h2>解锁抽取<\/h2>/);
});
test('one free recruit is reset each stage and cannot be banked', () => {
  const game = C.createGame();
  const run = game.run = C.createRun('outside', 21);
  run.free = 5;
  run.lastBattle = { won: true };
  assert.equal(C.continueRun(game, 'next'), true);
  assert.equal(run.stage, 2);
  assert.equal(run.free, 1);
  assert.equal(C.recruitCost(run), 8);
  const agentRun = C.createRun('agent', 21);
  assert.equal(C.recruitCost(agentRun), 6);
});

test('high-investment bonds grant expiring recruit tickets and capped stage cash', () => {
  const game = C.createGame();
  const run = game.run = C.createRun('outside', 20260922);
  for (const id of ['kobe', 'iverson', 'nash', 'rayallen']) run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  run.free = 9;
  run.cash = 10;
  run.lastBattle = { won: true };
  assert.equal(C.continueRun(game, 'next'), true);
  assert.equal(run.free, 2);
  assert.equal(run.cash, 10);

  for (const id of ['lebron', 'wade', 'paul', 'melo']) run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  run.lastBattle = { won: true };
  assert.equal(C.continueRun(game, 'next'), true);
  assert.equal(run.free, 2);
  assert.equal(run.cash, 13);
});

test('percentage talents scale after star and training growth and only activate in eligible slots', () => {
  const run = C.createRun('agent', 3);
  run.offer = [];
  run.owned.curry = { stars: 4, train: 3, trainedAt: 0 };
  run.slots.three = 'curry';
  const effect = C.BY_ID.curry.talentEffect;
  const original = effect.dimensions.shooting;
  effect.dimensions.shooting = 0;
  const withoutTalent = C.fused(run);
  effect.dimensions.shooting = original;
  const withTalent = C.fused(run);
  assert.deepEqual(withTalent.stats, withoutTalent.stats);
  assert.ok(withTalent.dimensions.shooting > withoutTalent.dimensions.shooting);
  C.swapPositions(run, { kind: 'slot', key: 'three' }, { kind: 'slot', key: 'mid' });
  assert.ok(!C.fused(run).talents.some(star => star.id === 'curry'));
});

test('S talents match the approved reference-style roles and mechanics', () => {
  assert.deepEqual(C.STARS.filter(star => star.tier === 'S').map(star => star.id), [
    'curry', 'lebron', 'kobe', 'duncan', 'durant', 'shaq', 'jordan',
    'harden', 'magic', 'bird', 'kareem', 'hakeem', 'wilt', 'russell'
  ]);
  assert.deepEqual(C.BY_ID.curry.talentEffect.dimensions, { shooting: 14, perimeterStop: -2, rimStop: -2 });
  assert.deepEqual(C.BY_ID.lebron.talentEffect.slots, ['drive', 'handle']);
  assert.equal(C.BY_ID.durant.talentEffect.slotEffects.three.allDimensions, 4);
  assert.equal(C.BY_ID.jordan.talentEffect.slotEffects.mid.allDimensions, 5);
  assert.equal(C.BY_ID.harden.talentEffect.slotEffects.handle.strategyDimensions.outside.shooting, 5);
  assert.equal(C.BY_ID.magic.talentEffect.slotEffects.handle.postBattleCash, 2);
  assert.equal(C.BY_ID.magic.talentEffect.slotEffects.handle.recruitDiscount, 1);
  assert.equal(C.BY_ID.bird.talentEffect.slotEffects.mid.allDimensions, 6);
  assert.deepEqual(C.BY_ID.kareem.talentEffect.slotEffects.def.dimensions, { perimeterStop: 4, rimStop: 4, shooting: -4 });
  assert.equal(C.BY_ID.hakeem.talentEffect.slotEffects.inside.postBattleCash, 2);
  assert.equal(C.BY_ID.russell.talentEffect.dimensions.perimeterStop, 6);
});

test('effective player attributes expose star training and slot adaptation without a hard cap', () => {
  const run = C.createRun('agent', 303);
  run.offer = [];
  run.owned.curry = { stars: 2, train: 1, trainedAt: 0 };
  run.slots.three = 'curry';
  const grown = Math.round(C.BY_ID.curry.attrs.three * 1.13);
  assert.equal(C.playerEffectiveStats(run, 'curry').stats.three, grown);
  run.owned.curry.stars = 20;
  run.owned.curry.train = 20;
  assert.ok(C.playerEffectiveStats(run, 'curry').stats.three > 150);
  assert.ok(C.fused(run).stats.three > 150);
});

test('equipment changes the targeted attribute while skills boosts and tactics affect combat', () => {
  const run = C.createRun('outside', 305);
  const ids = ['curry', 'kobe', 'jordan', 'lebron', 'shaq', 'magic'];
  ids.forEach((id, index) => {
    run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
    run.slots[C.SLOTS[index].id] = id;
  });
  const baseline = C.fused(run);
  run.owned.klay = { stars: 1, train: 0, trainedAt: 0 };
  run.bench.push('klay');
  run.gear.push('wrist');
  run.boosts.push('hot');
  const enhanced = C.fused(run, 'outside', 'collapse');
  assert.ok(enhanced.bonds.some(bond => bond.id === 'splash'));
  assert.equal(enhanced.stats.drive, baseline.stats.drive + 5);
  assert.equal(enhanced.stats.three, baseline.stats.three);
  assert.ok(enhanced.dimensions.shooting > baseline.dimensions.shooting);
  run.owned.curry.stars = 2;
  run.owned.curry.train = 1;
  assert.notDeepEqual(C.fused(run).stats, baseline.stats);
});

test('battle income follows reference victory loss and interest rules', () => {
  const run = C.createRun('outside', 404);
  run.cash = 44;
  assert.deepEqual(C.incomeBreakdown(run), { victoryBase: 4, lossBase: 7, lineupIncome: 0, interest: 2, interestCap: 3 });
  run.stage = 5;
  assert.equal(C.incomeBreakdown(run).victoryBase, 6);
  run.stage = 10;
  assert.equal(C.incomeBreakdown(run).victoryBase, 0);
  run.stage = 13;
  assert.equal(C.incomeBreakdown(run).victoryBase, 10);
});

test('recruit probability summary uses the same odds and labels group chances explicitly', () => {
  const run = C.createRun('outside', 505);
  const odds = C.tierOdds(run), summary = C.recruitProbabilitySummary(run);
  assert.equal(summary.S, odds.S);
  assert.equal(summary.SSR, odds.SSR);
  assert.equal(summary.ssrGroup, 0.8);
  assert.ok(Math.abs(summary.sGroup - (100 * (1 - Math.pow(1 - odds.S / 100, 4)))) < 1e-9);
});

test('offer probability snapshot stays tied to the displayed four-choice group', () => {
  const run = C.createRun('outside', 506);
  assert.equal(run.offerOdds.S, 0.2);
  run.offer = [];
  run.offerOdds = null;
  run.recruitGroups = 6;
  run.noSPlusGroups = 6;
  const expected = C.recruitProbabilitySummary(run);
  C.makeOffer(run);
  assert.deepEqual(run.offerOdds, expected);
  assert.equal(run.offer.length, 4);
  assert.equal(C.recruit(run, run.offer[0]).ok, true);
  assert.equal(run.offerOdds, null);
});

test('Magic Johnson reduces paid recruitment while assigned to the control slot', () => {
  const run = C.createRun('outside', 4);
  run.owned.magic = { stars: 1, train: 0, trainedAt: 0 };
  run.slots.handle = 'magic';
  assert.equal(C.recruitCost(run), 7);
  run.slots.handle = null;
  run.slots.drive = 'magic';
  assert.equal(C.recruitCost(run), 8);
});

test('ABC control-slot talents pay one bonus after either battle result', () => {
  const game = C.createGame();
  const run = game.run = C.createRun('outside', 20260922);
  const lineup = { three: 'klay', mid: 'tmac', drive: 'wade', handle: 'parker', inside: 'embiid', def: 'green' };
  for (const [slot, id] of Object.entries(lineup)) {
    run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
    run.slots[slot] = id;
  }
  const before = run.cash;
  const report = C.battle(game, 'outside');
  assert.ok(report);
  assert.ok(report.detail.includes('战后技能 1'));
  assert.equal(run.cash, before + report.reward);
});

test('legend variants inherit identity and respect the mainline star cap', () => {
  const legend = C.BY_ID.king_lebron;
  assert.equal(legend.variantOf, 'lebron');
  assert.equal(legend.maxStars, 10);
  assert.deepEqual(C.starSynergies('king_lebron').map(b => b.id), C.starSynergies('lebron').map(b => b.id));
  const run = C.createRun('outside', 7);
  run.offer = ['king_lebron'];
  run.free = 1;
  assert.equal(C.recruit(run, 'king_lebron').ok, true);
  const owned = run.owned.king_lebron;
  owned.stars = 2;
  run.offer = ['king_lebron'];
  run.free = 1;
  assert.equal(C.recruit(run, 'king_lebron').kind, 'duplicate');
  assert.equal(owned.stars, 3);
  assert.equal(C.starLimit(run, 'king_lebron'), 3);
});

test('six opening drafts produce six distinct starters and a playable lineup', () => {
  const run = draftedRun();
  assert.equal(Object.keys(run.owned).length, 6);
  assert.equal(run.free, 1);
  assert.ok(C.fused(run).rating > 0);
});

test('bench swap changes the fused attributes and keeps both cards', () => {
  const run = draftedRun();
  const before = C.fused(run).stats;
  const next = C.makeOffer(run).find(id => !run.owned[id]);
  assert.ok(next);
  assert.equal(C.recruit(run, next).kind, 'bench');
  const old = run.slots.three;
  assert.equal(C.swapBench(run, 0, 'three'), true);
  assert.equal(run.slots.three, next);
  assert.equal(run.bench[0], old);
  assert.notDeepEqual(C.fused(run).stats, before);
});

test('players can exchange any occupied lineup and bench positions', () => {
  const run = draftedRun();
  const first = run.slots.three;
  const second = run.slots.mid;
  assert.equal(C.swapPositions(run, { kind: 'slot', key: 'three' }, { kind: 'slot', key: 'mid' }), true);
  assert.equal(run.slots.three, second);
  assert.equal(run.slots.mid, first);
  const spare = C.STARS.filter(s => !run.owned[s.id]).slice(0, 2);
  for (const star of spare) { run.owned[star.id] = { stars: 1, train: 0, trainedAt: 0 }; run.bench.push(star.id) }
  assert.equal(C.swapPositions(run, { kind: 'bench', key: 0 }, { kind: 'bench', key: 1 }), true);
  assert.deepEqual(run.bench, [spare[1].id, spare[0].id]);
  assert.equal(C.swapPositions(run, { kind: 'slot', key: 'three' }, { kind: 'bench', key: 0 }), true);
  assert.equal(run.slots.three, spare[1].id);
  assert.equal(run.bench[0], second);
});

test('selling a bench player pays reference tier base value times current stars', () => {
  const run = draftedRun();
  const spare = C.STARS.find(s => !run.owned[s.id]);
  run.owned[spare.id] = { stars: 3, train: 0, trainedAt: 0 };
  run.bench.push(spare.id);
  const cash = run.cash;
  const bases = { C: 2, B: 3, A: 5, S: 8, SSR: 16 };
  const value = C.saleValue(spare.id, 3);
  assert.equal(value, bases[spare.tier] * 3);
  assert.equal(C.saleValue('irving', 15), bases.B * 10);
  assert.equal(C.sellBench(run, 0), value);
  assert.equal(run.cash, cash + value);
  assert.equal(run.bench.length, 0);
  assert.equal(run.owned[spare.id], undefined);
});

test('bench sale asks for confirmation and verifies the displayed player and position', () => {
  const ui = readH5('game-ui.js');
  assert.match(ui, /data-act="sell-bench" data-id="\$\{id\}" data-index="\$\{index\}"/);
  assert.match(ui, /data-act="sell-detail" data-id="\$\{s\.id\}" data-index="\$\{detailContext\.key\}"/);
  assert.match(ui, /if\(action==='sell-detail'\|\|action==='sell-bench'\)/);
  assert.match(ui, /r\.bench\[index\]!==id/);
  assert.match(ui, /if\(action==='sell-confirm'\)/);
  assert.match(ui, /r\.bench\[index\]!==playerId/);
});

test('star and training growth use reference percentages and distinguish SSR', () => {
  const normal = C.STARS.find(star => star.tier === 'A');
  const legend = C.STARS.find(star => star.tier === 'SSR');
  assert.equal(C.playerScore(normal, { stars: 3, train: 2 }, normal.best), Math.round(normal.attrs[normal.best] * 1.26));
  assert.equal(C.playerScore(legend, { stars: 3, train: 2 }, legend.best), Math.round(legend.attrs[legend.best] * 1.48));
});

test('training uses the reference mainline cap, endless stage cap, and cost ladder', () => {
  const run = C.createRun('outside', 23);
  const normal = C.STARS.find(star => star.tier === 'A');
  const legend = C.STARS.find(star => star.tier === 'SSR');
  run.owned = {
    [normal.id]: { stars: 1, train: 2, trainedAt: 0 },
    [legend.id]: { stars: 1, train: 3, trainedAt: 0 }
  };
  run.cash = 999;
  assert.equal(C.trainingLimit(run, normal.id), 3);
  assert.equal(C.trainingLimit(run, legend.id), 3);
  assert.equal(C.trainingCost(run, normal.id), 11);
  assert.equal(C.trainingCost(run, legend.id), 16);
  run.endless = true;
  run.stage = 11;
  assert.equal(C.trainingLimit(run, normal.id), 11);
  assert.equal(C.trainingLimit(run, legend.id), 11);
  run.stage = 13;
  assert.equal(C.trainingLimit(run, normal.id), 13);
  run.stage = 25;
  assert.equal(C.trainingLimit(run, legend.id), 25);
  const expected = [4, 7, 11, 16, 22, 29, 37, 46, 56, 67];
  expected.forEach((cost, level) => {
    run.owned[normal.id].train = level;
    assert.equal(C.trainingCost(run, normal.id), cost);
  });
  run.owned[normal.id].train = 14;
  assert.equal(C.trainingCost(run, normal.id), 67);
});

test('endless star limits open immediately and a player can train repeatedly in one round', () => {
  const run = C.createRun('outside', 904);
  const ordinary = C.BY_ID.irving, elite = C.BY_ID.curry, legend = C.BY_ID.chef_curry;
  run.owned[ordinary.id] = { stars: 3, train: 3, trainedAt: 10 };
  run.owned[elite.id] = { stars: 3, train: 3, trainedAt: 10 };
  run.owned[legend.id] = { stars: 3, train: 3, trainedAt: 10 };
  assert.equal(C.starLimit(run, ordinary.id), 3);
  assert.equal(C.starLimit(run, elite.id), 3);
  assert.equal(C.starLimit(run, legend.id), 3);
  run.endless = true;
  run.stage = 11;
  run.cash = 1000;
  assert.equal(C.starLimit(run, ordinary.id), 20);
  assert.equal(C.starLimit(run, elite.id), 10);
  assert.equal(C.starLimit(run, legend.id), 10);
  assert.equal(C.train(run, legend.id), true);
  assert.equal(C.train(run, legend.id), true);
  assert.equal(run.owned[legend.id].train, 5);
  assert.equal(C.trainingCost(run, legend.id), 29);
  while (run.owned[legend.id].train < 11) assert.equal(C.train(run, legend.id), true);
  assert.equal(C.trainingCost(run, legend.id), 67);
  assert.equal(C.train(run, legend.id), false);
});

test('full bench requires explicit sale or replacement', () => {
  const run = draftedRun();
  assert.equal(run.benchLimit, 6);
  const spare = C.STARS.filter(s => !run.owned[s.id]).slice(0, run.benchLimit);
  spare.forEach(s => { run.owned[s.id] = { stars: 1, train: 0, trainedAt: 0 }; run.bench.push(s.id) });
  const candidate = C.STARS.find(s => !run.owned[s.id]);
  run.offer = [candidate.id];
  run.free = 1;
  const answer = C.recruit(run, candidate.id);
  assert.equal(answer.kind, 'pending');
  assert.equal(run.pending, candidate.id);
  assert.equal(run.owned[candidate.id], undefined);
  assert.equal(C.resolvePending(run, 'replace', 0), true);
  assert.equal(run.bench.length, run.benchLimit);
  assert.ok(run.owned[candidate.id]);
  assert.equal(run.pending, null);
});

test('training is limited to once per stage and battle rewards cannot be claimed twice', () => {
  const game = C.createGame();
  game.run = draftedRun();
  const run = game.run;
  const id = run.slots.three;
  assert.equal(C.train(run, id), true);
  assert.equal(C.train(run, id), false);
  const report = C.battle(game, 'outside');
  assert.ok(report);
  const cash = run.cash;
  assert.equal(C.battle(game, 'outside'), null);
  assert.equal(run.cash, cash);
  if (run.ended) {
    assert.equal(C.finishRun(game), 0);
  } else {
    assert.equal(C.continueRun(game, report.won ? 'next' : 'retry'), true);
    assert.equal(run.lastBattle, null);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(game)) < 200000);
});

test('boost and equipment shops keep their independent reference refresh rules', () => {
  const run = C.createRun('outside', 707);
  assert.equal(run.shopOffers.boost.length, 4);
  assert.equal(run.shopOffers.gear.length, 3);
  assert.equal(new Set(run.shopOffers.boost).size, 4);
  assert.equal(new Set(run.shopOffers.gear).size, 3);
  run.cash = 30;
  assert.equal(C.shopRefreshCost(run, 'boost'), 4);
  assert.equal(C.refreshShop(run, 'boost'), true);
  assert.equal(run.cash, 26);
  assert.equal(run.shopRefreshes, 1);
  assert.equal(C.shopRefreshCost(run, 'boost'), 5);
  assert.equal(C.shopRefreshCost(run, 'gear'), 3);
  assert.equal(C.refreshShop(run, 'gear'), true);
  assert.equal(run.cash, 23);
  assert.equal(run.gearRefreshes, 1);
  assert.equal(run.shopOffers.gear.length, 3);
});

test('boosts stack across refreshes but each offer can be bought once', () => {
  const run = draftedRun(709);
  run.cash = 200;
  run.shopOffers.boost = ['hot', 'paint', 'stopper', 'rhythm'];
  const before = C.fused(run);
  for (let i = 0; i < 5; i++) {
    if(i){assert.equal(C.refreshShop(run,'boost'),true);run.shopOffers.boost=['hot','paint','stopper','rhythm']}
    assert.equal(C.buyBoost(run, 'hot'), true);
    assert.equal(C.buyBoost(run, 'hot'), false);
  }
  assert.equal(run.boosts.length, 5);
  assert.deepEqual(C.fused(run).stats, before.stats);
  assert.ok(C.fused(run).dimensions.shooting > before.dimensions.shooting);
  assert.ok(run.shopOffers.boost.includes('hot'));
});

test('shop refresh price rises by one and remains capped at ten', () => {
  const run = C.createRun('outside', 710);
  run.cash = 200;
  assert.deepEqual(Array.from({ length: 9 }, () => {
    const cost = C.shopRefreshCost(run);
    assert.equal(C.refreshShop(run), true);
    return cost;
  }), [4, 5, 6, 7, 8, 9, 10, 10, 10]);
});
test('all eight pregame boosts are available from stage one with equal offer odds', () => {
  assert.equal(C.BOOSTS.length, 8);
  assert.ok(C.BOOSTS.every(item => !('rarity' in item) && !item.minStage));
  const counts = Object.fromEntries(C.BOOSTS.map(item => [item.id, 0]));
  for (let seed = 1; seed <= 600; seed++) {
    const run = C.createRun('outside', Math.imul(seed, 2654435761));
    assert.equal(run.shopOffers.boost.length, 4);
    for (const id of run.shopOffers.boost) counts[id]++;
  }
  assert.ok(Object.values(counts).every(count => count > 240 && count < 360), JSON.stringify(counts));
});
test('equipment shop preserves reference treasure rarity shares despite different item counts', () => {
  const run = C.createRun('outside', 713);
  assert.deepEqual(C.gearRarityWeights(run), { C: 84, B: 45.6, A: 6, S: 1 });
  assert.deepEqual(['C','B','A','S'].map(rarity=>C.GEAR.filter(item=>!item.unlockable&&item.rarity===rarity).length*C.gearRarityWeights(run)[rarity]),[420,456,102,5]);
  run.stage = 10;
  assert.deepEqual(C.gearRarityWeights(run), { C: 84, B: 45.6, A: 6, S: 1 });
});

test('equipment is drawn by per-item weight and keeps distinct slots in each refresh', () => {
  const counts = { C: 0, B: 0, A: 0, S: 0 };
  for (let seed = 1; seed <= 3000; seed++) {
    const run = C.createRun('outside', Math.imul(seed, 2654435761));
    const item = C.GEAR.find(gear => gear.id === run.shopOffers.gear[0]);
    counts[item.rarity]++;
    assert.equal(new Set(run.shopOffers.gear.map(id=>C.GEAR.find(gear=>gear.id===id).slot)).size,run.shopOffers.gear.length);
  }
  assert.ok(counts.C > 1150 && counts.C < 1450, JSON.stringify(counts));
  assert.ok(counts.B > 1250 && counts.B < 1550, JSON.stringify(counts));
  assert.ok(counts.A > 250 && counts.A < 400, JSON.stringify(counts));
  assert.ok(counts.S > 3 && counts.S < 35, JSON.stringify(counts));
});

test('five equipment slots keep their tables alongside base and unlockable jerseys', () => {
  assert.equal(C.GEAR.length, 52);
  assert.equal(new Set(C.GEAR.map(item=>item.id)).size,52);
  for(const slot of ['头带','护腕','球鞋','戒指','战术板']){
    const items=C.GEAR.filter(item=>item.slot===slot);
    assert.equal(items.length,5);
    assert.deepEqual(Object.fromEntries(['C','B','A','S'].map(rarity=>[rarity,items.filter(item=>item.rarity===rarity).length])),{C:1,B:2,A:1,S:1});
  }
  assert.ok(C.GEAR.every(item=>['C','B','A','S'].includes(item.rarity)));
  assert.ok(C.GEAR.filter(item=>item.slot==='球衣').every(item=>item.rarity==='A'));
  const jerseys=C.GEAR.filter(item=>item.slot==='球衣'),baseJerseys=jerseys.filter(item=>!item.unlockable),legendJerseys=jerseys.filter(item=>item.unlockable);
  assert.equal(jerseys.length,27);
  assert.equal(baseJerseys.length,12);
  assert.equal(legendJerseys.length,15);
  assert.deepEqual(new Set(baseJerseys.map(item=>item.name)),new Set(['公牛·23号','勇士·30号','勇士·35号','骑士·23号','热火·6号','湖人·24号','湖人·8号','湖人·34号','马刺·21号','湖人·32号','公牛·45号','森林狼·21号']));
  assert.deepEqual(new Set(legendJerseys.map(item=>item.legendName)),new Set(['麦迪','艾弗森','贾巴尔','拉里·伯德','哈登','雷·阿伦','杜兰特','威少','韦德','字母哥','奥拉朱旺','诺维茨基','东契奇','张伯伦','比尔·拉塞尔']));
  assert.ok(jerseys.every(item=>item.kind==='signature'&&/^.+·\d+号$/.test(item.name)&&item.teamCode&&!Object.hasOwn(item,'exclusiveBonus')));
  assert.ok(jerseys.every(item=>item.price===20&&item.sellPrice===8&&Object.values(item.stats).reduce((a,b)=>a+b,0)===18&&!item.percentStats));
  const curry=C.GEAR.find(item=>item.id==='curry_wrist');
  assert.equal(curry.name,'勇士·30号');
  assert.equal(curry.rarity,'A');
  assert.equal(C.GEAR.find(item=>item.id==='kobe_sleeve').rarity,'A');
  assert.equal(C.GEAR.find(item=>item.id==='kobe_wrist').rarity,'A');
  assert.ok(C.GEAR.every(item => item.sellPrice > 0 && item.sellPrice < item.price));
  assert.deepEqual(new Set(C.GEAR.map(item => item.slot)), new Set(['护腕', '球鞋', '头带', '球衣', '戒指', '战术板']));
  assert.equal(C.GEAR_LIMIT, 6);
  assert.deepEqual([C.GEAR.find(item => item.id === 'dynasty_ring').price, C.GEAR.find(item => item.id === 'dynasty_ring').sellPrice], [50, 20]);
});

test('five equipment tables match the supplied names and Kyrie 2 ability values', () => {
  const names={
    '战术板':['空间战术板','八区战术板','对位战术板','临场战术板','核心单打战术板'],
    '戒指':['新秀戒指','老将戒指','防守戒指','全明星戒指','总冠军戒指'],
    '球鞋':['Shaq Attaq','Kyrie 2','Kobe 4','LeBron 2','Last Shot'],
    '护腕':['启动护腕','3D护腕','强硬护腕','禁区护框护腕','脚踝终结护腕'],
    '头带':['防守指挥头带','赛前录像头带','攻防转换头带','场上指挥头带','全能核心头带']
  };
  for(const [slot,expected] of Object.entries(names))assert.deepEqual(C.GEAR.filter(item=>item.slot===slot).map(item=>item.name),expected);
  const kyrie=C.GEAR.find(item=>item.name==='Kyrie 2');
  assert.deepEqual(kyrie.stats,{mid:3,handle:7});
  assert.equal(kyrie.description,'中投 +3；控球 +7');
});

test('six active equipment slots keep extra jerseys in the collection', () => {
  const run = draftedRun(714);
  run.cash = 500;
  run.shopOffers.gear = ['wrist', 'paint_shoes', 'lockdown_band', 'curry_wrist', 'dynasty_ring', 'tactics_board', 'team_jersey'];
  for (const id of run.shopOffers.gear.slice(0, 6)) assert.equal(C.buyGear(run, id), true, id);
  assert.equal(run.gear.length, 6);
  assert.equal(C.buyGear(run, 'team_jersey'), false);
  run.shopOffers.gear.push('kobe_sleeve');
  assert.equal(C.buyGear(run, 'kobe_sleeve'), true);
  assert.deepEqual(run.gearReserve, ['kobe_sleeve']);
  assert.equal(new Set(run.gear.map(id => C.GEAR.find(item => item.id === id).slot)).size, 6);
  const remainingCash=run.cash;
  assert.equal(C.refreshShop(run,'gear'),true);
  assert.equal(run.cash,remainingCash-C.shopRefreshCost(run,'gear'));
  assert.ok(run.shopOffers.gear.every(id=>![...run.gear,...run.gearReserve].includes(id)));
});

test('nonjersey slots allow one item while collected jerseys can exchange', () => {
  const run = draftedRun(708);
  run.cash = 100;
  run.shopOffers.gear = ['wrist', 'deep_wrist', 'paint_shoes', 'curry_wrist', 'kobe_sleeve'];
  const before = C.fused(run);
  assert.equal(C.buyGear(run, 'wrist'), true);
  const occupiedCash=run.cash;
  assert.equal(C.buyGear(run, 'deep_wrist'), false);
  assert.equal(run.cash,occupiedCash);
  assert.deepEqual(run.gearReserve,[]);
  assert.equal(C.buyGear(run, 'paint_shoes'), true);
  assert.equal(C.fused(run).stats.drive,before.stats.drive+5);
  assert.equal(C.fused(run).stats.inside,before.stats.inside+5);
  assert.ok(C.fused(run).dimensions.finishing > before.dimensions.finishing);
  assert.equal(C.buyGear(run,'curry_wrist'),true);
  assert.equal(C.buyGear(run,'kobe_sleeve'),true);
  assert.deepEqual(run.gearReserve,['kobe_sleeve']);
  assert.equal(C.equipGear(run,'kobe_sleeve'),true);
  assert.ok(run.gear.includes('kobe_sleeve')&&run.gearReserve.includes('curry_wrist'));
  const beforeSale = run.cash;
  assert.equal(C.sellGear(run, 'wrist'), 4);
  assert.equal(run.cash, beforeSale + 4);
  assert.equal(C.buyGear(run,'deep_wrist'),true);
  assert.equal(C.sellGear(run, 'deep_wrist'), 7);
});

test('bought gear stays sold in its current offer until refresh', () => {
  const run=draftedRun(715);
  run.cash=200;
  run.shopOffers.gear=['wrist','deep_wrist'];
  assert.equal(C.buyGear(run,'wrist'),true);
  assert.equal(C.buyGear(run,'wrist'),false);
  assert.ok(run.shopOffers.gear.includes('wrist'));
  assert.ok(run.gearSoldOffers.includes('wrist'));
  assert.equal(C.sellGear(run,'wrist'),4);
  assert.equal(C.buyGear(run,'wrist'),false);
  for(let i=0;i<20;i++){
    assert.equal(C.refreshShop(run,'gear'),true);
    assert.ok(!run.gearSoldOffers.includes('wrist'));
    run.cash=200;
  }
});

test('single-attribute gear applies directly to the fused player', () => {
  const run = draftedRun(711);
  run.cash = 100;
  run.shopOffers.gear = ['tactics_board'];
  const before = C.fused(run);
  assert.equal(C.buyGear(run, 'tactics_board'), true);
  assert.equal(C.fused(run).stats.three,before.stats.three+6);
  assert.equal(C.fused(run).stats.handle,before.stats.handle+4);
  assert.ok(C.fused(run).dimensions.shooting > before.dimensions.shooting);
  run.slots.three = null;
  assert.equal(C.gearMultiplier(run, C.GEAR.find(item => item.id === 'tactics_board')), 1);
});

test('percentage equipment and battle bonuses use their distinct effect paths', () => {
  const run=draftedRun(719);
  const baseline=C.fused(run);
  run.gear.push('rookie_ring');
  const withRing=C.fused(run);
  assert.ok(C.ATTRS.every(key=>withRing.stats[key]>=baseline.stats[key]));
  assert.ok(withRing.dimensions.shooting>baseline.dimensions.shooting);
  run.gear.push('paul_band');
  assert.equal(C.GEAR.find(item=>item.id==='paul_band').turnoverReduction,.015);
  assert.ok(C.fused(run).stats.handle>withRing.stats.handle);
  assert.match(C.GEAR.find(item=>item.id==='paul_band').description,/失误率/);
});

test('jersey gear applies directly without a player binding', () => {
  const run = C.createRun('outside', 712);
  run.offer = [];
  const ids = ['curry', 'kobe', 'jordan', 'lebron', 'shaq', 'magic'];
  ids.forEach((id, index) => {
    run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
    run.slots[C.SLOTS[index].id] = id;
  });
  run.cash = 100;
  run.shopOffers.gear = ['curry_wrist'];
  const before = C.fused(run);
  assert.equal(C.buyGear(run, 'curry_wrist'), true);
  assert.equal(run.gearBindings, undefined);
  assert.equal(C.fused(run).stats.three,before.stats.three+Math.round(12*C.JERSEY_COLLECTION_SCALE*(1+C.JERSEY_EQUIPPED_BONUS)));
  assert.equal(C.fused(run).stats.handle,before.stats.handle+Math.round(6*C.JERSEY_COLLECTION_SCALE*(1+C.JERSEY_EQUIPPED_BONUS)));
  const jerseyShooting = C.fused(run).dimensions.shooting;
  assert.ok(jerseyShooting > before.dimensions.shooting);
  run.slots.three = null;
  assert.ok(Math.abs(C.gearMultiplier(run, C.GEAR.find(item => item.id === 'curry_wrist'))-.525)<1e-12);
  assert.ok(C.fused(run).dimensions.shooting > C.fused({...run,gear:[]}).dimensions.shooting);
  assert.equal(C.bindGear, undefined);
});

test('jersey collection bonuses stay active while the equipped jersey gains fifty percent', () => {
  const run=draftedRun(720);
  run.cash=100;
  run.shopOffers.gear=['curry_wrist','kobe_sleeve'];
  assert.equal(C.buyGear(run,'curry_wrist'),true);
  assert.equal(C.buyGear(run,'kobe_sleeve'),true);
  const curry=C.GEAR.find(item=>item.id==='curry_wrist'),kobe=C.GEAR.find(item=>item.id==='kobe_sleeve');
  assert.ok(Math.abs(C.gearMultiplier(run,curry)-.525)<1e-12);
  assert.equal(C.gearMultiplier(run,kobe),.35);
  const collected=C.fused(run);
  assert.equal(C.equipGear(run,'kobe_sleeve'),true);
  assert.equal(C.gearMultiplier(run,curry),.35);
  assert.ok(Math.abs(C.gearMultiplier(run,kobe)-.525)<1e-12);
  const equipped=C.fused(run);
  assert.ok(equipped.stats.mid>collected.stats.mid);
  assert.ok(collected.stats.three>C.fused({...run,gear:[],gearReserve:[]}).stats.three);
});

test('legend points unlock nonrepeating jerseys and only unlocked jerseys enter the shop pool', () => {
  const profile=C.createGame().profile;
  profile.legend=1000;
  const locked=C.GEAR.find(item=>item.unlockable);
  const before=C.createRun('outside',721);
  assert.equal(C.gearAvailable(before,locked),false);
  const first=C.unlockJersey(profile,()=>0);
  assert.equal(first.id,locked.id);
  assert.equal(profile.legend,500);
  const run=C.createRun('outside',722,{jerseyUnlocks:profile.jerseyUnlocks});
  assert.equal(C.gearAvailable(run,first),true);
  const stillLocked=C.GEAR.find(item=>item.unlockable&&!profile.jerseyUnlocks.includes(item.id));
  run.cash=100;
  run.shopOffers.gear=[first.id,stillLocked.id];
  assert.equal(C.buyGear(run,first.id),true);
  assert.equal(C.buyGear(run,stillLocked.id),false);
  const second=C.unlockJersey(profile,()=>0);
  assert.notEqual(second.id,first.id);
  assert.equal(profile.legend,0);
  assert.equal(new Set(profile.jerseyUnlocks).size,2);
});

test('basketball meta upgrades replace the equipment slot with film study', () => {
  assert.equal(C.META_UPGRADES.some(item=>item.id==='treasureSlot'),false);
  assert.equal(C.META_UPGRADES.some(item=>item.id==='filmStudy'&&item.name==='录像分析'),true);
  const run=draftedRun(723);
  const baseline=C.fused(run,'outside','collapse').dimensions.shooting;
  run.metaFilmStudy=3;
  assert.ok(C.fused(run,'outside','collapse').dimensions.shooting>baseline);
  assert.equal(run.gearLimit,C.GEAR_LIMIT);
});

test('shop screen renders full-detail purchases and two-column equipment cards', () => {
  const css = readStyles();
  const ui = readH5('game-ui.js');
  assert.match(css, /#shop \.shop-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /#shop \.shopitem small\s*\{[^}]*display:\s*block;[^}]*overflow:\s*visible;[^}]*-webkit-line-clamp:\s*unset/);
  assert.match(ui, /<div class="shopPanel shop-grid">/);
  assert.match(ui, /data-act="shop-refresh"/);
  assert.match(ui, /data-act="sell-gear"/);
  assert.match(ui, /data-act="replace-gear"/);
  assert.match(ui, /C\.replaceGear\(r,id\)/);
  assert.match(ui, /gearReplaceId=id;renderPending\(\)/);
  assert.match(ui, /class="modal-card gear-replace-modal"/);
  assert.match(ui, /gear-compare-card \$\{className\} gear-tier-\$\{item\.rarity\.toLowerCase\(\)\}/);
  assert.match(ui, /const visual=equipmentJerseyVisual\(item\)/);
  assert.match(ui, /即将购买/);
  assert.match(ui, /当前已有/);
  assert.match(ui, /data-act="gear-replace-confirm"/);
  assert.match(css, /gear-compare-card\.incoming/);
  for (const rarity of ['c','b','a','s']) assert.match(css, new RegExp(`gear-compare-card\\.gear-tier-${rarity}\\{background:`));
  assert.match(css, /gear-compare-card\.jersey-equipment\{border:2px solid/);
  assert.match(css, /shop-item-actions\{display:flex/);
  assert.match(ui, /data-act="gear-detail-open"/);
  assert.doesNotMatch(ui, /data-act="gear-detail-bind"|data-act="bind-gear-player"/);
  assert.match(ui, /class="jersey-vector"/);
  assert.match(ui, /fill="\$\{primary\}" stroke="\$\{secondary\}"/);
  assert.doesNotMatch(ui, /linearGradient id="\$\{gradientId\}"|fill="url\(#\$\{gradientId\}\)"/);
  assert.doesNotMatch(ui, /jerseyTestRun|toggle-jersey-test|buy-test-jersey|测试球衣样式/);
  assert.match(ui, /class="equipment-slot-list"/);
  assert.match(css, /#shop \.equipped-shelf \.equipment-slot-list\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.shop-tier-b/);
});

test('game restore finishes before actions become available and locker slot labels stay legible', () => {
  const ui = readH5('game-ui.js');
  const css = readStyles();
  assert.match(ui, /screen='home',restoring=true/);
  assert.match(ui, /if\(restoring\|\|!button\|\|button\.disabled\)return/);
  assert.ok(ui.indexOf('await STORAGE.load()') < ui.indexOf('restoring=false'));
  assert.ok(ui.indexOf('restoring=false') < ui.lastIndexOf("go('home')"));
  for (const rarity of ['c','b','a','s']) assert.match(css, new RegExp(`equipment-slot-row\\.is-equipped\\.gear-tier-${rarity} \\.equipment-card-open span\\{color:`));
});

test('screen navigation uses the shared click handler without a time lock', () => {
  const ui = readH5('game-ui.js');
  assert.match(ui, /document\.addEventListener\('click',event=>\{/);
  assert.doesNotMatch(ui, /navigationClickLockedUntil/);
  assert.match(ui, /if\(action==='roster'\)\{go\('roster'\);return\}/);
});

test('full-bench replacement lists bench players before fusion-panel players', () => {
  const ui = readH5('game-ui.js');
  assert.ok(ui.indexOf('<h3>替换备战席球员</h3>') < ui.indexOf('<h3>替换融合面板球员</h3>'));
});

test('strategy counter is awarded to the correct side', () => {
  const counterGame = C.createGame();
  counterGame.run = draftedRun(99);
  assert.equal(C.opponent(counterGame.run).strategy, 'collapse');
  assert.equal(C.battle(counterGame, 'outside').beats, 1);
  const weakGame = C.createGame();
  weakGame.run = draftedRun(99);
  assert.equal(C.battle(weakGame, 'drive').beats, -1);
});

test('fifty distinct opponents rise in strength and end with all eight SSR players', () => {
  const run = C.createRun('outside', 1001);
  const opponents = Array.from({ length: 50 }, (_, index) => {
    run.stage = index + 1;
    return C.opponent(run);
  });
  assert.equal(new Set(opponents.map(foe => foe.id)).size, 50);
  assert.equal(opponents[0].id, 'caruso');
  assert.equal(opponents[29].id, 'giannis');
  assert.deepEqual([0, 1, 2, 4, 6, 7, 8, 9, 10].map(index => opponents[index].rating),
    [64, 70, 78, 90, 94, 96, 99, 103, 104]);
  assert.deepEqual([9, 19, 29, 39, 49].map(index => opponents[index].rating),
    [103, 126, 157, 197, 247]);
  assert.ok(opponents[49].rating - opponents[39].rating >
    opponents[29].rating - opponents[19].rating);
  assert.deepEqual(opponents.slice(-8).map(foe => foe.id), [
    'stone_duncan',
    'reaper_durant', 'showtime_magic', 'chef_curry', 'mamba_kobe',
    'diesel_shaq', 'king_lebron', 'air_jordan'
  ]);
  assert.ok(opponents.every((foe, index) => index === 0 || foe.rating > opponents[index - 1].rating));
  assert.ok(opponents.every(foe => Object.hasOwn(C.STRATEGIES, foe.strategy)));
  const repeated = Array.from({ length: 36 }, (_, index) => {
    run.stage = index + 51;
    return C.opponent(run);
  });
  assert.deepEqual(repeated.slice(0, 8).map(foe => foe.id), opponents.slice(-8).map(foe => foe.id));
  assert.deepEqual(repeated.slice(0, 8).map(foe => foe.stars), Array(8).fill(2));
  assert.deepEqual(repeated.slice(8, 16).map(foe => foe.stars), Array(8).fill(3));
  assert.ok(repeated.every((foe, index) => index === 0 || foe.rating > repeated[index - 1].rating));
  assert.equal(repeated.at(-1).stars, 6);
});

test('a powered seeded run can finish ten stages and enter endless play', () => {
  const game = C.createGame();
  const run = game.run = C.createRun('outside', 11);
  for (let i = 0; i < 6; i++) {
    const offer = C.makeOffer(run);
    const choice = offer.slice().sort((a, b) => C.BY_ID[b].attrs[C.BY_ID[b].best] - C.BY_ID[a].attrs[C.BY_ID[a].best])[0];
    C.recruit(run, choice);
  }
  for (const own of Object.values(run.owned)) { own.stars = 5; own.train = 3; }
  let attempts = 0;
  while (run.stage <= 10 && !run.ended && attempts++ < 30) {
    for (const id of Object.keys(run.owned)) C.train(run, id);
    for (const item of C.GEAR) C.buyGear(run, item.id);
    const foe = C.opponent(run);
    const counter = Object.keys(C.STRATEGIES).find(id => C.STRATEGIES[id].beats === foe.strategy);
    const report = C.battle(game, counter);
    assert.ok(report);
    if (!run.ended) C.continueRun(game, report.won ? 'next' : 'retry');
  }
  assert.equal(run.wins, 10);
  assert.equal(run.stage, 11);
  assert.equal(run.endless, true);
});

test('signature actions follow the strongest slot pair and trained players improve them', () => {
  const run = draftedRun(902);
  const offense = C.signatureMoves(run)[0];
  const defense = C.signatureMoves(run)[1];
  assert.equal(offense.kind, 'offense');
  assert.equal(defense.kind, 'defense');
  assert.ok(offense.slots.every(slot => run.slots[slot]));
  assert.ok(defense.slots.every(slot => run.slots[slot]));
  assert.equal(offense.trained, 0);
  run.owned[run.slots[offense.slots[0]]].train = 1;
  assert.equal(C.signatureMoves(run)[0].trained >= 1, true);
  for (const own of Object.values(run.owned)) own.stars = 1;
  run.owned[run.slots.drive].stars = 10;
  run.owned[run.slots.inside].stars = 10;
  assert.equal(C.signatureMoves(run)[0].id, 'contact');
  for (const own of Object.values(run.owned)) own.stars = 1;
  run.owned[run.slots.three].stars = 10;
  run.owned[run.slots.handle].stars = 10;
  assert.equal(C.signatureMoves(run)[0].id, 'stepback');
});

test('automatic battle records bounded signature activations without extra player input', () => {
  const game = C.createGame();
  game.run = draftedRun(903);
  const report = C.battle(game, 'outside');
  assert.equal(report.signatures.length, 2);
  assert.deepEqual(report.signatures.map(move => move.kind), ['offense', 'defense']);
  assert.ok(report.signatures.every(move => move.uses >= 0 && move.uses <= 2));
  assert.ok(report.signatures.some(move => move.uses > 0));
  assert.ok(report.log.length <= 7);
});

test('seventeen opening talents keep ten initial choices and seven career unlocks', () => {
  assert.equal(C.TALENTS.length, 17);
  assert.equal(new Set(C.TALENTS.map(talent => talent.id)).size, 17);
  const profile = C.createGame().profile;
  assert.equal(C.availableTalents(profile).length, 10);
  Object.assign(profile, { runs: 3, wins: 8, bestStage: 10, bestEndless: 13 });
  profile.discovered = C.STARS.slice(0, 20).map(star => star.id);
  assert.equal(C.availableTalents(profile).length, 17);
  assert.ok(C.TALENTS.every(talent => talent.gain && talent.cost && talent.category));
});

test('opening talent effects reach recruitment, growth, shop pricing, and free refreshes', () => {
  const base = C.createRun('win_bonus', 33);
  const scout = C.createRun('scouting_network', 33);
  assert.equal(scout.free, 7);
  assert.equal(C.recruitCost(scout), C.recruitCost(base) + 2);
  assert.ok(C.tierOdds(scout).S > C.tierOdds(base).S);
  assert.ok(C.tierOdds(scout).SSR > C.tierOdds(base).SSR);
  const player = C.BY_ID.curry, own = { stars: 2, train: 1 };
  const development = C.createRun('development', 33), workshop = C.createRun('star_workshop', 33);
  assert.ok(C.playerScore(player, own, player.best, development) > C.playerScore(player, own, player.best, base));
  assert.ok(C.playerScore(player, own, player.best, workshop) > C.playerScore(player, own, player.best, development));
  development.owned[player.id] = { ...own, trainedAt: 0 };
  base.owned[player.id] = { ...own, trainedAt: 0 };
  assert.equal(C.trainingCost(development, player.id), C.trainingCost(base, player.id) - 1);
  assert.ok(C.saleValue(player.id, 2, development) > C.saleValue(player.id, 2, base));
  assert.equal(workshop.benchLimit, 5);
  assert.equal(C.createRun('deep_bench', 33).benchLimit, 8);
  const manager = C.createRun('front_office', 33);
  assert.equal(C.gearPrice(manager, C.GEAR[0]), C.GEAR[0].price - 2);
  assert.equal(C.boostPrice(manager, C.BOOSTS[0]), C.BOOSTS[0].price + 2);
  const lockdown = C.createRun('lockdown', 33);
  assert.equal(C.shopRefreshCost(lockdown, 'gear'), 0);
  assert.ok(C.refreshShop(lockdown, 'gear'));
  assert.equal(C.shopRefreshCost(lockdown, 'gear'), 3);
  const allIn = C.createRun('all_in', 33);
  assert.equal(allIn.morale, 2);
  assert.equal(allIn.gear.length, 1);
  assert.equal(C.GEAR.find(item => item.id === allIn.gear[0]).rarity, 'A');
  assert.equal(C.GEAR.find(item => item.id === C.createRun('dynasty', 33).gear[0]).rarity, 'S');
});

test('every opening route can draft a lineup, fight, and settle a battle', () => {
  for (const talent of C.TALENTS) {
    const game = C.createGame(), run = game.run = C.createRun(talent.id, 617);
    for (let index = 0; index < 6; index++) {
      const offer = C.makeOffer(run);
      assert.equal(C.recruit(run, offer[0]).ok, true, talent.id);
    }
    assert.equal(C.starterCount(run), 6, talent.id);
    const fusion = C.fused(run, 'outside', 'collapse');
    assert.ok(C.COMBAT_LABELS && Object.values(fusion.dimensions).every(Number.isFinite), talent.id);
    const report = C.battle(game, 'outside');
    assert.ok(report && Number.isFinite(report.reward), talent.id);
    assert.ok(run.cash >= 0 && run.morale >= 0 && run.morale <= 3, talent.id);
  }
});

test('coaching routes change counter strength and captain restores morale after victory', () => {
  const roster = ['chef_curry','air_jordan','king_lebron','showtime_magic','diesel_shaq','reaper_durant'];
  const makeRun = talent => {
    const run = C.createRun(talent, 911);
    C.SLOTS.forEach((slot, index) => { run.slots[slot.id] = roster[index]; run.owned[roster[index]] = { stars: 1, train: 0, trainedAt: 0 }; });
    return run;
  };
  const standard = makeRun('win_bonus'), coach = makeRun('counter_coach'), film = makeRun('film_room');
  assert.ok(C.fused(coach, 'outside', 'collapse').dimensions.shooting > C.fused(standard, 'outside', 'collapse').dimensions.shooting);
  assert.ok(C.fused(film, 'outside', 'drive').dimensions.rimStop > C.fused(standard, 'outside', 'drive').dimensions.rimStop);
  const game = C.createGame(); game.run = makeRun('captain'); game.run.morale = 1;
  const report = C.battle(game, 'outside');
  assert.equal(report.won, true);
  assert.equal(game.run.morale, 2);
});

test('an owned nonjersey slot can be replaced from the equipment shop', () => {
  const game=C.createGame(190),run=C.createRun(game,'reserve_fund');
  run.cash=100;
  run.shopOffers.gear=['wrist','deep_wrist'];
  assert.equal(C.buyGear(run,'wrist'),true);
  const cashBefore=run.cash,old=C.GEAR.find(item=>item.id==='wrist'),next=C.GEAR.find(item=>item.id==='deep_wrist');
  assert.equal(C.replaceGear(run,'deep_wrist'),'wrist');
  assert.equal(run.gear.includes('wrist'),false);
  assert.equal(run.gear.includes('deep_wrist'),true);
  assert.equal(run.cash,cashBefore-C.gearPrice(run,next)+old.sellPrice);
});

test('ten-recruit pack costs 95 percent and preserves prepaid selections', () => {
  const run = C.createRun('win_bonus', 20260929);
  run.cash = 200;
  const originalFree = run.free;
  assert.equal(C.recruitCost(run), 8);
  assert.equal(C.recruitPackCost(run), 76);
  assert.equal(C.buyRecruitPack(run), true);
  assert.equal(run.cash, 124);
  assert.equal(run.offerMode, 'ten-batch');
  assert.equal(run.offer.length, 10);
  assert.deepEqual(run.batchSelected, Array(10).fill(true));
  const selected = run.batchSelected.map((_, index) => index < 2);
  const soldValue = run.offer.slice(2).reduce((sum, id) => sum + C.saleValue(id, 1, run), 0);
  const answer = C.confirmRecruitBatch(run, selected);
  assert.equal(answer.ok, true);
  assert.equal(answer.kept, 2);
  assert.equal(answer.sold, 8);
  assert.equal(answer.done, true);
  assert.equal(C.starterCount(run), 2);
  assert.equal(run.cash, 124 + soldValue);
  assert.equal(run.free, originalFree);
});

test('ten-recruit pack rejects insufficient cash without changing state', () => {
  const run = C.createRun('win_bonus', 929);
  run.cash = 75;
  assert.equal(C.buyRecruitPack(run), false);
  assert.equal(run.cash, 75);
  assert.equal(run.recruitCredits, 0);
});

test('ten-recruit selection toggles only the tapped card even when player ids repeat', () => {
  const run = C.createRun('win_bonus', 930);
  run.offerMode = 'ten-batch';
  run.offer = ['jordan','horry','jordan','horry','jordan','horry','jordan','horry','jordan','horry'];
  run.batchSelected = Array(10).fill(true);
  assert.equal(C.toggleRecruitBatchSelection(run, 3), true);
  assert.deepEqual(run.batchSelected, [true,true,true,false,true,true,true,true,true,true]);
  assert.equal(C.toggleRecruitBatchSelection(run, 8), true);
  assert.deepEqual(run.batchSelected, [true,true,true,false,true,true,true,true,false,true]);
  assert.equal(C.toggleRecruitBatchSelection(run, 3), true);
  assert.deepEqual(run.batchSelected, [true,true,true,true,true,true,true,true,false,true]);
});

test('full bench resolves a selected ten-recruit batch one card at a time', () => {
  const run = C.createRun('win_bonus', 813);
  const occupied = C.STARS.slice(0, 12);
  C.SLOTS.forEach((slot, index) => {
    const id = occupied[index].id;
    run.slots[slot.id] = id;
    run.owned[id] = { stars: 1, train: 0, trainedAt: 0 };
  });
  run.bench = occupied.slice(6).map(star => star.id);
  run.bench.forEach(id => { run.owned[id] = { stars: 1, train: 0, trainedAt: 0 }; });
  run.benchLimit = run.bench.length;
  run.offer = C.STARS.filter(star => !run.owned[star.id]).slice(0, 10).map(star => star.id);
  run.offerMode = 'ten-batch';
  run.batchSelected = Array(10).fill(true);
  let result = C.confirmRecruitBatch(run, run.batchSelected);
  assert.equal(result.pending, true);
  assert.equal(run.batchQueue.length, 9);
  let prompts = 0;
  while (run.pending) {
    assert.equal(C.resolvePending(run, 'sell'), true);
    prompts++;
    result = C.advanceRecruitBatch(run);
  }
  assert.equal(prompts, 10);
  assert.equal(result.done, true);
  assert.equal(run.batchQueue.length, 0);
  assert.equal(run.bench.length, run.benchLimit);
});

test('ten-recruit results allow repeated players and process them as star upgrades', () => {
  let generatedDuplicate = false;
  for (let seed = 1; seed <= 100 && !generatedDuplicate; seed++) {
    const generated = C.createRun('win_bonus', seed);
    generated.cash = 100;
    assert.equal(C.buyRecruitPack(generated), true);
    generatedDuplicate = new Set(generated.offer).size < generated.offer.length;
  }
  assert.equal(generatedDuplicate, true);
  const run = C.createRun('win_bonus', 1010);
  run.cash = 0;
  run.offer = Array(10).fill('curry');
  run.offerMode = 'ten-batch';
  run.batchSelected = Array(10).fill(true);
  const result = C.confirmRecruitBatch(run, run.batchSelected);
  assert.equal(result.done, true);
  assert.equal(result.kept, 10);
  assert.equal(run.owned.curry.stars, 3);
  assert.equal(run.cash, 28);
});

test('full bench can replace and sell a fusion-panel starter', () => {
  const run = C.createRun('win_bonus', 9901);
  const oldId = 'curry', newId = 'jokic';
  run.slots.three = oldId;
  run.owned[oldId] = { stars: 2, train: 0, trainedAt: 0 };
  run.pending = newId;
  const before = run.cash;
  const sale = C.saleValue(oldId, 2, run);
  assert.equal(C.resolvePending(run, 'replace-slot', 'three'), true);
  assert.equal(run.pending, null);
  assert.equal(run.slots.three, newId);
  assert.equal(run.owned[oldId], undefined);
  assert.deepEqual(run.owned[newId], { stars: 1, train: 0, trainedAt: 0 });
  assert.equal(run.cash, before + sale);
});

test('rewarded recruitment creates four S-tier choices, charges no cash, and resets next stage', () => {
  const run = C.createRun('win_bonus', 4422);
  run.free = 0;
  run.cash = 0;
  const offer = C.grantRewardedSOffer(run);
  assert.equal(offer.length, 4);
  assert.equal(new Set(offer).size, 4);
  assert.ok(offer.every(id => C.BY_ID[id].tier === 'S'));
  assert.equal(run.offerMode, 'rewarded-s');
  const answer = C.recruit(run, offer[0]);
  assert.equal(answer.ok, true);
  assert.equal(run.cash, 0);
  assert.equal(run.offerMode, 'normal');
  assert.equal(run.rewardedRecruitUsed, true);
  assert.equal(C.grantRewardedSOffer(run), false);
  run.lastBattle = { won: true };
  assert.equal(C.continueRun({ run }, 'next'), true);
  assert.equal(run.stage, 2);
  assert.equal(run.rewardedRecruitUsed, false);
});

test('recruit entry renders a bottom sheet with normal, ten-pack, and ad actions', () => {
  const ui = readH5('game-ui.js');
  const css = readH5('styles/recruit-sheet.css');
  assert.match(ui, /普通招募/);
  assert.match(ui, /十连招募/);
  assert.match(ui, /看广告招募/);
  assert.match(ui, /actionButton\('recruit-normal'/);
  assert.match(ui, /actionButton\('recruit-ten'/);
  assert.match(ui, /actionButton\('recruit-ad'/);
  assert.match(ui, /连续招募10位球员/);
  assert.match(ui, /S级球员4选1（每回合一次）/);
  assert.match(ui, /class="recruit-ad-icon"/);
  assert.doesNotMatch(ui, /每关免费 1 次/);
  assert.doesNotMatch(ui, /95折/);
  assert.match(ui, /S级球员4选1/);
  assert.match(ui, /默认全部拿走/);
  assert.match(ui, /confirm-recruit-batch/);
  assert.match(ui, /还需处理/);
  assert.match(ui, /pendingPlayerPreview/);
  assert.doesNotMatch(ui, /当前待处理球员/);
  assert.match(ui, /升星 · \$\{own\.stars\}★→/);
  assert.match(ui, /羁绊 · \$\{bond\.item\.name\}/);
  assert.doesNotMatch(ui, /HOOP LEGEND/);
  assert.match(ui, /data-mode="replace-slot"/);
  assert.match(ui, /决定\$\{s\.name\}的去留/);
  assert.match(css, /pending-sell-new/);
  assert.doesNotMatch(css, /card\.batch-selected/);
  assert.match(ui, /window\.ColorboxAI\.vatask\.completeRewardVideo\(\)/);
  assert.match(ui, /window\.ColorboxAI\.vatask\.getActivityTaskState\(\)/);
  assert.match(css, /align-items:flex-end/);
  assert.match(css, /recruit-sheet-rise/);
  assert.match(css, /draft-ten-mode \.card \.card-select\{height:68px\}/);
  assert.match(css, /batch-card-reveal/);
  assert.match(css, /animation-delay:calc\(var\(--card-order\)\*55ms\)/);
  assert.match(css, /batch-excluded\{[^}]*grayscale\(1\)/);
  assert.match(css, /batch-excluded::after\{[^}]*inset:0[^}]*width:auto;height:auto/);
  assert.match(ui, /selected\?draftBondHints\(id,batchIds\):\[\]/);
  assert.doesNotMatch(ui, /draftBondHints\(id,batchIds\)\.filter\(bond=>bond\.active\)/);
  assert.match(ui, /bondOwned\.add\(C\.identityOf\(s\.id\)\)/);
  assert.match(ui, /r\.offerMode==='ten-batch'.+bondOwned\.add\(C\.identityOf\(offerId\)\)/);
  assert.doesNotMatch(css, /recruit-ten"\]\{min-height/);
  assert.match(css, /recruit-ad"\]\{border-color:[^}]+background:linear-gradient/);
  assert.match(css, /pending-replacements-scroll\{[^}]*overflow-y:auto/);
  assert.match(css, /pending-player-tier\{color:var\(--tier\)/);
  assert.match(css, /modal-list button em\{color:#ff7474/);
  assert.match(ui, /toggle-recruit-batch/);
  assert.match(ui, /batch-action-summary/);
  assert.match(ui, /确认拿走/);
  assert.match(ui, /priorCopies/);
  assert.match(ui, /class="card-grade"/);
  assert.match(css, /draft-ten-mode \.card-grade\{display:flex;align-items:center/);
  assert.match(css, /draft-ten-mode \.card \.draft-bond-hints\{position:static/);
  assert.match(css, /draft-ten-mode \.card \.draft-bond-hints i\{[^}]*font-size:7px/);
  assert.match(ui, /\$\{batch\?bondHintMarkup:''\}<\/span>/);
  assert.doesNotMatch(ui, /style="--card-order:\$\{index\}" data-act="select-offer"/);
  assert.match(ui, /C\.toggleRecruitBatchSelection\(r,index\)/);
  assert.doesNotMatch(ui, /batchPointerClickSuppressedUntil/);
  assert.match(ui, /forcedOpening\|\|screen==='recruit'\|\|screen==='result'/);
  assert.match(ui, /batchCount===0\?'全部出售':'确认拿走'/);
  assert.match(css, /pending-recruit-modal>h2\{[^}]*font-size:14px/);
  assert.match(css, /batch-select-toggle\{flex:0 0 auto;width:auto/);
  assert.match(ui, /syncScrollViewport\(\);\s*\n\s*\}/);
  assert.match(readRoot('src', 'App.jsx'), /id="batch-action-root" hidden/);
  assert.match(ui, /function renderBatchAction\(batch,batchCount\)/);
  assert.match(ui, /batchActionRoot\.markup='';batchActionRoot\.hidden=true/);
  assert.doesNotMatch(ui, /batchActionRoot\.replaceChildren\(/);
  assert.match(css, /#batch-action-root\{position:fixed;z-index:19;left:0;right:0;bottom:0/);
  assert.doesNotMatch(css, /draft-ten-mode \.floatingaction\{|#batch-action-root\{[^}]*backdrop-filter|#batch-action-root\{[^}]*transform:/);
  assert.match(css, /batch-confirm\{[^}]*background:linear-gradient[^}]*!important/);
});

test('all modal content stays inside the React renderer lifecycle', () => {
  const ui = readH5('game-ui.js');
  assert.match(ui, /function renderRecruitSheet\(r\)[\s\S]+?modal\.markup=/);
  assert.doesNotMatch(ui, /modal\.replaceChildren\(/);
});

test('duel action dock stays flush while protecting its button from the host bottom edge', () => {
  const css = readH5('styles/roster-actions.css');
  assert.match(css, /#duel \.floatingaction\{[^}]*bottom:0[^}]*padding:9px 15px calc\(9px \+ env\(safe-area-inset-bottom\)\)/);
});

test('screens with the top bar share the horizontal 15px gap without a covering shadow', () => {
  const catalog = readH5('styles/catalog.css');
  const duel = readH5('styles/duel.css');
  const modules = readH5('styles/profile-shop.css');
  assert.match(modules, /:root\{--module-gap:10px;--game-top-height:32px;--screen-edge-gap:15px\}/);
  assert.match(modules, /:is\(#talent,#recruit,#roster,#shop,#duel,#result\)\.screen\{padding-top:calc\(var\(--game-top-height\) \+ var\(--screen-edge-gap\)\)\}/);
  assert.match(catalog, /margin-top: var\(--screen-top-offset, var\(--game-top-height, 32px\)\);[\s\S]*?padding-top: var\(--screen-edge-gap, 15px\)/);
  assert.match(duel, /\.top\{height:var\(--game-top-height,32px\);padding:0 14px;box-shadow:none\}/);
});

test('opening screens hide the top bar and its reserved space until the first six players are chosen', () => {
  const ui = readH5('game-ui.js');
  const screens = readRoot('src', 'react-screens.jsx');
  const css = readH5('styles/catalog.css');
  assert.match(ui, /id==='talent'\|\|id==='recruit'&&!!game\.run&&C\.starterCount\(game\.run\)<6/);
  assert.match(css, /\.app\.opening-mode \.top\{display:none\}/);
  assert.match(css, /\.app\.opening-mode\{--screen-top-offset:0px\}/);
  assert.match(css, /height: calc\(100dvh - var\(--screen-top-offset, var\(--game-top-height, 32px\)\) - var\(--fixed-dock-height, 0px\)\)/);
  assert.doesNotMatch(screens, /<p className="lead">从 \{totalCount\} 项开局天赋/);
  assert.doesNotMatch(screens, /className="result-top"/);
});

test('shop and locker share a compact five-stat header without a title', () => {
  const ui = readH5('game-ui.js');
  const css = readH5('styles/profile-shop.css');
  assert.doesNotMatch(ui, /LOCKER ROOM/);
  assert.doesNotMatch(ui, /shop-screen-title/);
  assert.match(ui, /function shopCombatSummary\(r\)/);
  assert.match(ui, /shop-overview-row">\$\{shopCombatSummary\(liveRun\)\}/);
  assert.doesNotMatch(ui, /shopTab==='my'\?combatPanel\(liveRun,false\)/);
  assert.match(css, /#shop \.shop-overview-row\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css, /#shop \.shop-combat-summary \.roster-combat-grid\{height:100%;gap:3px\}/);
  assert.match(css, /#shop \.shop-balance\{min-width:0;padding:5px 8px;border-radius:9px;font-size:10px\}/);
  assert.match(css, /#shop>\.row\{display:none!important\}/);
  assert.match(ui, /action==='buy-gear'.+save\(\);go\('shop'\);notify\('装备已购买'\)/);
});

test('top-bar back navigation uses the shared click handler', () => {
  const ui = readH5('game-ui.js');
  assert.match(ui, /document\.addEventListener\('click',event=>\{/);
  assert.doesNotMatch(ui, /handle\(topBack\.dataset\.act,topBack\);/);
  assert.doesNotMatch(ui, /topBackClickSuppressedUntil/);
  assert.match(ui, /if\(action==='roster'\)\{go\('roster'\);return\}/);
});

test('roster top action opens the current talent instead of returning home', () => {
  const ui = readH5('game-ui.js');
  assert.match(ui, /screen==='roster'\?\['current-talent-open',`当前天赋：\$\{currentTalent\?\.name\|\|'未选择'\}`\]/);
  assert.doesNotMatch(ui, /<button class="roster-talent-action" data-act="current-talent-open">查看天赋<\/button>/);
  assert.match(ui, /if\(action==='current-talent-open'\)\{if\(r\)\{showCurrentTalent=true;renderPending\(\)\}return\}/);
});

test('duel fusion panel uses the rating in place of the portrait and spans five combat stats', () => {
  const ui = readH5('game-ui.js');
  const screens = readRoot('src', 'react-screens.jsx');
  const css = readH5('styles/duel.css');
  assert.match(ui, /class="ace-rating">\$\{fusion\.rating\}/);
  assert.match(screens, /className="ace-rating">\{fusion\.rating\}/);
  assert.doesNotMatch(screens, /className="ace-mark"/);
  assert.doesNotMatch(screens, /组羁绊生效|综合战力/);
  assert.doesNotMatch(ui, /<h1 class="title">单挑赛前情报<\/h1>/);
  assert.doesNotMatch(screens, />单挑赛前情报<\/h1>/);
  assert.match(css, /\.compact-ace \.ace-combat-wide\{[^}]*grid-column:1\/-1/);
  assert.match(css, /\.compact-ace \.ace-combat-grid\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\);width:100%\}/);
  assert.match(css, /#duel \.opponent\{padding:10px;border-radius:13px\}/);
  assert.match(screens, /className="opponent-name-row"/);
  assert.doesNotMatch(screens, /className="eyebrow">本关对手/);
  assert.match(css, /#duel \.opponent-name-row b\{font-size:22px/);
  assert.match(css, /#duel \.opponent-name-row>strong\{[^}]*margin:0/);
  assert.match(css, /#duel \.opponent-combat\{margin-bottom:0\}/);
  assert.match(css, /#duel \.compact-ace \.signature-panel\.embedded\{margin-top:6px;padding-top:6px\}/);
  assert.match(readH5('styles/catalog.css'), /\.screen:not\(#home\):not\(#result\):not\(#report\):not\(#roster\):not\(#profile\):not\(#pointshop\):not\(#leaderboard\)\.active/);
});

test('roster action dock remains fixed at the viewport bottom while the roster scrolls', () => {
  const css = readH5('styles/catalog.css');
  assert.match(css, /\.screen:not\(#home\):not\(#result\):not\(#report\):not\(#roster\):not\(#profile\):not\(#pointshop\):not\(#leaderboard\)\.active/);
  assert.match(css, /#roster \.roster-dock \{[\s\S]*?position: fixed;[\s\S]*?bottom: 0;/);
  assert.match(css, /#roster\.active \{[\s\S]*?padding-bottom: 145px/);
});

test('career settlement can be revived once without duplicating run rewards', () => {
  const game = C.createGame();
  const run = C.createRun('win_bonus', 20261001);
  game.run = run;
  run.stage = 6;
  run.wins = 4;
  run.losses = 3;
  run.morale = 0;
  run.lastBattle = { won: false, stage: 6 };
  const earned = C.finishRun(game);
  assert.equal(earned, 50);
  assert.equal(game.profile.legend, 50);
  assert.equal(game.profile.runs, 1);
  const cashBefore = run.cash;
  const bonus = C.reviveRun(game);
  assert.equal(bonus, C.recruitPackCost(run, 10));
  assert.equal(run.cash, cashBefore + bonus);
  assert.equal(run.morale, 3);
  assert.equal(run.stage, 6);
  assert.equal(run.lastBattle, null);
  assert.equal(run.ended, false);
  assert.equal(game.profile.legend, 0);
  assert.equal(game.profile.runs, 0);
  assert.equal(C.reviveRun(game), false);
});

test('career report builds a preview and shares its PNG through OSS and the post editor', () => {
  const ui = readH5('game-ui.js');
  const screens = readRoot('src', 'react-screens.jsx');
  const css = readH5('styles/career-report.css');
  assert.match(ui, /function careerReportSummary\(\)/);
  assert.match(ui, /function createCareerPoster\(summary\)/);
  assert.match(ui, /canvas\.toBlob\(blob=>blob\?resolve\(blob\)/);
  assert.match(ui, /ai\.oss\.uploadFile\(\{file:blob,filename:/);
  assert.match(ui, /new URL\(upload\.downloadUrl\)/);
  assert.match(ui, /imageUrl\.protocol!=='https:'/);
  assert.match(ui, /const bbs=await ai\.bbsConfig\.get\(\)/);
  assert.match(ui, /typeof bbs\?\.bbsTagId==='string'&&bbs\.bbsTagId\.trim\(\)/);
  assert.match(ui, /ai\.request\.bbs\.openPostEditor\(params\)/);
  assert.match(ui, /if\(response\?\.code!==200\)throw new Error/);
  assert.match(ui, /const rewardedNow=!r\.posterRewarded;\s*if\(rewardedNow\)\{r\.posterRewarded=true;game\.profile\.legend\+=100;save\(\)\}/);
  assert.match(ui, /posterMessage=rewardedNow\?'已获得奖励·100传奇点':''/);
  assert.match(ui, /showRecruitSheet=false;recruitSheetMessage='';showBonds=false/);
  assert.match(screens, /查看生涯报告/);
  assert.match(screens, /\{!ended && <div className="panel battle-reward"/);
  assert.match(screens, /data-act="report-poster" disabled=\{posterBusy\}>生成海报/);
  assert.doesNotMatch(ui, /data-act="poster-regenerate"/);
  assert.match(ui, /data-act="poster-share"/);
  assert.match(screens, /value\.startsWith\('blob:'\)/);
  assert.match(screens, /new URL\(value\.slice\(5\)\)\.origin !== window\.location\.origin/);
  assert.match(screens, /<h2>最终阵容<\/h2>/);
  assert.match(screens, /未激活羁绊/);
  assert.match(screens, /未购买装备和球衣/);
  assert.match(screens, /data-act="report-new">返回首页/);
  assert.doesNotMatch(screens, /恢复满体力，重打当前关/);
  assert.doesNotMatch(screens, /根据回调来发放奖励/);
  assert.match(css, /\.app\.report-mode \.top\{display:none\}/);
  assert.match(css, /\.career-report-hero\{[^}]*padding:10px/);
  assert.match(css, /\.career-report-hero h1\{[^}]*font-size:24px/);
  assert.match(css, /\.career-report-overview\{display:grid;grid-template-columns:/);
  assert.match(screens, /<span>第 \{summary\.stage\} 关<\/span><h1>\{summary\.goat\}<\/h1>/);
  assert.match(css, /\.career-report-content\{[^}]*overflow-y:auto/);
  assert.match(css, /\.career-action-row\{display:grid;grid-template-columns:1fr 1fr/);
  assert.match(css, /\.career-lineup\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.career-lineup b\{[^}]*text-overflow:ellipsis/);
  assert.match(screens, /className="career-bond-tag"[^>]*>\{bond\.name\}<\/div>/);
  assert.doesNotMatch(screens, /\{bond\.description\}<\/span>/);
  assert.match(screens, /className=\{`career-gear-tag \$\{item\.rarityClass\}`\}/);
  assert.doesNotMatch(screens, /\{item\.description\}<\/small>/);
  assert.match(css, /\.career-bonds,\.career-gear\{display:flex;flex-wrap:wrap;gap:5px\}/);
  assert.match(css, /\.career-gear-tag\.gear-tier-a\{background:linear-gradient/);
  assert.match(screens, /className="career-settlement-head"/);
  assert.doesNotMatch(screens, /重打当前关，并获得一次十连招募所需奖金/);
  assert.match(readH5('styles/catalog.css'), /\.screen:not\(#home\):not\(#result\):not\(#report\):not\(#roster\):not\(#profile\):not\(#pointshop\):not\(#leaderboard\)\.active/);
});

test('talent video choice and leaderboard use rewarded callbacks and bounded cloud reads', () => {
  const ui = readH5('game-ui.js');
  const screens = readRoot('src', 'react-screens.jsx');
  assert.match(ui, /if\(action==='talent-ad'\)/);
  assert.match(ui, /response\?\.code!==200\|\|response\?\.data\?\.rewarded!==true/);
  assert.match(ui, /talentOffer=C\.availableTalents\(game\.profile\)/);
  assert.match(ui, /await refreshRewardTaskState\(\)/);
  assert.doesNotMatch(ui, /mockBoard|MOCK_NAMES|SUPFUSION_DEMO_LEADERBOARD/);
  assert.match(ui, /rows\.slice\(0,50\)/);
  assert.match(ui, /window\.ColorboxAI\.cloud\.request\(\{url:`\$\{base\}\/api\/leaderboard`,method:'GET',data:\{board,limit:50\}\}\)/);
  assert.match(screens, /leaderboard-podium/);
  assert.match(screens, /entries\.slice\(3, 50\)/);
  assert.match(screens, /data-act="talent-ad"/);
  assert.match(screens, /单局最高 OVR/);
  assert.doesNotMatch(screens, /unit="GOAT"/);
});

test('a run records its highest battle OVR separately from GOAT', () => {
  const game = C.createGame();
  game.run = draftedRun(20261001);
  const report = C.battle(game, 'outside');
  assert.ok(report);
  assert.equal(game.run.maxOvr, report.rating);
  assert.notEqual(game.run.maxOvr, report.goat);
  C.finishRun(game);
  assert.equal(game.profile.bestOvr, report.rating);
});
