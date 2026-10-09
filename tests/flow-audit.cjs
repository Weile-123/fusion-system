const C = require('../h5/game-core.js');

const policy = process.argv[2] || 'basic';
const count = Number(process.argv[3] || 300);
const stageCap = Number(process.argv[4] || 10);
const stats = Array.from({ length: stageCap }, () => ({ reached: 0, wins: 0, attempts: 0, rating: 0, foe: 0 }));
const outcome = { clears: 0, clearWithoutTrainingStarOrBond: 0, deaths: 0, attempts: 0, invalid: 0, furthest: 0, cash: 0 };
const byTalent = Object.fromEntries(C.TALENTS.map(talent => [talent.id, { runs: 0, clears: 0, furthest: 0 }]));
const slots = C.SLOTS.map(s => s.id);

function assertState(r) {
  const present = [...slots.map(s => r.slots[s]).filter(Boolean), ...r.bench];
  if (new Set(present).size !== present.length || present.length !== Object.keys(r.owned).length ||
      r.bench.length > r.benchLimit || r.cash < 0 || !Number.isFinite(r.cash) ||
      !present.every(id => r.owned[id] && C.BY_ID[id])) throw Error(`invalid state at ${r.stage}`);
}
function choose(r) {
  const vacant = slots.filter(s => !r.slots[s]);
  return r.offer.slice().sort((a, b) => score(b) - score(a))[0];
  function score(id) {
    const s = C.BY_ID[id];
    const slot = vacant.includes(s.best) ? s.best : vacant[0] || s.best;
    const value = s.attrs[slot] + s.attrs[s.best] * .2;
    if (r.owned[id]) return value + (policy === 'spend' ? 24 : 10);
    return value + ({ C: 0, B: 5, A: 10, S: 16, SSR: 25 }[s.tier]);
  }
}
function strategyFor(r) {
  if (policy === 'basic') return 'collapse';
  if (policy === 'omniscient' || policy === 'openingOnly') return Object.keys(C.STRATEGIES).find(id => C.STRATEGIES[id].beats === C.opponent(r).strategy);
  const foe = C.opponent(r);
  if (foe.stats.inside + foe.stats.drive > foe.stats.three + foe.stats.mid + 13) return 'collapse';
  if (foe.stats.three > foe.stats.inside + 7) return 'outside';
  return 'drive';
}
function improveLineup(r) {
  for (let pass = 0; pass < 3; pass++) {
    let best = null;
    for (let index = 0; index < r.bench.length; index++) for (const slot of slots) {
      const incoming = r.bench[index], outgoing = r.slots[slot];
      const gain = C.playerScore(C.BY_ID[incoming], r.owned[incoming], slot) -
        C.playerScore(C.BY_ID[outgoing], r.owned[outgoing], slot);
      if (gain > (best?.gain ?? 2)) best = { index, slot, gain };
    }
    if (!best) break;
    C.swapBench(r, best.index, best.slot);
  }
}
for (let seed = 1; seed <= count; seed++) {
  const game = C.createGame(), r = game.run = C.createRun(C.TALENTS[seed % C.TALENTS.length].id, seed * 7919);
  const talentRow = byTalent[r.talent]; talentRow.runs++;
  for (let i = 0; i < 6; i++) {
    const answer = C.recruit(r, choose(r));
    if (!answer.ok) throw Error('opening recruitment failed');
    if (i < 5) C.makeOffer(r);
  }
  assertState(r);
  while (!r.ended && r.stage <= stageCap) {
    const row = stats[r.stage - 1];
    row.reached++;
    if (r.free && r.stage > 1 && policy !== 'openingOnly') {
      C.makeOffer(r);
      const answer = C.recruit(r, choose(r));
      if (!answer.ok) throw Error('stage recruit failed');
      if (answer.kind === 'pending') C.resolvePending(r, 'sell');
    }
    if (['advanced', 'noTraining', 'noGear', 'noGrowth'].includes(policy)) improveLineup(r);
    if (!['basic', 'noTraining', 'noGrowth', 'openingOnly'].includes(policy)) {
      for (const id of Object.keys(r.owned)) if (r.cash >= C.trainingCost(r, id) + 8) C.train(r, id);
    }
    if (!['basic', 'noGear', 'noGrowth', 'openingOnly'].includes(policy)) {
      for (const id of r.shopOffers.gear) {
        const item = C.GEAR.find(g => g.id === id);
        if (r.cash >= C.gearPrice(r, item) + 8) C.buyGear(r, id);
      }
      if (policy === 'spend' || policy === 'omniscient') {
        for (const id of r.shopOffers.boost) {
          const item = C.BOOSTS.find(b => b.id === id);
          if (r.cash >= C.boostPrice(r, item) + 8) C.buyBoost(r, id);
        }
      }
    }
    assertState(r);
    const stage = r.stage, rating = C.fused(r).rating, foe = C.opponent(r).rating;
    row.rating += rating; row.foe += foe;
    let won = false;
    for (let retry = 0; retry < 3 && !r.ended && !won; retry++) {
      const result = C.battle(game, strategyFor(r));
      if (!result || result.stage !== stage) throw Error('battle failed');
      row.attempts++; outcome.attempts++;
      won = result.won;
      if (!r.ended) C.continueRun(game, won ? 'next' : 'retry');
      if(r.randomEvent){const id=r.randomEvent.id;C.resolveRandomEvent(game,id,'safe');C.acknowledgeRandomEvent(game,id)}
    }
    if (won) row.wins++;
    assertState(r);
    if (!won) break;
  }
  if (r.stage > 10) {
    outcome.clears++;
    talentRow.clears++;
    if (Object.values(r.owned).every(own => own.train === 0 && own.stars === 1) && !C.activeSynergies(r).length)
      outcome.clearWithoutTrainingStarOrBond++;
  }
  if (r.ended) outcome.deaths++;
  outcome.furthest += r.stage;
  talentRow.furthest += r.stage;
  outcome.cash += r.cash;
}
console.log(JSON.stringify({ policy, count, stageCap, outcome, byTalent,
  stages: stats.map((s, i) => ({ stage: i + 1, reached: s.reached, clear: s.reached ? +(100 * s.wins / s.reached).toFixed(1) : null,
    attempts: s.attempts, rating: s.reached ? +(s.rating / s.reached).toFixed(1) : null,
    foe: s.reached ? +(s.foe / s.reached).toFixed(1) : null })) }, null, 2));
