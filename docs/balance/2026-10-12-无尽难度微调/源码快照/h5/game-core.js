/* 《我的球星融合系统》第五版规则与状态。数值为游戏设计值，并非真实 NBA 统计。 */
(function (root) {
  'use strict';

  const DATA=typeof window==='undefined'&&typeof require==='function'?require('./game-data.js'):root.SupFusionGameData;
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
    if(item.winCash)parts.push(`胜利额外 +${item.winCash} 奖金`);
    if(item.lossCash)parts.push(`失败额外 +${item.lossCash} 奖金`);
    if(item.battleCash)parts.push(`每场对局额外 +${item.battleCash} 奖金`);
    if(item.shopDiscount)parts.push(`购买装备便宜 ${item.shopDiscount} 奖金（最低1）`);
    if(item.preventDefeat)parts.push('生命归零时恢复至1点，并消耗此装备');
    if(item.healEveryWins)parts.push(`佩戴期间每累计${item.healEveryWins}胜恢复1点士气，可溢出，总士气最高13`);
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
  // Keep the previous talent configuration for runs using rules 1–7.
  const PREVIOUS_TALENTS = [
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
    {id:'steady_interest',name:'长期合同',category:'经营',gain:'利息上限 +1；每过一关奖金 +1',cost:'无',unlock:{wins:5},effects:{interestCap:1,stageCash:1}},
    {id:'championship_budget',name:'冠军预算',category:'经营',gain:'五项单挑能力 +10%；装备购买享 8 折',cost:'开局奖金 -8',unlock:{bestStage:7,wins:15},effects:{allDimensions:10,gearPriceMultiplier:.8,startCash:-8}},
    {id:'dynasty',name:'王朝计划',category:'决战',gain:'五项单挑能力 +12%；开局获得一件随机 S 级装备',cost:'每场结算奖金 -2',unlock:{clears:1,wins:30},effects:{allDimensions:12,startGearRarity:'S',battleCash:-2}},
    {id:'film_room',name:'录像分析室',category:'战术',gain:'战术克制额外加成从 6% 提高到 16%；免除本方策略弱势惩罚',cost:'装备商店刷新费用 +1',unlock:{bestStage:6,wins:20},effects:{counterBonus:10,ignoreStrategyPenalty:true,gearRefreshCostDelta:1}},
    {id:'deep_bench',name:'豪华轮换',category:'阵容',gain:'备战席初始上限 +3；扩容上限 +3',cost:'付费招募 +1 奖金',unlock:{discovered:35},effects:{benchDelta:3,paidRecruitDelta:1}},
    {id:'streak_bonus',name:'连胜分红',category:'进取',gain:'每场胜利额外获得 10 奖金',cost:'失败补偿 -2 奖金',unlock:{bestEndless:13,wins:40},effects:{winCash:10,lossCash:-2}},
    {id:'captain',name:'领袖回归',category:'续战',gain:'每累计两胜恢复 1 点士气；本局累计最多恢复 10 点，可超过初始士气',cost:'持球创造 -3%',unlock:{clears:1,wins:25},effects:{winHeal:1,healEveryWins:2,healLimit:10,dimensions:{creation:-3}}},
    {id:'phase_pressure',name:'攻防压制',category:'阶段专精',gain:'对抗、续航专精：禁区终结、外线限制、护框强度 +8%',cost:'布局弱势：投射威胁、持球创造 -4%',effects:{dimensions:{finishing:8,perimeterStop:8,rimStop:8,shooting:-4,creation:-4}}},
    {id:'phase_patient',name:'稳守反击',category:'阶段专精',gain:'布局、续航专精：投射威胁、持球创造、护框强度 +8%',cost:'对抗弱势：禁区终结、外线限制 -4%',effects:{dimensions:{shooting:8,creation:8,rimStop:8,finishing:-4,perimeterStop:-4}}},
    {id:'phase_tempo',name:'速战速决',category:'阶段专精',gain:'布局、对抗专精：投射威胁、持球创造、禁区终结、外线限制 +6%',cost:'续航弱势：护框强度 -8%',effects:{dimensions:{shooting:6,creation:6,finishing:6,perimeterStop:6,rimStop:-8}}}
  ];
  const TALENT_UPDATES = {
  "reserve_fund": {
    "gain": "开局奖金 +15；每过一关奖金 +3；利息上限 +2",
    "effects": {
      "startCash": 15,
      "stageCash": 3,
      "interestCap": 2,
      "dimensions": {
        "shooting": -3,
        "finishing": -3
      }
    }
  },
  "scouting_network": {
    "cost": "付费招募 +1 奖金",
    "effects": {
      "draftSWeight": 1.3,
      "draftSSRWeight": 1.5,
      "freePerStage": 1,
      "paidRecruitDelta": 1
    }
  },
  "front_office": {
    "gain": "每场结算奖金 +5；装备购买后返还10%奖金",
    "effects": {
      "battleCash": 5,
      "gearCashback": 0.1,
      "boostCostDelta": 2
    }
  },
  "win_bonus": {
    "name": "巨星传承",
    "gain": "升至满星时再补授随机5星徽章；补授槽禁止重随和广告替换",
    "cost": "失败补偿 -1 奖金",
    "unlock": {
      "wins": 15,
      "discovered": 20
    },
    "effects": {
      "fullStarBonusSkill": true,
      "lossCash": -1
    }
  },
  "development": {
    "gain": "每级训练额外 +1.5 个百分点",
    "cost": "训练费用×1.5",
    "effects": {
      "trainingGrowthDelta": 0.015,
      "trainingCostMultiplier": 1.5
    }
  },
  "star_workshop": {
    "cost": "备战席初始上限 -2",
    "effects": {
      "starGrowthDelta": 0.02,
      "trainingGrowthDelta": 0.01,
      "benchDelta": -2
    }
  },
  "lockdown": {
    "gain": "外线限制、护框强度各 +10%；每关免费刷新装备商店 1 次",
    "effects": {
      "dimensions": {
        "perimeterStop": 10,
        "rimStop": 10,
        "shooting": -3
      },
      "freeGearRefresh": 1
    }
  },
  "counter_coach": {
    "gain": "战术克制额外加成从 6% 提高到 18%；每关免费招募 +1",
    "cost": "无",
    "effects": {
      "counterBonus": 12,
      "freePerStage": 1
    }
  },
  "steady_interest": {
    "gain": "利息上限 +2；每过一关奖金 +3；护框强度 +30%",
    "cost": "禁区终结 -5%",
    "effects": {
      "interestCap": 2,
      "stageCash": 3,
      "dimensions": {
        "rimStop": 30,
        "finishing": -5
      }
    }
  },
  "film_room": {
    "gain": "战术克制额外加成从 6% 提高到 18%；免除本方策略弱势惩罚",
    "effects": {
      "counterBonus": 12,
      "ignoreStrategyPenalty": true,
      "gearRefreshCostDelta": 1
    }
  },
  "deep_bench": {
    "gain": "备战席初始上限 +3；激活羁绊倍率×1.3",
    "effects": {
      "benchDelta": 3,
      "benchExpansionDelta": 0,
      "bondEffectScale": 1.3,
      "paidRecruitDelta": 1
    }
  },
  "streak_bonus": {
    "name": "场外协助",
    "category": "经营",
    "unlock": {"bestEndless": 13, "discoveredEvents": 10},
    "gain": "事件挑战成功率100%；永久事件增益×1.5；战后收入-2",
    "effects": {
      "eventAlwaysSuccess": true,
      "eventBuffMultiplier": 1.5,
      "battleCash": -2,
      "lossCash": -2
    }
  },
  "captain": {
    "gain": "每累计两胜恢复 1 点士气；可超过初始士气，总士气最高13",
    "effects": {
      "winHeal": 1,
      "healEveryWins": 2,
      "dimensions": {
        "creation": -3
      }
    }
  }
};
  const TALENTS = PREVIOUS_TALENTS.map(talent=>({...talent,...TALENT_UPDATES[talent.id]}));
  const LEGACY_TALENTS = [
    {id:'outside',name:'外线速成'},{id:'inside',name:'禁区霸主'},{id:'defense',name:'铁血防线'},
    {id:'agent',name:'球星经纪人'},{id:'economy',name:'精算大师'}
  ];
  const KNOWN_TALENTS=[...TALENTS,...LEGACY_TALENTS];
  const TALENT_BY_ID=Object.fromEntries(TALENTS.map(talent=>[talent.id,talent]));
  const PREVIOUS_TALENT_BY_ID=Object.fromEntries(PREVIOUS_TALENTS.map(talent=>[talent.id,talent]));
  function talentForRun(run){return (run?.balanceRulesVersion>=8?TALENT_BY_ID:PREVIOUS_TALENT_BY_ID)[run?.talent]}
  function openingEffect(run){return talentForRun(run)?.effects||{}}
  function talentUnlocked(talent,profile){
    if(profile?.metaUnlocks?.talents?.includes(talent.id))return true;
    if(!talent.unlock)return true;
    return Object.entries(talent.unlock).every(([key,value])=>key==='discovered'?(profile?.discovered?.length||0)>=value:key==='discoveredEvents'?new Set((profile?.discoveredEvents||[]).filter(id=>Object.hasOwn(api.EVENT_BY_ID,id))).size>=value:(profile?.[key]||0)>=value);
  }
  function availableTalents(profile){return TALENTS.filter(talent=>talentUnlocked(talent,profile)||profile?.metaUnlocks?.talents?.includes(talent.id))}
  function migrateTalentUnlocks(profile){
    if(profile.talentRulesVersion===3)return profile;
    const previouslyMigrated=profile.talentRulesVersion===2;
    const old={steady_interest:{runs:1},championship_budget:{bestStage:5},dynasty:{bestStage:10},film_room:{wins:8},deep_bench:{discovered:20},streak_bonus:{bestEndless:13},captain:{runs:3}};
    profile.metaUnlocks ||= {talents:[],gear:[],players:[]};
    profile.metaUnlocks.talents=[...new Set([...(profile.metaUnlocks.talents||[]),...(!previouslyMigrated?Object.entries(old).filter(([,unlock])=>talentUnlocked({unlock},profile)).map(([id])=>id):[]),...(profile.runs>0?['win_bonus']:[])])];
    profile.talentRulesVersion=3;return profile;
  }
  function benchExpansionLimit(run){const effect=openingEffect(run);return 10+(effect.benchExpansionDelta??Math.max(0,effect.benchDelta||0))}
  const STAR_ROWS = DATA.STAR_ROWS;
  function makeStars(catalog){return catalog.STAR_ROWS.map(r => ({
    id:r[0],name:r[1],tier:r[2],role:r[3],team:r[4],best:r[5],
    attrs:Object.fromEntries(ATTRS.map((a,i)=>[a,r[6][i]])),talent:r[7],talentEffect:catalog.TALENT_DETAILS[r[0]],variantOf:r[8]||null,
    maxStars:['S','SSR'].includes(r[2])?10:20
  }));}
  function makeCatalog(data){const stars=makeStars(data);return {STARS:stars,BY_ID:Object.fromEntries(stars.map(s=>[s.id,s])),SYNERGIES:data.SYNERGIES};}
  const LATEST_CATALOG=makeCatalog(DATA),PREVIOUS_CATALOG=makeCatalog(DATA.PREVIOUS_CATALOG||DATA);
  let STARS=LATEST_CATALOG.STARS,BY_ID=LATEST_CATALOG.BY_ID,SYNERGIES=LATEST_CATALOG.SYNERGIES;
  function catalogForRun(run){return run&&(run.balanceRulesVersion||1)<12?PREVIOUS_CATALOG:LATEST_CATALOG;}
  function withCatalog(run,fn){const previous={STARS,BY_ID,SYNERGIES},catalog=run?catalogForRun(run):previous;({STARS,BY_ID,SYNERGIES}=catalog);try{return fn()}finally{({STARS,BY_ID,SYNERGIES}=previous);}}

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
  const LEGEND_FOE_COUNT=FOE_ROSTER.filter(([id])=>BY_ID[id].tier==='SSR').length;
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
  // 固定关卡目标，不读取玩家阵容；50关开始给成熟阵容压力，保留养成优势。
  function endlessOpponentTarget(stage){
    if(stage<=20)return null;
    if(stage<=50)return 126*Math.exp(Math.log(500/126)*(stage-20)/30);
    const depth=stage-50;
    return 500*(1+depth/125)*Math.exp(.004*depth);
  }
  // The catalog is selected for each synchronous core operation.
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
  const LEGENDARY_GEAR_UNLOCK_PRICE = 300;
  const META_UPGRADES=[
    {id:'startGold',name:'启动资金',prices:[80,150,250,400,600],effect:'每级开局奖金 +5'},
    {id:'scouting',name:'球探网络',prices:[100,180,300,450,650],effect:'每级提高 S 与 SSR 招募权重'},
    {id:'interestCap',name:'薪资运营',prices:[250,500,800,1200,1600],effect:'每级利息上限 +1'},
    {id:'trainingBoost',name:'训练团队',prices:[150,300,500],effect:'每级训练成长 +1%'},
    {id:'policyOffers',name:'教练组会议',prices:[500],effect:'开局天赋候选 3 → 4'},
    {id:'benchSeat',name:'轮换深度',prices:[180,350,600,900,1300],effect:'每级初始备战席 +1'},
    {id:'gearStorage',name:'装备收纳',prices:[180,350,600,900,1300],effect:'每级装备收藏上限 +1，最高10个'},
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
    displayName: item.name,
    combatFlat: item.dimensions || {},
    combatPercent: item.dimensionPercent
      ? Object.fromEntries(Object.entries(item.dimensionPercent).flatMap(([key,value]) => key === 'all' ? COMBAT_KEYS.map(dim => [dim,value]) : [[key,value]]))
      : {},
    description: item.slot==='球衣'?'收藏按标注属性的 '+JERSEY_COLLECTION_SCALE*100+'% 生效；装备后提高 50%：'+describeGearEffect(item):describeGearEffect(item)
  }));
  const tierValue = { C:0, B:1, A:2, S:3, SSR:4 };
  const SALE_BASE = { C:2, B:3, A:5, S:8, SSR:16 };
  const TRAINING_COSTS = [1,2,3,16,22,29,37,46,56,67];
  const LEGACY_TRAINING_COSTS = [4,7,11,16,22,29,37,46,56,67];
  const RANDOM_SKILLS=DATA.RANDOM_SKILLS,SKILL_BY_ID=Object.fromEntries(RANDOM_SKILLS.map(s=>[s.id,s]));
  // Preserve the grade and draw order of rules 7–8 without changing historical data files.
  const LEGACY_RANDOM_SKILLS=RANDOM_SKILLS.filter(s=>s.id!=='sk_win_5');
  LEGACY_RANDOM_SKILLS.splice(LEGACY_RANDOM_SKILLS.findIndex(s=>s.id==='sk_inc_5')+1,0,{...SKILL_BY_ID.sk_win_5,star:5});
  function randomSkillsForRun(run){return run?.balanceRulesVersion<9?LEGACY_RANDOM_SKILLS:RANDOM_SKILLS}
  function randomSkillForRun(run,id){return run?.balanceRulesVersion<9&&id==='sk_win_5'?LEGACY_RANDOM_SKILLS.find(s=>s.id===id):SKILL_BY_ID[id]}
  const SKILL_REFRESH_COSTS=[10,30,50];
  function hasRandomSkills(run){return run?.balanceRulesVersion>=7}
  function initRandomSkills(run){Object.assign(run,{roleSkillMap:{},draftSkillPreview:{},skillRefreshCount:{},skillAdPickUsed:{},skillAdPick:null,skillHealCounters:{},skillHealGranted:{},skillFreeRefreshStage:0,skillStageCashPaid:0});if(run.balanceRulesVersion>=8)run.bonusSkillSlots={}}
  function drawRandomSkill(run,minStar=1,exclude=[]){
    const skills=randomSkillsForRun(run),star=minStar+Math.floor(nextRandom(run)*(6-minStar)),pool=skills.filter(s=>s.star===star&&!exclude.includes(s.id));
    const candidates=pool.length?pool:skills.filter(s=>!exclude.includes(s.id));
    return candidates.length?candidates[Math.floor(nextRandom(run)*candidates.length)]:null;
  }
  function previewRandomSkills(run,ids){
    if(!hasRandomSkills(run))return;
    for(const id of new Set(ids))if(!run.roleSkillMap[id]?.length&&!run.draftSkillPreview[id])run.draftSkillPreview[id]=drawRandomSkill(run).id;
  }
  function acquireRandomSkill(run,id){
    if(!hasRandomSkills(run)||run.roleSkillMap[id]?.length)return;
    run.roleSkillMap[id]=[run.draftSkillPreview[id]||drawRandomSkill(run).id];delete run.draftSkillPreview[id];
  }
  function unlockFullStarSkill(run,id){
    if(!hasRandomSkills(run)||run.owned[id]?.stars<starLimit(run,id))return;
    if(run.roleSkillMap[id].length<2){const extra=drawRandomSkill(run,3,run.roleSkillMap[id]);if(extra)run.roleSkillMap[id].push(extra.id)}
    if(openingEffect(run).fullStarBonusSkill&&!run.bonusSkillSlots[id]){const extra=drawRandomSkill(run,5,run.roleSkillMap[id]);if(extra){run.roleSkillMap[id].push(extra.id);run.bonusSkillSlots[id]=run.roleSkillMap[id].length}}
  }
  function getRoleSkills(run,id,preview=true){
    if(!hasRandomSkills(run))return [];
    const ids=run.roleSkillMap?.[id]?.length?run.roleSkillMap[id]:preview&&run.draftSkillPreview?.[id]?[run.draftSkillPreview[id]]:[];
    return ids.map((skillId,i)=>({skill:randomSkillForRun(run,skillId),slot:i+1})).filter(entry=>entry.skill);
  }
  function activeRandomSkills(run){
    if(!hasRandomSkills(run)||starterCount(run)<6)return [];
    return [...new Set(Object.values(run.slots).filter(id=>id&&run.owned[id]))].flatMap(id=>getRoleSkills(run,id,false).map(entry=>({...entry,playerId:id})));
  }
  function randomSkillEffects(run){
    const total={dimensions:{},allDimensions:0,outsideCounterBonus:0,turnoverReduction:0,clutchBonus:0,opponentPenalty:0,battleCash:0,winCash:0,stageCash:0,shopDiscount:0,ignoreStrategyPenalty:false,freeGearRefresh:false};
    for(const {skill}of activeRandomSkills(run))for(const [key,value]of Object.entries(skill.effects)){
      if(key==='dimensions'){for(const [dim,n]of Object.entries(value))total.dimensions[dim]=(total.dimensions[dim]||0)+n;}
      else if(typeof value==='boolean')total[key]||=value;
      else if(Object.hasOwn(total,key))total[key]+=value;
    }
    return total;
  }
  function canManageSkill(run,id,slot){return hasRandomSkills(run)&&!run.ended&&!run.lastBattle&&!run.pending&&!run.randomEvent&&!run.skillAdPick&&!!run.owned[id]&&Number.isInteger(slot)&&slot>=1&&slot<=2&&!!run.roleSkillMap[id]?.[slot-1]}
  function refreshRandomSkill(run,id,slot){
    if(!canManageSkill(run,id,slot))return false;
    const used=run.skillRefreshCount[id]?.[slot-1]||0,cost=SKILL_REFRESH_COSTS[used];if(cost===undefined||run.cash<cost)return false;
    const skill=drawRandomSkill(run,slot>=2?3:1,run.roleSkillMap[id]);if(!skill)return false;
    run.cash-=cost;run.roleSkillMap[id][slot-1]=skill.id;(run.skillRefreshCount[id]||=[])[slot-1]=used+1;return true;
  }
  function enterSkillAdPick(run,id,slot){
    if(!canManageSkill(run,id,slot)||!randomSkillsForRun(run).some(s=>s.star===5&&!run.roleSkillMap[id].includes(s.id)))return false;
    run.skillAdPick={playerId:id,slot};return true;
  }
  function confirmSkillAdPick(run,skillId){
    const pick=run?.skillAdPick,skill=randomSkillForRun(run,skillId);
    if(!hasRandomSkills(run)||!pick||!Number.isInteger(pick.slot)||pick.slot<1||pick.slot>2||!run.roleSkillMap[pick.playerId]?.[pick.slot-1]||run.ended||run.lastBattle||run.pending||run.randomEvent||!run.owned[pick.playerId]||!skill||skill.star!==5||run.roleSkillMap[pick.playerId]?.includes(skillId))return false;
    run.roleSkillMap[pick.playerId][pick.slot-1]=skillId;(run.skillAdPickUsed[pick.playerId]||=[])[pick.slot-1]=true;run.skillAdPick=null;return true;
  }
  function cancelSkillAdPick(run){if(!hasRandomSkills(run)||!run.skillAdPick)return false;run.skillAdPick=null;return true}
  function restoreRandomSkills(run,source){
    if(!hasRandomSkills(run))return;if(run===source)source={...source};initRandomSkills(run);
    for(const id of Object.keys(BY_ID)){
      const ids=source.roleSkillMap?.[id],bonus=openingEffect(run).fullStarBonusSkill&&source.bonusSkillSlots?.[id]===3&&Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&randomSkillForRun(run,ids[2])?.star===5;
      if(Array.isArray(ids))run.roleSkillMap[id]=[...new Set(ids.filter(s=>Object.hasOwn(SKILL_BY_ID,s)))].slice(0,bonus?3:2);
      if(bonus&&run.roleSkillMap[id].length===3)run.bonusSkillSlots[id]=3;
      const preview=source.draftSkillPreview?.[id];if(Object.hasOwn(SKILL_BY_ID,preview)&&!run.roleSkillMap[id]?.length)run.draftSkillPreview[id]=preview;
      if(Array.isArray(source.skillRefreshCount?.[id]))run.skillRefreshCount[id]=source.skillRefreshCount[id].slice(0,2).map(n=>Number.isInteger(n)?clamp(n,0,3):0);
      if(Array.isArray(source.skillAdPickUsed?.[id]))run.skillAdPickUsed[id]=source.skillAdPickUsed[id].slice(0,2).map(n=>n===true);
      for(const skill of RANDOM_SKILLS)if(skill.effects.winHeal){
        const key=id+':'+skill.id,counter=source.skillHealCounters?.[key],granted=source.skillHealGranted?.[key];
        if(Number.isInteger(counter))run.skillHealCounters[key]=clamp(counter,0,skill.effects.healEveryWins-1);
        if(Number.isSafeInteger(granted))run.skillHealGranted[key]=Math.max(0,granted);
      }
    }
    for(const skill of RANDOM_SKILLS)if(skill.effects.winHeal){
      const key='skill-'+skill.id,counter=source.skillHealCounters?.[key];
      const legacy=Object.keys(BY_ID).reduce((sum,id)=>sum+(run.skillHealCounters[id+':'+skill.id]||0),0);
      if(Number.isInteger(counter)||legacy>0)run.skillHealCounters[key]=Number.isInteger(counter)?clamp(counter,0,skill.effects.healEveryWins-1):legacy%skill.effects.healEveryWins;
    }
    for(const key of ['skillFreeRefreshStage','skillStageCashPaid'])run[key]=Number.isInteger(source[key])?clamp(source[key],0,run.stage):0;
    const pick=source.skillAdPick;if(pick&&canManageSkill(run,pick.playerId,pick.slot))run.skillAdPick={playerId:pick.playerId,slot:pick.slot};
  }
  function recoverSkillMorale(run,skills){
    const detail=[];
    for(const {skill,playerId}of skills){const e=skill.effects;if(!e.winHeal)continue;
      const key='skill-'+skill.id,grantedKey=playerId+':'+skill.id;
      run.skillHealCounters[key]=(run.skillHealCounters[key]||0)+1;
      if(run.skillHealCounters[key]>=e.healEveryWins){run.skillHealCounters[key]=0;const heal=Math.min(e.winHeal,Math.max(0,MORALE_HARD_CAP-run.morale));if(heal>0){run.morale+=heal;run.skillHealGranted[grantedKey]=(run.skillHealGranted[grantedKey]||0)+heal;detail.push(skill.name+' · 士气 +'+heal)}}
    }
    return detail;
  }
  const BALANCE_RULES_VERSION=13,MORALE_HARD_CAP=13;
  const PLAYER_SHOP_PRICES=Object.freeze({A:14,S:24}),PLAYER_SHOP_REFRESH_COST=4;
  function currentBalance(run){return run?.balanceRulesVersion>=2}
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
    return Math.floor(recruitCost(run)*size*(currentBalance(run)?.9:.95));
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
  const LEGENDARY_PLAYER_UNLOCK_PRICE=400;
  const LEGENDARY_PLAYERS=Object.freeze(LATEST_CATALOG.STARS.filter(star=>star.tier==='SSR'&&!PREVIOUS_CATALOG.BY_ID[star.id]));
  function playerAvailable(run,id){return !(run.balanceRulesVersion>=12)||!LEGENDARY_PLAYERS.some(star=>star.id===id)||(run.unlockedPlayers||[]).includes(id)}
  function unlockLegendaryPlayer(profile,random=Math.random){
    const owned=profile.playerUnlocks||(profile.playerUnlocks=[]),pool=LEGENDARY_PLAYERS.filter(star=>!owned.includes(star.id));
    if(!pool.length||!Number.isFinite(profile.legend)||profile.legend<LEGENDARY_PLAYER_UNLOCK_PRICE)return null;
    const star=pool[Math.min(pool.length-1,Math.floor(clamp(random(),0,.999999)*pool.length))];
    profile.legend-=LEGENDARY_PLAYER_UNLOCK_PRICE;owned.push(star.id);return star;
  }
  function createGame(){return { version:1, run:null, profile:{talentRulesVersion:3,runs:0,wins:0,clears:0,bestStage:0,highestStage:0,bestEndless:0,bestGoat:0,bestOvr:0,legend:0,discovered:[],discoveredEvents:[],jerseys:[],jerseyUnlocks:[],gearUnlocks:[],playerUnlocks:[],upgrades:{startGold:0,scouting:0,interestCap:0,trainingBoost:0,policyOffers:0,benchSeat:0,filmStudy:0,gearStorage:0},metaUnlocks:{talents:[],gear:[],players:[]}} }}
  function createRun(talent,seed,progress={},rulesVersion=BALANCE_RULES_VERSION){
    const effect=openingEffect({talent,balanceRulesVersion:rulesVersion});
    const run={seed:seed>>>0,rng:seed>>>0,talent,stage:1,endless:false,rarityBonus:clamp(progress.scouting??progress.rarityBonus??0,0,5),metaInterestCap:clamp(progress.interestCap||0,0,5),metaTrainingBoost:clamp(progress.trainingBoost||0,0,3),metaPolicyOffers:clamp(progress.policyOffers||0,0,1),metaFilmStudy:clamp(progress.filmStudy||0,0,3),unlockedJerseys:[...new Set((progress.jerseyUnlocks||[]).filter(id=>GEAR.some(item=>item.id===id&&item.unlockable&&item.slot==='球衣')))],unlockedGear:[...new Set((progress.gearUnlocks||[]).filter(id=>GEAR.some(item=>item.id===id&&item.legendary)))],gearHealCounters:{},gearLimit:GEAR_LIMIT,gearReserveLimit:5+clamp(progress.gearStorage||0,0,5),maxGoat:0,maxOvr:0,endlessWins:0,collectedPlayers:[],collectedJerseys:[],morale:clamp(3+(effect.startMorale||0),1,3),cash:Math.max(0,(rulesVersion>=2?12:16)+clamp(progress.startGold||0,0,5)*5+(effect.startCash||0)),free:6+(effect.freePerStage||0),recruitCredits:0,rewardedRecruitUsed:false,offerMode:'normal',batchSelected:[],batchQueue:[],refreshFree:1,gearRefreshFree:effect.freeGearRefresh||0,forceRareRecruit:false,owned:{},slots:Object.fromEntries(SLOTS.map(s=>[s.id,null])),bench:[],talentWinHealGranted:0,benchLimit:clamp(6+clamp(progress.benchSeat||0,0,5)+(effect.benchDelta||0),1,11+Math.max(0,effect.benchDelta||0)),offer:[],offerOdds:null,pending:null,boosts:[],boostBoughtOffers:[],gear:[],gearReserve:[],gearSoldOffers:[],shopOffers:{boost:[],gear:[]},shopRefreshes:0,gearRefreshes:0,gearPaidRefreshes:0,wins:0,losses:0,stats:{recruits:0,prizeIncome:0,gearPurchases:0},reviveUsed:false,posterRewarded:false,settlement:null,lastBattle:null,ended:false,awarded:false,recruitGroups:0,noAPlusGroups:0,noSPlusGroups:0,openingAPlusGroups:0};
    if(rulesVersion>=12)run.unlockedPlayers=[...new Set((Array.isArray(progress.playerUnlocks)?progress.playerUnlocks:[]).filter(id=>LEGENDARY_PLAYERS.some(star=>star.id===id)))];
    if(rulesVersion>=2){run.balanceRulesVersion=rulesVersion;run.bondWinHealCounters={}}
    if(rulesVersion>=7)initRandomSkills(run);
    if(rulesVersion>=4){run.eventState={seen:[],misses:0,lastBattle:-2,bonuses:{},jerseys:0,recovered:false};run.randomEvent=null}
    if(talent==='outside')run.free+=1;
    if(talent==='economy')run.free-=1;
    if(effect.startGearRarity){const pool=GEAR.filter(item=>item.rarity===effect.startGearRarity&&item.kind!=='signature'&&(rulesVersion>=5?gearAvailable(run,item):!item.legendary));if(pool.length){const id=randomChoice(run,pool).id;run.gear.push(id);if(GEAR.find(item=>item.id===id)?.slot==='球衣')run.collectedJerseys.push(id)}}
    if(rulesVersion>=12)playerEconomy.reset(run);
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
  function synergiesForRun(run){return run?.balanceRulesVersion>=3?SYNERGIES:(DATA.LEGACY_SYNERGIES||SYNERGIES)}
  function completedSynergies(run){const ids=ownedIdentities(run);return synergiesForRun(run).filter(s=>(currentBalance(run)||!s.effect?.winHeal)&&s.ids.every(id=>ids.has(id)))}
  function activeSynergies(run){
    const completed=completedSynergies(run),highest=new Map();
    if(run?.balanceRulesVersion>=3){
      const scale=openingEffect(run).bondEffectScale;if(!scale)return completed;
      return completed.map(bond=>({...bond,effect:Object.fromEntries(Object.entries(bond.effect||{}).map(([key,value])=>[key,key==='dimensions'?Object.fromEntries(Object.entries(value).map(([dim,n])=>[dim,n*scale])):key==='healEveryWins'?value:typeof value==='number'?Math.floor(value*scale):value]))}));
    }
    for(const bond of completed)if(bond.chainId)highest.set(bond.chainId,Math.max(highest.get(bond.chainId)||0,bond.chainLevel||0));
    return completed.filter(bond=>!bond.chainId||(bond.chainLevel||0)===highest.get(bond.chainId));
  }
  function starSynergies(id,run){const identity=identityOf(id);return (run?synergiesForRun(run):SYNERGIES).filter(s=>s.ids.includes(identity))}
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
    const usable=star=>playerAvailable(run,star.id)&&!chosen.includes(star.id)&&!chosenIdentities.has(identityOf(star.id))
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
    previewRandomSkills(run,chosen);
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
    previewRandomSkills(run,chosen);
    return chosen;
  }
  function addRecruitedStar(run,id,track=true){
    const star=BY_ID[id];
    acquireRandomSkill(run,id);
    if(track){run.stats||(run.stats={recruits:0,prizeIncome:0,gearPurchases:0});run.stats.recruits++}
    if(!(run.collectedPlayers||(run.collectedPlayers=[])).includes(id))run.collectedPlayers.push(id);
    if(run.owned[id]){
      const own=run.owned[id];
      if(own.stars<starLimit(run,id))own.stars++;else run.cash+=4;
      unlockFullStarSkill(run,id);
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
      last=addRecruitedStar(run,run.batchQueue.shift(),false);processed++;
    }
    return {ok:true,processed,last,pending:!!run.pending,done:!run.pending&&!(run.batchQueue?.length)};
  }
  function confirmRecruitBatch(run,selected=run.batchSelected){
    if(run.ended||run.pending||run.offerMode!=='ten-batch'||run.offer.length!==10)return {ok:false,reason:'当前没有可确认的十连招募'};
    const choices=Array.isArray(selected)?run.offer.map((_,index)=>selected[index]!==false):run.offer.map(()=>true);
    run.stats||(run.stats={recruits:0,prizeIncome:0,gearPurchases:0});run.stats.recruits+=run.offer.length;
    const keep=[],sell=[];
    run.offer.forEach((id,index)=>(choices[index]?keep:sell).push(id));
    for(const id of sell)run.cash+=saleValue(id,1,run);
    const kept=keep.length,sold=sell.length;
    run.batchQueue=[...keep];
    run.offer=[];run.offerOdds=null;run.offerMode='normal';run.batchSelected=[];
    const result=advanceRecruitBatch(run);
    return {...result,sold,kept};
  }
  function resetSoldBonusSkills(run,id){
    if(run.balanceRulesVersion<11||!hasRandomSkills(run))return;
    if(run.roleSkillMap[id])run.roleSkillMap[id]=run.roleSkillMap[id].slice(0,1);
    delete run.bonusSkillSlots[id];
    if(run.skillRefreshCount[id])run.skillRefreshCount[id]=run.skillRefreshCount[id].slice(0,1);
    if(run.skillAdPickUsed[id])run.skillAdPickUsed[id]=run.skillAdPickUsed[id].slice(0,1);
  }
  function resolvePending(run,mode,target){
    const id=run.pending;if(!id)return false;
    if(mode==='sell'){run.cash+=saleValue(id,1,run)}
    else if(mode==='replace' && Number.isInteger(target) && target>=0 && target<run.bench.length){
      const old=run.bench[target];run.cash+=saleValue(old,run.owned[old]?.stars,run);delete run.owned[old];resetSoldBonusSkills(run,old);
      run.owned[id]={stars:1,train:0,trainedAt:0};run.bench[target]=id;
    } else if(mode==='replace-slot'&&SLOTS.some(slot=>slot.id===target)&&run.slots[target]){
      const old=run.slots[target];run.cash+=saleValue(old,run.owned[old]?.stars,run);delete run.owned[old];resetSoldBonusSkills(run,old);
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
    run.bench.splice(index,1);delete run.owned[id];resetSoldBonusSkills(run,id);run.cash+=value;
    return value;
  }
  function playerScore(star,own,key,run=null){
    if(run&&(run.balanceRulesVersion||1)<12)star=BY_ID[star.id]||star;
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
  function combatBonus(run,value){return run?.balanceRulesVersion>=3?(value<=30?Math.max(-30,value):30+(value-30)*.5):clamp(value,-30,40)}
  function fused(run,strategy='',foeStrategy=''){
    const stats={},talents=[],talentEffects=[],bonds=activeSynergies(run),opening=openingEffect(run),skills=activeRandomSkills(run),skillEffects=randomSkillEffects(run);
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
      slotScores[key]=Math.max(0,(slotScores[key]+abilityFlat[key])*(1+combatBonus(run,abilityPercent[key])/100));
      stats[key]=Math.round(Math.max(0,(stats[key]+abilityFlat[key])*(1+combatBonus(run,abilityPercent[key])/100)));
    }
    const dimensions=dimensionsFromSlots(slotScores),flat=Object.fromEntries(COMBAT_KEYS.map(key=>[key,0]));
    const percents=Object.fromEntries(COMBAT_KEYS.map(key=>[key,0]));
    const openingPercents=Object.fromEntries(COMBAT_KEYS.map(key=>[key,0]));
    addDimensions(percents,skillEffects.dimensions);
    for(const key of COMBAT_KEYS)percents[key]+=skillEffects.allDimensions;
    if(strategy==='outside'&&foeStrategy==='collapse')percents.shooting+=skillEffects.outsideCounterBonus;
    if(run.balanceRulesVersion>=4)addDimensions(percents,run.eventState?.bonuses);
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
      if(!opening.ignoreStrategyPenalty&&!skillEffects.ignoreStrategyPenalty)openingPercents[tactic.penalty]-=4+(opening.strategyPenalty||0);
    }
    for(const key of COMBAT_KEYS)dimensions[key]=Math.max(0,(dimensions[key]+flat[key])*(1+combatBonus(run,percents[key])/100)*(1+combatBonus(run,openingPercents[key])/100));
    const rating=Math.round(COMBAT_KEYS.reduce((sum,key)=>sum+dimensions[key],0)/COMBAT_KEYS.length);
    return {stats,slotScores,dimensions,rating,bonds,talents,talentEffects,skills,skillEffects};
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
  const opponentRatingCache=new Map();
  function opponent(run){
    const curveVersion=run.balanceRulesVersion>=13?13:run.balanceRulesVersion>=12?12:run.balanceRulesVersion>=9?9:run.balanceRulesVersion>=6?6:5;
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
    if(run.balanceRulesVersion>=6&&run.stage>20){
      const targetRating=endlessOpponentTarget(run.stage),scale=targetRating/rating;
      for(const attr of ATTRS)stats[attr]=Math.max(20,Math.round(stats[attr]*scale));
      slotScores=slotScoresFromStats(stats);dimensions=dimensionsFromSlots(slotScores);
      rating=Math.round(COMBAT_KEYS.reduce((sum,key)=>sum+dimensions[key],0)/COMBAT_KEYS.length);
    }
    // 规则9收回部分徽章与天赋收益：入门+3%，10关+6%，50关+9%，80关后+12%。
    if(curveVersion>=9){
      const stage=run.stage,originalScale=stage<=3?1.03:stage<=10?1.03+.03*(stage-3)/7:stage<=20?1.06:stage<=50?1.06+.03*(stage-20)/30:1.09+.03*Math.min(30,stage-50)/30;
      // 规则13只放宽无尽：第11关-3%，第20关及以后-5%；主线与旧局不变。
      const relief=curveVersion>=13&&stage>10?.97-.02*Math.min(9,stage-11)/9:1,scale=originalScale*relief;
      for(const attr of ATTRS)stats[attr]=Math.max(20,Math.round(stats[attr]*scale));
      slotScores=slotScoresFromStats(stats);dimensions=dimensionsFromSlots(slotScores);
      rating=Math.round(COMBAT_KEYS.reduce((sum,key)=>sum+dimensions[key],0)/COMBAT_KEYS.length);
    }
    if(run.stage>1){
      const previousKey=`${curveVersion}:${run.stage-1}`;
      const previous=opponentRatingCache.has(previousKey)?opponentRatingCache.get(previousKey):opponent({stage:run.stage-1,balanceRulesVersion:run.balanceRulesVersion}).rating;
      while(rating<=previous){
        for(const attr of ATTRS)stats[attr]++;
        slotScores=slotScoresFromStats(stats);dimensions=dimensionsFromSlots(slotScores);
        rating=Math.round(COMBAT_KEYS.reduce((sum,key)=>sum+dimensions[key],0)/COMBAT_KEYS.length);
      }
    }
    if(opponentRatingCache.size>=2048)opponentRatingCache.delete(opponentRatingCache.keys().next().value);
    opponentRatingCache.set(`${curveVersion}:${run.stage}`,rating);
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
      total.counterCash+=(item.counterCash||0)*multiplier;
      if(run.balanceRulesVersion>=5){total.lossCash+=(item.lossCash||0)*multiplier;total.battleCash+=(item.battleCash||0)*multiplier;total.shopDiscount+=(item.shopDiscount||0)*multiplier}return total;
    },{clutchBonus:0,turnoverReduction:0,opponentPenalty:0,winCash:0,counterCash:0,lossCash:0,battleCash:0,shopDiscount:0});
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
    const pool=GEAR.filter(item=>!owned.has(item.id)&&gearAvailable(run,item)&&(!item.minStage||run.stage>=item.minStage)&&(!(run.balanceRulesVersion>=5)||item.slot!=='球衣')),chosen=[],weights=gearRarityWeights(run);
    const jerseyChance=.15; // 第四栏球衣独立判定，不受非球衣装备池或持有情况影响。
    while(pool.length&&chosen.length<count){
      // 每件装备独立获得对应品质的权重；抽中后，同次刷新不再抽该部位。
      const total=pool.reduce((sum,item)=>sum+weights[item.rarity],0);
      let roll=nextRandom(run)*total,index=pool.length-1;
      for(let i=0;i<pool.length;i++){roll-=weights[pool[i].rarity];if(roll<0){index=i;break}}
      const item=pool[index];chosen.push(item.id);
      nextRandom(run); // 保持每件商品消耗两次随机数，避免改变同种子后续对局的随机序列。
      for(let i=pool.length-1;i>=0;i--)if(pool[i].slot===item.slot)pool.splice(i,1);
    }
    if(run.balanceRulesVersion>=5){
      const jerseys=GEAR.filter(item=>item.slot==='球衣'&&!owned.has(item.id)&&gearAvailable(run,item)&&(!item.minStage||run.stage>=item.minStage));
      if(nextRandom(run)<jerseyChance&&jerseys.length)chosen.push(jerseys[Math.floor(nextRandom(run)*jerseys.length)].id);
    }
    return chosen;
  }
  function gearAvailable(run,item){return !!item&&(!item.legendary||run.balanceRulesVersion>=5)&&(!item.unlockable||(item.slot==='球衣'?(run.unlockedJerseys||[]):(run.unlockedGear||[])).includes(item.id))}
  function makeShopOffers(run){
    run.shopOffers={boost:drawShopItems(run,BOOSTS,4,[]),gear:drawGearItems(run,3)};
    run.boostBoughtOffers=[];run.gearSoldOffers=[];
    if(run.balanceRulesVersion>=10)makePlayerShopOffers(run);
    return run.shopOffers;
  }
  function playerShopUnlocked(run){return !!run&&run.balanceRulesVersion>=10&&run.stage>=(run.balanceRulesVersion>=11?5:6)}
  function playerShopReady(run){return playerShopUnlocked(run)&&!run.ended&&!run.lastBattle&&!run.pending&&!run.randomEvent&&!run.skillAdPick}
  function makePlayerShopOffers(run){
    if(!run||run.balanceRulesVersion<10)return [];
    run.playerShopOffers=[];run.playerShopOffersInitialized=true;
    if(run.balanceRulesVersion>=12)run.playerShopSoldOffers=[];
    if(!playerShopUnlocked(run))return run.playerShopOffers;
    const tiers=['A','A',nextRandom(run)<.3?'S':'A'],excluded=new Set(STARS.filter(star=>run.owned[star.id]?.stars>=starLimit(run,star.id)).map(star=>star.id));
    for(const tier of tiers){
      let pool=STARS.filter(star=>star.tier===tier&&!excluded.has(star.id));
      if(!pool.length)pool=STARS.filter(star=>['A','S'].includes(star.tier)&&!excluded.has(star.id));
      if(pool.length){const id=randomChoice(run,pool).id;excluded.add(id);run.playerShopOffers.push(id)}
    }
    previewRandomSkills(run,run.playerShopOffers);
    return run.playerShopOffers;
  }
  function ensurePlayerShop(run){
    if(!playerShopUnlocked(run))return [];
    if(!run.playerShopOffersInitialized)makePlayerShopOffers(run);
    return run.playerShopOffers||[];
  }
  function playerShopPrice(run,id){
    const star=BY_ID[id],base=PLAYER_SHOP_PRICES[star?.tier];
    if(base===undefined)return Infinity;
    if(run.balanceRulesVersion>=11)return base;
    const discount=(openingEffect(run).gearDiscount||0)+itemEffects(run).shopDiscount+randomSkillEffects(run).shopDiscount;
    return Math.max(1,Math.ceil(base-discount));
  }
  function refreshPlayerShop(run){
    if(!playerShopReady(run)||run.cash<PLAYER_SHOP_REFRESH_COST)return false;
    run.cash-=PLAYER_SHOP_REFRESH_COST;makePlayerShopOffers(run);return true;
  }
  function buyShopPlayer(run,id){
    if(!playerShopReady(run)||!BY_ID[id]||!ensurePlayerShop(run).includes(id)||(run.balanceRulesVersion>=12&&(run.playerShopSoldOffers||[]).includes(id))||run.owned[id]?.stars>=starLimit(run,id))return {ok:false,reason:'球员不可购买'};
    const price=playerShopPrice(run,id);if(run.cash<price)return {ok:false,reason:'奖金不足'};
    run.cash-=price;
    if(run.balanceRulesVersion>=12)(run.playerShopSoldOffers||(run.playerShopSoldOffers=[])).push(id);
    else run.playerShopOffers=run.playerShopOffers.filter(offered=>offered!==id);
    return addRecruitedStar(run,id);
  }
  function ensureShop(run){
    if(!run.shopOffers||!Array.isArray(run.shopOffers.boost)||!Array.isArray(run.shopOffers.gear))run.shopOffers={boost:[],gear:[]};
    if(!run.shopOffers.boost.length){run.shopOffers.boost=drawShopItems(run,BOOSTS,4,[]);run.boostBoughtOffers=[]}
    if(!run.shopOffers.gear.length){run.shopOffers.gear=drawGearItems(run,3);run.gearSoldOffers=[]}
    return run.shopOffers;
  }
  function baseShopRefreshCost(run,type='boost'){return type==='gear'?(run.gearRefreshFree>0||randomSkillEffects(run).freeGearRefresh&&run.skillFreeRefreshStage!==run.stage?0:3+(run.balanceRulesVersion>=5?(run.gearPaidRefreshes||0):0)+(openingEffect(run).gearRefreshCostDelta||0)):Math.min(10,4+(run.shopRefreshes||0))}
  function shopRefreshCost(run,type='boost'){return playerEconomy.quote(run,type==='gear'?'gearRefresh':'boostRefresh',baseShopRefreshCost(run,type)).price;}
  function refreshShop(run,type='boost'){
    if(!['boost','gear'].includes(type))return false;
    const base=baseShopRefreshCost(run,type),quote=playerEconomy.quote(run,type==='gear'?'gearRefresh':'boostRefresh',base),cost=quote.price;if(run.cash<cost)return false;run.cash-=cost;playerEconomy.consume(run,quote);
    if(type==='gear'){if(run.balanceRulesVersion>=5&&cost>0)run.gearPaidRefreshes=(run.gearPaidRefreshes||0)+1;if(run.gearRefreshFree>0)run.gearRefreshFree--;else if(base===0&&hasRandomSkills(run))run.skillFreeRefreshStage=run.stage;run.gearRefreshes=(run.gearRefreshes||0)+1;run.shopOffers.gear=drawGearItems(run,3);run.gearSoldOffers=[]}
    else{run.shopRefreshes=(run.shopRefreshes||0)+1;run.shopOffers.boost=drawShopItems(run,BOOSTS,4,[]);run.boostBoughtOffers=[]}
    return true;
  }
  function trainingLimit(run,id){
    const star=BY_ID[id];if(!star)return 0;
    return run.endless||run.stage>10?run.stage:3;
  }
  function baseTrainingCost(run,id){const level=run.owned[id]?.train??0,costs=currentBalance(run)?TRAINING_COSTS:LEGACY_TRAINING_COSTS,base=costs[Math.min(level,costs.length-1)],effect=openingEffect(run);return base===undefined?Infinity:Math.max(1,Math.ceil((base+(run.talent==='agent'?2:0)+(effect.trainingCostDelta||0))*(effect.trainingCostMultiplier||1)))}
  function trainingCost(run,id){return playerEconomy.quote(run,'training',baseTrainingCost(run,id)).price;}
  function train(run,id){const own=run.owned[id],star=BY_ID[id];if(!own||!star||own.train>=trainingLimit(run,id)||(!run.endless&&own.trainedAt===run.stage))return false;const quote=playerEconomy.quote(run,'training',baseTrainingCost(run,id)),cost=quote.price;if(run.cash<cost)return false;run.cash-=cost;playerEconomy.consume(run,quote);own.train++;own.trainedAt=run.stage;return true}
  function baseBoostPrice(run,item){return Math.max(1,item.price+(openingEffect(run).boostCostDelta||0))}
  function boostPrice(run,item){return playerEconomy.quote(run,'boostPurchase',baseBoostPrice(run,item),item.id).price;}
  function gearPrice(run,item){const effect=openingEffect(run);return Math.max(1,Math.ceil((item.price-(effect.gearDiscount||0)-(run.balanceRulesVersion>=5?itemEffects(run).shopDiscount:0)-randomSkillEffects(run).shopDiscount)*(effect.gearPriceMultiplier||1)))}
  function gearCashback(run,price){return Math.floor(price*(openingEffect(run).gearCashback||0))}
  function boostPurchaseLimit(run){return run.balanceRulesVersion>=6?(run.stage<=10?2:10):Infinity}
  function buyBoost(run,id){ensureShop(run);const item=BOOSTS.find(b=>b.id===id);if(!item||!run.shopOffers.boost.includes(id)||(run.boostBoughtOffers||[]).includes(id)||run.boosts.filter(boostId=>boostId===id).length>=boostPurchaseLimit(run)||run.cash<boostPrice(run,item))return false;const quote=playerEconomy.quote(run,'boostPurchase',baseBoostPrice(run,item),id);run.cash-=quote.price;playerEconomy.consume(run,quote);run.boosts.push(id);(run.boostBoughtOffers||(run.boostBoughtOffers=[])).push(id);return true}
  function gearReserveCount(run){return (run.gearReserve||[]).filter(id=>GEAR.find(item=>item.id===id)?.slot!=='球衣').length}
  function gearReserveLimit(run){return clamp(run.gearReserveLimit||5,5,10)}
  function gearStorageFull(run,item){return run.balanceRulesVersion>=5&&item?.slot!=='球衣'&&(run.gear.some(id=>GEAR.find(g=>g.id===id)?.slot===item.slot)||run.gear.length>=(run.gearLimit||GEAR_LIMIT))&&gearReserveCount(run)>=gearReserveLimit(run)}
  function buyGear(run,id){
    ensureShop(run);
    const item=GEAR.find(g=>g.id===id),reserve=run.gearReserve||(run.gearReserve=[]);
    if(!item||!gearAvailable(run,item)||!run.shopOffers.gear.includes(id)||(run.gearSoldOffers||[]).includes(id)||run.cash<gearPrice(run,item)||run.gear.includes(id)||reserve.includes(id))return false;
    if(!(run.balanceRulesVersion>=5)&&item.slot!=='球衣'&&[...run.gear,...reserve].some(gearId=>GEAR.find(g=>g.id===gearId)?.slot===item.slot))return false;
    if(gearStorageFull(run,item))return false;
    const price=gearPrice(run,item);run.cash-=price;run.cash+=gearCashback(run,price);
    run.stats||(run.stats={recruits:0,prizeIncome:0,gearPurchases:0});run.stats.gearPurchases++;
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
    const price=gearPrice(run,item);run.cash-=price;run.cash+=gearCashback(run,price);
    run.stats||(run.stats={recruits:0,prizeIncome:0,gearPurchases:0});run.stats.gearPurchases++;
    if(oldItem)run.cash+=oldItem.sellPrice;
    if(activeIndex>=0)run.gear[activeIndex]=id;else reserve[reserveIndex]=id;
    (run.gearSoldOffers||(run.gearSoldOffers=[])).push(id);
    return oldId;
  }
  function equipGear(run,id){
    const reserve=run.gearReserve||[],index=reserve.indexOf(id),item=GEAR.find(g=>g.id===id);
    if(index<0||!item||!(run.balanceRulesVersion>=5)&&item.slot!=='球衣')return false;
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
  function expandBench(run){if(run.cash<10||run.benchLimit>=benchExpansionLimit(run))return false;run.cash-=10;run.benchLimit++;return true}
  function recruitRefreshCost(run){return run.refreshFree>0?0:playerEconomy.quote(run,'recruitRefresh',5).price;}
  function refreshOffer(run){if(run.refreshFree>0)run.refreshFree--;else{const quote=playerEconomy.quote(run,'recruitRefresh',5);if(run.cash<quote.price)return false;run.cash-=quote.price;playerEconomy.consume(run,quote);}run.offer=[];run.offerOdds=null;makeOffer(run);return true}
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
  function legendPointBreakdown(run){
    const cleared=clearedMainStage(run),main={5:50,6:60,7:70,8:80,9:90,10:200}[cleared]||0,endlessWins=run?.endlessWins||0,endless=endlessWins*50;
    return {cleared,main,endlessWins,endless,total:main+endless,formula:`主线进度 ${cleared}/10：${main} + 无尽胜场 ${endlessWins}×50：${endless} = ${main+endless}`};
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
  function unlockLegendaryGear(profile,random=Math.random){
    const owned=profile.gearUnlocks||(profile.gearUnlocks=[]),pool=GEAR.filter(item=>item.legendary&&!owned.includes(item.id));
    if(!pool.length||profile.legend<LEGENDARY_GEAR_UNLOCK_PRICE)return null;
    const item=pool[Math.min(pool.length-1,Math.floor(clamp(random(),0,.999999)*pool.length))];
    profile.legend-=LEGENDARY_GEAR_UNLOCK_PRICE;owned.push(item.id);return item;
  }
  function preventGearDefeat(run){
    if(!(run.balanceRulesVersion>=5)||run.morale>0)return null;
    const item=run.gear.map(id=>GEAR.find(g=>g.id===id)).find(g=>g?.preventDefeat);
    if(!item)return null;
    run.gear=run.gear.filter(id=>id!==item.id);run.morale=1;return item;
  }
  function recoverGearMorale(run){
    if(!(run.balanceRulesVersion>=5))return [];
    const counters=run.gearHealCounters||(run.gearHealCounters={}),detail=[];
    for(const id of run.gear){const item=GEAR.find(g=>g.id===id);if(!item?.healEveryWins)continue;
      counters[id]=(counters[id]||0)+1;
      if(counters[id]>=item.healEveryWins){counters[id]=0;const heal=Math.min(1,Math.max(0,MORALE_HARD_CAP-run.morale));run.morale+=heal;if(heal)detail.push(item.name+'恢复1点士气')}
    }
    return detail;
  }
  function finishRun(game){
    const run=game.run;if(!run||run.awarded)return 0;
    if(run.morale>0)run.randomEvent=null;
    const profile=game.profile,points=legendPoints(run),cleared=clearedMainStage(run),goat=Math.round(run.maxGoat||0);
    profile.runs++;profile.wins+=run.wins;profile.clears=(profile.clears||0)+(cleared>=10?1:0);
    profile.bestStage=Math.max(profile.bestStage||0,cleared);profile.highestStage=Math.max(profile.highestStage||0,run.stage);
    profile.bestEndless=Math.max(profile.bestEndless||0,run.endless?run.stage:0);profile.bestGoat=Math.max(profile.bestGoat||0,goat);profile.bestOvr=Math.max(profile.bestOvr||0,run.maxOvr||run.lastBattle?.rating||0);profile.legend+=points;
    profile.discovered=[...new Set([...(profile.discovered||[]),...(run.collectedPlayers||Object.keys(run.owned))])];
    profile.jerseys=[...new Set([...(profile.jerseys||[]),...(run.collectedJerseys||[])])];
    profile.metaUnlocks ||= {talents:[],gear:[],players:[]};
    profile.metaUnlocks.talents=[...new Set([...(profile.metaUnlocks.talents||[]),...availableTalents(profile).filter(talent=>talent.unlock).map(talent=>talent.id)])];
    run.settlement={points,wins:run.wins,clearAward:cleared>=10?1:0};run.awarded=true;run.ended=true;return points;
  }
  function reviveRun(game){
    const run=game?.run,settlement=run?.settlement;
    if(!run||!run.ended||!run.awarded||run.reviveUsed||run.morale>0||!run.lastBattle||!settlement)return false;
    const profile=game.profile;
    profile.runs=Math.max(0,(profile.runs||0)-1);
    profile.wins=Math.max(0,(profile.wins||0)-(settlement.wins||0));
    profile.clears=Math.max(0,(profile.clears||0)-(settlement.clearAward||0));
    profile.legend=Math.max(0,(profile.legend||0)-(settlement.points||0));
    const bonus=recruitPackCost(run,10);
    run.cash+=bonus;run.morale=3;run.reviveUsed=true;run.awarded=false;run.ended=false;run.settlement=null;run.lastBattle=null;
    return bonus;
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
  function recoverBondMorale(run,bonds=activeSynergies(run)){
    if(!currentBalance(run))return [];
    const counters=run.bondWinHealCounters||(run.bondWinHealCounters={}),messages=[];
    for(const bond of bonds){
      const amount=bond.effect?.winHeal,period=bond.effect?.healEveryWins;
      if(!amount||!period)continue;
      const previous=Number.isInteger(counters[bond.id])&&counters[bond.id]>=0&&counters[bond.id]<period?counters[bond.id]:0;
      counters[bond.id]=previous+1;
      if(counters[bond.id]>=period){
        counters[bond.id]=0;
        const healed=Math.min(amount,Math.max(0,MORALE_HARD_CAP-run.morale));
        run.morale+=healed;
        if(healed)messages.push(`${bond.name} · 生命 +${healed}`);
      }
    }
    return messages;
  }
  function battle(game,strategy){
    const run=game.run;if(!run||run.ended||run.lastBattle||run.randomEvent||run.skillAdPick||starterCount(run)<6||!STRATEGIES[strategy])return null;
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
      const turnover=clamp(.09-.12*creationEdge-(turn==='us'?equipment.turnoverReduction+own.skillEffects.turnoverReduction:0)+(activeMove?.turnoverPenalty||0)+(activeMove?.turnover||0)+(activeMove?.turnover?activeMove.trained*.02:0),.02,.18);
      let made=false;
      const lostBall=nextRandom(run)<=turnover;
      if(!lostBall){
        let chance=matchup.base+.22*combatEdge(matchup.attack,matchup.guard)+.08*creationEdge;
        if(turn==='us'){chance+=Math.max(us,them)>=8?equipment.clutchBonus+own.skillEffects.clutchBonus:0}else chance-=equipment.opponentPenalty+own.skillEffects.opponentPenalty;
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
    const skillCash=own.skillEffects.battleCash+(won?own.skillEffects.winCash:0)+own.skillEffects.stageCash;
    if(won&&hasRandomSkills(run))run.skillStageCashPaid=run.stage;
    const counterCash=beats===1?equipment.counterCash:0;
    const postBattleCash=own.talentEffects.reduce((sum,effect)=>sum+(effect.postBattleCash||0),0)+counterCash+equipment.battleCash;
    let reward=0,detail=[];
    if(won){
      const income=incomeBreakdown(run),base=income.victoryBase,lineupIncome=income.lineupIncome,interest=income.interest;
      const bond=own.bonds.length?1:0,bondCash=Math.min(5,own.bonds.reduce((sum,item)=>sum+(item.effect?.winCash||0),0));
      const talentCash=own.talentEffects.reduce((sum,effect)=>sum+(effect.winCash||0),0);
      const openingCash=(opening.battleCash||0)+(own.bonds.length?(opening.bondWinCash||0):0);
      const grossReward=Math.max(0,base+lineupIncome+interest+bond+bondCash+talentCash+postBattleCash+equipment.winCash+openingCash+skillCash);
      reward=run.balanceRulesVersion>=5?Math.min(90,grossReward):grossReward;run.cash+=reward;run.wins++;
      if(opening.winHeal&&run.wins%(opening.healEveryWins||1)===0){
        const granted=run.talentWinHealGranted||0,heal=Math.min(opening.winHeal,Math.max(0,(opening.healLimit??(run.balanceRulesVersion>=8?Infinity:10))-granted));
        run.morale+=currentBalance(run)?Math.min(heal,Math.max(0,MORALE_HARD_CAP-run.morale)):heal;run.talentWinHealGranted=granted+heal;
      }
      detail=[`胜利 ${base}`,`阵容收入 ${lineupIncome}`,`利息 ${interest}`,`羁绊 ${bond+bondCash}`];
      detail.push(...recoverBondMorale(run,own.bonds),...recoverGearMorale(run),...recoverSkillMorale(run,own.skills));
      if(equipment.winCash)detail.push(`装备胜利奖励 ${equipment.winCash}`);
      if(openingCash)detail.push(`开局天赋 ${openingCash}`);
      if(talentCash)detail.push(`球星技能 ${talentCash}`);
      if(postBattleCash)detail.push(`${counterCash?'战术克制与':'战后'}技能 ${postBattleCash}`);
      if(grossReward>reward)detail.push('胜利奖金上限90');
    }else{
      run.morale--;run.losses++;run.free++;reward=Math.max(0,incomeBreakdown(run).lossBase+postBattleCash+(opening.battleCash||0)+equipment.lossCash+skillCash);run.cash+=reward;detail=[`失败补偿 ${reward-postBattleCash-(opening.battleCash||0)-equipment.lossCash-skillCash}`,'免费招募 +1'];
      if(equipment.lossCash)detail.push(`装备失败奖励 ${equipment.lossCash}`);
      if(opening.battleCash)detail.push(`开局天赋 ${opening.battleCash}`);
      if(postBattleCash)detail.push(`${counterCash?'战术克制与':'战后'}技能 ${postBattleCash}`);
    }
    if(skillCash)detail.push('随机徽章奖金 '+skillCash);
    const rescued=preventGearDefeat(run);if(rescued)detail.push(rescued.name+'已消耗，生命恢复至1点');
    run.stats||(run.stats={recruits:0,prizeIncome:0,gearPurchases:0});run.stats.prizeIncome+=reward;
    run.boosts=[];
    const goatPhases={planning:own.dimensions.shooting+own.dimensions.creation,clash:own.dimensions.finishing+own.dimensions.perimeterStop,endurance:own.dimensions.rimStop};
    const goat=Math.round(goatPhases.planning+goatPhases.clash+goatPhases.endurance);
    const report={stage:run.stage,won,us,them,reward,detail,log:log.slice(-7),signatures:signatures.map(({id,name,kind,uses})=>({id,name,kind,uses})),strategy,foe:foe.id,foeName:foe.name,foeStars:foe.stars,foeStrategy:foe.strategy,beats,rating:own.rating,foeRating:foe.rating,goat,goatPhases};
    run.maxGoat=Math.max(run.maxGoat||0,goat);run.maxOvr=Math.max(run.maxOvr||0,own.rating);if(won&&run.stage>10)run.endlessWins=(run.endlessWins||0)+1;
    if(run.balanceRulesVersion>=12)report.playerStageCash=won?own.talentEffects.reduce((sum,effect)=>sum+(effect.stageCash||0),0):0;
    run.lastBattle=report;
    if(run.balanceRulesVersion>=4)report.eventSnapshot=api.eventBattleSnapshot(run);
    if(!won&&run.morale<=0)report.legendEarned=finishRun(game);
    return report;
  }
  function continueRun(game,choice){
    const run=game.run;if(!run||run.randomEvent||!run.lastBattle||run.ended)return false;
    if(!['next','retry','finish'].includes(choice)||(!run.lastBattle.won&&choice!=='retry')||(run.lastBattle.won&&choice==='retry'))return false;
    if(choice==='finish'&&run.stage!==10)return false;
    if(api.maybeTriggerEvent(game,choice))return true;
    return advanceAfterBattle(game,choice);
  }
  function advanceAfterBattle(game,choice){
    const run=game.run;if(!run||!run.lastBattle)return false;
    if(run.ended)return false;
    if(!run.lastBattle.won){if(hasRandomSkills(run))run.skillFreeRefreshStage=0;playerEconomy.reset(run);run.lastBattle=null;if(run.balanceRulesVersion>=10)makePlayerShopOffers(run);return true}
    if(run.stage===10&&choice==='finish'){run.lastBattle.legendEarned=finishRun(game);return true}
    if(run.stage===10)run.endless=true;
    const bonds=activeSynergies(run),opening=openingEffect(run);
    const bondFree=Math.min(2,bonds.reduce((sum,item)=>sum+(item.effect?.freeRecruit||0),0));
    const bondCash=Math.min(5,bonds.reduce((sum,item)=>sum+(item.effect?.stageCash||0),0));
    run.stage++;run.free=1+bondFree+(opening.freePerStage||0);
    run.cash=Math.max(0,run.cash+bondCash+(opening.stageCash||0)+(run.balanceRulesVersion>=12?(run.lastBattle.playerStageCash||0):0));
    playerEconomy.reset(run);
    run.gearRefreshFree=opening.freeGearRefresh||0;
    run.refreshFree=1;run.rewardedRecruitUsed=false;run.offer=[];run.offerOdds=null;run.shopRefreshes=0;run.gearRefreshes=0;run.gearPaidRefreshes=0;makeShopOffers(run);run.lastBattle=null;
    return true;
  }
  const api={LEGENDARY_PLAYER_UNLOCK_PRICE,LEGENDARY_PLAYERS,playerAvailable,unlockLegendaryPlayer,catalogForRun,resolveTalentEffect,recruitRefreshCost,BALANCE_RULES_VERSION,MORALE_HARD_CAP,ATTRS,LABELS,COMBAT_LABELS,SLOTS,STRATEGIES,SIGNATURE_MOVES,signatureMoves,TALENTS,KNOWN_TALENTS,availableTalents,talentUnlocked,migrateTalentUnlocks,benchExpansionLimit,openingEffect,talentForRun,STARS,BY_ID,FOES,SYNERGIES,BOOSTS,GEAR,GEAR_LIMIT,JERSEY_COLLECTION_SCALE,JERSEY_EQUIPPED_BONUS,JERSEY_UNLOCK_PRICE,LEGENDARY_GEAR_UNLOCK_PRICE,META_UPGRADES,META_UNLOCKS,createGame,createRun,synergiesForRun,combatBonus,tierOdds,recruitProbabilitySummary,makeOffer,makeTenOffer,toggleRecruitBatchSelection,grantRewardedSOffer,recruit,confirmRecruitBatch,advanceRecruitBatch,recruitCost,recruitPackCost,buyRecruitPack,resolvePending,swapBench,swapPositions,saleValue,sellBench,starterCount,ownedCount,starLimit,identityOf,starSynergies,activeSynergies,playerScore,playerEffectiveStats,incomeBreakdown,fused,opponent,trainingLimit,trainingCost,train,boostPrice,boostPurchaseLimit,gearPrice,gearRarityWeights,gearAvailable,makeShopOffers,ensureShop,shopRefreshCost,refreshShop,PLAYER_SHOP_PRICES,PLAYER_SHOP_REFRESH_COST,playerShopUnlocked,makePlayerShopOffers,ensurePlayerShop,playerShopPrice,refreshPlayerShop,buyShopPlayer,buyBoost,buyGear,gearReserveCount,gearReserveLimit,gearStorageFull,replaceGear,equipGear,gearMultiplier,sellGear,expandBench,refreshOffer,battle,continueRun,finishRun,recoverBondMorale,reviveRun,goatPhases,goatScore,clearedMainStage,legendPoints,legendPointBreakdown,buyMetaUpgrade,buyMetaUnlock,unlockJersey,unlockLegendaryGear,recoverGearMorale,preventGearDefeat,clamp};
  for(const key of ['STARS','BY_ID','SYNERGIES'])Object.defineProperty(api,key,{enumerable:true,get:()=>({STARS,BY_ID,SYNERGIES})[key]});
  const ECONOMY_SYSTEM=root.SupFusionPlayerEconomy||(typeof require==='function'?require('./player-economy.js'):null);
  if(!ECONOMY_SYSTEM)throw new Error('SupFusionPlayerEconomy is required before game-core.js');
  const playerEconomy=ECONOMY_SYSTEM.createSystem(api);api.restorePlayerEconomy=playerEconomy.restore;
  const EVENT_SYSTEM=root.SupFusionEventSystem||(typeof require==='function'?require('./event-system.js'):null);
  Object.assign(api,{RANDOM_SKILLS,SKILL_BY_ID,SKILL_REFRESH_COSTS,randomSkillsForRun,randomSkillForRun,hasRandomSkills,getRoleSkills,activeRandomSkills,randomSkillEffects,refreshRandomSkill,enterSkillAdPick,confirmSkillAdPick,cancelSkillAdPick,restoreRandomSkills});
  if(!EVENT_SYSTEM)throw new Error('SupFusionEventSystem is required before game-core.js');
  Object.assign(api,EVENT_SYSTEM.createSystem(Object.assign(Object.create(api),{nextRandom,advanceAfterBattle})));
  for(const name of ['makeOffer','ensureShop','buyRecruitPack','grantRewardedSOffer','recruit','confirmRecruitBatch','advanceRecruitBatch','resolvePending','swapPositions','swapBench','sellBench','equipGear','expandBench','train','buyBoost','buyGear','replaceGear','sellGear','refreshShop','refreshOffer','refreshRandomSkill','enterSkillAdPick']){
    const original=api[name];api[name]=function(run,...args){return run?.randomEvent||run?.skillAdPick?false:original(run,...args)};
  }
  // Old rules must use their original roster during every operation, including events.
  for(const name of Object.keys(api))if(typeof api[name]==='function'&&name!=='catalogForRun'){
    const original=api[name];api[name]=function(...args){
      const run=name==='createRun'?{balanceRulesVersion:args[3]??BALANCE_RULES_VERSION}:args.map(arg=>arg?.run||arg).find(arg=>arg&&typeof arg==='object'&&(arg.slots&&arg.owned||Object.hasOwn(arg,'balanceRulesVersion')||Object.hasOwn(arg,'stage')));
      return withCatalog(run,()=>original(...args));
    };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SupFusionGameCore=api;
})(typeof window!=='undefined'?window:globalThis);
