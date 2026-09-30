/* 《我的球星融合系统》第四版规则与状态。数值为游戏设计值，并非真实 NBA 统计。 */
(function (root) {
  'use strict';

  const DATA=root.SupFusionGameData||(typeof require==='function'?require('./game-data.js'):null);
  if(!DATA)throw new Error('SupFusionGameData is required before game-core.js');
  const GEAR_DATA=root.SupFusionGearCatalog||(typeof require==='function'?require('./gear-catalog.js'):null);
  if(!GEAR_DATA)throw new Error('SupFusionGearCatalog is required before game-core.js');

  const ATTRS = DATA.ATTRS;
  const LABELS = DATA.LABELS;
  const SLOTS = [
    { id: 'three', label: '三分', secondary: 'handle' },
    { id: 'mid', label: '中投', secondary: 'drive' },
    { id: 'drive', label: '突破', secondary: 'inside' },
    { id: 'handle', label: '控球', secondary: 'mid' },
    { id: 'inside', label: '篮下', secondary: 'drive' },
    { id: 'def', label: '防守', secondary: 'inside' }
  ];
  const COMBAT_LABELS=DATA.COMBAT_LABELS;
  const COMBAT_KEYS=Object.keys(COMBAT_LABELS);
  const SLOT_WEIGHTS={
    three:{three:.65,mid:.2,handle:.15},mid:{mid:.55,drive:.25,three:.2},
    drive:{drive:.55,handle:.25,inside:.2},handle:{handle:.55,drive:.25,mid:.2},
    inside:{inside:.6,drive:.25,def:.15},def:{def:.6,inside:.25,handle:.15}
  };
  const DIMENSION_WEIGHTS={
    shooting:{three:.5,mid:.35,handle:.15},creation:{handle:.5,drive:.3,mid:.2},
    finishing:{inside:.5,drive:.35,mid:.15},perimeterStop:{def:.5,handle:.3,drive:.2},
    rimStop:{def:.5,inside:.35,drive:.15}
  };
  function weighted(values,weights){return Object.entries(weights).reduce((sum,[key,weight])=>sum+(values[key]||0)*weight,0)}
  function slotScoresFromStats(stats){return Object.fromEntries(SLOTS.map(slot=>[slot.id,weighted(stats,SLOT_WEIGHTS[slot.id])]))}
  function dimensionsFromSlots(scores){return Object.fromEntries(COMBAT_KEYS.map(key=>[key,weighted(scores,DIMENSION_WEIGHTS[key])]))}
  function describeCombatEffect(flat,percent,extras=[]){
    const parts=[];
    if(Object.keys(flat||{}).length)parts.push(DATA.combatText(flat));
    if(Object.keys(percent||{}).length)parts.push(DATA.combatText(percent,'%'));
    return [...parts,...extras].filter(Boolean).join('；');
  }
  function describeGearEffect(item){
    const parts=[];
    for(const [key,value] of Object.entries(item.stats||{}))parts.push(`${LABELS[key]} +${value}`);
    for(const [key,value] of Object.entries(item.percentStats||{}))parts.push(`${key==='all'?'六项能力':LABELS[key]} +${value}%`);
    if(item.dimensions)parts.push(DATA.combatText(item.dimensions,''));
    if(item.dimensionPercent){
      const {all,...specific}=item.dimensionPercent;
      if(all)parts.push(`五项单挑能力 +${all}%`);
      if(Object.keys(specific).length)parts.push(DATA.combatText(specific,'%'));
    }
    if(item.counterCash)parts.push(`战术克制成功额外 +${item.counterCash} 奖金`);
    if(item.bondBoost)parts.push(`羁绊战力效果 +${Math.round(item.bondBoost*100)}%`);
    if(item.clutchBonus)parts.push(`关键分命中率 +${Math.round(item.clutchBonus*100)} 个百分点`);
    if(item.turnoverReduction)parts.push(`失误率 -${Math.round(item.turnoverReduction*1000)/10} 个百分点`);
    return parts.join('；');
  }
  const STRATEGIES = {
    outside: { name: '外线拉开', beats: 'collapse', shot: 'three', target:'shooting', penalty:'rimStop', description: '投射威胁 +12%，护框强度 -4%；克制护框收缩' },
    drive: { name: '突破冲筐', beats: 'outside', shot: 'drive', target:'finishing', penalty:'perimeterStop', description: '禁区终结 +12%，外线限制 -4%；克制外线拉开' },
    collapse: { name: '护框收缩', beats: 'drive', shot: 'inside', target:'rimStop', penalty:'shooting', description: '护框强度 +12%，投射威胁 -4%；克制突破冲筐' }
  };
  const SIGNATURE_MOVES = [
    {id:'stepback',name:'变向后撤步',kind:'offense',slots:['three','handle'],shot:'three',accuracy:.10,turnoverPenalty:.02,description:'三分命中 +10 个百分点；触发时失误 +2 个百分点'},
    {id:'offball',name:'横移晃投',kind:'offense',slots:['three','mid'],shot:'three',accuracy:.06,threeBias:.08,description:'横移晃开防守后，三分出手占比 +8 个百分点；触发时命中 +6 个百分点'},
    {id:'pullup',name:'急停跳投',kind:'offense',slots:['mid','drive'],shot:'mid',accuracy:.10,description:'中投命中 +10 个百分点'},
    {id:'contact',name:'对抗终结',kind:'offense',slots:['drive','inside'],shot:'inside',accuracy:.10,description:'篮下命中 +10 个百分点'},
    {id:'steal',name:'预判抢断',kind:'defense',slots:['def','handle'],turnover:.06,description:'对手失误率 +6 个百分点'},
    {id:'block',name:'追身封盖',kind:'defense',slots:['def','inside'],shot:'inside',accuracy:.10,description:'对手篮下命中 -10 个百分点'}
  ];
  // 17 条开局路线：10 条默认、7 条由生涯纪录解锁。旧版天赋只用于继续已有存档。
  const TALENTS = [
    {id:'reserve_fund',name:'奖金储备',category:'经营',gain:'开局奖金 +8；每过一关奖金 +1；利息上限 +1',cost:'投射威胁、禁区终结各 -3%',effects:{startCash:8,stageCash:1,interestCap:1,dimensions:{shooting:-3,finishing:-3}}},
    {id:'scouting_network',name:'球探网络',category:'招募',gain:'S 出现权重 +30%；SSR 每组概率 +50%；每关免费招募 +1',cost:'付费招募 +2 奖金',effects:{draftSWeight:1.3,draftSSRWeight:1.5,freePerStage:1,paidRecruitDelta:2}},
    {id:'front_office',name:'精明经理',category:'经营',gain:'每场结算奖金 +2；装备购买价格 -2 奖金',cost:'赛前强化购买价格 +2 奖金',effects:{battleCash:2,gearDiscount:2,boostCostDelta:2}},
    {id:'win_bonus',name:'赢球奖金',category:'进取',gain:'每场胜利额外获得 4 奖金',cost:'失败补偿 -2 奖金',effects:{winCash:4,lossCash:-2}},
    {id:'development',name:'发展联盟',category:'养成',gain:'训练费用 -1；每级训练成长额外 +1 个百分点；出售球员多得 20%',cost:'付费招募 +2 奖金',effects:{trainingCostDelta:-1,trainingGrowthDelta:.01,saleMultiplier:1.2,paidRecruitDelta:2}},
    {id:'chemistry',name:'更衣室凝聚',category:'羁绊',gain:'已激活羁绊的五维加成提高 25%；有羁绊时胜利奖金 +2',cost:'没有激活羁绊时五维 -3%',effects:{bondScale:1.25,bondWinCash:2,noBondPenalty:-3}},
    {id:'star_workshop',name:'球星工坊',category:'养成',gain:'每颗星的六项成长额外 +2 个百分点；每级训练额外 +1 个百分点',cost:'备战席初始上限 -1',effects:{starGrowthDelta:.02,trainingGrowthDelta:.01,benchDelta:-1}},
    {id:'lockdown',name:'铁桶防线',category:'防守',gain:'外线限制、护框强度各 +8%；每关免费刷新装备商店 1 次',cost:'投射威胁 -3%',effects:{dimensions:{perimeterStop:8,rimStop:8,shooting:-3},freeGearRefresh:1}},
    {id:'counter_coach',name:'临场教练',category:'战术',gain:'战术克制额外加成从 6% 提高到 12%；每关免费招募 +1',cost:'本方策略弱势维度惩罚从 -4% 增至 -6%',effects:{counterBonus:6,freePerStage:1,strategyPenalty:2}},
    {id:'all_in',name:'孤注一掷',category:'决战',gain:'五项单挑能力 +7%；开局获得一件随机 A 级装备',cost:'开局士气 -1',effects:{allDimensions:7,startGearRarity:'A',startMorale:-1}},
    {id:'steady_interest',name:'长期合同',category:'经营',gain:'利息上限 +1；每过一关奖金 +1',cost:'无',unlock:{runs:1},effects:{interestCap:1,stageCash:1}},
    {id:'championship_budget',name:'冠军预算',category:'经营',gain:'五项单挑能力 +6%；装备购买价格 -2 奖金',cost:'开局奖金 -8',unlock:{bestStage:5},effects:{allDimensions:6,gearDiscount:2,startCash:-8}},
    {id:'dynasty',name:'王朝计划',category:'决战',gain:'开局获得一件随机 S 级装备',cost:'开局奖金 -8；每过一关奖金 -2',unlock:{bestStage:10},effects:{startGearRarity:'S',startCash:-8,stageCash:-2}},
    {id:'film_room',name:'录像分析室',category:'战术',gain:'战术克制额外加成从 6% 提高到 16%；免除本方策略弱势惩罚',cost:'装备商店刷新费用 +1',unlock:{wins:8},effects:{counterBonus:10,ignoreStrategyPenalty:true,gearRefreshCostDelta:1}},
    {id:'deep_bench',name:'豪华轮换',category:'阵容',gain:'备战席初始上限 +2',cost:'付费招募 +1 奖金',unlock:{discovered:20},effects:{benchDelta:2,paidRecruitDelta:1}},
    {id:'streak_bonus',name:'连胜分红',category:'进取',gain:'每场胜利额外获得 6 奖金',cost:'失败补偿 -2 奖金',unlock:{bestEndless:13},effects:{winCash:6,lossCash:-2}},
    {id:'captain',name:'领袖回归',category:'续战',gain:'每场胜利恢复 1 点士气，最多恢复到 3 点',cost:'持球创造 -3%',unlock:{runs:3},effects:{winHeal:1,dimensions:{creation:-3}}}
  ];
  const LEGACY_TALENTS = [
    {id:'outside',name:'外线速成'},{id:'inside',name:'禁区霸主'},{id:'defense',name:'铁血防线'},
    {id:'agent',name:'球星经纪人'},{id:'economy',name:'精算大师'}
  ];
  const KNOWN_TALENTS=[...TALENTS,...LEGACY_TALENTS];
  const TALENT_BY_ID=Object.fromEntries(TALENTS.map(talent=>[talent.id,talent]));
  function openingEffect(run){return TALENT_BY_ID[run?.talent]?.effects||{}}
  function talentUnlocked(talent,profile){
    if(!talent.unlock)return true;
    return Object.entries(talent.unlock).every(([key,value])=>key==='discovered'?(profile?.discovered?.length||0)>=value:(profile?.[key]||0)>=value);
  }
  function availableTalents(profile){return TALENTS.filter(talent=>talentUnlocked(talent,profile)||profile?.metaUnlocks?.talents?.includes(talent.id))}
  const STAR_ROWS = DATA.STAR_ROWS;
  const STARS = STAR_ROWS.map(r => ({
    id:r[0],name:r[1],tier:r[2],role:r[3],team:r[4],best:r[5],
    attrs:Object.fromEntries(ATTRS.map((a,i)=>[a,r[6][i]])),talent:r[7],talentEffect:DATA.TALENT_DETAILS[r[0]],variantOf:r[8]||null,
    maxStars:['S','SSR'].includes(r[2])?10:20
  }));
  const BY_ID = Object.fromEntries(STARS.map(s=>[s.id,s]));
  // 关卡顺序按球员基础等级与单挑强度递进；倾向只用于战斗计算，不在赛前揭示。
  const FOE_ROSTER = [
    ['caruso','collapse'],['fox','collapse'],['anunoby','drive'],['fisher','outside'],['bowen','collapse'],
    ['battier','collapse'],['horry','outside'],['lopez','outside'],
    ['brunson','drive'],['edwards','drive'],['tatum','outside'],['booker','outside'],['irving','drive'],
    ['westbrook','drive'],['lillard','outside'],['klay','outside'],['george','outside'],['murray','outside'],
    ['butler','drive'],['green','collapse'],['gobert','collapse'],['holiday','collapse'],
    ['nash','outside'],['paul','outside'],['rayallen','outside'],['dirk','outside'],['doncic','drive'],
    ['iverson','drive'],['wade','drive'],['giannis','drive'],['kawhi','collapse'],['davis','collapse'],
    ['embiid','collapse'],['jokic','collapse'],
    ['harden','outside'],['curry','outside'],['bird','outside'],['durant','outside'],['kobe','outside'],
    ['duncan','collapse'],['shaq','collapse'],['lebron','drive'],['stone_duncan','collapse'],
    ['reaper_durant','outside'],['showtime_magic','drive'],['chef_curry','outside'],['mamba_kobe','outside'],
    ['diesel_shaq','collapse'],['king_lebron','drive'],['air_jordan','drive']
  ];
  const FOES = FOE_ROSTER.map(([id])=>id);
  const LEGEND_FOE_COUNT=STARS.filter(star=>star.tier==='SSR').length;
  const LEGEND_FOE_START=FOE_ROSTER.length-LEGEND_FOE_COUNT;
  // Keep the onboarding stages forgiving, then accelerate into the back half.
  // Stage 11+ deliberately uses a convex curve so future meta progression does
  // not turn endless mode into a long stretch of nearly flat difficulty.
  const MAINLINE_FOE_TARGETS=[64,70,78,86,90,92,94,96,99,103];

  function opponentTarget(stage){
    if(stage<=10)return MAINLINE_FOE_TARGETS[stage-1];
    const depth=Math.min(stage,50)-10;
    return MAINLINE_FOE_TARGETS[9]+depth*1.8+depth*depth*.045;
  }
  const SYNERGIES = DATA.SYNERGIES;
  const BOOSTS = [
    { id:'hot', name:'手感火热', type:'投射', price:5, stats:{three:8}, description:'下一场三分 +8%' },
    { id:'paint', name:'禁区强攻', type:'终结', price:5, stats:{inside:8}, description:'下一场篮下 +8%' },
    { id:'stopper', name:'防守专家', type:'防守', price:5, stats:{def:8}, description:'下一场防守 +8%' },
    { id:'rhythm', name:'节奏加速', type:'组织', price:6, stats:{handle:9}, description:'下一场控球 +9%' },
    { id:'touch', name:'中距离热区', type:'投射', price:6, stats:{mid:9}, description:'下一场中投 +9%' },
    { id:'focus', name:'全神贯注', type:'全能', price:9, stats:{all:4}, description:'下一场全属性 +4%' },
    { id:'clutch', name:'关键球模式', type:'关键球', price:10, stats:{all:2}, clutchBonus:.06, description:'全属性 +2%；关键分命中率提升' },
    { id:'composure', name:'稳健持球', type:'控场', price:9, stats:{handle:5}, turnoverReduction:.025, description:'控球 +5%；降低下一场失误率' }
  ].map(item=>{
    const combatPercent=DATA.mapToCombat(item.stats);
    const extras=[];
    if(item.clutchBonus)extras.push(`关键分命中率 +${Math.round(item.clutchBonus*100)} 个百分点`);
    if(item.turnoverReduction)extras.push(`失误率 -${Math.round(item.turnoverReduction*1000)/10} 个百分点`);
    return {...item,combatPercent,description:`本场${describeCombatEffect(null,combatPercent,extras)}`};
  });
  const GEAR_LIMIT = 6;
  const JERSEY_COLLECTION_SCALE = .35;
  const JERSEY_EQUIPPED_BONUS = .5;
  const JERSEY_UNLOCK_PRICE = 500;
  const META_UPGRADES=[
    {id:'startGold',name:'启动资金',prices:[80,150,250,400,600],effect:'每级开局奖金 +5'},
    {id:'scouting',name:'球探网络',prices:[100,180,300,450,650],effect:'每级提高 S 与 SSR 招募权重'},
    {id:'interestCap',name:'薪资运营',prices:[250,500,800,1200,1600],effect:'每级利息上限 +1'},
    {id:'trainingBoost',name:'训练团队',prices:[150,300,500],effect:'每级训练成长 +1%'},
    {id:'policyOffers',name:'教练组会议',prices:[500],effect:'开局天赋候选 3 → 4'},
    {id:'benchSeat',name:'轮换深度',prices:[180,350,600,900,1300],effect:'每级初始备战席 +1'},
    {id:'filmStudy',name:'录像分析',prices:[200,400,700],effect:'每级使战术克制的目标能力额外 +1%'}
  ];
  const META_UNLOCKS=[
    {id:'talents',name:'天赋解锁抽取',price:500,pool:'天赋'},
    {id:'gear',name:'装备解锁抽取',price:300,pool:'装备'},
    {id:'players',name:'球员解锁抽取',price:200,pool:'球员'}
  ];
  const GEAR = GEAR_DATA.map(item => ({
    ...item,
    kind: item.slot === '球衣' ? 'signature' : 'global',
    displayName: item.legendName?item.legendName+' · '+item.name:item.name,
    combatFlat: item.dimensions || {},
    combatPercent: item.dimensionPercent
      ? Object.fromEntries(Object.entries(item.dimensionPercent).flatMap(([key,value]) => key === 'all' ? COMBAT_KEYS.map(dim => [dim,value]) : [[key,value]]))
      : {},
    description: item.slot==='球衣'?'收藏按标注属性的 '+JERSEY_COLLECTION_SCALE*100+'% 生效；装备后提高 50%：'+describeGearEffect(item):describeGearEffect(item)
  }));
  const tierValue = { C:0, B:1, A:2, S:3, SSR:4 };
  const SALE_BASE = { C:2, B:3, A:5, S:8, SSR:16 };
  const TRAINING_COSTS = [4,7,11,16,22,29,37,46,56,67];
  function saleValue(id,stars=1,run=null){const star=BY_ID[id];return star?Math.floor(SALE_BASE[star.tier]*clamp(Math.floor(stars)||1,1,10)*(openingEffect(run).saleMultiplier||1)):0}
  function resolveTalentEffect(run,slotId){
    const star=BY_ID[run.slots[slotId]],base=star?.talentEffect;
    if(!star||!base?.slots?.includes(slotId))return null;
    const specific=base.slotEffects?.[slotId];
    if(!specific)return base;
    const dimensions={...(base.dimensions||{})};
    for(const [key,value] of Object.entries(specific.dimensions||{}))dimensions[key]=(dimensions[key]||0)+value;
    return {...base,...specific,dimensions,allDimensions:(base.allDimensions||0)+(specific.allDimensions||0),
      strategyDimensions:{...(base.strategyDimensions||{}),...(specific.strategyDimensions||{})}};
  }
  function activeTalentEffects(run){return SLOTS.map(slot=>resolveTalentEffect(run,slot.id)).filter(Boolean)}
  function recruitCost(run){
    const base=(run.talent==='agent'?6:8)+(openingEffect(run).paidRecruitDelta||0);
    const discount=activeTalentEffects(run).reduce((sum,effect)=>sum+(effect.recruitDiscount||0),0);
    return Math.max(1,base-discount);
  }
  function recruitPackCost(run,count=10){
    const size=Math.max(1,Math.min(100,Math.floor(Number(count)||10)));
    return Math.floor(recruitCost(run)*size*.95);
  }
  function buyRecruitPack(run,count=10){
    const size=Math.max(1,Math.min(100,Math.floor(Number(count)||10))),cost=recruitPackCost(run,size);
    if(run.ended||run.pending||run.cash<cost)return false;
    run.cash-=cost;
    run.recruitCredits=0;
    return !!makeTenOffer(run,size);
  }
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  function nextRandom(run){run.rng=(Math.imul(run.rng,1664525)+1013904223)>>>0;return run.rng/4294967296}
  function randomChoice(run,arr){return arr[Math.floor(nextRandom(run)*arr.length)]}
  function createGame(){return { version:1, run:null, profile:{runs:0,wins:0,clears:0,bestStage:0,highestStage:0,bestEndless:0,bestGoat:0,legend:0,discovered:[],jerseys:[],jerseyUnlocks:[],upgrades:{startGold:0,scouting:0,interestCap:0,trainingBoost:0,policyOffers:0,benchSeat:0,filmStudy:0},metaUnlocks:{talents:[],gear:[],players:[]}} }}
  function createRun(talent,seed,progress={}){
    const effect=openingEffect({talent});
    const run={seed:seed>>>0,rng:seed>>>0,talent,stage:1,endless:false,rarityBonus:clamp(progress.scouting??progress.rarityBonus??0,0,5),metaInterestCap:clamp(progress.interestCap||0,0,5),metaTrainingBoost:clamp(progress.trainingBoost||0,0,3),metaPolicyOffers:clamp(progress.policyOffers||0,0,1),metaFilmStudy:clamp(progress.filmStudy||0,0,3),unlockedJerseys:[...new Set((progress.jerseyUnlocks||[]).filter(id=>GEAR.some(item=>item.id===id&&item.unlockable)))],gearLimit:GEAR_LIMIT,maxGoat:0,endlessWins:0,collectedPlayers:[],collectedJerseys:[],morale:clamp(3+(effect.startMorale||0),1,3),cash:Math.max(0,16+clamp(progress.startGold||0,0,5)*5+(effect.startCash||0)),free:6+(effect.freePerStage||0),recruitCredits:0,rewardedRecruitUsed:false,offerMode:'normal',batchSelected:[],batchQueue:[],refreshFree:1,gearRefreshFree:effect.freeGearRefresh||0,forceRareRecruit:false,owned:{},slots:Object.fromEntries(SLOTS.map(s=>[s.id,null])),bench:[],benchLimit:clamp(6+clamp(progress.benchSeat||0,0,5)+(effect.benchDelta||0),1,11),offer:[],offerOdds:null,pending:null,boosts:[],boostBoughtOffers:[],gear:[],gearReserve:[],gearSoldOffers:[],shopOffers:{boost:[],gear:[]},shopRefreshes:0,gearRefreshes:0,wins:0,losses:0,lastBattle:null,ended:false,awarded:false,recruitGroups:0,noAPlusGroups:0,noSPlusGroups:0,openingAPlusGroups:0};
    if(talent==='outside')run.free+=1;
    if(talent==='economy')run.free-=1;
    if(effect.startGearRarity){const pool=GEAR.filter(item=>item.rarity===effect.startGearRarity&&item.kind!=='signature');if(pool.length){const id=randomChoice(run,pool).id;run.gear.push(id);if(GEAR.find(item=>item.id===id)?.slot==='球衣')run.collectedJerseys.push(id)}}
    makeOffer(run);
    makeShopOffers(run);
    return run;
  }
  function ownedCount(run){return Object.keys(run.owned).length}
  function starterCount(run){return SLOTS.filter(s=>run.slots[s.id]).length}
  function starLimit(run,id){
    const star=BY_ID[id];if(!star)return 0;
    return run.endless||run.stage>10?star.maxStars:3;
  }
  function identityOf(id){const star=BY_ID[id];return star?(star.variantOf||star.id):id}
  function ownedIdentities(run){return new Set(Object.keys(run.owned).map(identityOf))}
  function completedSynergies(run){const ids=ownedIdentities(run);return SYNERGIES.filter(s=>s.ids.every(id=>ids.has(id)))}
  function activeSynergies(run){
    const completed=completedSynergies(run),highest=new Map();
    for(const bond of completed)if(bond.chainId)highest.set(bond.chainId,Math.max(highest.get(bond.chainId)||0,bond.chainLevel||0));
    return completed.filter(bond=>!bond.chainId||(bond.chainLevel||0)===highest.get(bond.chainId));
  }
  function starSynergies(id){const identity=identityOf(id);return SYNERGIES.filter(s=>s.ids.includes(identity))}
  function isOpeningRecruit(run){const groups=run.recruitGroups||0;return run.offer.length?groups<=6:groups<6}
  function tierOdds(run){
    const stage=Math.max(1,run.stage||1),opening=isOpeningRecruit(run);
    const base=opening?{C:64.8,B:30,A:5,S:.2,SSR:.8}
      :stage<=4?{C:57.3,B:30,A:12,S:.7,SSR:.8}
      :stage<=7?{C:27,B:27,A:40,S:6,SSR:.8}
      :{C:15,B:21,A:54,S:10,SSR:.8};
    const odds={...base},scouting=clamp(run.rarityBonus||0,0,5);
    odds.S*=Math.pow(1.08,scouting);
    odds.SSR*=Math.pow(1.04,scouting);
    const effect=openingEffect(run);
    odds.S*=effect.draftSWeight||1;
    odds.SSR*=effect.draftSSRWeight||1;
    if(stage>10){
      const depth=stage-10;
      odds.A+=Math.min(14,depth);
      odds.S+=Math.min(7,depth*.4);
      odds.SSR=Math.min(2,odds.SSR+depth*.05);
    }
    const softPity=Math.min(6,Math.max(0,(run.noSPlusGroups||0)-5));
    odds.S+=softPity;
    odds.C=Math.max(2,odds.C-softPity);
    const baseTotal=odds.C+odds.B+odds.A+odds.S;
    for(const tier of ['C','B','A','S'])odds[tier]=odds[tier]*100/baseTotal;
    return odds;
  }
  function recruitProbabilitySummary(run){
    const odds=tierOdds(run),sSingle=odds.S/100;
    return {...odds,sGroup:100*(1-Math.pow(1-sSingle,4)),ssrGroup:odds.SSR,aPityIn:Math.max(0,4-(run.noAPlusGroups||0)),sPityIn:Math.max(0,12-(run.noSPlusGroups||0))};
  }
  function tierRoll(run,minimum='C'){
    const odds=tierOdds(run),eligible=['C','B','A','S'].filter(tier=>tierValue[tier]>=tierValue[minimum]);
    const total=eligible.reduce((sum,tier)=>sum+odds[tier],0),n=nextRandom(run)*total;
    let cursor=0;
    for(const tier of eligible){cursor+=odds[tier];if(n<cursor)return tier}
    return eligible[eligible.length-1];
  }
  function recruitPool(run,tier,chosen,opening){
    const chosenIdentities=new Set(chosen.map(identityOf)),ownedIds=new Set(Object.keys(run.owned));
    const usable=star=>!chosen.includes(star.id)&&!chosenIdentities.has(identityOf(star.id))
      &&(!opening||!ownedIds.has(star.id))
      &&(!run.owned[star.id]||run.owned[star.id].stars<starLimit(run,star.id));
    let pool=STARS.filter(star=>star.tier===tier&&usable(star));
    if(!pool.length)pool=STARS.filter(usable);
    return pool;
  }
  function makeOffer(run){
    if(run.offer.length)return run.offer;
    run.offerMode='normal';
    run.offerOdds=recruitProbabilitySummary(run);
    const chosen=[],opening=isOpeningRecruit(run),group=(run.recruitGroups||0)+1;
    if(run.forceRareRecruit){
      for(const tier of ['SSR','S']){
        const pool=recruitPool(run,tier,chosen,opening).filter(star=>star.tier===tier);
        if(pool.length)chosen.push(randomChoice(run,pool).id);
      }
    }
    const requireS=(run.noSPlusGroups||0)>=11;
    let requireA=(run.noAPlusGroups||0)>=3?1:0;
    if(opening&&group===3&&(run.openingAPlusGroups||0)===0)requireA=Math.max(requireA,1);
    if(opening&&group===6&&(run.openingAPlusGroups||0)<2)requireA=Math.max(requireA,2);
    for(let i=chosen.length;i<4;i++){
      const remaining=4-i,currentA=chosen.filter(id=>tierValue[BY_ID[id].tier]>=tierValue.A).length;
      const currentS=chosen.some(id=>tierValue[BY_ID[id].tier]>=tierValue.S);
      let minimum=requireS&&!currentS&&remaining===1?'S':requireA-currentA>=remaining?'A':'C';
      if(i===3&&minimum==='C'&&!chosen.some(id=>tierValue[BY_ID[id].tier]>=tierValue.B))minimum='B';
      const tier=minimum==='A'||minimum==='B'?minimum:tierRoll(run,minimum),pool=recruitPool(run,tier,chosen,opening);
      chosen.push(randomChoice(run,pool).id);
    }
    const odds=run.offerOdds;
    if(!chosen.some(id=>BY_ID[id].tier==='SSR')&&nextRandom(run)<odds.SSR/100){
      const ssrPool=recruitPool(run,'SSR',chosen,opening).filter(star=>star.tier==='SSR');
      if(ssrPool.length)chosen[Math.floor(nextRandom(run)*chosen.length)]=randomChoice(run,ssrPool).id;
    }
    const hasA=chosen.some(id=>tierValue[BY_ID[id].tier]>=tierValue.A);
    const hasS=chosen.some(id=>tierValue[BY_ID[id].tier]>=tierValue.S);
    run.recruitGroups=group;
    run.noAPlusGroups=hasA?0:(run.noAPlusGroups||0)+1;
    run.noSPlusGroups=hasS?0:(run.noSPlusGroups||0)+1;
    if(opening&&hasA)run.openingAPlusGroups=(run.openingAPlusGroups||0)+1;
    run.offer=chosen;
    return chosen;
  }
  function makeTenOffer(run,count=10){
    const size=clamp(Math.floor(Number(count)||10),1,10),chosen=[],odds=recruitProbabilitySummary(run);
    run.offer=[];run.offerOdds=null;run.offerMode='normal';
    while(chosen.length<size){
      const group=makeOffer(run);
      chosen.push(...group.slice(0,size-chosen.length));
      run.offer=[];run.offerOdds=null;
    }
    run.offer=chosen;
    run.offerOdds=odds;
    run.offerMode='ten-batch';
    run.batchSelected=chosen.map(()=>true);
    return chosen;
  }
  function toggleRecruitBatchSelection(run,index){
    if(!run||run.offerMode!=='ten-batch'||!Number.isInteger(index)||index<0||index>=run.offer.length)return false;
    const current=Array.isArray(run.batchSelected)?run.batchSelected:[];
    run.batchSelected=run.offer.map((_,offerIndex)=>offerIndex===index?current[offerIndex]===false:current[offerIndex]!==false);
    return true;
  }
  function grantRewardedSOffer(run){
    if(run.ended||run.pending||run.rewardedRecruitUsed)return false;
    const chosen=[],ownedIds=new Set(Object.keys(run.owned));
    const pools=[
      STARS.filter(star=>star.tier==='S'&&(!ownedIds.has(star.id)||run.owned[star.id].stars<starLimit(run,star.id))),
      STARS.filter(star=>star.tier==='S')
    ];
    for(const pool of pools){
      while(chosen.length<4){
        const available=pool.filter(star=>!chosen.includes(star.id)&&!chosen.map(identityOf).includes(identityOf(star.id)));
        if(!available.length)break;
        chosen.push(randomChoice(run,available).id);
      }
      if(chosen.length===4)break;
    }
    if(chosen.length<4)return false;
    run.rewardedRecruitUsed=true;
    run.offerMode='rewarded-s';
    run.offer=chosen;
    run.offerOdds={C:0,B:0,A:0,S:100,SSR:0,sGroup:100,ssrGroup:0,aPityIn:0,sPityIn:0};
    return chosen;
  }
  function addRecruitedStar(run,id){
    const star=BY_ID[id];
    if(!(run.collectedPlayers||(run.collectedPlayers=[])).includes(id))run.collectedPlayers.push(id);
    if(run.owned[id]){
      const own=run.owned[id];
      if(own.stars<starLimit(run,id))own.stars++;else run.cash+=4;
      return {ok:true,kind:'duplicate',star};
    }
    const vacant=SLOTS.filter(s=>!run.slots[s.id]);
    if(vacant.length){
      const chosen=vacant.find(s=>s.id===star.best)||vacant[0];
      run.owned[id]={stars:1,train:0,trainedAt:0};run.slots[chosen.id]=id;
      return {ok:true,kind:'starter',slot:chosen.id,star};
    }
    if(run.bench.length<run.benchLimit){run.owned[id]={stars:1,train:0,trainedAt:0};run.bench.push(id);return {ok:true,kind:'bench',star}}
    run.pending=id;
    return {ok:true,kind:'pending',star};
  }
  function recruit(run,id){
    if(run.ended||run.pending||!run.offer.includes(id))return {ok:false,reason:'本轮无法选择该球星'};
    const rewarded=run.offerMode==='rewarded-s',cost=recruitCost(run);
    const credits=Math.max(0,Math.floor(Number(run.recruitCredits)||0));
    if(!rewarded&&credits<=0&&run.free<=0&&run.cash<cost)return {ok:false,reason:'奖金不足，无法追加招募'};
    if(rewarded)run.offerMode='normal';
    else if(credits>0)run.recruitCredits=credits-1;
    else if(run.free>0)run.free--;
    else run.cash-=cost;
    run.offer=[];
    run.offerOdds=null;
    return addRecruitedStar(run,id);
  }
  function advanceRecruitBatch(run){
    let processed=0,last=null;
    while(!run.pending&&run.batchQueue?.length){
      last=addRecruitedStar(run,run.batchQueue.shift());processed++;
    }
    return {ok:true,processed,last,pending:!!run.pending,done:!run.pending&&!(run.batchQueue?.length)};
  }
  function confirmRecruitBatch(run,selected=run.batchSelected){
    if(run.ended||run.pending||run.offerMode!=='ten-batch'||run.offer.length!==10)return {ok:false,reason:'当前没有可确认的十连招募'};
    const choices=Array.isArray(selected)?run.offer.map((_,index)=>selected[index]!==false):run.offer.map(()=>true);
    const keep=[],sell=[];
    run.offer.forEach((id,index)=>(choices[index]?keep:sell).push(id));
    for(const id of sell)run.cash+=saleValue(id,1,run);
    const kept=keep.length,sold=sell.length;
    run.batchQueue=[...keep];
    run.offer=[];run.offerOdds=null;run.offerMode='normal';run.batchSelected=[];
    const result=advanceRecruitBatch(run);
    return {...result,sold,kept};
  }
  function resolvePending(run,mode,target){
    const id=run.pending;if(!id)return false;
    if(mode==='sell'){run.cash+=saleValue(id,1,run)}
    else if(mode==='replace' && Number.isInteger(target) && target>=0 && target<run.bench.length){
      const old=run.bench[target];run.cash+=saleValue(old,run.owned[old]?.stars,run);delete run.owned[old];
      run.owned[id]={stars:1,train:0,trainedAt:0};run.bench[target]=id;
    } else if(mode==='replace-slot'&&SLOTS.some(slot=>slot.id===target)&&run.slots[target]){
      const old=run.slots[target];run.cash+=saleValue(old,run.owned[old]?.stars,run);delete run.owned[old];
      run.owned[id]={stars:1,train:0,trainedAt:0};run.slots[target]=id;
    } else return false;
    run.pending=null;return true;
  }
  function swapBench(run,benchIndex,slot){
    if(run.ended||run.lastBattle||!SLOTS.some(s=>s.id===slot)||benchIndex<0||benchIndex>=run.bench.length)return false;
    const incoming=run.bench[benchIndex],outgoing=run.slots[slot];run.slots[slot]=incoming;
    if(outgoing)run.bench[benchIndex]=outgoing;else run.bench.splice(benchIndex,1);
    return true;
  }
  function swapPositions(run,from,to){
    if(run.ended||run.lastBattle||!from||!to)return false;
    const valid=place=>place.kind==='slot'
      ?SLOTS.some(s=>s.id===place.key)
      :place.kind==='bench'&&Number.isInteger(place.key)&&place.key>=0&&place.key<run.bench.length;
    if(!valid(from)||!valid(to))return false;
    if(from.kind===to.kind&&from.key===to.key)return false;
    const read=place=>place.kind==='slot'?run.slots[place.key]:run.bench[place.key];
    const write=(place,id)=>{if(place.kind==='slot')run.slots[place.key]=id;else run.bench[place.key]=id};
    const first=read(from),second=read(to);
    if(!first&&!second)return false;
    if((from.kind==='bench'||to.kind==='bench')&&(!first||!second)){
      const bench=from.kind==='bench'?from:to;
      const slot=from.kind==='slot'?from:to;
      if(!read(bench))return false;
      return swapBench(run,bench.key,slot.key);
    }
    write(from,second);write(to,first);
    return true;
  }
  function sellBench(run,index){
    if(run.ended||run.lastBattle||!Number.isInteger(index)||index<0||index>=run.bench.length)return 0;
    const id=run.bench[index],value=saleValue(id,run.owned[id]?.stars,run);
    run.bench.splice(index,1);delete run.owned[id];run.cash+=value;
    return value;
  }
  function playerScore(star,own,key,run=null){
    const effect=openingEffect(run),starGrowth=(star.tier==='SSR'?.2:.1)+(effect.starGrowthDelta||0),trainingGrowth=(star.tier==='SSR'?.04:.03)+(effect.trainingGrowthDelta||0)+(run?.metaTrainingBoost||0)/100;
    return Math.round(star.attrs[key]*(1+(own.stars-1)*starGrowth+own.train*trainingGrowth));
  }
  function playerEffectiveStats(run,id,slotId='',strategy=''){
    const star=BY_ID[id],own=run?.owned?.[id];
    if(!star||!own)return null;
    const stats=Object.fromEntries(ATTRS.map(attr=>[attr,Math.round(playerScore(star,own,attr,run))]));
    const actualSlot=slotId||SLOTS.find(slot=>run.slots[slot.id]===id)?.id||'';
    const effect=actualSlot?resolveTalentEffect(run,actualSlot):null;
    return {stats,slot:actualSlot,effect,stars:own.stars,train:own.train};
  }
  function addDimensions(target,values,multiplier=1){
    for(const [key,value] of Object.entries(values||{}))if(COMBAT_KEYS.includes(key))target[key]+=value*multiplier;
  }
  function fused(run,strategy='',foeStrategy=''){
    const stats={},talents=[],talentEffects=[],bonds=activeSynergies(run),opening=openingEffect(run);
    for(const attr of ATTRS){
      let sum=0,weight=0;
      for(const slot of SLOTS){
        const id=run.slots[slot.id];if(!id)continue;
        const w=attr===slot.id?2.5:attr===slot.secondary?1.25:.28;
        sum+=playerScore(BY_ID[id],run.owned[id],attr,run)*w;weight+=w;
      }
      stats[attr]=weight?Math.round(sum/weight):0;
    }
    const slotScores=Object.fromEntries(SLOTS.map(slot=>{
      const id=run.slots[slot.id],star=BY_ID[id];
      if(!star)return [slot.id,0];
      const grown=Object.fromEntries(ATTRS.map(attr=>[attr,playerScore(star,run.owned[id],attr,run)]));
      return [slot.id,weighted(grown,SLOT_WEIGHTS[slot.id])];
    }));
    const abilityFlat=Object.fromEntries(ATTRS.map(key=>[key,0]));
    const abilityPercent=Object.fromEntries(ATTRS.map(key=>[key,0]));
    for(const itemId of [...new Set([...run.gear,...(run.gearReserve||[])])]){
      const item=GEAR.find(gear=>gear.id===itemId),multiplier=gearMultiplier(run,item);
      if(!item||!multiplier)continue;
      for(const key of ATTRS){
        abilityFlat[key]+=(item.stats?.[key]||0)*multiplier;
        abilityPercent[key]+=((item.percentStats?.[key]||0)+(item.percentStats?.all||0))*multiplier;
      }
    }
    for(const key of ATTRS){
      slotScores[key]=Math.max(0,(slotScores[key]+abilityFlat[key])*(1+clamp(abilityPercent[key],-30,40)/100));
      stats[key]=Math.round(Math.max(0,(stats[key]+abilityFlat[key])*(1+clamp(abilityPercent[key],-30,40)/100)));
    }
    const dimensions=dimensionsFromSlots(slotScores),flat=Object.fromEntries(COMBAT_KEYS.map(key=>[key,0]));
    const percents=Object.fromEntries(COMBAT_KEYS.map(key=>[key,0]));
    const openingPercents=Object.fromEntries(COMBAT_KEYS.map(key=>[key,0]));
    for(const slot of SLOTS){
      const id=run.slots[slot.id],star=BY_ID[id],effect=resolveTalentEffect(run,slot.id);
      if(!star||!effect)continue;
      for(const key of COMBAT_KEYS)percents[key]+=effect.allDimensions||0;
      addDimensions(percents,effect.dimensions);
      addDimensions(percents,effect.strategyDimensions?.[strategy]);
      talents.push(star);
      talentEffects.push(effect);
    }
    const bondBoost=run.gear.reduce((sum,id)=>{
      const item=GEAR.find(gear=>gear.id===id);
      return sum+(item?.bondBoost||0)*gearMultiplier(run,item);
    },0);
    for(const bond of bonds){
      addDimensions(percents,bond.effect?.dimensions,1+bondBoost);
      if(opening.bondScale)addDimensions(openingPercents,bond.effect?.dimensions,(1+bondBoost)*(opening.bondScale-1));
    }
    addDimensions(openingPercents,opening.dimensions);
    if(opening.allDimensions)for(const key of COMBAT_KEYS)openingPercents[key]+=opening.allDimensions;
    if(opening.noBondPenalty&&!bonds.length)for(const key of COMBAT_KEYS)openingPercents[key]+=opening.noBondPenalty;
    if(run.talent==='outside')addDimensions(flat,DATA.mapToCombat({three:5,handle:5,inside:-3}));
    if(run.talent==='inside')addDimensions(flat,DATA.mapToCombat({inside:7,def:3,three:-3}));
    if(run.talent==='defense')addDimensions(flat,DATA.mapToCombat({def:7}));
    for(const itemId of [...new Set([...run.gear,...(run.gearReserve||[])])]){
      const item=GEAR.find(g=>g.id===itemId),multiplier=gearMultiplier(run,item);
      if(!item||!multiplier)continue;
      addDimensions(flat,item.combatFlat,multiplier);
      addDimensions(percents,item.combatPercent,multiplier);
    }
    for(const boostId of run.boosts){
      const item=BOOSTS.find(b=>b.id===boostId);
      if(item)addDimensions(percents,item.combatPercent);
    }
    if(STRATEGIES[strategy]){
      const tactic=STRATEGIES[strategy];
      percents[tactic.target]+=12+(tactic.beats===foeStrategy?6:0);
      if(tactic.beats===foeStrategy)openingPercents[tactic.target]+=(opening.counterBonus||0)+(run.metaFilmStudy||0);
      if(!opening.ignoreStrategyPenalty)openingPercents[tactic.penalty]-=4+(opening.strategyPenalty||0);
    }
    for(const key of COMBAT_KEYS)dimensions[key]=Math.max(0,(dimensions[key]+flat[key])*(1+clamp(percents[key],-30,40)/100)*(1+clamp(openingPercents[key],-30,40)/100));
    const rating=Math.round(COMBAT_KEYS.reduce((sum,key)=>sum+dimensions[key],0)/COMBAT_KEYS.length);
    return {stats,slotScores,dimensions,rating,bonds,talents,talentEffects};
  }
  function signatureMoves(run){
    const scores=Object.fromEntries(SLOTS.map(slot=>{
      const id=run?.slots?.[slot.id],star=BY_ID[id],own=run?.owned?.[id];
      if(!star||!own)return [slot.id,0];
      const grown=Object.fromEntries(ATTRS.map(attr=>[attr,playerScore(star,own,attr,run)]));
      return [slot.id,weighted(grown,SLOT_WEIGHTS[slot.id])];
    }));
    return ['offense','defense'].map(kind=>SIGNATURE_MOVES.filter(move=>move.kind===kind&&move.slots.every(slot=>scores[slot]>0))
      .map(move=>({...move,score:Math.round(move.slots.reduce((sum,slot)=>sum+scores[slot],0)/move.slots.length),
        trained:move.slots.filter(slot=>(run.owned[run.slots[slot]]?.train||0)>0).length}))
      .sort((a,b)=>b.score-a.score)[0]||null);
  }
  function opponent(run){
    const index=run.stage<=FOE_ROSTER.length?run.stage-1:LEGEND_FOE_START+(run.stage-51)%LEGEND_FOE_COUNT;
    const [id,strategy]=FOE_ROSTER[index],star=BY_ID[id];
    // 前九关保留入门坡度；第十关小幅抬升，无尽随后按凸曲线加速。
    const baseStage=Math.min(run.stage,50),calibrationStage=run.stage<=50?baseStage:index+1;
    const target=opponentTarget(calibrationStage);
    const base=dimensionsFromSlots(slotScoresFromStats(star.attrs));
    const baseRating=COMBAT_KEYS.reduce((sum,key)=>sum+base[key],0)/COMBAT_KEYS.length;
    const diff=target-baseRating;
    const cycle=run.stage<=50?0:Math.floor((run.stage-51)/LEGEND_FOE_COUNT)+1;
    const stars=Math.min(star.maxStars,cycle+1),starScale=1+(stars-1)*.2;
    const extra=cycle+Math.max(0,cycle-(star.maxStars-1))*35;
    const stats=Object.fromEntries(ATTRS.map(a=>[a,Math.max(20,Math.round((star.attrs[a]+diff)*starScale+extra))]));
    let slotScores=slotScoresFromStats(stats),dimensions=dimensionsFromSlots(slotScores);
    let rating=Math.round(COMBAT_KEYS.reduce((sum,key)=>sum+dimensions[key],0)/COMBAT_KEYS.length);
    if(run.stage>1){
      const previous=opponent({stage:run.stage-1}).rating;
      while(rating<=previous){
        for(const attr of ATTRS)stats[attr]++;
        slotScores=slotScoresFromStats(stats);dimensions=dimensionsFromSlots(slotScores);
        rating=Math.round(COMBAT_KEYS.reduce((sum,key)=>sum+dimensions[key],0)/COMBAT_KEYS.length);
      }
    }
    return {id,name:star.name,strategy,stars,stats,slotScores,dimensions,rating};
  }
  function gearMultiplier(run,item){
    if(!item)return 0;
    if(item.slot!=='球衣')return run.gear.includes(item.id)?1:0;
    if(run.gear.includes(item.id))return JERSEY_COLLECTION_SCALE*(1+JERSEY_EQUIPPED_BONUS);
    return (run.gearReserve||[]).includes(item.id)?JERSEY_COLLECTION_SCALE:0;
  }
  function itemEffects(run){
    const gearItems=[...new Set([...run.gear,...(run.gearReserve||[])])].map(id=>GEAR.find(item=>item.id===id)).filter(Boolean);
    const boostItems=run.boosts.map(id=>BOOSTS.find(item=>item.id===id)).filter(Boolean);
    return [...gearItems.map(item=>[item,gearMultiplier(run,item)]),...boostItems.map(item=>[item,1])].reduce((total,[item,multiplier])=>{
      total.clutchBonus+=(item.clutchBonus||0)*multiplier;total.turnoverReduction+=(item.turnoverReduction||0)*multiplier;
      total.opponentPenalty+=(item.opponentPenalty||0)*multiplier;total.winCash+=(item.winCash||0)*multiplier;
      total.counterCash+=(item.counterCash||0)*multiplier;return total;
    },{clutchBonus:0,turnoverReduction:0,opponentPenalty:0,winCash:0,counterCash:0});
  }
  function drawShopItems(run,items,count,owned){
    const pool=items.filter(item=>!owned.includes(item.id)&&(!item.minStage||run.stage>=item.minStage));
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(nextRandom(run)*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    return pool.slice(0,count).map(item=>item.id);
  }
  // 按两边的各品质件数校准：原宝物池的品质总权重为 420:456:102:5。
  function gearRarityWeights(){return {C:84,B:45.6,A:6,S:1}}
  function drawGearItems(run,count){
    const owned=new Set([...run.gear,...(run.gearReserve||[])]);
    const pool=GEAR.filter(item=>!owned.has(item.id)&&gearAvailable(run,item)&&(!item.minStage||run.stage>=item.minStage)),chosen=[],weights=gearRarityWeights(run);
    while(pool.length&&chosen.length<count){
      // 每件装备独立获得对应品质的权重；抽中后，同次刷新不再抽该部位。
      const total=pool.reduce((sum,item)=>sum+weights[item.rarity],0);
      let roll=nextRandom(run)*total,index=pool.length-1;
      for(let i=0;i<pool.length;i++){roll-=weights[pool[i].rarity];if(roll<0){index=i;break}}
      const item=pool[index];chosen.push(item.id);
      nextRandom(run); // 保持每件商品消耗两次随机数，避免改变同种子后续对局的随机序列。
      for(let i=pool.length-1;i>=0;i--)if(pool[i].slot===item.slot)pool.splice(i,1);
    }
    return chosen;
  }
  function gearAvailable(run,item){return !!item&&(!item.unlockable||(run.unlockedJerseys||[]).includes(item.id))}
  function makeShopOffers(run){
    run.shopOffers={boost:drawShopItems(run,BOOSTS,4,[]),gear:drawGearItems(run,3)};
    run.boostBoughtOffers=[];run.gearSoldOffers=[];
    return run.shopOffers;
  }
  function ensureShop(run){
    if(!run.shopOffers||!Array.isArray(run.shopOffers.boost)||!Array.isArray(run.shopOffers.gear))run.shopOffers={boost:[],gear:[]};
    if(!run.shopOffers.boost.length){run.shopOffers.boost=drawShopItems(run,BOOSTS,4,[]);run.boostBoughtOffers=[]}
    if(!run.shopOffers.gear.length){run.shopOffers.gear=drawGearItems(run,3);run.gearSoldOffers=[]}
    return run.shopOffers;
  }
  function shopRefreshCost(run,type='boost'){return type==='gear'?(run.gearRefreshFree>0?0:3+(openingEffect(run).gearRefreshCostDelta||0)):Math.min(10,4+(run.shopRefreshes||0))}
  function refreshShop(run,type='boost'){
    const cost=shopRefreshCost(run,type);if(run.cash<cost)return false;run.cash-=cost;
    if(type==='gear'){if(run.gearRefreshFree>0)run.gearRefreshFree--;run.gearRefreshes=(run.gearRefreshes||0)+1;run.shopOffers.gear=drawGearItems(run,3);run.gearSoldOffers=[]}
    else{run.shopRefreshes=(run.shopRefreshes||0)+1;run.shopOffers.boost=drawShopItems(run,BOOSTS,4,[]);run.boostBoughtOffers=[]}
    return true;
  }
  function trainingLimit(run,id){
    const star=BY_ID[id];if(!star)return 0;
    return run.endless||run.stage>10?run.stage:3;
  }
  function trainingCost(run,id){const level=run.owned[id]?.train??0,base=TRAINING_COSTS[Math.min(level,TRAINING_COSTS.length-1)];return base===undefined?Infinity:Math.max(1,base+(run.talent==='agent'?2:0)+(openingEffect(run).trainingCostDelta||0))}
  function train(run,id){const own=run.owned[id],star=BY_ID[id];if(!own||!star||own.train>=trainingLimit(run,id)||(!run.endless&&own.trainedAt===run.stage))return false;const cost=trainingCost(run,id);if(run.cash<cost)return false;run.cash-=cost;own.train++;own.trainedAt=run.stage;return true}
  function boostPrice(run,item){return Math.max(1,item.price+(openingEffect(run).boostCostDelta||0))}
  function gearPrice(run,item){return Math.max(1,item.price-(openingEffect(run).gearDiscount||0))}
  function buyBoost(run,id){ensureShop(run);const item=BOOSTS.find(b=>b.id===id);if(!item||!run.shopOffers.boost.includes(id)||(run.boostBoughtOffers||[]).includes(id)||run.cash<boostPrice(run,item))return false;run.cash-=boostPrice(run,item);run.boosts.push(id);(run.boostBoughtOffers||(run.boostBoughtOffers=[])).push(id);return true}
  function buyGear(run,id){
    ensureShop(run);
    const item=GEAR.find(g=>g.id===id),reserve=run.gearReserve||(run.gearReserve=[]);
    if(!item||!gearAvailable(run,item)||!run.shopOffers.gear.includes(id)||(run.gearSoldOffers||[]).includes(id)||run.cash<gearPrice(run,item)||run.gear.includes(id)||reserve.includes(id))return false;
    if(item.slot!=='球衣'&&[...run.gear,...reserve].some(gearId=>GEAR.find(g=>g.id===gearId)?.slot===item.slot))return false;
    run.cash-=gearPrice(run,item);
    const slotUsed=run.gear.some(gearId=>GEAR.find(g=>g.id===gearId)?.slot===item.slot);
    if(slotUsed||run.gear.length>=(run.gearLimit||GEAR_LIMIT))reserve.push(id);else run.gear.push(id);
    if(item.slot==='球衣'&&!(run.collectedJerseys||(run.collectedJerseys=[])).includes(id))run.collectedJerseys.push(id);
    (run.gearSoldOffers||(run.gearSoldOffers=[])).push(id);
    return true;
  }
  function replaceGear(run,id){
    ensureShop(run);
    const item=GEAR.find(g=>g.id===id),reserve=run.gearReserve||(run.gearReserve=[]);
    if(!item||item.slot==='球衣'||!gearAvailable(run,item)||!run.shopOffers.gear.includes(id)||(run.gearSoldOffers||[]).includes(id)||run.cash<gearPrice(run,item)||run.gear.includes(id)||reserve.includes(id))return false;
    const activeIndex=run.gear.findIndex(gearId=>GEAR.find(g=>g.id===gearId)?.slot===item.slot);
    const reserveIndex=reserve.findIndex(gearId=>GEAR.find(g=>g.id===gearId)?.slot===item.slot);
    if(activeIndex<0&&reserveIndex<0)return false;
    const oldId=activeIndex>=0?run.gear[activeIndex]:reserve[reserveIndex],oldItem=GEAR.find(g=>g.id===oldId);
    run.cash-=gearPrice(run,item);
    if(oldItem)run.cash+=oldItem.sellPrice;
    if(activeIndex>=0)run.gear[activeIndex]=id;else reserve[reserveIndex]=id;
    (run.gearSoldOffers||(run.gearSoldOffers=[])).push(id);
    return oldId;
  }
  function equipGear(run,id){
    const reserve=run.gearReserve||[],index=reserve.indexOf(id),item=GEAR.find(g=>g.id===id);
    if(index<0||!item||item.slot!=='球衣')return false;
    const activeIndex=run.gear.findIndex(gearId=>GEAR.find(g=>g.id===gearId)?.slot===item.slot);
    if(activeIndex<0&&run.gear.length>=(run.gearLimit||GEAR_LIMIT))return false;
    reserve.splice(index,1);
    if(activeIndex<0)run.gear.push(id);else {const old=run.gear[activeIndex];run.gear[activeIndex]=id;reserve.push(old)}
    return true;
  }
  function sellGear(run,id){
    const item=GEAR.find(g=>g.id===id);if(!item)return 0;
    const activeIndex=run.gear.indexOf(id),reserve=run.gearReserve||[],reserveIndex=reserve.indexOf(id);
    if(activeIndex<0&&reserveIndex<0)return 0;
    if(activeIndex>=0)run.gear.splice(activeIndex,1);else reserve.splice(reserveIndex,1);
    run.cash+=item.sellPrice;return item.sellPrice;
  }
  function expandBench(run){if(run.cash<10||run.benchLimit>=10)return false;run.cash-=10;run.benchLimit++;return true}
  function refreshOffer(run){if(run.refreshFree>0)run.refreshFree--;else if(run.cash>=5)run.cash-=5;else return false;run.offer=[];run.offerOdds=null;makeOffer(run);return true}
  function shotType(run,strategy,attacker,move=null){
    const n=nextRandom(run),bias=attacker==='us'?(move?.threeBias||0):0;
    if(strategy==='outside')return n<.57+bias?'three':n<.79+bias?'mid':'inside';
    if(strategy==='drive')return n<.59-bias?'inside':n<.76-bias?'mid':'three';
    if(attacker==='foe')return n<.4?'inside':n<.7?'mid':'three';
    return n<.35-bias?'inside':n<.65-bias?'mid':'three';
  }
  function goatPhases(run,strategy=''){
    if(!run||starterCount(run)<6)return {planning:0,clash:0,endurance:0,total:0};
    const dimensions=fused(run,strategy).dimensions;
    const planning=dimensions.shooting+dimensions.creation,clash=dimensions.finishing+dimensions.perimeterStop,endurance=dimensions.rimStop;
    return {planning,clash,endurance,total:Math.round(planning+clash+endurance)};
  }
  function goatScore(run,strategy=''){return goatPhases(run,strategy).total}
  function clearedMainStage(run){
    if(!run)return 0;
    if(run.endless||run.stage>10)return 10;
    return clamp(run.stage-(run.lastBattle?.won?0:1),0,10);
  }
  function legendPoints(run){
    const main={5:50,6:60,7:70,8:80,9:90,10:200}[clearedMainStage(run)]||0;
    return main+50*(run?.endlessWins||0);
  }
  function buyMetaUpgrade(profile,id){
    const item=META_UPGRADES.find(entry=>entry.id===id),level=profile?.upgrades?.[id]||0,price=item?.prices[level];
    if(!item||price===undefined||profile.legend<price)return false;
    profile.legend-=price;profile.upgrades[id]=level+1;return true;
  }
  function buyMetaUnlock(profile,id){
    const item=META_UNLOCKS.find(entry=>entry.id===id);if(!item||profile.legend<item.price)return null;
    const source=id==='talents'?TALENTS:id==='gear'?GEAR:STARS,owned=profile.metaUnlocks?.[id]||(profile.metaUnlocks[id]=[]),pool=source.filter(entry=>!owned.includes(entry.id));
    if(!pool.length)return null;
    const unlocked=pool[Math.floor(Math.random()*pool.length)];profile.legend-=item.price;owned.push(unlocked.id);return unlocked;
  }
  function unlockJersey(profile,random=Math.random){
    const owned=profile.jerseyUnlocks||(profile.jerseyUnlocks=[]);
    const pool=GEAR.filter(item=>item.slot==='球衣'&&item.unlockable&&!owned.includes(item.id));
    if(!pool.length||profile.legend<JERSEY_UNLOCK_PRICE)return null;
    const item=pool[Math.min(pool.length-1,Math.floor(clamp(random(),0,.999999)*pool.length))];
    profile.legend-=JERSEY_UNLOCK_PRICE;owned.push(item.id);return item;
  }
  function finishRun(game){
    const run=game.run;if(!run||run.awarded)return 0;
    const profile=game.profile,points=legendPoints(run),cleared=clearedMainStage(run),goat=Math.round(run.maxGoat||0);
    profile.runs++;profile.wins+=run.wins;profile.clears=(profile.clears||0)+(cleared>=10?1:0);
    profile.bestStage=Math.max(profile.bestStage||0,cleared);profile.highestStage=Math.max(profile.highestStage||0,run.stage);
    profile.bestEndless=Math.max(profile.bestEndless||0,run.endless?run.stage:0);profile.bestGoat=Math.max(profile.bestGoat||0,goat);profile.legend+=points;
    profile.discovered=[...new Set([...(profile.discovered||[]),...(run.collectedPlayers||Object.keys(run.owned))])];
    profile.jerseys=[...new Set([...(profile.jerseys||[]),...(run.collectedJerseys||[])])];
    run.awarded=true;run.ended=true;return points;
  }
  function incomeBreakdown(run){
    const referenceBase=run.stage===10?0:run.stage===5?6:run.stage<=9?4:7+Math.floor((run.stage-11)/2)*3;
    const handleId=run.slots.handle,defId=run.slots.def;
    const handleScore=handleId?playerScore(BY_ID[handleId],run.owned[handleId],'handle',run):0;
    const defScore=defId?playerScore(BY_ID[defId],run.owned[defId],'def',run):0;
    const lineupIncome=clamp(Math.floor(((handleScore*.65+defScore*.35)-50)/18),0,4);
    const effect=openingEffect(run),interestCap=3+(run.metaInterestCap||0)+(run.talent==='economy'?1:0)+(effect.interestCap||0)+(defScore>=90?1:0)+Math.min(10,Math.max(0,run.stage-10));
    return {
      victoryBase:Math.max(0,referenceBase-(run.talent==='defense'?1:0)+(run.talent==='economy'?2:0)+(effect.winCash||0)),
      lossBase:Math.max(0,7+(run.talent==='defense'?2:0)+(effect.lossCash||0)),
      lineupIncome,
      interest:Math.min(interestCap,Math.floor(run.cash/15)),
      interestCap
    };
  }
  function combatEdge(attack,defense){
    return clamp((attack-defense)/Math.max(80,(attack+defense)/2),-.5,.5);
  }
  function strategyDimensions(base,strategy,opponentStrategy){
    const result={...base},tactic=STRATEGIES[strategy];
    if(!tactic)return result;
    result[tactic.target]*=1+(12+(tactic.beats===opponentStrategy?6:0))/100;
    result[tactic.penalty]*=.96;
    return result;
  }
  function shotMatchup(attackDimensions,attackSlots,defenseDimensions,type){
    const profiles={
      three:{base:.29,points:2,attack:.8*attackDimensions.shooting+.2*attackSlots.three,
        guard:.8*defenseDimensions.perimeterStop+.2*defenseDimensions.rimStop},
      mid:{base:.46,points:1,attack:.8*attackDimensions.shooting+.2*attackSlots.mid,
        guard:.6*defenseDimensions.perimeterStop+.4*defenseDimensions.rimStop},
      inside:{base:.55,points:1,attack:.8*attackDimensions.finishing+.2*attackSlots.inside,
        guard:.2*defenseDimensions.perimeterStop+.8*defenseDimensions.rimStop}
    };
    return profiles[type];
  }
  function battle(game,strategy){
    const run=game.run;if(!run||run.ended||run.lastBattle||starterCount(run)<6||!STRATEGIES[strategy])return null;
    const opening=openingEffect(run);
    const foe=opponent(run),own=fused(run,strategy,foe.strategy),equipment=itemEffects(run);
    const foeDimensions=strategyDimensions(foe.dimensions,foe.strategy,strategy);
    let us=0,them=0,turn='us',round=0,ownPossessions=0,foePossessions=0;
    const beats=STRATEGIES[strategy].beats===foe.strategy?1:STRATEGIES[foe.strategy].beats===strategy?-1:0;
    const log=[],signatures=signatureMoves(run).filter(Boolean).map(move=>({...move,uses:0,lastUse:-Infinity}));
    while(round<90){
      round++;
      const attack=turn==='us'?own:foe,attackDimensions=turn==='us'?own.dimensions:foeDimensions;
      const defenseDimensions=turn==='us'?foeDimensions:own.dimensions;
      const style=turn==='us'?strategy:foe.strategy;
      const type=shotType(run,style,turn,turn==='us'?signatures.find(item=>item.kind==='offense'):null),matchup=shotMatchup(attackDimensions,attack.slotScores,defenseDimensions,type);
      const possession=turn==='us'?++ownPossessions:++foePossessions;
      const move=signatures.find(item=>item.kind===(turn==='us'?'offense':'defense'));
      const activeMove=move&&move.uses<2&&possession-move.lastUse>=3&&(!move.shot||move.shot===type)?move:null;
      if(activeMove){activeMove.uses++;activeMove.lastUse=possession}
      const creationEdge=combatEdge(attackDimensions.creation,defenseDimensions.perimeterStop);
      const turnover=clamp(.09-.12*creationEdge-(turn==='us'?equipment.turnoverReduction:0)+(activeMove?.turnoverPenalty||0)+(activeMove?.turnover||0)+(activeMove?.turnover?activeMove.trained*.02:0),.02,.18);
      let made=false;
      const lostBall=nextRandom(run)<=turnover;
      if(!lostBall){
        let chance=matchup.base+.22*combatEdge(matchup.attack,matchup.guard)+.08*creationEdge;
        if(turn==='us'){chance+=Math.max(us,them)>=8?equipment.clutchBonus:0}else chance-=equipment.opponentPenalty;
        if(activeMove?.accuracy)chance+=(turn==='us'?1:-1)*(activeMove.accuracy+activeMove.trained*.02);
        made=nextRandom(run)<clamp(chance,.16,.79);
      }
      const actionNote=activeMove?`招牌动作「${activeMove.name}」· `:'';
      if(made){
        const pts=matchup.points;if(turn==='us')us+=pts;else them+=pts;
        log.push(`${round}回合 · ${actionNote}${turn==='us'?'融合球员':foe.name}命中${{three:'三分',mid:'中投',inside:'篮下'}[type]} +${pts}`);
      }else if(activeMove||round%3===0)log.push(`${round}回合 · ${actionNote}${turn==='us'?'我方':'对手'}${lostBall?'持球失误':'投篮受干扰'}`);
      turn=turn==='us'?'foe':'us';
      if((us>=11||them>=11)&&Math.abs(us-them)>=2)break;
      if(us>=15||them>=15)break;
    }
    if(us===them){
      const foeRating=COMBAT_KEYS.reduce((sum,key)=>sum+foeDimensions[key],0)/COMBAT_KEYS.length;
      if(own.rating>=foeRating)us++;else them++;
    }
    const won=us>them;
    const counterCash=beats===1?equipment.counterCash:0;
    const postBattleCash=own.talentEffects.reduce((sum,effect)=>sum+(effect.postBattleCash||0),0)+counterCash;
    let reward=0,detail=[];
    if(won){
      const income=incomeBreakdown(run),base=income.victoryBase,lineupIncome=income.lineupIncome,interest=income.interest;
      const bond=own.bonds.length?1:0,bondCash=Math.min(5,own.bonds.reduce((sum,item)=>sum+(item.effect?.winCash||0),0));
      const talentCash=own.talentEffects.reduce((sum,effect)=>sum+(effect.winCash||0),0);
      const openingCash=(opening.battleCash||0)+(own.bonds.length?(opening.bondWinCash||0):0);
      reward=base+lineupIncome+interest+bond+bondCash+talentCash+postBattleCash+equipment.winCash+openingCash;run.cash+=reward;run.wins++;
      if(opening.winHeal)run.morale=Math.min(3,run.morale+opening.winHeal);
      detail=[`胜利 ${base}`,`阵容收入 ${lineupIncome}`,`利息 ${interest}`,`羁绊 ${bond+bondCash}`];
      if(openingCash)detail.push(`开局天赋 ${openingCash}`);
      if(talentCash)detail.push(`球星技能 ${talentCash}`);
      if(postBattleCash)detail.push(`${counterCash?'战术克制与':'战后'}技能 ${postBattleCash}`);
    }else{
      run.morale--;run.losses++;reward=incomeBreakdown(run).lossBase+postBattleCash+(opening.battleCash||0);run.cash+=reward;detail=[`失败补偿 ${reward-postBattleCash-(opening.battleCash||0)}`];
      if(opening.battleCash)detail.push(`开局天赋 ${opening.battleCash}`);
      if(postBattleCash)detail.push(`${counterCash?'战术克制与':'战后'}技能 ${postBattleCash}`);
    }
    run.boosts=[];
    const goatPhases={planning:own.dimensions.shooting+own.dimensions.creation,clash:own.dimensions.finishing+own.dimensions.perimeterStop,endurance:own.dimensions.rimStop};
    const goat=Math.round(goatPhases.planning+goatPhases.clash+goatPhases.endurance);
    const report={stage:run.stage,won,us,them,reward,detail,log:log.slice(-7),signatures:signatures.map(({id,name,kind,uses})=>({id,name,kind,uses})),strategy,foe:foe.id,foeName:foe.name,foeStars:foe.stars,foeStrategy:foe.strategy,beats,rating:own.rating,foeRating:foe.rating,goat,goatPhases};
    run.maxGoat=Math.max(run.maxGoat||0,goat);if(won&&run.stage>10)run.endlessWins=(run.endlessWins||0)+1;
    run.lastBattle=report;
    if(!won&&run.morale<=0)report.legendEarned=finishRun(game);
    return report;
  }
  function continueRun(game,choice){
    const run=game.run;if(!run||!run.lastBattle)return false;
    if(run.ended)return false;
    if(!run.lastBattle.won){run.lastBattle=null;return true}
    if(run.stage===10&&choice==='finish'){run.lastBattle.legendEarned=finishRun(game);return true}
    if(run.stage===10)run.endless=true;
    const bonds=activeSynergies(run),opening=openingEffect(run);
    const bondFree=Math.min(2,bonds.reduce((sum,item)=>sum+(item.effect?.freeRecruit||0),0));
    const bondCash=Math.min(5,bonds.reduce((sum,item)=>sum+(item.effect?.stageCash||0),0));
    run.stage++;run.free=1+bondFree+(opening.freePerStage||0);
    run.cash=Math.max(0,run.cash+bondCash+(opening.stageCash||0));
    run.gearRefreshFree=opening.freeGearRefresh||0;
    run.refreshFree=1;run.rewardedRecruitUsed=false;run.offer=[];run.offerOdds=null;run.shopRefreshes=0;run.gearRefreshes=0;makeShopOffers(run);run.lastBattle=null;
    return true;
  }
  const api={ATTRS,LABELS,COMBAT_LABELS,SLOTS,STRATEGIES,SIGNATURE_MOVES,signatureMoves,TALENTS,KNOWN_TALENTS,availableTalents,talentUnlocked,openingEffect,STARS,BY_ID,FOES,SYNERGIES,BOOSTS,GEAR,GEAR_LIMIT,JERSEY_COLLECTION_SCALE,JERSEY_EQUIPPED_BONUS,JERSEY_UNLOCK_PRICE,META_UPGRADES,META_UNLOCKS,createGame,createRun,tierOdds,recruitProbabilitySummary,makeOffer,makeTenOffer,toggleRecruitBatchSelection,grantRewardedSOffer,recruit,confirmRecruitBatch,advanceRecruitBatch,recruitCost,recruitPackCost,buyRecruitPack,resolvePending,swapBench,swapPositions,saleValue,sellBench,starterCount,ownedCount,starLimit,identityOf,starSynergies,activeSynergies,playerScore,playerEffectiveStats,incomeBreakdown,fused,opponent,trainingLimit,trainingCost,train,boostPrice,gearPrice,gearRarityWeights,gearAvailable,makeShopOffers,ensureShop,shopRefreshCost,refreshShop,buyBoost,buyGear,replaceGear,equipGear,gearMultiplier,sellGear,expandBench,refreshOffer,battle,continueRun,finishRun,goatPhases,goatScore,clearedMainStage,legendPoints,buyMetaUpgrade,buyMetaUnlock,unlockJersey,clamp};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SupFusionGameCore=api;
})(typeof window!=='undefined'?window:globalThis);
