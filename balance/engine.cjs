'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const files=['game-data.js','gear-catalog.js','event-data.js','event-system.js','game-core.js'];
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function manifest(){
  const paths=[...files.map(file=>'h5/'+file),...['engine.cjs','driver.cjs','policies.cjs','runner.cjs','cli.cjs'].map(file=>'balance/'+file)];
  return Object.fromEntries(paths.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
}
function loadBrowserCore(){
  const context=vm.createContext({});context.window=context;
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,'h5',file),'utf8'),context,{filename:file});
  return context.SupFusionGameCore;
}
function rng(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
const C=require('../h5/game-core.js');
function normalize(options={}){
  const cfg={seed:1,policy:'ordinary',maxStage:500,maxBattles:2000,maxActions:30000,maxActionsPerBattle:120,maxMs:30000,ads:'none',...options};
  for(const key of ['seed','maxStage','maxBattles','maxActions','maxActionsPerBattle','maxMs']){
    if(!Number.isInteger(cfg[key])||cfg[key]<(key==='seed'?0:1))throw Error('Invalid '+key);
  }
  if(cfg.seed>4294967295)throw Error('Invalid seed');
  if(!['none','rewarded-success'].includes(cfg.ads))throw Error('Invalid ads');
  if(cfg.rulesVersion!==undefined&&(!Number.isInteger(cfg.rulesVersion)||cfg.rulesVersion<1||cfg.rulesVersion>C.BALANCE_RULES_VERSION))throw Error('Invalid rulesVersion');
  if(cfg.scenario&&!cfg.scenario.label)throw Error('Scenario requires label');
  return cfg;
}
function initialize(core,config){
  const game=core.createGame();if(config.profile)game.profile=clone(config.profile);
  const setupRandom=rng(config.setupSeed??(config.seed^0xa341316c));
  const talents=[...core.availableTalents(game.profile)];
  for(let i=talents.length-1;i>0;i--){const j=Math.floor(setupRandom()*(i+1));[talents[i],talents[j]]=[talents[j],talents[i]]}
  const talentOffer=talents.slice(0,3+(game.profile.upgrades?.policyOffers||0));
  const preferences={novice:['dynasty','championship_budget','all_in','phase_tempo'],ordinary:['scouting_network','star_workshop','development','win_bonus'],expert:['scouting_network','development','star_workshop','front_office','captain'],extreme:['scouting_network','development','chemistry','star_workshop','captain']};
  const preferred=(preferences[config.policy]||[]).find(id=>talentOffer.some(t=>t.id===id));
  const chosen=config.talent||preferred||talentOffer[0].id;
  if(!config.scenario&&!talentOffer.some(t=>t.id===chosen))throw Error('Talent is not in visible opening offer');
  if(!core.TALENTS.some(t=>t.id===chosen))throw Error('Unknown talent');
  const progress={...game.profile.upgrades,jerseyUnlocks:game.profile.jerseyUnlocks,gearUnlocks:game.profile.gearUnlocks};
  game.run=core.createRun(chosen,config.seed,progress,config.rulesVersion??core.BALANCE_RULES_VERSION);
  if(config.scenario){
    const s=config.scenario,r=game.run;
    if(s.stage!==undefined){if(!Number.isInteger(s.stage)||s.stage<1)throw Error('Invalid scenario stage');r.stage=s.stage;r.endless=s.stage>10}
    if(s.players){
      if(s.players.length<6||new Set(s.players).size!==s.players.length||s.players.some(id=>!core.BY_ID[id]))throw Error('Invalid scenario players');
      r.slots=Object.fromEntries(core.SLOTS.map((slot,i)=>[slot.id,s.players[i]]));r.bench=s.players.slice(6);r.benchLimit=Math.max(r.benchLimit,r.bench.length);
      r.owned=Object.fromEntries(s.players.map(id=>[id,{stars:1,train:0,trainedAt:0,...s.growth?.[id]}]));
      r.collectedPlayers=[...s.players];r.offer=[];r.offerOdds=null;r.free=0;
    }
    for(const field of ['cash','morale'])if(s[field]!==undefined)r[field]=s[field];
    for(const field of ['gear','gearReserve','boosts'])if(s[field])r[field]=clone(s[field]);
    if(s.eventBonuses)r.eventState.bonuses=clone(s.eventBonuses);
    // 场景资源明确标为预设，不混入自然获取统计；依然执行正式规则。
    core.makeShopOffers(r);
  }
  return {game,talentOffer:talentOffer.map(t=>({id:t.id,name:t.name,gain:t.gain,cost:t.cost})),chosen};
}
function assertState(core,r){
  const present=[...Object.values(r.slots).filter(Boolean),...r.bench];
  if(new Set(present).size!==present.length||present.length!==Object.keys(r.owned).length||present.some(id=>!core.BY_ID[id]||!r.owned[id]))throw Error('Invalid roster');
  if(r.bench.length>r.benchLimit||r.cash<0||!Number.isFinite(r.cash)||r.morale<0||r.morale>core.MORALE_HARD_CAP)throw Error('Invalid resources');
  for(const own of Object.values(r.owned))if(!Number.isInteger(own.stars)||own.stars<1||!Number.isInteger(own.train)||own.train<0)throw Error('Invalid growth');
  const gear=[...r.gear,...r.gearReserve];
  if(new Set(gear).size!==gear.length||gear.some(id=>!core.GEAR.some(g=>g.id===id)))throw Error('Invalid gear');
  if(new Set(r.gear.map(id=>core.GEAR.find(g=>g.id===id).slot)).size!==r.gear.length)throw Error('Duplicate worn slot');
  if(core.gearReserveCount(r)>core.gearReserveLimit(r))throw Error('Storage overflow');
  const f=core.fused(r);for(const n of [...Object.values(f.stats),...Object.values(f.dimensions),f.rating])if(!Number.isFinite(n)||n<0)throw Error('Invalid power');
}
module.exports={C,clone,hash,manifest,loadBrowserCore,rng,normalize,initialize,assertState};
