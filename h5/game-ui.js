/* 《我的球星融合系统》第二版界面：保留已确认的深色卡片风格。 */
(function () {
  'use strict';
  const C=Object.create(window.SupFusionGameCore);
  const STORAGE=window.FusionStorage;
  const els=Object.fromEntries(['home','leaderboard','talent','recruit','roster','shop','duel','result','report','profile','pointshop'].map(id=>[id,document.getElementById(id)]));
  const batchActionRoot=document.getElementById('batch-action-root');
  let game=C.createGame(),screen='home',restoring=true,talentOffer=[],selectedTalent='',selectedOffer='',selectedPlace=null,showBonds=false,showStrategyPicker=false,showExpandConfirm=false,showNewJourneyConfirm=false,showTalentCatalog=false,showCurrentTalent=false,showRecruitSheet=false,recruitSheetMessage='',rewardVideoBusy=false,rewardTaskState=null,rewardTaskError='',reportReviveBusy=false,reportReviveMessage='',posterPhase='idle',posterMessage='',posterBlob=null,posterPreviewUrl='',showPosterPreview=false,detailStar='',detailContext=null,gearDetailId='',gearReplaceId='',strategy='collapse',shopTab='boost',shopSlideFrom='boost',rosterTraining=false,pointShopTab='upgrades',pointShopSlideFrom='upgrades',profileTier='all',profileTab='stars',profileSlideFrom='stars',batchRevealPending=false,lastJerseyUnlock='',playerName='玩家',playerNameNotice='',playerInfoChecked=false,playerInfoRequest=null,saveQueue=Promise.resolve();
  let sellConfirm=null,talentAdBusy=false,talentAdUnlocked=false,talentAdMessage='',leaderboardTab='legend',cloudStartBusy=false,cloudQueue=Promise.resolve();
  let leaderboardBoards={legend:[],ovr:[]},leaderboardStatus={legend:'正在加载榜单…',ovr:'正在加载榜单…'},leaderboardMine={legend:null,ovr:null};
  const cloudBattleRequests=new WeakMap();
  let leaderboardLoadRequest=null,leaderboardRefreshRequest=null,leaderboardBusy=false,leaderboardTimer=null;
  let pointShopMessage='',jerseyUnlockResult='';
  let showFeedback=false,feedbackDraft='',feedbackBusy=false,feedbackMessage='';
  const recordedActions=['makeOffer','ensureShop','buyRecruitPack','grantRewardedSOffer','recruit','confirmRecruitBatch','advanceRecruitBatch','resolvePending','swapPositions','sellBench','equipGear','expandBench','train','buyBoost','buyGear','replaceGear','sellGear','refreshShop','refreshOffer','continueRun'];
  for(const name of recordedActions){
    const original=C[name];
    C[name]=function(first,...args){
      const run=name==='continueRun'?first?.run:first;
      const tracking=run===game.run&&run?.cloudProofVersion===3;
      const before=tracking?JSON.stringify(run):'';
      const result=original(first,...args);
      if(tracking&&before!==JSON.stringify(run)){
        (run.cloudOperations||=[]).push({action:name,args:JSON.parse(JSON.stringify(args))});
      }
      return result;
    };
  }
  function withTimeout(promise,ms=15000){
    let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('请求超时，请稍后重试。')),ms)})]).finally(()=>clearTimeout(timer));
  }
  // 色值取自所附队徽的外圈与主要描边；渐变的每一侧仍是同样的边框宽度。
  const TEAM_LOGO_EDGES={atl:['#c8102e','#c8102e'],bkn:['#f5f5f5','#111111'],bos:['#008348','#111111'],cha:['#17176d','#1697cc'],chi:['#ed1c24','#111111'],cle:['#860038','#ffb81c'],dal:['#005da8','#09254b'],den:['#8b3438','#ffbf29'],det:['#0b4da2','#d90846'],gsw:['#1d428a','#ffc72c'],hou:['#002e62','#c62426'],ind:['#082454','#f7cf47'],lac:['#c00000','#002e5e'],lal:['#552583','#fdb927'],mem:['#5d76ae','#f5b324'],mia:['#98002e','#111111'],mil:['#214b39','#e3d6ae'],min:['#0c2340','#9db8ca'],nop:['#e31837','#0b2856'],ny:['#f16621','#16439a'],okc:['#377db9','#f36b4a'],orl:['#2554a4','#111111'],phi:['#1761ad','#ed1b52'],phx:['#111111','#f9a01b'],por:['#bb2337','#111111'],sac:['#4d167e','#65737b'],sas:['#101820','#c4ced4'],tor:['#ce0e2d','#8c8c8c'],utah:['#ffbb38','#315f41'],wsh:['#d50032','#13294b']};
  const LEGACY_GEAR_MAP={master_playbook:'team_jersey',ring:'dynasty_ring',vision_ring:'finals_ring',goat_ring:'dynasty_ring',qimin_jersey:'armor_jersey',kobe_shoes:'footwork_shoes',jordan_shoes:'footwork_shoes',vince_shoes:'paint_shoes',carter_band:'balance_band',duncan_band:'lockdown_band',durant_band:'taiping_playbook',power_sleeve:'team_jersey',nash_band:'team_jersey',kidd_band:'matchup_board',quick_read_band:'lockdown_band',sleeve:'wrist',transition_shoes:'paint_shoes',hustle_ring:'rookie_ring',paint_board:'spacing_board'};
  const tierName={SSR:'SSR',S:'S',A:'A',B:'B',C:'C'};
  const tierClass={SSR:'tier-legend',S:'tier-s',A:'tier-a',B:'tier-b',C:'tier-c'};
  const attrOrder=['three','mid','drive','handle','inside','def'];
  const combatOrder=['shooting','creation','finishing','perimeterStop','rimStop'];
  const barColor={three:'bar-orange',mid:'bar-gold',drive:'bar-red',handle:'bar-blue',inside:'bar-orange',def:'bar-gold'};
  const $=id=>document.getElementById(id);
  function renderMarkup(element,html){
    if(!window.SupFusionReactScreens?.renderMarkup)throw new Error('React screen renderer is unavailable');
    window.SupFusionReactScreens.renderMarkup(element,String(html));
  }
  function adoptReactRenderer(element){
    if(!element||!window.SupFusionReactScreens?.renderMarkup)return;
    Object.defineProperty(element,'markup',{configurable:true,set(html){renderMarkup(element,html)}});
  }
  Object.values(els).forEach(adoptReactRenderer);
  adoptReactRenderer(batchActionRoot);
  function notify(){/* 所有状态变化直接反映在对应页面，不显示浮动提示框。 */}
  function loadPlayerName(){
    const getUserInfo=window.ColorboxAI?.auth?.getUserInfo;
    if(playerInfoChecked||playerInfoRequest||typeof getUserInfo!=='function')return;
    playerInfoRequest=Promise.resolve().then(()=>getUserInfo.call(window.ColorboxAI.auth)).then(response=>{
      playerInfoChecked=true;
      if(response?.code===200){
        const nickname=response.data?.islogin===1?response.data.nickname:null;
        playerName=typeof nickname==='string'&&nickname.trim()?nickname.trim().slice(0,30):'玩家';
      }else playerNameNotice=response?.message||'玩家信息暂时无法读取，已显示“玩家”。';
    }).catch(()=>{playerInfoChecked=true;playerNameNotice='玩家信息暂时无法读取，已显示“玩家”。'}).finally(()=>{
      playerInfoRequest=null;
      if(screen==='home')renderHome();
      if(screen==='result')renderResult();
      if(screen==='leaderboard')renderLeaderboard();
    });
  }
  function save(){
    if(!STORAGE.available())return;
    const snapshot=JSON.parse(JSON.stringify(game));
    snapshot.savedAt=Date.now();
    saveQueue=STORAGE.save(snapshot).catch(()=>notify('存档写入失败，请稍后重试'));
  }
  function safeNumber(value,min,max,fallback){
    return typeof value==='number'&&Number.isFinite(value)?C.clamp(Math.round(value),min,max):fallback;
  }
  function safeProbability(value,fallback){
    return typeof value==='number'&&Number.isFinite(value)?C.clamp(value,0,100):fallback;
  }
  function knownPlayer(id){return typeof id==='string'&&Object.hasOwn(C.BY_ID,id)}
  function requestId(){return window.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,ch=>{const n=Math.floor(Math.random()*16);return (ch==='x'?n:(n&3)|8).toString(16)})}
  function localSeed(){const values=new Uint32Array(1);if(window.crypto?.getRandomValues){window.crypto.getRandomValues(values);return values[0]}return Math.floor(Math.random()*4294967296)}
  function cloudEnabled(){return !!(window.ACTIVITY_API_BASE&&window.ACTIVITY_ENV_ID&&typeof window.ColorboxAI?.cloud?.request==='function')}
  function pendingCloudCount(){return [...new Set([...(game.pendingCloudRuns||[]),game.run].filter(Boolean))].filter(run=>run.cloudStartPending||run.cloudOutbox?.length).length}
  function escapeText(value){
    return String(value).replace(/[&<>"']/g,ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }
  function restoreGame(raw,depth=0){
    const restored=C.createGame();
    if(!raw||raw.version!==1||typeof raw.profile!=='object'||!raw.profile)return restored;
    const profile=raw.profile;
    restored.profile={
      runs:safeNumber(profile.runs,0,100000,0),
      wins:safeNumber(profile.wins,0,1000000,0),
      clears:safeNumber(profile.clears,0,100000,0),
      bestStage:safeNumber(profile.bestStage,0,10,0),
      highestStage:safeNumber(profile.highestStage,0,100000,profile.bestEndless||profile.bestStage||0),
      bestEndless:safeNumber(profile.bestEndless,0,100000,0),
      bestGoat:safeNumber(profile.bestGoat,0,Number.MAX_SAFE_INTEGER,0),
      bestOvr:safeNumber(profile.bestOvr,0,Number.MAX_SAFE_INTEGER,0),
      legend:safeNumber(profile.legend,0,10000000,0),
      discovered:Array.isArray(profile.discovered)?[...new Set(profile.discovered.filter(knownPlayer))]:[],
      jerseys:Array.isArray(profile.jerseys)?[...new Set(profile.jerseys.filter(id=>C.GEAR.some(item=>item.id===id&&item.slot==='球衣')))]:[],
      jerseyUnlocks:Array.isArray(profile.jerseyUnlocks)?[...new Set(profile.jerseyUnlocks.filter(id=>C.GEAR.some(item=>item.id===id&&item.unlockable)))]:[],
      upgrades:Object.fromEntries(C.META_UPGRADES.map(item=>[item.id,safeNumber(profile.upgrades?.[item.id],0,item.prices.length,0)])),
      metaUnlocks:{talents:Array.isArray(profile.metaUnlocks?.talents)?[...new Set(profile.metaUnlocks.talents.filter(id=>C.TALENTS.some(item=>item.id===id)))]:[],gear:Array.isArray(profile.metaUnlocks?.gear)?[...new Set(profile.metaUnlocks.gear.filter(id=>C.GEAR.some(item=>item.id===id)))]:[],players:Array.isArray(profile.metaUnlocks?.players)?[...new Set(profile.metaUnlocks.players.filter(knownPlayer))]:[]}
    };
    // Release an old reserved purchase when switching to immediate local unlocks.
    if(profile.cloudJerseyReserved===true&&typeof profile.cloudJerseyPurchaseId==='string'&&/^[0-9a-f-]{36}$/i.test(profile.cloudJerseyPurchaseId))restored.profile.legend+=C.JERSEY_UNLOCK_PRICE;
    restored.profile.talentRulesVersion=profile.talentRulesVersion;
    restored.pendingCloudRuns=Array.isArray(raw.pendingCloudRuns)&&depth===0?raw.pendingCloudRuns.map(run=>restoreGame({version:1,profile:restored.profile,run},1).run).filter(Boolean):[];
    C.migrateTalentUnlocks(restored.profile);
    const source=raw.run;
    if(!source||typeof source!=='object'||!C.KNOWN_TALENTS.some(t=>t.id===source.talent))return restored;
    const seed=safeNumber(source.seed,0,4294967295,1);
    const run=C.createRun(source.talent,seed,{...restored.profile.upgrades,jerseyUnlocks:restored.profile.jerseyUnlocks});
    run.cloudRunId=typeof source.cloudRunId==='string'&&/^[0-9a-f-]{36}$/i.test(source.cloudRunId)?source.cloudRunId:'';
    run.cloudRankError=typeof source.cloudRankError==='string'&&source.cloudRankError!=='本局未连接云端，不计入排行榜。'?source.cloudRankError.slice(0,120):'';
    run.cloudFinished=source.cloudFinished===true;
    run.cloudResumePending=source.cloudResumePending===true;
    run.cloudSharePending=source.cloudSharePending===true;
    run.cloudProofVersion=source.cloudProofVersion===3?3:0;
    run.cloudSequence=safeNumber(source.cloudSequence,0,1000000,0);
    run.cloudOperations=Array.isArray(source.cloudOperations)?source.cloudOperations.filter(item=>item&&recordedActions.includes(item.action)&&Array.isArray(item.args)).slice(0,1500):[];
    run.cloudOutbox=Array.isArray(source.cloudOutbox)?source.cloudOutbox.filter(event=>event&&['battle','finish','resume','share'].includes(event.type)&&Array.isArray(event.operations)):[];
    run.cloudStartPending=source.cloudStartPending&&typeof source.cloudStartPending.requestId==='string'?source.cloudStartPending:null;
    run.cloudFinalizationQueued=source.cloudFinalizationQueued===true;
    if(run.cloudRunId&&run.cloudProofVersion!==3){run.cloudRunId='';run.cloudRankError='旧存档可继续游戏；重新开局后提交验证成绩。'}
    if(depth===0&&source.cloudPendingBattle?.run){
      const pending=source.cloudPendingBattle,prior=restoreGame({version:1,profile:restored.profile,run:pending.run},1).run;
      if(prior&&!prior.lastBattle&&!prior.ended&&Object.hasOwn(C.STRATEGIES,pending.strategy))run.cloudPendingBattle={run:prior,strategy:pending.strategy};
    }
    run.rng=safeNumber(source.rng,0,4294967295,run.rng);
    run.stage=safeNumber(source.stage,1,100000,1);
    run.endless=source.endless===true;
    run.rarityBonus=safeNumber(source.rarityBonus,0,5,run.rarityBonus);
    run.metaInterestCap=safeNumber(source.metaInterestCap,0,5,run.metaInterestCap);
    run.metaTrainingBoost=safeNumber(source.metaTrainingBoost,0,3,run.metaTrainingBoost);
    run.metaPolicyOffers=safeNumber(source.metaPolicyOffers,0,1,run.metaPolicyOffers);
    run.metaFilmStudy=safeNumber(source.metaFilmStudy,0,3,run.metaFilmStudy);
    run.gearLimit=C.GEAR_LIMIT;
    run.maxGoat=safeNumber(source.maxGoat,0,Number.MAX_SAFE_INTEGER,0);
    run.maxOvr=safeNumber(source.maxOvr,0,Number.MAX_SAFE_INTEGER,safeNumber(source.lastBattle?.rating,0,Number.MAX_SAFE_INTEGER,0));
    run.endlessWins=safeNumber(source.endlessWins,0,100000,Math.max(0,run.stage-11+(source.lastBattle?.won?1:0)));
    run.collectedPlayers=Array.isArray(source.collectedPlayers)?[...new Set(source.collectedPlayers.filter(knownPlayer))]:Object.keys(source.owned||{}).filter(knownPlayer);
    const savedCollectedJerseys=Array.isArray(source.collectedJerseys)?source.collectedJerseys:[...(source.gear||[]),...(source.gearReserve||[])];
    run.collectedJerseys=[...new Set(savedCollectedJerseys.map(id=>LEGACY_GEAR_MAP[id]||id).filter(id=>C.GEAR.some(item=>item.id===id&&item.slot==='球衣')))];
    run.recruitGroups=safeNumber(source.recruitGroups,0,100000,run.recruitGroups);
    run.noAPlusGroups=safeNumber(source.noAPlusGroups,0,3,run.noAPlusGroups);
    run.noSPlusGroups=safeNumber(source.noSPlusGroups,0,11,run.noSPlusGroups);
    run.openingAPlusGroups=safeNumber(source.openingAPlusGroups,0,6,run.openingAPlusGroups);
    run.forceRareRecruit=source.forceRareRecruit===true;
    run.morale=safeNumber(source.morale,0,source.talent==='captain'?13:3,3);
    run.talentWinHealGranted=safeNumber(source.talentWinHealGranted,0,10,Math.min(10,Math.floor((source.wins||0)/2)));
    run.cash=safeNumber(source.cash,0,1000000,16);
    run.free=safeNumber(source.free,0,1000,0);
    run.recruitCredits=safeNumber(source.recruitCredits,0,1000,0);
    run.rewardedRecruitUsed=source.rewardedRecruitUsed===true;
    run.refreshFree=safeNumber(source.refreshFree,0,1,0);
    run.benchLimit=safeNumber(source.benchLimit,Math.min(6,run.benchLimit),11+Math.max(0,C.openingEffect(run).benchDelta||0),run.benchLimit);
    run.wins=safeNumber(source.wins,0,100000,0);
    run.losses=safeNumber(source.losses,0,100000,0);
    run.stats={recruits:safeNumber(source.stats?.recruits,0,100000,0),prizeIncome:safeNumber(source.stats?.prizeIncome,0,10000000,0),gearPurchases:safeNumber(source.stats?.gearPurchases,0,100000,0)};
    run.reviveUsed=source.reviveUsed===true;
    run.posterRewarded=source.posterRewarded===true;
    run.owned=Object.create(null);
    if(source.owned&&typeof source.owned==='object'){
      for(const [id,own] of Object.entries(source.owned)){
        if(!knownPlayer(id)||!own||typeof own!=='object')continue;
        const star=C.BY_ID[id];
        run.owned[id]={
          stars:safeNumber(own.stars,1,C.starLimit(run,id),1),
          train:safeNumber(own.train,0,Math.min(run.stage,C.trainingLimit(run,id)),0),
          trainedAt:safeNumber(own.trainedAt,0,run.stage,0)
        };
      }
    }
    const used=new Set();
    for(const slot of C.SLOTS){
      const id=source.slots?.[slot.id]??(slot.id==='inside'?source.slots?.post:null);
      run.slots[slot.id]=knownPlayer(id)&&run.owned[id]&&!used.has(id)?id:null;
      if(run.slots[slot.id])used.add(id);
    }
    run.bench=[];
    if(Array.isArray(source.bench)){
      for(const id of source.bench){
        if(run.bench.length>=run.benchLimit)break;
        if(knownPlayer(id)&&run.owned[id]&&!used.has(id)){run.bench.push(id);used.add(id)}
      }
    }
    for(const id of Object.keys(run.owned))if(!used.has(id))delete run.owned[id];
    const savedOfferMode=source.offerMode==='ten-batch'?'ten-batch':source.offerMode==='rewarded-s'?'rewarded-s':'normal';
    run.offer=Array.isArray(source.offer)?source.offer.filter(knownPlayer).slice(0,savedOfferMode==='ten-batch'?10:4):[];
    run.offerMode=run.offer.length&&(savedOfferMode!=='ten-batch'||run.offer.length===10)?savedOfferMode:'normal';
    run.batchSelected=run.offerMode==='ten-batch'?run.offer.map((_,index)=>source.batchSelected?.[index]!==false):[];
    run.batchQueue=Array.isArray(source.batchQueue)?source.batchQueue.filter(knownPlayer).slice(0,10):[];
    const currentOdds=C.recruitProbabilitySummary(run),savedOdds=source.offerOdds;
    run.offerOdds=run.offer.length&&savedOdds&&typeof savedOdds==='object'?{
      C:safeProbability(savedOdds.C,currentOdds.C),B:safeProbability(savedOdds.B,currentOdds.B),A:safeProbability(savedOdds.A,currentOdds.A),S:safeProbability(savedOdds.S,currentOdds.S),SSR:safeProbability(savedOdds.SSR,currentOdds.SSR),
      sGroup:safeProbability(savedOdds.sGroup,currentOdds.sGroup),ssrGroup:safeProbability(savedOdds.ssrGroup,currentOdds.ssrGroup),
      aPityIn:safeNumber(savedOdds.aPityIn,0,4,currentOdds.aPityIn),sPityIn:safeNumber(savedOdds.sPityIn,0,12,currentOdds.sPityIn)
    }:run.offer.length?currentOdds:null;
    run.pending=knownPlayer(source.pending)&&!run.owned[source.pending]?source.pending:null;
    run.boosts=Array.isArray(source.boosts)?source.boosts.filter(id=>C.BOOSTS.some(b=>b.id===id)).slice(0,200):[];
    const migrateGear=id=>LEGACY_GEAR_MAP[id]||id;
    const savedGear=Array.isArray(source.gear)?[...new Set(source.gear)].map(migrateGear).filter(id=>C.GEAR.some(g=>g.id===id)):[];
    const savedReserve=Array.isArray(source.gearReserve)?[...new Set(source.gearReserve)].map(migrateGear).filter(id=>C.GEAR.some(g=>g.id===id)):[];
    run.gear=[];run.gearReserve=[];
    const occupiedGearSlots=new Set();
    for(const id of savedGear){
      const item=C.GEAR.find(gear=>gear.id===id);
      if(occupiedGearSlots.has(item.slot)||run.gear.length>=run.gearLimit){if(item.slot==='球衣')run.gearReserve.push(id);else run.cash+=item.sellPrice;continue}
      occupiedGearSlots.add(item.slot);run.gear.push(id);
    }
    for(const id of savedReserve)if(!savedGear.includes(id)&&!run.gear.includes(id)&&!run.gearReserve.includes(id)){
      const item=C.GEAR.find(gear=>gear.id===id);
      if(item.slot==='球衣')run.gearReserve.push(id);else if(!occupiedGearSlots.has(item.slot)){run.gear.push(id);occupiedGearSlots.add(item.slot)}else run.cash+=item.sellPrice;
    }
    run.shopRefreshes=safeNumber(source.shopRefreshes,0,100,0);
    run.gearRefreshes=safeNumber(source.gearRefreshes,0,100,0);
    run.gearRefreshFree=safeNumber(source.gearRefreshFree,0,1,run.gearRefreshFree);
    const offeredGearSlots=new Set();
    run.shopOffers={
      boost:Array.isArray(source.shopOffers?.boost)?[...new Set(source.shopOffers.boost.filter(id=>C.BOOSTS.some(item=>item.id===id)))].slice(0,4):[],
      gear:Array.isArray(source.shopOffers?.gear)?[...new Set(source.shopOffers.gear.filter(id=>C.GEAR.some(item=>item.id===id)))].filter(id=>C.gearAvailable(run,C.GEAR.find(item=>item.id===id))).filter(id=>{const slot=C.GEAR.find(item=>item.id===id).slot;if(offeredGearSlots.has(slot))return false;offeredGearSlots.add(slot);return true}).slice(0,3):[]
    };
    run.boostBoughtOffers=Array.isArray(source.boostBoughtOffers)?[...new Set(source.boostBoughtOffers.filter(id=>run.shopOffers.boost.includes(id)))]:run.shopOffers.boost.filter(id=>run.boosts.includes(id));
    run.gearSoldOffers=Array.isArray(source.gearSoldOffers)?[...new Set(source.gearSoldOffers.filter(id=>run.shopOffers.gear.includes(id)))]:[];
    for(const id of run.shopOffers.gear)if([...run.gear,...run.gearReserve].includes(id)&&!run.gearSoldOffers.includes(id))run.gearSoldOffers.push(id);
    C.ensureShop(run);
    run.ended=source.ended===true||run.morale===0;
    run.awarded=source.awarded===true;
    if(run.awarded&&source.settlement&&typeof source.settlement==='object')run.settlement={points:safeNumber(source.settlement.points,0,100000,0),wins:safeNumber(source.settlement.wins,0,100000,run.wins),clearAward:safeNumber(source.settlement.clearAward,0,1,0)};
    else if(run.awarded)run.settlement={points:C.legendPoints(run),wins:run.wins,clearAward:C.clearedMainStage(run)>=10?1:0};
    const report=source.lastBattle;
    if(report&&typeof report==='object'){
      const foeId=knownPlayer(report.foe)?report.foe:C.opponent(run).id;
      const foe=C.BY_ID[foeId];
      const style=Object.hasOwn(C.STRATEGIES,report.strategy)?report.strategy:'collapse';
      run.lastBattle={
        stage:safeNumber(report.stage,1,100000,run.stage),
        won:report.won===true,
        us:safeNumber(report.us,0,100,0),
        them:safeNumber(report.them,0,100,0),
        reward:safeNumber(report.reward,0,1000,0),
        detail:['已恢复赛后奖金记录'],
        log:Array.isArray(report.log)?report.log.slice(-7).map(line=>String(line).slice(0,120)):[],
        strategy:style,
        foe:foeId,
        foeName:foe.name,
        foeStars:safeNumber(report.foeStars,1,5,1),
        foeStrategy:C.opponent(run).strategy,
        beats:safeNumber(report.beats,-1,1,0),
        rating:safeNumber(report.rating,0,Number.MAX_SAFE_INTEGER,0),
        foeRating:safeNumber(report.foeRating,0,Number.MAX_SAFE_INTEGER,0),
        goat:safeNumber(report.goat,0,Number.MAX_SAFE_INTEGER,0),
        goatPhases:report.goatPhases&&typeof report.goatPhases==='object'?report.goatPhases:null,
        signatures:Array.isArray(report.signatures)?report.signatures.filter(move=>C.SIGNATURE_MOVES.some(item=>item.id===move.id)).map(move=>{const item=C.SIGNATURE_MOVES.find(entry=>entry.id===move.id);return {id:item.id,name:item.name,kind:item.kind,uses:safeNumber(move.uses,0,2,0)}}):[],
        legendEarned:safeNumber(report.legendEarned,0,100000,0)
      };
    }
    restored.run=run;
    return restored;
  }
  function top(){
    const r=game.run;
    const header=document.querySelector('.top');
    const currentTalent=C.KNOWN_TALENTS.find(item=>item.id===r?.talent);
    const back=screen==='roster'?['current-talent-open',`当前天赋：${currentTalent?.name||'未选择'}`]:
      screen==='talent'?['home','返回首页']:
      ['recruit','shop','duel'].includes(screen)?['roster','返回阵容']:
      screen==='result'?['roster','返回阵容']:['home','返回首页'];
    const forcedOpening=screen==='talent'||screen==='recruit'&&r&&C.starterCount(r)<6;
    const hideBack=forcedOpening||screen==='recruit'||screen==='result'||screen==='report';
    const liveGoat=r&&!r.ended?Math.max(r.maxGoat||0,C.goatScore(r)):0;
    const morale=Math.max(0,Math.min(r?.talent==='captain'?13:3,Number(r?.morale)||0));
    if(window.SupFusionReactScreens?.renderTopBar){
      window.SupFusionReactScreens.renderTopBar(header,{hasRun:!!(r&&!r.ended),hideBack,backAction:back[0],backLabel:back[1],liveGoat,moraleMax:3,stageLabel:r?.endless?r.stage:`${r?.stage||1}/10`,morale});
      return;
    }
    const backButton=(action,label)=>{
      const button=document.createElement('button');
      const talentAction=action==='current-talent-open';
      button.className=`top-back${talentAction?' top-talent':''}`;button.dataset.act=action;button.textContent=talentAction?label:`← ${label}`;
      return button;
    };
    const metric=(label,value,className='')=>{
      const wrap=document.createElement('span');if(className)wrap.className=className;
      const small=document.createElement('small');small.textContent=label;
      const strong=document.createElement('b');strong.textContent=String(value);
      wrap.append(small,strong);return wrap;
    };
    header.replaceChildren();
    if(r&&!r.ended){
      if(!hideBack)header.appendChild(backButton(back[0],back[1]));
      const status=document.createElement('div');status.className='top-status';
      status.append(metric('GOAT',liveGoat,'top-goat'),metric('关卡',r.endless?r.stage:`${r.stage}/10`));
      const life=document.createElement('span');life.className='top-life';
      const heart=document.createElement('span');heart.className='life-heart-fallback';heart.textContent='♥';life.append(heart);
      const moraleText=document.createElement('b');moraleText.textContent=`${Math.min(3,morale)}/3${morale>3?` +${morale-3}`:''}`;life.appendChild(moraleText);
      status.appendChild(life);header.appendChild(status);
    }else if(!hideBack)header.appendChild(backButton('home','返回首页'));
  }
  function go(id){
    if(id!=='leaderboard')clearLeaderboardTimer();
    if(id!=='report'&&showPosterPreview)resetCareerPoster();
    if(id!=='roster')sellConfirm=null;
    if(id!=='roster'){showBonds=false;selectedPlace=null}
    if(id!=='roster')showExpandConfirm=false;
    if(id!=='roster')rosterTraining=false;
    if(id!=='roster'){showRecruitSheet=false;recruitSheetMessage=''}
    if(id!=='duel')showStrategyPicker=false;
    if(id!=='talent')showTalentCatalog=false;
    showCurrentTalent=false;
    if(id!=='shop'){gearDetailId='';gearReplaceId=''}
    if(id!=='recruit'){detailStar='';detailContext=null}
    if(id!=='recruit'&&batchActionRoot){batchActionRoot.markup='';batchActionRoot.hidden=true}
    screen=id;
    Object.keys(els).forEach(key=>els[key].classList.toggle('active',key===id));
    document.querySelector('.app').classList.toggle('home-mode',id==='home');
    document.querySelector('.app').classList.toggle('profile-mode',id==='profile');
    document.querySelector('.app').classList.toggle('pointshop-mode',id==='pointshop');
    document.querySelector('.app').classList.toggle('leaderboard-mode',id==='leaderboard');
    document.querySelector('.app').classList.toggle('report-mode',id==='report');
    document.querySelector('.app').classList.toggle('opening-mode',id==='talent'||id==='recruit'&&!!game.run&&C.starterCount(game.run)<6);
    render();
    top();
    syncScrollViewport();
    els[id]?.scrollTo({top:0,behavior:'auto'});
  }
  function syncScrollViewport(){
    els.roster?.style.removeProperty('--fixed-dock-height');
    for(const [name,selector] of [['recruit','.floatingaction'],['duel','.floatingaction']]){
      const panel=els[name],dock=name==='recruit'&&!batchActionRoot?.hidden?batchActionRoot:panel?.querySelector(selector);
      if(panel&&dock)panel.style.setProperty('--fixed-dock-height',`${Math.ceil(dock.getBoundingClientRect().height)}px`);
    }
  }
  window.addEventListener('resize',syncScrollViewport);
  function render(){({home:renderHome,leaderboard:renderLeaderboard,talent:renderTalent,recruit:renderRecruit,roster:renderRoster,shop:renderShop,duel:renderDuel,result:renderResult,report:renderCareerReport,profile:renderProfile,pointshop:renderPointShop}[screen]||renderHome)();renderPending()}
  function runOrHome(){if(!game.run||game.run.ended){go('home');return null}return game.run}
  function renderHome(){
    const r=game.run,active=r&&!r.ended;
    if(window.SupFusionReactScreens?.renderHome){
      window.SupFusionReactScreens.renderHome(els.home,{active,stage:r?.stage||1});
      return;
    }
    els.home.markup=`
      <section class="home-hero"><div class="home-orbit" aria-hidden="true"><span>11</span></div><div class="home-eyebrow">BUILD YOUR OWN LEGEND</div>
        <h1>我的球星<br><em>融合系统</em></h1>
        <p>六位球星，一位终极单挑者。招募、融合、闯关，打出独一无二的传奇之路。</p>
        <div class="home-scores"><div><b>06</b><small>能力槽位</small></div><div><b>10</b><small>主线关卡</small></div><div><b>∞</b><small>无尽挑战</small></div></div>
      </section>
      ${active?`<button class="btn wide home-primary home-continue" data-act="continue">继续第 ${r.stage} 关 <span>→</span></button>`:''}
      <button class="btn wide home-primary home-new" data-act="new">${active?'开启另一段旅程':'开启新旅程'} <span>→</span></button><button class="home-leaderboard-entry button-7" data-act="leaderboard">排行榜 <span>→</span></button>
      <div class="home-entry-row grid grid-cols-2"><button class="home-secondary home-pointshop" data-act="pointshop">点数商店</button><button class="home-secondary home-profile" data-act="profile">传奇档案</button></div>
       <button type="button" class="home-feedback button-7" data-act="feedback-open">反馈入口</button>`;
  }
  function renderLeaderboard(){
    window.SupFusionReactScreens?.renderLeaderboard(els.leaderboard,{boards:leaderboardBoards,tab:leaderboardTab,status:leaderboardStatus,mine:leaderboardMine,playerName,busy:leaderboardBusy});
  }
  async function cloudApi(path,method='GET',data){
    const base=String(window.ACTIVITY_API_BASE||'').trim().replace(/\/$/,'');
    const envId=String(window.ACTIVITY_ENV_ID||'').trim();
    if(!base||!envId||typeof window.ColorboxAI?.cloud?.request!=='function')throw new Error('当前环境无法连接云端排行榜。');
    const response=await withTimeout(window.ColorboxAI.cloud.request({url:`${base}/api${path}`,method,data,auth:true,envId}));
    if(response?.statusCode!==200||response?.code!=null&&response.code!==0&&response.code!==200)throw Object.assign(new Error(response?.message||'排行榜服务暂时不可用。'),{status:response?.statusCode});
    return response.data;
  }
  function queueCloud(task){cloudQueue=cloudQueue.catch(()=>{}).then(task);return cloudQueue}
  function queueEvent(run,type,operations=[],strategy){
    (run.cloudOutbox||=[]).push({type,operations:JSON.parse(JSON.stringify(operations)),...(strategy?{strategy}:{})});
  }
  function archiveCloudRun(run){
    if(!run||!run.cloudStartPending&&!run.cloudOutbox?.length)return;
    const pending=game.pendingCloudRuns||=[];
    if(!pending.includes(run))pending.push(run);save();
  }
  function queueFinalization(run){
    if(!run||!run.cloudRunId&&!run.cloudStartPending)return;
    if(run.ended&&!run.cloudFinalizationQueued&&(!run.cloudFinished||run.cloudResumePending)){
      queueEvent(run,'finish',run.cloudOperations||[]);run.cloudOperations=[];run.cloudFinalizationQueued=true;
    }
    if(run.cloudSharePending&&!run.cloudOutbox?.some(event=>event.type==='share'))queueEvent(run,'share');
    save();
  }
  async function syncCloudRun(run){
    if(!run||!run.cloudRunId&&!run.cloudStartPending)return true;
    if(cloudBattleRequests.has(run))return cloudBattleRequests.get(run);
    if(run.cloudResumePending&&!run.cloudOutbox?.some(event=>event.type==='resume'))(run.cloudOutbox||=[]).unshift({type:'resume',operations:[]});
    // Convert the previous release's single pending battle without losing its replay prefix.
    if(run.cloudPendingBattle){const pending=run.cloudPendingBattle;queueEvent(run,'battle',pending.run.cloudOperations||[],pending.strategy);run.cloudOperations=(run.cloudOperations||[]).slice(pending.run.cloudOperations?.length||0);run.cloudPendingBattle=null;save()}
    const scheduledEvents=[...(run.cloudOutbox||[])];
    const task=queueCloud(async()=>{
      try{
        if(run.cloudStartPending){
          const result=await cloudApi('/runs/start','POST',run.cloudStartPending);
          if(result?.proofVersion!==3||result.seed!==run.seed||result.runId!==run.cloudStartPending.requestId)throw new Error('云端开局验证未完成，成绩已保留待同步。');
          run.cloudRunId=result.runId;run.cloudStartPending=null;save();
        }
        // Acknowledgments only remove the first immutable event; gameplay may keep appending.
        for(const event of scheduledEvents){
          if(run.cloudOutbox?.[0]!==event)throw new Error("Pending event order changed");
          const data={runId:run.cloudRunId,...(event.type==='share'?{}:{sequence:run.cloudSequence||0,operations:event.operations}),...(event.strategy?{strategy:event.strategy}:{})};
          const result=await cloudApi(`/runs/${event.type}`,'POST',data);
          if(event.type!=='share')run.cloudSequence=result?.sequence??(run.cloudSequence||0)+1;
          if(event.type==='finish')run.cloudFinished=true;
          if(event.type==='resume'){run.cloudFinished=false;run.cloudResumePending=false}
          if(event.type==='share')run.cloudSharePending=false;
          run.cloudOutbox.shift();save();
        }
        run.cloudRankError='';
        game.pendingCloudRuns=(game.pendingCloudRuns||[]).filter(item=>item!==run||item.cloudStartPending||item.cloudOutbox?.length);
        save();return true;
      }catch(error){run.cloudSyncStatus=error?.status;run.cloudRankError=`${error?.message||'成绩同步失败'} 成绩已保留，下次进入游戏会重试同步。`;save();return false}
    }).finally(()=>{cloudBattleRequests.delete(run);if(game.run===run){if(screen==='result')renderResult();if(screen==='home')renderHome()}if(screen==='leaderboard')void loadLeaderboard(true)});
    cloudBattleRequests.set(run,task);return task;
  }
  function syncSaveBackup(){
    if(STORAGE.syncToCloud)void STORAGE.syncToCloud(JSON.parse(JSON.stringify({...game,savedAt:Date.now()}))).catch(()=>{});
  }
  async function syncPendingRuns(includeActive=false){
    const runs=[...(game.pendingCloudRuns||[]),game.run].filter(Boolean);
    for(const run of [...new Set(runs)]){if(!includeActive&&!run.ended)continue;queueFinalization(run);const ok=await syncCloudRun(run);if(!ok&&[408,429,503].includes(run.cloudSyncStatus))break}
  }
  function sendCloudBattle(before,strategy,run){
    if(!run.cloudRunId&&!run.cloudStartPending)return Promise.resolve(true);
    queueEvent(run,'battle',before.cloudOperations||[],strategy);run.cloudOperations=[];run.cloudPendingBattle=null;
    queueFinalization(run);return run.ended?finishCloudRun(run):Promise.resolve(true);
  }
  function flushCloudBattle(run){return syncCloudRun(run)}
  function finishCloudRun(run){
    queueFinalization(run);syncSaveBackup();
    const existing=cloudBattleRequests.get(run);
    return existing?existing.then(ok=>ok?syncCloudRun(run):false):syncCloudRun(run);
  }
  function clearLeaderboardTimer(){
    if(leaderboardTimer!==null)clearTimeout(leaderboardTimer);
    leaderboardTimer=null;
  }
  function scheduleLeaderboardRefresh(){
    clearLeaderboardTimer();
    if(screen==='leaderboard')leaderboardTimer=setTimeout(()=>{
      leaderboardTimer=null;
      if(screen==='leaderboard')void loadLeaderboard();
    },5000);
  }
  function loadLeaderboard(force=false){
    if(leaderboardLoadRequest){
      if(force&&!leaderboardRefreshRequest)leaderboardRefreshRequest=leaderboardLoadRequest.then(()=>loadLeaderboard()).finally(()=>{leaderboardRefreshRequest=null});
      return leaderboardRefreshRequest||leaderboardLoadRequest;
    }
    clearLeaderboardTimer();leaderboardBusy=true;
    leaderboardLoadRequest=fetchLeaderboard().finally(()=>{
      leaderboardLoadRequest=null;leaderboardBusy=false;
      if(screen==='leaderboard')renderLeaderboard();
      scheduleLeaderboardRefresh();
    });
    return leaderboardLoadRequest;
  }
  async function fetchLeaderboard(){
    const base=String(window.ACTIVITY_API_BASE||'').trim().replace(/\/$/,'');
    if(!base){leaderboardBoards={legend:[],ovr:[]};leaderboardStatus={legend:'排行榜暂不可用。',ovr:'排行榜暂不可用。'};renderLeaderboard();return}
    if(typeof window.ColorboxAI?.cloud?.request!=='function'){
      leaderboardBoards={legend:[],ovr:[]};leaderboardStatus={legend:'当前环境无法读取排行榜。',ovr:'当前环境无法读取排行榜。'};renderLeaderboard();return;
    }
    const refreshId=Date.now();
    leaderboardStatus=Object.fromEntries(['legend','ovr'].map(board=>[board,leaderboardBoards[board].length?'':'正在加载榜单…']));renderLeaderboard();
    await Promise.all(['legend','ovr'].map(async board=>{
      try{
        const response=await withTimeout(window.ColorboxAI.cloud.request({url:`${base}/api/leaderboard`,method:'GET',data:{board,limit:50,refreshId}}));
        if(response?.statusCode!==200||response?.code!=null&&response.code!==0&&response.code!==200)throw new Error(response?.message||'排行榜读取失败。');
        const rows=Array.isArray(response.data)?response.data:response.data?.entries;
        if(!Array.isArray(rows))throw new Error('排行榜返回数据无效。');
        leaderboardBoards={...leaderboardBoards,[board]:rows.slice(0,50).map((row,index)=>({rank:Number.isSafeInteger(Number(row.rank))&&Number(row.rank)>0?Number(row.rank):index+1,name:String(row.displayName||row.name||'玩家').slice(0,20),score:Math.max(0,Math.floor(Number(row.score)||0)),isCurrent:row.isCurrent===true}))};
        leaderboardStatus={...leaderboardStatus,[board]:rows.length?'':'暂无成绩'};
        if(window.ACTIVITY_ENV_ID){
          try{
            const mineResponse=await withTimeout(window.ColorboxAI.cloud.request({url:`${base}/api/leaderboard/me`,method:'GET',data:{board,refreshId},auth:true,envId:window.ACTIVITY_ENV_ID}));
            if(mineResponse?.statusCode===200&&(mineResponse?.code==null||mineResponse.code===0||mineResponse.code===200)){
              const row=mineResponse.data?.entry||mineResponse.data;
              leaderboardMine={...leaderboardMine,[board]:row?.rank>0?{rank:Math.floor(row.rank),score:Math.max(0,Math.floor(Number(row.score)||0))}:null};
              leaderboardBoards={...leaderboardBoards,[board]:leaderboardBoards[board].map(entry=>({...entry,isCurrent:entry.rank===leaderboardMine[board]?.rank}))};
            }
            else leaderboardStatus={...leaderboardStatus,[board]:'个人名次暂不可用，请稍后再试。'};
          }catch(_){leaderboardStatus={...leaderboardStatus,[board]:'个人名次暂不可用，请稍后再试。'};}
        }
      }catch(_){leaderboardStatus={...leaderboardStatus,[board]:'排行榜暂不可用，请稍后再试。'}}
      if(screen==='leaderboard')renderLeaderboard();
    }));
  }
  function renderTalent(){
    if(window.SupFusionReactScreens?.renderTalent){
      window.SupFusionReactScreens.renderTalent(els.talent,{offer:talentOffer,selectedTalent,unlockedCount:C.availableTalents(game.profile).length,totalCount:C.TALENTS.length,talentAdBusy,talentAdUnlocked,talentAdMessage,beginBusy:cloudStartBusy});
      return;
    }
    els.talent.markup=`
      <button class="inline-back" data-act="home">← 返回首页</button><div class="eyebrow">NEW RUN · 开局抉择</div>
      <h1 class="title">选择你的融合路线</h1>
      <div class="talent-catalog-row"><span>已解锁 ${C.availableTalents(game.profile).length}/${C.TALENTS.length}</span><button data-act="talent-catalog">查看全部天赋</button></div>
      <div class="list">${talentOffer.map(t=>`<button class="talent button-6 ${selectedTalent===t.id?'selected':''}" data-act="talent" data-id="${t.id}"><b>✦ ${t.name} <small>${t.category}</small></b><span>${t.gain}</span><i>${t.cost==='无'?'无代价':`代价：${t.cost}`}</i></button>`).join('')}</div>
      <div class="floatingaction talent-actions"><button class="btn wide talent-confirm button-3" data-act="begin" ${talentAdBusy?'disabled':''}>确认天赋</button><button class="talent-ad button-4${talentAdBusy?' ad-busy':''}" data-act="talent-ad" ${talentAdBusy||talentAdUnlocked?'disabled':''}><span><b>${talentAdUnlocked?'已解锁自选天赋':'看广告自选天赋'}</b><small>${talentAdUnlocked?'请在上方选择天赋':'从所有已解锁天赋中自选一个'}</small></span>${talentAdBusy?'<i class="ad-loading-icon" aria-hidden="true"></i>':'<img src="assets/reward-video-icon.svg" alt="">'}</button>${talentAdMessage?`<p class="talent-ad-message" role="status">${escapeText(talentAdMessage)}</p>`:''}</div>`;
  }
  function draftBondHints(id,extraIds=[]){
    const identity=C.identityOf(id),baseOwned=new Set(Object.keys(game.run.owned).map(C.identityOf)),owned=new Set([...baseOwned,...extraIds.map(C.identityOf)]);
    if(baseOwned.has(identity))return [];
    return C.starSynergies(id).map(bond=>{
      const ownedOthers=bond.ids.filter(player=>player!==identity&&owned.has(player)).length;
      if(!ownedOthers)return null;
      const afterCount=bond.ids.filter(player=>owned.has(player)||player===identity).length;
      return {name:bond.name,count:afterCount,total:bond.ids.length,active:afterCount===bond.ids.length};
    }).filter(Boolean).sort((a,b)=>Number(b.active)-Number(a.active)||b.count-a.count).slice(0,2);
  }
  function draftCard(id,index){
    const run=game.run,s=C.BY_ID[id],own=run.owned[id],value=s.attrs[s.best],batch=run.offerMode==='ten-batch';
    const selected=batch?run.batchSelected[index]!==false:selectedOffer===id;
    const priorCopies=batch?run.offer.slice(0,index).filter((offerId,offerIndex)=>offerId===id&&run.batchSelected[offerIndex]!==false).length:0;
    const duplicate=!!own||priorCopies>0,nextStars=Math.min(C.starLimit(run,id),(own?.stars||0)+priorCopies+1);
    const batchIds=batch?run.offer.filter((_,offerIndex)=>run.batchSelected[offerIndex]!==false):[];
    const bondHints=batch?(selected?draftBondHints(id,batchIds):[]):draftBondHints(id);
    const bondHintMarkup=bondHints.length?`<span class="draft-bond-hints">${bondHints.map(b=>`<i class="${b.active?'active':''}">${b.name}${b.active?'':` ${b.count}/${b.total}`}</i>`).join('')}</span>`:'';
    const isSSR=s.tier==='SSR';
    return `<div class="card ${tierClass[s.tier]} ${isSSR?'ssr-card ':''}${batch?(selected?'batch-selected':'batch-excluded'):selected?'selected':''}" style="--card-order:${index}">
      <button class="card-select" data-act="select-offer" data-id="${id}" data-index="${index}"><span class="card-top"><span class="card-grade"><span class="rarity">${tierName[s.tier]}</span>${batch&&duplicate?`<span class="draft-upgrade">★ ${nextStars}级</span>`:''}</span>${batch?bondHintMarkup:''}</span>
      <span class="card-visual">${isSSR?`<span class="ssr-player-art" data-player-art="${id}" aria-hidden="true"></span>`:''}<span class="visual-number">${value}</span>${batch?'':`<span class="visual-role">${duplicate?'升星':'球星招募'}${duplicate?`<span class="draft-upgrade">★ ${Math.min(C.starLimit(game.run,id),own.stars+1)}级</span>`:''}</span>`}${batch?'':bondHintMarkup}<strong>${s.name}</strong></span></button>
      <div class="card-meta"><span>推荐 · ${C.LABELS[s.best]}位</span><button class="card-detail" data-act="star-detail" data-id="${id}">查看详情</button></div>
      <div class="card-effect">◎ ${s.talent}：${s.talentEffect.description}</div>
    </div>`;
  }
  function renderBatchAction(batch,batchCount){
    if(!batchActionRoot)return;
    batchActionRoot.hidden=!batch;
    batchActionRoot.markup=batch?`<div class="batch-action-summary">拿走 ${batchCount} 张 · 出售 ${10-batchCount} 张</div><div class="batch-action-row"><button class="btn batch-select-toggle" data-act="toggle-recruit-batch">${batchCount===10?'取消全选':'一键全选'}</button><button class="btn batch-confirm" data-act="confirm-recruit-batch">${batchCount===0?'全部出售':'确认拿走'}</button></div>`:'';
  }
  function renderRecruit(){
    const r=runOrHome();if(!r)return;
    if(!r.offer.length&&!r.pending){C.makeOffer(r);save()}
    const batch=r.offerMode==='ten-batch';
    if(!batch&&!r.offer.includes(selectedOffer))selectedOffer=r.offer[0]||'';
    const selected=C.BY_ID[selectedOffer],odds=r.offerOdds||C.recruitProbabilitySummary(r),pct=value=>Number.isInteger(value)?value:String(value.toFixed(1)).replace(/\.0$/,'');
    els.recruit.classList.add('draft-style-material');
    els.recruit.classList.toggle('draft-ten-mode',batch);
    els.recruit.classList.toggle('batch-reveal',batch&&batchRevealPending);
    els.recruit.classList.toggle('draft-rewarded-mode',r.offerMode==='rewarded-s');
    const batchCount=batch?r.batchSelected.filter(Boolean).length:0;
    els.recruit.markup=`
      <button class="inline-back" data-act="roster">← 返回融合球场</button>
      <div class="draft-heading"><div><h1>DRAFT <small>${batch?`十连招募 · 已选 ${batchCount}/10`:'招募'}</small></h1></div></div>
      <div class="draft-odds"><span class="draft-odd" aria-label="SSR 概率 ${pct(odds.ssrGroup)}%"><span class="tier-dot legend-dot"></span>${pct(odds.ssrGroup)}%</span><span class="draft-odd" aria-label="S 概率 ${pct(odds.S)}%"><span class="tier-dot s-dot"></span>${pct(odds.S)}%</span><span class="draft-odd" aria-label="A 概率 ${pct(odds.A)}%"><span class="tier-dot a-dot"></span>${pct(odds.A)}%</span><span class="draft-odd" aria-label="B 概率 ${pct(odds.B)}%"><span class="tier-dot b-dot"></span>${pct(odds.B)}%</span><span class="draft-odd" aria-label="C 概率 ${pct(odds.C)}%"><span class="tier-dot c-dot"></span>${pct(odds.C)}%</span></div>
      ${batch?'<p class="batch-recruit-hint">默认全部拿走 · 点击卡片取消，取消的球员将直接出售</p>':''}
      <div class="choicegrid grid grid-cols-2">${r.offer.map(draftCard).join('')}</div>
      ${batch?'':`<div class="floatingaction"><button class="btn wide" data-act="pick" ${r.offerMode!=='rewarded-s'&&r.free<=0&&r.cash<C.recruitCost(r)?'disabled':''}>${r.offerMode==='rewarded-s'?`S级球员 4 选 1 · 选入 ${selected?selected.name:''} →`:r.free<=0&&r.cash<C.recruitCost(r)?'奖金不足，无法招募':'确定选入 '+(selected?selected.name:'')+' →'}</button></div>`}`;
    renderBatchAction(batch,batchCount);
    batchRevealPending=false;
    syncScrollViewport();
  }
  function rosterSlot(slot,r){
    const id=r.slots[slot.id],s=C.BY_ID[id];
    const selected=selectedPlace?.kind==='slot'&&selectedPlace.key===slot.id?'selected':'';
    if(!s)return `<button class="slot empty ${selected}" data-act="place" data-kind="slot" data-key="${slot.id}"><span class="slot-top">${slot.label}位</span><span class="slot-body"><strong>待招募<small>选择球员换入</small></strong></span></button>`;
    const effective=C.playerEffectiveStats(r,id,slot.id),value=effective.stats[slot.id];
    return `<div class="slot ${tierClass[s.tier]} ${selected} ${rosterTraining?'training-mode':''}"><button class="slot-player" data-act="place" data-kind="slot" data-key="${slot.id}"><span class="slot-tier-watermark">${tierName[s.tier]}</span><span class="slot-top">${slot.label}位</span>
      <span class="slot-body"><strong>${s.name}<small><b class="slot-value">${value}</b>${rosterTraining?` · 训练${effective.train}`:''} · <b class="slot-rank">${effective.stars}<span class="star-icon">★</span></b></small></strong></span></button>${rosterTraining?trainingAction(r,id,'slot-train'):''}</div>`;
  }
  function acePanel(r,fusion){
    return `<div class="ace-panel panel compact-ace"><strong class="ace-rating">${fusion.rating}</strong>
      <div class="ace-detail"><div class="ace-section-label">融合六项 <small>升星、训练与换位</small></div><div class="ace-stat-grid">${attrOrder.map(a=>`<span>${C.LABELS[a]} <b>${fusion.stats[a]}</b></span>`).join('')}</div></div>
      <div class="ace-combat-wide"><div class="ace-section-label">单挑战力 <small>技能、羁绊与装备</small></div><div class="ace-combat-grid">${combatOrder.map(key=>`<span>${C.COMBAT_LABELS[key]} <b>${Math.round(fusion.dimensions[key])}</b></span>`).join('')}</div></div>${signaturePanel(r,true)}</div>`;
  }
  function combatPanel(r,includeSignature=true){
    const fusion=C.fused(r);
    return `<section class="roster-combat panel"><div class="roster-combat-head"><b>单挑战力</b><span>综合 ${fusion.rating}</span></div><div class="roster-combat-grid">${combatOrder.map(key=>`<span>${C.COMBAT_LABELS[key]} <b>${Math.round(fusion.dimensions[key])}</b></span>`).join('')}</div>${includeSignature?signaturePanel(r,true):''}</section>`;
  }
  function shopCombatSummary(r){
    const fusion=C.fused(r);
    return `<section class="shop-combat-summary panel"><div class="roster-combat-grid">${combatOrder.map(key=>`<span>${C.COMBAT_LABELS[key]} <b>${Math.round(fusion.dimensions[key])}</b></span>`).join('')}</div></section>`;
  }
  function signaturePanel(r,embedded=false){
    const moves=C.signatureMoves(r).filter(Boolean);
    if(!moves.length)return '';
    return `<section class="signature-panel${embedded?' embedded':' panel'}"><div class="signature-title"><b>招牌动作</b><small>自动触发 · 每项每场最多 2 次</small></div><div class="signature-list">${moves.map(move=>`<div class="signature-item"><b>${move.name}<span>·${move.slots.map(slot=>C.SLOTS.find(item=>item.id===slot).label).join('+')}</span></b><small>${move.description}</small>${move.trained?`<em>受训成员 ${move.trained}/2 · 每人额外强化 2 个百分点</em>`:''}</div>`).join('')}</div></section>`;
  }
  function benchCard(id,index,r){
    const s=C.BY_ID[id],effective=C.playerEffectiveStats(r,id),value=effective.stats[s.best];
    return `<div class="bench-card ${tierClass[s.tier]} ${selectedPlace?.kind==='bench'&&selectedPlace.key===index?'selected':''}">
      <button class="bench-player" data-act="place" data-kind="bench" data-key="${index}"><strong>${s.name}</strong><small><span class="bench-rank">${effective.stars} <span class="star-icon">★</span></span>${rosterTraining?` · 训练${effective.train}`:''} · <span class="bench-attr">${C.LABELS[s.best]}</span> <b class="bench-value">${value}</b></small><span class="bench-drag-handle" title="按住此处拖动换位" aria-label="拖动换位"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 4h12M3 9h12M3 14h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span></button>
      ${rosterTraining?trainingAction(r,id,'bench-train'):`<button class="bench-sell button-5" data-act="sell-bench" data-id="${id}" data-index="${index}" ${r.lastBattle?'disabled title="请先进入下一关整备"':''} aria-label="出售 ${s.name}，获得 ${C.saleValue(id,effective.stars,r)} 奖金"><span>出售</span><b>${C.saleValue(id,effective.stars,r)}</b></button>`}
    </div>`;
  }
  function trainingAction(run,id,className){
    const own=run.owned[id],limit=C.trainingLimit(run,id),cost=C.trainingCost(run,id);
    const full=own.train>=limit,used=!run.endless&&own.trainedAt===run.stage,poor=run.cash<cost;
    const label=full?'已满级':used?'已训练':`训练·${cost}`;
    return `<button class="${className} training-action" data-act="train" data-id="${id}" ${full||used||poor||run.lastBattle?'disabled':''} aria-label="训练 ${C.BY_ID[id].name}，花费 ${cost} 奖金">${label}</button>`;
  }
  function renderRoster({preserveScroll=false}={}){
    const r=runOrHome();if(!r)return;
    const rosterScroll=preserveScroll?els.roster.scrollTop:0,benchScroll=preserveScroll?document.getElementById('benchGrid')?.scrollTop||0:0;
    const fusion=C.fused(r);
    const tierOrder={SSR:0,S:1,A:2,B:3,C:4};
    const sortedBench=r.bench.map((id,index)=>({id,index})).sort((a,b)=>tierOrder[C.BY_ID[a.id].tier]-tierOrder[C.BY_ID[b.id].tier]||(r.owned[b.id]?.stars||1)-(r.owned[a.id]?.stars||1)||a.index-b.index);
    els.roster.markup=`
      <button class="inline-back" data-act="home">← 返回首页</button>
      ${combatPanel(r)}
      <div class="sectionhead slots-heading"><div class="slots-title-actions"><h2>融合面板</h2><button class="roster-bonds-action" data-act="bonds">查看羁绊(${fusion.bonds.length})</button></div><span>点击查看详情，拖动更换位置</span></div>
      <div class="fusion-lineup"><div class="lineup-column">${C.SLOTS.slice(0,3).map(s=>rosterSlot(s,r)).join('')}</div><div class="lineup-center"><img src="assets/fusion-player-asian.png" alt="持球的融合球员"></div><div class="lineup-column">${C.SLOTS.slice(3).map(s=>rosterSlot(s,r)).join('')}</div></div>
      <div class="bench-heading-block"><div class="bench-heading-copy"><div class="sectionhead bench-title"><h2>备战席 <span class="bench-count">${r.bench.length} / ${r.benchLimit}</span></h2></div><p class="bench-gesture-hint">滑动列表浏览 · 按住球员左侧把手拖动换位</p></div><div class="bench-title-actions"><button class="roster-expand" data-act="expand-open" ${r.cash<10||r.benchLimit>=C.benchExpansionLimit(r)||r.lastBattle?'disabled':''}>扩容</button><button class="roster-training-toggle" data-act="toggle-training">${rosterTraining?'返回':'切换训练'}</button></div></div>
      <div class="bench-panel panel"><div class="bench-grid" id="benchGrid">${sortedBench.length?sortedBench.map(({id,index})=>benchCard(id,index,r)).join(''):'<div class="bench-empty" role="status">暂无备战球员，招募后可加入备战席</div>'}</div></div>
      <div class="roster-dock"><div class="roster-dock-main"><div class="action-cash"><img src="assets/cash-stack.png" alt=""><span>当前奖金 <b>${r.cash}</b></span></div>
        <div class="quick-actions"><button class="btn wide recruit-action ${r.free>0||r.offerMode==='ten-batch'?'has-free':''}" data-act="recruit" ${r.lastBattle||r.ended?'disabled':''}><span>招募球员</span><small>${r.offerMode==='ten-batch'?'十连待确认':r.free>0?`免费 · 仅本轮（${r.free} 次）`:`${C.recruitCost(r)} 奖金`}</small>${r.free>0||r.offerMode==='ten-batch'?'<i aria-label="有可用招募内容"></i>':''}</button><button class="btn wide" data-act="shop">商店/装备</button></div></div>
        <button class="btn wide roster-fight" data-act="duel" ${C.starterCount(r)<6?'disabled':''}>${r.lastBattle?'查看本场结算':'前往备战'}</button></div>`;
    syncScrollViewport();
    if(preserveScroll){els.roster.scrollTop=rosterScroll;document.getElementById('benchGrid').scrollTop=benchScroll}
  }
  function shopItem(title,desc,price,action,id,disabled,rarity=null,meta='',teamCode='',sold=false,boostId='',replace=false,replaceDisabled=false){
    const edges=TEAM_LOGO_EDGES[teamCode];
    const jersey=edges?` jersey-shopitem`:'',style=edges?` style="--jersey-edge-a:${edges[0]};--jersey-edge-b:${edges[1]}"`:'';
    const logo=edges?`<img class="jersey-team-logo" src="assets/logos/${teamCode}.png" alt="${title.split('·')[0]}队徽">`:'';
    return `<div class="panel shopitem ${rarity?`shop-tier-${rarity.toLowerCase()}`:'shop-boost'}${jersey}${sold?' shop-sold':''}"${style}>${boostId?`<img class="boost-icon" src="assets/boosts/${boostId}.svg" alt="">`:''}<div class="shop-card-copy">${rarity?`<div class="shop-card-top"><span>${meta}</span></div>`:''}<strong>${title}</strong><small>${desc}</small></div>${logo}<div class="shop-item-actions"><button class="btn small" data-act="${action}" data-id="${id}" ${disabled?'disabled':''}>${price}</button>${replace?`<button class="btn small gear-replace" data-act="replace-gear" data-id="${id}" ${replaceDisabled?'disabled':''}>替换</button>`:''}</div>${sold?'<span class="shop-sold-stamp" aria-label="已售">已售</span>':''}</div>`;
  }
  function cashPrice(value){return `<span class="cash-price"><img src="assets/cash-stack.png" alt="奖金">${value}</span>`}
  function equipmentJerseyVisual(item){
    const edges=TEAM_LOGO_EDGES[item?.teamCode];
    return edges?{className:' jersey-equipment',style:` style="--jersey-edge-a:${edges[0]};--jersey-edge-b:${edges[1]}"`,logo:`<img class="equipment-team-logo" src="assets/logos/${item.teamCode}.png" alt="">`}:{className:'',style:'',logo:''};
  }
  function jerseyArtwork(item){
    const [primary,secondary]=TEAM_LOGO_EDGES[item.teamCode]||['#28364b','#f2c35b'];
    const number=item.name.match(/·(\d+)号/)?.[1]||'';
    const rgb=primary.slice(1).match(/../g).map(value=>parseInt(value,16));
    const light=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>160;
    const ink=light?'#17202a':'#fff9eb',outline=light?'#fff9eb':'#17202a';
    return `<span class="jersey-art-frame"><svg class="jersey-vector" viewBox="0 0 160 120" role="img" aria-label="${item.name}球衣矢量图"><path d="M45 17 61 8 68 15 Q80 23 92 15 L99 8 115 17 143 31 132 57 116 50 116 110 44 110 44 50 28 57 17 31Z" fill="${primary}" stroke="${secondary}" stroke-width="3" stroke-linejoin="round"/><path d="M20 32 39 22 47 41 31 53Z M140 32 121 22 113 41 129 53Z" fill="${secondary}" opacity=".85"/><path d="M45 48 53 45 53 108 45 108Z M115 48 107 45 107 108 115 108Z" fill="${secondary}"/><path d="M61 8 Q80 31 99 8" fill="none" stroke="${secondary}" stroke-width="7"/><path d="M67 8 Q80 22 93 8" fill="none" stroke="${outline}" stroke-width="3" opacity=".75"/><path d="M53 27 68 20 94 104 78 109Z" fill="#fff" opacity=".08"/><text x="80" y="79" text-anchor="middle" fill="${ink}" stroke="${outline}" stroke-width="2" paint-order="stroke" font-family="Arial, sans-serif" font-size="47" font-weight="900">${number}</text></svg></span>`;
  }
  function equipmentSubtitle(item){
    return item.slot;
  }
  function equipmentShelf(r){
    const slots=['头带','球衣','护腕','戒指','球鞋','战术板'];
    const active=`<div class="equipped-shelf"><div class="shop-subhead"><b>已装备 ${r.gear.length}/${r.gearLimit||C.GEAR_LIMIT}</b><span>点击装备查看详情</span></div><div class="equipment-slot-list">${slots.map(slot=>{
      const id=r.gear.find(gearId=>C.GEAR.find(item=>item.id===gearId)?.slot===slot),item=C.GEAR.find(gear=>gear.id===id);
      const visual=equipmentJerseyVisual(item);
      return `<div class="equipment-slot-row ${item?`is-equipped gear-tier-${item.rarity.toLowerCase()}`:''}${visual.className}"${visual.style}>${visual.logo}${item?`<button class="equipment-card-open" data-act="gear-detail-open" data-id="${id}" aria-label="查看${item.displayName}详情"><span>${equipmentSubtitle(item)}</span><b>${item.displayName}</b></button><button class="gear-sell" data-act="sell-gear" data-id="${id}">出售 +${item.sellPrice}</button>`:`<div class="equipment-slot-empty"><span>${slot}</span><b>未装备</b></div>`}</div>`;
    }).join('')}</div></div>`;
    const jerseys=[...r.gear,...(r.gearReserve||[])].filter(id=>C.GEAR.find(item=>item.id===id)?.slot==='球衣');
    const spare=`<div class="equipment-reserve"><div class="shop-subhead"><b>球衣收藏 ${jerseys.length} · 全部生效</b></div><div class="equipment-reserve-list">${jerseys.length?jerseys.map(id=>{const item=C.GEAR.find(gear=>gear.id===id),visual=equipmentJerseyVisual(item),worn=r.gear.includes(id);return `<div class="equipment-reserve-card gear-tier-${item.rarity.toLowerCase()}${visual.className}"${visual.style}><button class="equipment-card-open jersey-collection-preview" data-act="gear-detail-open" data-id="${id}">${jerseyArtwork(item)}<span>${item.slot}</span><b>${item.displayName}</b></button><button class="gear-equip" data-act="equip-gear" data-id="${id}" ${worn?'disabled':''}>${worn?'已装备':'装备'}</button><button class="gear-sell" data-act="sell-gear" data-id="${id}">出售 +${item.sellPrice}</button></div>`}).join(''):'<div class="equipment-reserve-empty">暂无收藏球衣，购买新球衣后会出现在这里</div>'}</div></div>`;
    return active+spare;
  }
  function renderShop(){
    const liveRun=runOrHome();if(!liveRun)return;
    const r=liveRun;
    const tabs=[['boost','赛前强化'],['gear','装备'],['my','更衣室']],offers=C.ensureShop(r);
    let content='',equipped='';
    if(shopTab==='my')equipped=equipmentShelf(liveRun);
    if(shopTab==='boost'){
      content=offers.boost.map(id=>{const item=C.BOOSTS.find(x=>x.id===id),bought=r.boosts.filter(boostId=>boostId===id).length,boughtHere=(r.boostBoughtOffers||[]).includes(id),price=C.boostPrice(r,item),poor=r.cash<price;
        return shopItem(item.name,item.description+(bought?` · 已购 ×${bought}`:''),boughtHere?'已购':poor?'奖金不足':cashPrice(price),'buy-boost',id,boughtHere||poor,null,'','',false,item.id);
      }).join('');
    }
    if(shopTab==='gear'){
      const gearIds=offers.gear;
      content=gearIds.map(id=>{const item=C.GEAR.find(x=>x.id===id),sold=(r.gearSoldOffers||[]).includes(id)||r.gear.includes(id)||(r.gearReserve||[]).includes(id),ownedSlot=item.slot!=='球衣'&&[...r.gear,...(r.gearReserve||[])].some(gearId=>C.GEAR.find(gear=>gear.id===gearId)?.slot===item.slot),price=C.gearPrice(r,item),poor=r.cash<price;
        return shopItem(item.displayName,item.description,sold?'已售':ownedSlot?`已有${item.slot}`:poor?'奖金不足':cashPrice(price),'buy-gear',id,sold||ownedSlot||poor,item.rarity,item.slot,item.teamCode,sold,'',ownedSlot&&!sold,poor);
      }).join('');
    }
    const refreshCost=shopTab==='my'?0:C.shopRefreshCost(r,shopTab);
    const refreshButton=shopTab==='my'?'':`<button class="shop-refresh-action" data-act="shop-refresh" ${r.cash<refreshCost?'disabled':''}>${r.cash<refreshCost?'奖金不足':refreshCost===0?'免费刷新':`刷新 · ${cashPrice(refreshCost)}`}</button>`;
    const tabIndex=tabs.findIndex(([id])=>id===shopTab),fromIndex=tabs.findIndex(([id])=>id===shopSlideFrom);
    els.shop.markup=`<button class="inline-back" data-act="roster">← 返回融合球场</button><div class="shop-overview-row">${shopCombatSummary(liveRun)}<span class="pill gold shop-balance"><img src="assets/cash-stack.png" alt="奖金">${r.cash}</span></div>
      <div class="tabrow shop-tabs"><div class="shop-tab-track" style="--tab-index:${tabIndex};--from-tab:${fromIndex<0?tabIndex:fromIndex}"><span key="shop-${fromIndex}-${tabIndex}" class="shop-tab-slider" aria-hidden="true"></span>${tabs.map(([id,name])=>`<button class="tab ${shopTab===id?'active':''}" data-act="shop-tab" data-id="${id}">${name}</button>`).join('')}</div>${refreshButton}</div>
      ${shopTab==='my'?equipped:`${equipped}<div class="shopPanel shop-grid">${content||'<div class="emptyline">暂无可用商品或球员。</div>'}</div>`}
      ${shopTab==='boost'?'<p class="footer-note">赛前强化仅对下一场生效。</p>':''}
      <button class="btn wide" data-act="roster">整备完成，返回球场 →</button>`;
    shopSlideFrom=shopTab;
  }
  function renderDuel(){
    const r=runOrHome();if(!r)return;
    const foe=C.opponent(r),fusion=C.fused(r);
    if(window.SupFusionReactScreens?.renderDuel){
      const moves=C.signatureMoves(r).filter(Boolean).map(move=>({...move,slotLabels:move.slots.map(slot=>C.SLOTS.find(item=>item.id===slot).label)}));
      window.SupFusionReactScreens.renderDuel(els.duel,{stage:r.stage,fusion:{rating:fusion.rating},attrStats:attrOrder.map(id=>({id,label:C.LABELS[id],value:fusion.stats[id]})),combatStats:combatOrder.map(id=>({id,label:C.COMBAT_LABELS[id],value:Math.round(fusion.dimensions[id])})),moves,foe,foeCombat:combatOrder.map(id=>({id,label:C.COMBAT_LABELS[id],value:Math.round(foe.dimensions[id])}))});
      return;
    }
    els.duel.markup=`<button class="inline-back" data-act="roster">← 返回融合球场</button>
      <div class="eyebrow">STAGE ${String(r.stage).padStart(2,'0')} · 赛前情报</div>
      ${acePanel(r,fusion)}
      <div class="sectionhead duel-foe-heading"><h2>本关对手</h2><span>基础战力 ${fusion.rating} : ${foe.rating}</span></div>
      <div class="panel opponent"><div class="opponent-name-row"><strong>${foe.name}</strong><span><small>OVR</small><b>${foe.rating}</b>${foe.stars>1?`<em>${foe.stars}★</em>`:''}</span></div>
        <p>三分 ${foe.stats.three} · 突破 ${foe.stats.drive} · 防守 ${foe.stats.def}</p>
        <div class="opponent-combat">${combatOrder.map(key=>`<span>${C.COMBAT_LABELS[key]} ${Math.round(foe.dimensions[key])}</span>`).join('')}</div>
        <span class="versus">VS</span></div>
      <div class="floatingaction"><button class="btn wide" data-act="battle">开始自动单挑 →</button></div>`;
  }
  function renderResult(){
    const r=game.run,report=r?.lastBattle;if(!report){go('home');return}
    loadPlayerName();
    const won=report.won,ended=r.ended,final=r.stage===10&&won&&!r.endless;
    els.result.classList.toggle('result-loss',!won);
    const beatText=report.beats>0?'战术克制成功':report.beats<0?'本场战术被克制':'双方策略未形成克制';
    if(window.SupFusionReactScreens?.renderResult){
      window.SupFusionReactScreens.renderResult(els.result,{report,won,ended,final,wins:r.wins,losses:r.losses,battleKey:`${r.seed}-${r.wins}-${r.losses}`,beatText,strategyName:C.STRATEGIES[report.strategy].name,strategyEffect:report.beats>0?'主战力额外 +6%':report.beats<0?'对手主战力额外 +6%':'势均力敌',playerName,playerNameNotice});
      return;
    }
    const resultAction=ended?`<button class="btn wide" data-act="career-report">查看生涯报告 →</button>`
      :final?`<div class="result-actions"><button class="btn dark" data-act="finish">本局结算</button><button class="btn" data-act="next">进入无尽 →</button></div>`
      :`<button class="btn wide" data-act="${won?'next':'retry'}">${won?'下一关整备':'整备重试'} →</button>`;
    els.result.markup=`
      <div class="result-card panel">
        <div class="result-scoreboard"><div class="result-side"><div class="result-avatar you-avatar"><img src="assets/fusion-ace.png" alt="融合球员概念插画"></div><strong>${escapeText(playerName)}</strong><small>OVR ${report.rating}</small></div>
          <div class="result-middle"><div class="score">${report.us}<span>:</span>${report.them}</div><b>${won?'胜利':'失利'}</b></div>
          <div class="result-side"><div class="result-avatar opp-avatar"><img src="assets/rival-forward.png" alt="对手概念插画"></div><strong>${report.foeName}</strong><small>OVR ${report.foeRating}${report.foeStars>1?` · ${report.foeStars}★`:''}</small></div></div>
        <div class="result-strategy"><span>▣ ${beatText}：${C.STRATEGIES[report.strategy].name}</span><b>${report.beats>0?'主战力额外 +6%':report.beats<0?'对手主战力额外 +6%':'势均力敌'}</b></div></div>${playerNameNotice?`<p class="result-user-notice" role="status">${escapeText(playerNameNotice)}</p>`:''}
      <div class="sectionhead result-timeline-title"><h2>关键回合</h2></div><div class="timeline" key="battle-${r.seed}-${r.wins}-${r.losses}">${report.signatures?.length?`<div class="timeline-signatures">${report.signatures.map(move=>`<span>${move.kind==='offense'?'进攻':'防守'} · <b>${move.name}</b>　触发 ${move.uses} 次</span>`).join('')}</div>`:''}${report.log.map((line,index)=>`<p class="timeline-entry" style="--round-order:${index}">${escapeText(line.replace(/^(\d+)回合/,'第$1次攻防'))}</p>`).join('')}</div>
      ${ended?`<div class="panel result-summary">本局 ${r.wins} 胜 ${r.losses} 负，获得 ${report.legendEarned||0} 传奇点。</div>`
        :final?`<div class="panel result-summary">主线十关完成！可以带当前阵容进入无尽，或结算本局。</div>`:''}
      <div class="result-dock">${ended?'':`<div class="panel battle-reward"><div class="battle-reward-main"><span class="shopicon">＄</span><div><strong>本场奖金 +${report.reward}</strong><small>${report.detail.join(' · ')}</small></div></div></div>`}${resultAction}</div>`;
  }
  function careerReportSummary(){
    const r=game.run;if(!r)return null;
    const breakdown=C.legendPointBreakdown(r),stats=r.stats||{};
    const lineup=C.SLOTS.map(slot=>{const id=r.slots[slot.id],star=C.BY_ID[id],own=r.owned[id];return star?{slot:slot.id,slotLabel:slot.label,name:star.name,tier:star.tier,tierClass:tierClass[star.tier],stars:own?.stars||1,train:own?.train||0}:null}).filter(Boolean);
    const bonds=C.activeSynergies(r).map(bond=>({name:bond.name,description:bond.description}));
    const gear=r.gear.map(id=>C.GEAR.find(item=>item.id===id)).filter(Boolean).map(item=>({id:item.id,slot:item.slot,name:item.displayName,description:item.description,rarityClass:`gear-tier-${item.rarity.toLowerCase()}`}));
    return {goat:Math.round(r.maxGoat||r.lastBattle?.goat||C.goatScore(r)),stage:r.lastBattle?.stage||r.stage,wins:r.wins,losses:r.losses,lineup,bonds,gear,recruits:stats.recruits||0,prizeIncome:stats.prizeIncome||0,gearPurchases:stats.gearPurchases||0,legendEarned:r.settlement?.points??r.lastBattle?.legendEarned??breakdown.total,formula:breakdown.formula,currentLegend:game.profile.legend,reviveUsed:r.reviveUsed===true,canRevive:r.morale<=0&&r.lastBattle?.won===false&&r.reviveUsed!==true,posterRewarded:r.posterRewarded===true};
  }
  function renderCareerReport(){
    const summary=careerReportSummary();if(!summary||!game.run?.ended){go('home');return}
    if(window.SupFusionReactScreens?.renderCareerReport){window.SupFusionReactScreens.renderCareerReport(els.report,{summary,posterBusy:posterPhase==='rendering'||posterPhase==='uploading'||posterPhase==='opening',reviveBusy:reportReviveBusy,reviveMessage:reportReviveMessage});return}
    els.report.markup=`<div class="career-report-content"><div class="career-report-overview"><div class="panel career-report-hero"><span>第 ${summary.stage} 关</span><h1>${summary.goat}</h1><small>GOAT 分数</small></div><section class="panel career-advanced"><div><span>胜负记录<b>${summary.wins} 胜 ${summary.losses} 负</b></span><span>招募球员<b>${summary.recruits} 次</b></span><span>累计奖金收入<b>${summary.prizeIncome} 奖金</b></span><span>购买装备<b>${summary.gearPurchases} 次</b></span></div></section></div></div><div class="career-report-actions"><div class="career-action-row"><button class="btn wide career-revive${reportReviveBusy?' ad-busy':''}" data-act="report-revive" ${summary.canRevive&&!reportReviveBusy?'':'disabled'}>${reportReviveBusy?'<i class="ad-loading-icon" aria-hidden="true"></i>':''}${summary.reviveUsed?'本局已使用体力恢复':summary.canRevive?'看视频恢复体力':'当前无需恢复体力'}</button><button class="btn wide dark" data-act="report-new">返回首页</button></div><button class="btn wide career-poster" data-act="report-poster">生成海报</button></div>`;
  }
  function posterRoundRect(ctx,x,y,width,height,radius){
    const r=Math.min(radius,width/2,height/2);
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+width,y,x+width,y+height,r);ctx.arcTo(x+width,y+height,x,y+height,r);ctx.arcTo(x,y+height,x,y,r);ctx.arcTo(x,y,x+width,y,r);ctx.closePath();
  }
  function posterText(ctx,value,x,y,maxWidth){
    let text=String(value||'');
    while(text.length>1&&ctx.measureText(text).width>maxWidth)text=text.slice(0,-1);
    if(text!==String(value||''))text=text.slice(0,-1)+'…';
    ctx.fillText(text,x,y);
  }
  function posterCard(ctx,x,y,width,height,colors){
    const gradient=ctx.createLinearGradient(x,y,x+width,y+height);
    colors.forEach((color,index)=>gradient.addColorStop(index/(colors.length-1),color));
    posterRoundRect(ctx,x,y,width,height,14);ctx.fillStyle=gradient;ctx.fill();
    const shine=ctx.createLinearGradient(x,y,x+width*.7,y+height);shine.addColorStop(0,'#ffffff43');shine.addColorStop(.36,'#ffffff00');shine.addColorStop(.63,'#ffffff26');shine.addColorStop(1,'#ffffff00');
    posterRoundRect(ctx,x,y,width,height,14);ctx.fillStyle=shine;ctx.fill();ctx.strokeStyle='#ffffff73';ctx.lineWidth=2;ctx.stroke();
  }
  function createCareerPoster(summary){
    const playerColors={C:['#36424c','#778890','#293640'],B:['#102d55','#286a9c','#0c2548'],A:['#392051','#77499b','#301b49'],S:['#604113','#aa7a25','#4e330d'],SSR:['#b7d9df','#cadfe4','#dfd2ba']};
    const gearColors={c:['#5b6670','#9da8ae','#38434c'],b:['#09254c','#246da8','#081d3d'],a:['#65400b','#ba8529','#47300c'],s:['#59121c','#a5263a','#3d0c19'],sr:['#c75177','#d3a940','#4ca9ad','#9d67ce']};
    const bondRows=Math.max(1,Math.ceil(summary.bonds.length/3)),gearRows=Math.max(1,Math.ceil(summary.gear.length/3));
    const bondTop=948,bondHeight=Math.max(78,bondRows*58+20),gearTitleY=bondTop+bondHeight+57,gearTop=gearTitleY+25,gearHeight=Math.max(80,gearRows*88+18),footerTop=gearTop+gearHeight+38;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=footerTop+164;const ctx=canvas.getContext('2d');
    const background=ctx.createLinearGradient(0,0,1080,canvas.height);background.addColorStop(0,'#35210c');background.addColorStop(.35,'#171819');background.addColorStop(1,'#090a0c');ctx.fillStyle=background;ctx.fillRect(0,0,1080,canvas.height);
    posterRoundRect(ctx,48,48,984,348,22);ctx.fillStyle='#201b16';ctx.fill();ctx.strokeStyle='#856329';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#ffc557';ctx.font='900 38px sans-serif';ctx.fillText('我的球星融合系统 · 生涯报告',76,106);
    ctx.fillStyle='#fff1d4';ctx.font='900 144px sans-serif';ctx.fillText(String(summary.goat),76,256);
    ctx.fillStyle='#cbb68c';ctx.font='800 27px sans-serif';ctx.fillText('GOAT 分数',82,295);
    ctx.fillStyle='#f9deb1';ctx.font='800 31px sans-serif';ctx.fillText(`达到第 ${summary.stage} 关   ·   ${summary.wins} 胜 ${summary.losses} 负`,362,284);
    ctx.strokeStyle='#73552b';ctx.beginPath();ctx.moveTo(76,315);ctx.lineTo(1004,315);ctx.stroke();
    const stats=[`招募 ${summary.recruits} 次`,`累计奖金 ${summary.prizeIncome}`,`购买装备 ${summary.gearPurchases} 次`];
    ctx.fillStyle='#d5c4a5';ctx.font='700 25px sans-serif';stats.forEach((stat,index)=>{const x=76+index*312;posterText(ctx,stat,x,366,286)});
    ctx.fillStyle='#ffcd65';ctx.font='900 34px sans-serif';ctx.fillText('融合面板阵容',60,454);
    summary.lineup.forEach((player,index)=>{
      const x=60+(index%2)*490,y=480+Math.floor(index/2)*136,light=player.tier==='SSR';
      posterCard(ctx,x,y,470,120,playerColors[player.tier]||playerColors.C);
      ctx.fillStyle=light?'#24434b':'#f8e9cf';ctx.font='800 23px sans-serif';ctx.fillText(`${player.slotLabel}位 · ${player.tier}`,x+18,y+32);
      ctx.fillStyle=light?'#173b43':'#fff9eb';ctx.font='900 32px sans-serif';posterText(ctx,player.name,x+18,y+73,430);
      ctx.fillStyle=light?'#395b60':'#ffdf8d';ctx.font='800 22px sans-serif';ctx.fillText(`${player.stars}★   训练 ${player.train}`,x+18,y+103);
    });
    ctx.fillStyle='#ffcd65';ctx.font='900 34px sans-serif';ctx.fillText('激活羁绊',60,920);
    posterRoundRect(ctx,60,bondTop,960,bondHeight,14);ctx.fillStyle='#242321';ctx.fill();ctx.strokeStyle='#6d542c';ctx.stroke();
    if(summary.bonds.length){summary.bonds.forEach((bond,index)=>{
      const x=76+(index%3)*318,y=bondTop+14+Math.floor(index/3)*58;
      posterRoundRect(ctx,x,y,302,46,9);ctx.fillStyle='#302719';ctx.fill();ctx.strokeStyle='#af873c';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#ffd072';ctx.font='900 22px sans-serif';posterText(ctx,bond.name,x+12,y+31,278);
    })}else{ctx.fillStyle='#8e877b';ctx.font='700 23px sans-serif';ctx.fillText('本局未激活羁绊',82,bondTop+48)}
    ctx.fillStyle='#ffcd65';ctx.font='900 34px sans-serif';ctx.fillText('装备和球衣',60,gearTitleY);
    posterRoundRect(ctx,60,gearTop,960,gearHeight,14);ctx.fillStyle='#242321';ctx.fill();ctx.strokeStyle='#6d542c';ctx.stroke();
    if(summary.gear.length){summary.gear.forEach((item,index)=>{
      const x=76+(index%3)*318,y=gearTop+12+Math.floor(index/3)*88,rarity=String(item.rarityClass||'').replace('gear-tier-','');
      posterCard(ctx,x,y,302,76,gearColors[rarity]||gearColors.c);
      ctx.fillStyle='#fff9eb';ctx.font='900 22px sans-serif';ctx.textBaseline='middle';posterText(ctx,item.name,x+12,y+38,278);ctx.textBaseline='alphabetic';
    })}else{ctx.fillStyle='#8e877b';ctx.font='700 23px sans-serif';ctx.fillText('本局没有装备',82,gearTop+48)}
    ctx.textAlign='center';ctx.fillStyle='#ffc347';ctx.font='900 48px sans-serif';ctx.fillText(`+${summary.legendEarned} 传奇点`,540,footerTop+55);
    const date=new Date(),stamp=`${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
    ctx.fillStyle='#a7987d';ctx.font='700 23px sans-serif';ctx.fillText(`#我的球星融合系统# · ${stamp}`,540,footerTop+111);ctx.textAlign='left';
    return canvas;
  }
  function careerPosterBlob(canvas){
    return new Promise((resolve,reject)=>{
      if(typeof canvas.toBlob!=='function'){reject(new Error('当前浏览器无法生成 PNG 海报，请更换浏览器重试。'));return}
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('海报生成失败，请重试。')),'image/png');
    });
  }
  function careerPosterPost(summary){
    return {title:`我的球星融合系统 | 第${summary.stage}关生涯报告`,topicId:'871',tagId:'158640',topicName:'AI工坊',tagName:'我的球星融合系统'};
  }
  async function publishCareerPoster(blob,summary){
    const ai=window.ColorboxAI;
    if(typeof ai?.oss?.uploadFile!=='function'||typeof ai?.request?.bbs?.openPostEditor!=='function')throw new Error('请在虎扑 App 中分享海报。');
    if(!blob||blob.size===0)throw new Error('海报图片为空，请重新生成。');
    if(blob.size>10*1024*1024)throw new Error('海报超过 10MB，请重新生成。');
    posterPhase='uploading';posterMessage='';renderPending();
    const upload=await ai.oss.uploadFile({file:blob,filename:`supfusion-result-${Date.now()}.png`});
    if(upload?.code!=null&&upload.code!==200)throw new Error('海报分享失败，请稍后重试。');
    if(!upload?.downloadUrl)throw new Error('海报分享失败，请稍后重试。');
    let imageUrl;
    try{imageUrl=new URL(upload.downloadUrl)}catch(_){throw new Error('海报分享失败，请稍后重试。')}
    const imageHosts=['hupu.com','hoopchina.com.cn','static.cloudbase.net'];
    if(imageUrl.protocol!=='https:'||!imageHosts.some(host=>imageUrl.hostname===host||imageUrl.hostname.endsWith(`.${host}`)))throw new Error('海报分享失败，请稍后重试。');
    posterPhase='opening';posterMessage='正在打开虎扑发帖编辑器…';renderPending();
    const params={...careerPosterPost(summary),imageUrl:imageUrl.href};
    const response=await ai.request.bbs.openPostEditor(params);
    if(response?.code!==200)throw new Error(response?.message||'发帖编辑器打开失败，请重试。');
  }
  async function generateCareerPoster(){
    if(posterPhase==='rendering'||posterPhase==='uploading'||posterPhase==='opening')return;
    posterPhase='rendering';posterMessage='正在生成海报…';renderPending();
    try{
      const blob=await careerPosterBlob(createCareerPoster(careerReportSummary()));
      if(blob.size>10*1024*1024)throw new Error('海报超过 10MB，请重试。');
      const url=URL.createObjectURL(blob);
      if(posterPreviewUrl)URL.revokeObjectURL(posterPreviewUrl);
      posterBlob=blob;posterPreviewUrl=url;posterPhase='idle';posterMessage='海报已生成，可分享到虎扑。';
    }catch(error){posterPhase='error';posterMessage=error?.message||'海报生成失败，请重试。'}
    if(showPosterPreview&&screen==='report')renderPending();
  }
  function resetCareerPoster(){
    showPosterPreview=false;posterBlob=null;posterMessage='';posterPhase='idle';
    if(posterPreviewUrl)URL.revokeObjectURL(posterPreviewUrl);
    posterPreviewUrl='';
  }
  function closeCareerPoster(){
    if(posterPhase==='rendering'||posterPhase==='uploading'||posterPhase==='opening')return;
    resetCareerPoster();renderPending();
  }
  function renderProfile(){
    const p=game.profile,discovered=new Set(p.discovered.map(C.identityOf)),tierOrder={SSR:0,S:1,A:2,B:3,C:4};
    const orderedStars=[...C.STARS].filter(star=>p.discovered.includes(star.id)).sort((a,b)=>tierOrder[a.tier]-tierOrder[b.tier]);
    const catalogJerseyIds=new Set([...(p.jerseys||[]),...(p.jerseyUnlocks||[])]);
    const jerseys=C.GEAR.filter(item=>item.slot==='球衣'&&catalogJerseyIds.has(item.id));
    const visibleStars=orderedStars.filter(star=>profileTier==='all'||star.tier===profileTier);
    const starCatalog=`<div class="codex-heading"><div><h2>球星图鉴 <small>${p.discovered.length} / ${C.STARS.length}</small></h2></div><div class="codex-tier-filter" aria-label="球星等级筛选">${['all','SSR','S','A','B','C'].map(tier=>`<button data-act="profile-tier" data-id="${tier}" class="${profileTier===tier?'active':''}" aria-pressed="${profileTier===tier}">${tier==='all'?'全部':tier}</button>`).join('')}</div></div>${visibleStars.length?`<div class="catalog codex-star-list">${visibleStars.map(star=>`<span class="profile-star-card ${tierClass[star.tier]} unlocked" data-tier="${star.tier}">${escapeText(star.name)}</span>`).join('')}</div>`:`<div class="codex-empty"><b>等待传奇入册</b><p>${orderedStars.length?'该等级暂无已收集球星。':'完成一局后，招募过的球星会收录在这里。'}</p></div>`}`;
    const bondCatalog=`<div class="codex-heading"><div><h2>羁绊图鉴</h2></div><span class="codex-collection-count">${C.SYNERGIES.filter(bond=>bond.ids.every(id=>discovered.has(id))).length} / ${C.SYNERGIES.length} 已收集</span></div><div class="codex-bond-journal">${C.SYNERGIES.map(bond=>{const count=bond.ids.filter(id=>discovered.has(id)).length;return `<article class="codex-bond-entry ${count===bond.ids.length?'complete':''}"><header><h3>${escapeText(bond.name)}</h3><small>${count===bond.ids.length?'收集完成':`${count} / ${bond.ids.length}`}</small></header><p>${escapeText(bond.description||'')}</p><div class="codex-bond-members">${bond.ids.map(id=>`<span class="${discovered.has(id)?'collected':''}">${escapeText(C.BY_ID[id].name)}</span>`).join('')}</div></article>`}).join('')}</div>`;
    const jerseyCatalog=`<div class="sectionhead"><h2>球衣图鉴</h2><span>已收集 ${jerseys.length} / ${C.GEAR.filter(item=>item.slot==='球衣').length}</span></div>${jerseys.length?`<div class="profile-jersey-catalog">${jerseys.map(item=>{const visual=equipmentJerseyVisual(item);return `<div class="equipment-reserve-card gear-tier-${item.rarity.toLowerCase()}${visual.className}"${visual.style}>${visual.logo}<div class="jersey-collection-preview">${jerseyArtwork(item)}<b>${item.name}</b></div></div>`}).join('')}</div>`:'<div class="emptyline catalog-empty">完成一局后，本局获得过的球衣会收录在这里。</div>'}`;
    const profileTabs=['stars','bonds','jerseys'],profileTabIndex=profileTabs.indexOf(profileTab),profileFromIndex=profileTabs.indexOf(profileSlideFrom);
    els.profile.markup=`
      <div class="profile-title-row"><div><div class="eyebrow">LEGACY</div><h1 class="title">我的传奇档案</h1></div><button class="profile-home" data-act="home">返回主页</button></div>
      <div class="statusbar profile-status"><div class="statbox"><strong>${p.runs}</strong><small>局数</small></div><div class="statbox"><strong>${p.clears||0}</strong><small>通关次数</small></div><div class="statbox"><strong>${p.highestStage||0}</strong><small>最高关卡</small></div><div class="statbox"><strong class="goldtext">${p.bestGoat||0}</strong><small>最高GOAT分</small></div></div>
      <div class="profile-tabs" role="tablist" style="--tab-index:${profileTabIndex};--from-tab:${profileFromIndex<0?profileTabIndex:profileFromIndex}"><button class="${profileTab==='stars'?'active':''}" data-act="profile-tab" data-id="stars">球星图鉴</button><button class="${profileTab==='bonds'?'active':''}" data-act="profile-tab" data-id="bonds">羁绊图鉴</button><button class="${profileTab==='jerseys'?'active':''}" data-act="profile-tab" data-id="jerseys">球衣图鉴</button><i key="profile-${profileFromIndex}-${profileTabIndex}" class="${profileTab}"></i></div>
      <div class="profile-catalog-panel">${profileTab==='stars'?starCatalog:profileTab==='bonds'?bondCatalog:jerseyCatalog}</div>`;
    profileSlideFrom=profileTab;
  }
  function legacyIcon(id){
    const paths={
      crown:'M4 8 8 13 12 5 16 13 20 8 18 19H6Z M7 22H17',
      hanger:'M9 6a3 3 0 0 1 6 0c0 2-3 2-3 5l-9 7a1 1 0 0 0 1 2h16a1 1 0 0 0 1-2l-9-7',
      startGold:'M3 7c0-2 10-2 10 0s-10 2-10 0Zm0 0v5c0 2 10 2 10 0V7 M3 12v5c0 2 10 2 10 0v-5 M14 11c0-2 7-2 7 0s-7 2-7 0Zm0 0v8c0 2 7 2 7 0v-8',
      scouting:'M4 10 7 5 10 5 10 17 M14 17V5h3l3 5 M10 11h4 M3 16a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M13 16a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
      interestCap:'M5 3h11l3 3v15H5Z M8 8h7 M8 12h4 M16 12v9 M19 14h-4c-2 0-2 3 0 3h2c2 0 2 3 0 3h-4',
      trainingBoost:'M3 8v8 M6 5v14 M9 8v8 M9 12h6 M15 8v8 M18 5v14 M21 8v8',
      policyOffers:'M8 4H5v18h14V4h-3 M8 2h8v5H8Z M8 11l2 2-2 2 M15 11l2 2-2 2 M11 19l4-3',
      benchSeat:'M3 5h7v8H3Z M14 5h7v8h-7Z M2 16h20 M5 13v8 M19 13v8',
      filmStudy:'M3 5h18v15H3Z M9 9l6 4-6 4Z'
    };
    return `<svg class="legacy-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[id]||paths.crown}"/></svg>`;
  }
  function renderPointShop(){
    const profile=game.profile;
    const upgrades=C.META_UPGRADES.map(item=>{const level=profile.upgrades[item.id]||0,price=item.prices[level],max=price===undefined;return `<div class="panel meta-shop-item legacy-upgrade${max?' is-max':''}"><div class="legacy-upgrade-icon">${legacyIcon(item.id)}</div><div class="legacy-upgrade-copy"><strong>${item.name} <small>Lv.${level}/${item.prices.length}</small></strong><span>${item.effect}</span><div class="legacy-levels" aria-label="当前等级 ${level}，最高 ${item.prices.length}">${item.prices.map((_,index)=>`<i class="${index<level?'filled':''}"></i>`).join('')}</div></div><button class="btn small" data-act="meta-upgrade" data-id="${item.id}" ${max||profile.legend<price?'disabled':''}>${max?'已满级':`${price} 点`}</button></div>`}).join('');
    const legendary=C.GEAR.filter(item=>item.slot==='球衣'&&item.unlockable),unlocked=new Set(profile.jerseyUnlocks||[]),complete=unlocked.size>=legendary.length;
    const ownedJerseys=legendary.filter(item=>unlocked.has(item.id));
    const jerseyCards=ownedJerseys.map(item=>{const visual=equipmentJerseyVisual(item),effects=Object.entries(item.stats||{}).map(([key,value])=>`${C.LABELS[key]||key} +${value}`).join(' · ');return `<div class="meta-jersey unlocked${visual.className}"${visual.style}>${visual.logo}${jerseyArtwork(item)}<b>${item.name}</b><span class="legacy-jersey-stats">${effects}</span></div>`}).join('');
    const unlockedItem=C.GEAR.find(item=>item.id===lastJerseyUnlock);
    const shopNotice=pointShopMessage?`<p class="footer-note" role="status">${escapeText(pointShopMessage)}</p>`:'';
    const upgradePage=`${shopNotice}<div class="meta-shop-list">${upgrades}</div>`;
    const jerseyPage=`${shopNotice}<section class="panel jersey-unlock-panel legacy-gift-panel${ownedJerseys.length?' has-collection':''}"><h2>${complete?'传奇球衣已全部解锁':'解锁你的下一件传奇球衣'}</h2><div class="legacy-gift-stage"><img src="assets/legacy-gift-box.svg" alt="黑金传奇礼盒"></div><p>解锁后加入装备商店球衣池，每次不会重复</p><button class="btn button-4 legacy-unlock-button" data-act="jersey-unlock" ${complete||profile.legend<C.JERSEY_UNLOCK_PRICE?'disabled':''}>${complete?'已全部解锁':`解锁球衣 · ${C.JERSEY_UNLOCK_PRICE} 点`}</button>${unlockedItem?`<em class="legacy-unlock-result" role="status">本次解锁：${unlockedItem.name}</em>`:''}</section><section class="panel legacy-collection"><div class="legacy-collection-title"><h2>已解锁 <b>${ownedJerseys.length}/${legendary.length}</b></h2><span aria-hidden="true">${legacyIcon('crown')}</span></div>${jerseyCards?`<div class="meta-jersey-grid">${jerseyCards}</div>`:`<div class="legacy-collection-empty">${legacyIcon('hanger')}<p>你的传奇球衣收藏从这里开始</p></div>`}</section>`;
    const pointShopTabs=['upgrades','jerseys'],pointShopTabIndex=pointShopTabs.indexOf(pointShopTab),pointShopFromIndex=pointShopTabs.indexOf(pointShopSlideFrom);
    els.pointshop.markup=`<div class="profile-title-row"><div><div class="eyebrow">LEGACY SHOP</div><h1 class="title">点数商店</h1></div><button class="profile-home" data-act="home">返回主页</button></div><div class="legend-balance"><span class="legacy-coin" aria-hidden="true">${legacyIcon('crown')}</span><span>传奇点</span><b>${profile.legend}</b></div><div class="profile-tabs pointshop-tabs" role="tablist" style="--tab-index:${pointShopTabIndex};--from-tab:${pointShopFromIndex<0?pointShopTabIndex:pointShopFromIndex}"><button class="${pointShopTab==='upgrades'?'active':''}" data-act="pointshop-tab" data-id="upgrades">天赋加成</button><button class="${pointShopTab==='jerseys'?'active':''}" data-act="pointshop-tab" data-id="jerseys">传奇球衣</button><i key="pointshop-${pointShopFromIndex}-${pointShopTabIndex}" class="${pointShopTab}"></i></div><div class="pointshop-page">${pointShopTab==='upgrades'?upgradePage:jerseyPage}</div>`;
    pointShopSlideFrom=pointShopTab;
  }  let modal=document.createElement('div');modal.id='game-modal';document.body.appendChild(modal);adoptReactRenderer(modal);
  function rewardTaskCompleted(){return rewardTaskState?.tasks?.some(task=>task?.taskCode==='reward'&&task.status==='completed')===true}
  async function refreshRewardTaskState(){
    if(typeof window.ColorboxAI?.vatask?.getActivityTaskState!=='function')return null;
    try{
      const response=await withTimeout(window.ColorboxAI.vatask.getActivityTaskState(),2500);
      if(response?.code===200){rewardTaskState=response.data;rewardTaskError='';return response.data}
      rewardTaskError=response?.message||'激励广告任务状态读取失败，请稍后重试。';return null;
    }catch(_){rewardTaskError='激励广告任务状态读取失败，请稍后重试。';return null}
  }
  function renderRecruitSheet(r){
    const normalCost=C.recruitCost(r),packCost=C.recruitPackCost(r);
    modal.className='game-modal open recruit-sheet-modal';
    const actionButton=(action,label,meta,description,disabled=false)=>{
      const price=action==='recruit-ad'?(rewardVideoBusy?'<i class="ad-loading-icon" aria-hidden="true"></i>':'<img class="recruit-ad-icon" src="assets/reward-video-icon.svg" alt="观看广告">'):`<strong>${escapeText(meta)}</strong>`;
      return `<button type="button" class="${action==='recruit-ad'?`button-4${rewardVideoBusy?' ad-busy':''}`:'button-3'}" data-act="${action}" ${disabled?'disabled':''}><span><b>${escapeText(label)}</b><small>${escapeText(description)}</small></span>${price}</button>`;
    };
    const adUnavailable=r.rewardedRecruitUsed;
    modal.markup=`<section class="modal-card recruit-sheet" role="dialog" aria-modal="true" aria-labelledby="recruit-sheet-title"><div class="recruit-sheet-head"><div class="recruit-sheet-heading"><span>球星招募</span><h2 id="recruit-sheet-title">选择招募方式</h2></div><button type="button" data-act="recruit-sheet-close" aria-label="关闭招募方式">×</button></div><p class="recruit-sheet-balance">当前奖金 <b>${r.cash}</b></p><div class="recruit-sheet-actions">${actionButton('recruit-normal','普通招募',r.free>0?'免费':`${normalCost} 奖金`,r.free>0?`本轮还可免费招募 ${r.free} 次`:'从本轮候选球星中选择 1 名',r.cash<normalCost)}${actionButton('recruit-ten','十连招募',`${packCost} 奖金`,'连续招募10位球员',r.cash<packCost)}${actionButton('recruit-ad','看广告招募','','S级球员4选1（每回合一次）',rewardVideoBusy||adUnavailable)}</div>${recruitSheetMessage?`<p class="recruit-sheet-message" role="status">${escapeText(recruitSheetMessage)}</p>`:''}</section>`;
  }
  function startNewJourney(){
    const pool=[...C.availableTalents(game.profile)];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    talentOffer=pool.slice(0,3+(game.profile.upgrades?.policyOffers||0));selectedTalent=talentOffer[0].id;talentAdBusy=false;talentAdUnlocked=false;talentAdMessage='';showNewJourneyConfirm=false;go('talent');
  }
  function unlockHint(talent){
    return Object.entries(talent.unlock||{}).map(([key,value])=>({runs:`结算 ${value} 局`,clears:`通关主线 ${value} 次`,bestStage:`主线通过第 ${value} 关`,wins:`生涯获胜 ${value} 场`,discovered:`发现 ${value} 名球星`,bestEndless:`无尽到达第 ${value} 关`}[key]||'')).join(' · ');
  }
  function pendingPlayerPreview(id,r){
    const star=C.BY_ID[id],value=star.attrs[star.best];
    const own=r.owned[id];
    const ownedIdentities=new Set(Object.keys(r.owned).map(C.identityOf));
    const bond=C.starSynergies(id).map(item=>({item,count:item.ids.filter(player=>ownedIdentities.has(player)||player===C.identityOf(id)).length})).sort((a,b)=>b.count-a.count||a.item.ids.length-b.item.ids.length)[0];
    const status=own
      ?`升星 · ${own.stars}★→${Math.min(C.starLimit(r,id),own.stars+1)}★`
      :bond?`羁绊 · ${bond.item.name} ${bond.count}/${bond.item.ids.length}`:'暂无关联羁绊';
    return `<div class="pending-player-preview ${tierClass[star.tier]}"><div><span>${tierName[star.tier]}</span><small>${status}</small></div><strong>${value}</strong><h3>${star.name}</h3><p>推荐 · ${C.LABELS[star.best]}位</p><em>出售可得 ${C.saleValue(id,1,r)} 奖金</em></div>`;
  }
  function renderPending(){
    if(showFeedback){
      modal.className='game-modal open';
      window.SupFusionReactScreens.renderFeedback(modal,{draft:feedbackDraft,remaining:2000-Array.from(feedbackDraft.trim()).length,busy:feedbackBusy,message:feedbackMessage});
      return;
    }
    if(jerseyUnlockResult){
      const item=C.GEAR.find(gear=>gear.id===jerseyUnlockResult);
      modal.className='game-modal open';
      modal.markup=`<section class="modal-card jersey-unlock-result" role="dialog" aria-modal="true" aria-labelledby="jersey-unlock-title"><h2 id="jersey-unlock-title">获得传奇球衣</h2><div class="jersey-unlock-art">${jerseyArtwork(item)}</div><h3>${escapeText(item.name)}</h3><p>已加入传奇球衣收藏</p><button class="btn button-1 wide" data-act="jersey-unlock-confirm">确认</button></section>`;
      return;
    }
    const r=game.run,id=r?.pending;
    if(sellConfirm&&screen==='roster'&&r){
      const {id:playerId,index}=sellConfirm,star=C.BY_ID[playerId];
      if(r.bench[index]!==playerId||!star||r.lastBattle){sellConfirm=null;renderPending();return}
      modal.className='game-modal open sell-confirm-modal';
      modal.markup=`<section class="modal-card sell-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="sell-confirm-title"><div class="recruit-sheet-head"><div class="recruit-sheet-heading"><span>备战席</span><h2 id="sell-confirm-title">确认出售球员？</h2></div><button type="button" class="button-8" data-act="sell-cancel" aria-label="取消出售">×</button></div><p>出售 ${star.name} 后将从备战席移除。</p><div class="sell-confirm-value">可获得 <b>${C.saleValue(playerId,r.owned[playerId]?.stars||1,r)}</b> 奖金</div><div class="expand-actions"><button class="btn dark button-2" data-act="sell-cancel">取消</button><button class="btn button-1" data-act="sell-confirm">确认出售</button></div></section>`;
      return;
    }
    if(showPosterPreview&&screen==='report'&&r?.ended){
      const busy=posterPhase==='rendering'||posterPhase==='uploading'||posterPhase==='opening';
      const status=posterMessage?`<p class="career-poster-status" role="status">${escapeText(posterMessage)}</p>`:'';
      modal.className='game-modal open';
      modal.markup=`<section class="modal-card career-poster-modal" role="dialog" aria-modal="true" aria-labelledby="career-poster-title"><div class="modal-head"><div><span>本局生涯报告</span><h2 id="career-poster-title">结果海报</h2></div><button type="button" class="button-8" data-act="poster-close" aria-label="关闭海报预览" ${busy?'disabled':''}>×</button></div><div class="career-poster-result">第 ${r.lastBattle?.stage||r.stage} 关 · GOAT ${Math.round(r.maxGoat||r.lastBattle?.goat||C.goatScore(r))} · ${r.wins} 胜 ${r.losses} 负</div>${posterPreviewUrl?`<div class="career-poster-preview"><img src="${posterPreviewUrl}" alt="本局生涯报告海报预览"></div>`:`<div class="career-poster-placeholder">${posterPhase==='error'?'预览不可用，请关闭后重试。':'正在生成海报预览…'}</div>`}${status}<div class="career-poster-actions"><button class="btn button-1" data-act="poster-share" ${busy||!posterBlob?'disabled':''}>${busy?'<i class="ad-loading-icon" aria-hidden="true"></i>':''}发帖分享</button></div></section>`;
      return;
    }
    if(showRecruitSheet&&screen==='roster'&&r){renderRecruitSheet(r);return}
    if(showCurrentTalent&&r){
      const talent=C.KNOWN_TALENTS.find(item=>item.id===r.talent);
      modal.className='game-modal open';
      modal.markup=`<div class="modal-card current-talent-modal" role="dialog" aria-modal="true" aria-labelledby="current-talent-title"><div class="modal-head"><div><span>当前天赋 · ${talent?.category||'开局天赋'}</span><h2 id="current-talent-title">${talent?.name||'开局天赋'}</h2></div><button data-act="current-talent-close" aria-label="关闭">×</button></div><p>${talent?.gain||'当前旅程的开局天赋'}</p><p>代价：${talent?.cost||'无'}</p></div>`;
      return;
    }
    if(showNewJourneyConfirm&&screen==='home'){
      modal.className='game-modal open';
      modal.markup=`<div class="modal-card new-journey-modal" role="dialog" aria-modal="true" aria-labelledby="new-journey-title"><div class="modal-head"><div><span>旅程确认</span><h2 id="new-journey-title">开启另一段旅程？</h2></div><button data-act="new-cancel" aria-label="关闭">×</button></div><p>当前第 ${r.stage} 关的旅程将按自动认输结算：GOAT 峰值、传奇点和本局图鉴会先写入档案。</p><div class="expand-actions"><button class="btn dark" data-act="new-cancel">取消</button><button class="btn" data-act="new-confirm">确认开启</button></div></div>`;
      return;
    }
    if(showTalentCatalog&&screen==='talent'){
      modal.className='game-modal open';
      modal.markup=`<div class="modal-card talent-catalog-modal" role="dialog" aria-modal="true" aria-labelledby="talent-catalog-title"><div class="modal-head"><div><span>开局天赋图鉴</span><h2 id="talent-catalog-title">${C.TALENTS.length} 条融合路线</h2></div><button data-act="talent-catalog-close" aria-label="关闭">×</button></div><div class="talent-catalog-list">${C.TALENTS.map(talent=>{const unlocked=C.talentUnlocked(talent,game.profile);return `<div class="talent-catalog-item ${unlocked?'':'locked'}"><div><strong>${talent.name}</strong><span>${talent.category} · ${unlocked?'已解锁':unlockHint(talent)}</span></div><p>${talent.gain}</p><small>${talent.cost==='无'?'无代价':`代价：${talent.cost}`}</small></div>`}).join('')}</div></div>`;
      return;
    }
    if(showStrategyPicker&&screen==='duel'&&r){
      modal.className='game-modal open';
      const foe=C.opponent(r);
      const opening=C.openingEffect(r);
      const penalty=opening.ignoreStrategyPenalty?'无惩罚':`-${4+(opening.strategyPenalty||0)}%`;
      modal.markup=`<div class="modal-card strategy-modal" role="dialog" aria-modal="true" aria-labelledby="strategy-modal-title"><div class="modal-head"><div><span>本关对手 · ${foe.name}</span><h2 id="strategy-modal-title">选择本场策略</h2></div><button data-act="close-strategy" aria-label="关闭">×</button></div><p>结合对球员打法的了解，选择一项策略后立即开始单挑。</p><div class="strategy-options">${Object.entries(C.STRATEGIES).map(([strategyId,item])=>`<button data-act="strategy" data-id="${strategyId}"><b>${item.name}</b><small>${item.description.replace('-4%',penalty)}</small></button>`).join('')}</div></div>`;
      return;
    }
    if(showExpandConfirm&&screen==='roster'&&r){
      modal.className='game-modal open';
      modal.markup=`<div class="modal-card expand-modal" role="dialog" aria-modal="true" aria-labelledby="expand-modal-title"><div class="modal-head"><div><span>阵容管理</span><h2 id="expand-modal-title">扩容备战席</h2></div><button data-act="expand-close" aria-label="关闭">×</button></div><p>备战席上限 ${r.benchLimit} → ${r.benchLimit+1}（最多 ${Math.max(r.benchLimit,C.benchExpansionLimit(r))}）</p><div class="expand-actions"><button class="btn dark" data-act="expand-close">取消</button><button class="btn expand-confirm-button" data-act="expand-confirm"><span>确认</span><span class="expand-confirm-price">${cashPrice(10)}</span></button></div></div>`;
      return;
    }
    if(gearReplaceId&&r&&screen==='shop'){
      const next=C.GEAR.find(item=>item.id===gearReplaceId),ownedId=next&&[...r.gear,...(r.gearReserve||[])].find(itemId=>C.GEAR.find(item=>item.id===itemId)?.slot===next.slot),current=C.GEAR.find(item=>item.id===ownedId);
      if(!next||!current||next.slot==='球衣'){gearReplaceId='';renderPending();return}
      const price=C.gearPrice(r,next),net=Math.max(0,price-current.sellPrice);
      const compareCard=(item,label,className)=>{
        const visual=equipmentJerseyVisual(item);
        return `<div class="gear-compare-card ${className} gear-tier-${item.rarity.toLowerCase()}${visual.className}"${visual.style}>${visual.logo}<span>${label} · ${item.slot}</span><strong>${item.displayName}</strong><p>${item.description}</p><small>${className==='incoming'?`购买价 ${price} 奖金`:`回收价 ${item.sellPrice} 奖金`}</small></div>`;
      };
      modal.className='game-modal open';
      modal.markup=`<div class="modal-card gear-replace-modal" role="dialog" aria-modal="true" aria-labelledby="gear-replace-title"><div class="modal-head"><div><span>装备替换确认</span><h2 id="gear-replace-title">确认替换${next.slot}？</h2></div><button data-act="gear-replace-cancel" aria-label="关闭">×</button></div><div class="gear-compare-list">${compareCard(next,'即将购买','incoming')}<div class="gear-compare-arrow">↓ 替换</div>${compareCard(current,'当前已有','current')}</div><p class="gear-replace-cost">支付 ${price} 奖金，回收旧装备获得 ${current.sellPrice} 奖金，实际支出 <b>${net}</b> 奖金</p><div class="expand-actions"><button class="btn dark" data-act="gear-replace-cancel">取消</button><button class="btn" data-act="gear-replace-confirm" data-id="${next.id}">确认替换</button></div></div>`;
      return;
    }
    if(gearDetailId&&r&&screen==='shop'){
      const item=C.GEAR.find(gear=>gear.id===gearDetailId);
      if(!item||![...r.gear,...(r.gearReserve||[])].includes(item.id)){gearDetailId='';renderPending();return}
      modal.className='game-modal open';
      modal.markup=`<div class="modal-card gear-detail-modal" role="dialog" aria-modal="true" aria-labelledby="gear-detail-title"><div class="modal-head"><div><span>${item.slot}</span><h2 id="gear-detail-title">${item.displayName}</h2></div><button data-act="gear-detail-close" aria-label="关闭">×</button></div><p>${item.description}</p></div>`;
      return;
    }
    if(!id&&detailStar&&r){
      const s=C.BY_ID[detailStar],own=r.owned[detailStar],owned=new Set(Object.keys(r.owned).map(C.identityOf));
      if(!s){detailStar='';detailContext=null;renderPending();return}
      const bondOwned=new Set(owned);
      if(detailContext?.kind==='other'){
        bondOwned.add(C.identityOf(s.id));
        if(r.offerMode==='ten-batch')r.offer.forEach((offerId,index)=>{if(r.batchSelected[index]!==false)bondOwned.add(C.identityOf(offerId))});
      }
      const effective=own?C.playerEffectiveStats(r,s.id):null,shown=effective?.stats||s.attrs;
      const fits=[...C.ATTRS].sort((a,b)=>shown[b]-shown[a]).slice(0,3),bonds=C.starSynergies(s.id);
      const canSell=detailContext?.kind==='bench'&&r.bench[detailContext.key]===s.id&&!r.lastBattle;
      const assigned=effective?.slot?C.LABELS[effective.slot]+'位':'未上阵';
      modal.className='game-modal open';
      modal.markup=`<div class="modal-card player-detail ${tierClass[s.tier]}">
        <div class="modal-head detail-head"><div><span>${tierName[s.tier]} · 球员详情</span><h2>${s.name}</h2><small>${s.role} · ${s.talent}</small></div><button data-act="close-star-detail" aria-label="关闭">×</button></div>
        <div class="detail-scroll">
          <div class="detail-growth"><b>${own?`${effective.stars}★/${C.starLimit(r,s.id)} · 训练 ${effective.train}/${C.trainingLimit(r,s.id)} · ${assigned}`:'未拥有 · 基础属性'}</b><span>${effective?.effect?'位置适配已激活':'当前位置无专属适配'}</span></div>
          <div class="detail-stats">${C.ATTRS.map(attr=>`<div><span>${C.LABELS[attr]}</span><b>${shown[attr]}</b>${own&&shown[attr]!==s.attrs[attr]?`<small>基础 ${s.attrs[attr]}</small>`:''}</div>`).join('')}</div>
          <section class="detail-section"><span>专属天赋</span><h3>${s.talent}</h3><p>${s.talentEffect.description}。</p></section>
          <section class="detail-section"><span>位置适配</span><div class="fit-list">${fits.map(attr=>`<b>${C.LABELS[attr]} ${shown[attr]}</b>`).join('')}</div></section>
          <section class="detail-section"><span>关联羁绊</span><div class="detail-bonds">${bonds.length?bonds.map(bond=>{const count=bond.ids.filter(player=>bondOwned.has(player)).length,active=count===bond.ids.length;return `<div class="${active?'active':''}"><strong>${bond.name}<small>${active?'已激活':`${count}/${bond.ids.length}`}</small></strong><p>${bond.ids.map(player=>`<em class="${bondOwned.has(player)?'owned':''}">${C.BY_ID[player].name}</em>`).join('')}</p><b>${bond.description}</b></div>`}).join(''):'<p>暂无关联羁绊</p>'}</div></section>
        </div>
        ${canSell?`<div class="detail-actions"><button class="detail-sell" data-act="sell-detail" data-id="${s.id}" data-index="${detailContext.key}">出售·获得${C.saleValue(s.id,effective.stars,r)}奖金</button></div>`:''}
      </div>`;
      return;
    }
    if(!id&&showBonds&&r){
      const owned=new Set(Object.keys(r.owned).map(C.identityOf));
      const bonds=C.SYNERGIES.map((bond,index)=>({...bond,index,count:bond.ids.filter(player=>owned.has(player)).length})).sort((a,b)=>
        Number(b.count===b.ids.length)-Number(a.count===a.ids.length)||b.count-a.count||a.index-b.index);
      modal.className='game-modal open';
      const activeCount=bonds.filter(b=>b.count===b.ids.length).length;
      modal.markup=`<div class="modal-card bonds-modal"><div class="modal-head"><h2>战术羁绊</h2><button data-act="close-bonds" aria-label="关闭">×</button></div><p class="bond-summary">已激活 ${activeCount}/${bonds.length}</p><div class="bond-list">${bonds.map(b=>`<div class="bond-entry ${b.count===b.ids.length?'active':''}"><strong>${b.name}<small>${b.count}/${b.ids.length} · ${b.count===b.ids.length?'已激活':'未激活'}</small></strong><span>${b.ids.map(player=>`<em class="${owned.has(player)?'owned':''}">${C.BY_ID[player].name}</em>`).join('')}</span><b>${b.description}</b></div>`).join('')}</div></div>`;
      return;
    }
    if(!id){modal.className='game-modal';modal.markup='';return}
    const s=C.BY_ID[id],batchRemaining=(r.batchQueue?.length||0)+1;modal.className='game-modal open';
    modal.markup=`<div class="modal-card pending-recruit-modal"><h2>备战席已满，决定${s.name}的去留</h2>${r.batchQueue?.length?`<div class="pending-batch-remaining">十连还需处理 ${batchRemaining} 张</div>`:''}${pendingPlayerPreview(id,r)}<p>选择融合面板或备战席中的一名球员替换并出售，也可以直接出售这名新球员。</p><div class="pending-replacements-scroll">
      <section class="pending-replace-section"><h3>替换备战席球员</h3><div class="modal-list">${r.bench.map((old,i)=>{const star=C.BY_ID[old];return `<button class="${tierClass[star.tier]}" data-act="resolve" data-mode="replace" data-index="${i}"><span class="pending-player-tier">${tierName[star.tier]}</span><span class="pending-player-copy"><b>${star.name}</b><small>备战席 · ${r.owned[old]?.stars||1}★</small></span><em>出售 ${C.saleValue(old,r.owned[old]?.stars,r)} 奖金</em></button>`}).join('')}</div></section>
      <section class="pending-replace-section"><h3>替换融合面板球员</h3><div class="modal-list pending-slot-list">${C.SLOTS.map(slot=>{const old=r.slots[slot.id],star=C.BY_ID[old];return old?`<button class="${tierClass[star.tier]}" data-act="resolve" data-mode="replace-slot" data-slot="${slot.id}"><span class="pending-player-tier">${tierName[star.tier]}</span><span class="pending-player-copy"><b>${star.name}</b><small>${slot.label}位 · ${r.owned[old]?.stars||1}★</small></span><em>出售 ${C.saleValue(old,r.owned[old]?.stars,r)} 奖金</em></button>`:''}).join('')}</div></section></div>
      <button class="btn wide pending-sell-new" data-act="resolve" data-mode="sell">出售${s.name}，保留当前阵容</button></div>`;
  }
  function placeFromElement(element){
    if(!element||element.dataset.act!=='place')return null;
    return {kind:element.dataset.kind,key:element.dataset.kind==='bench'?Number(element.dataset.key):element.dataset.key};
  }
  function hasPlayer(run,place){return !!(place.kind==='slot'?run.slots[place.key]:run.bench[place.key])}
  let dragStart=null,dragGhost=null,dragTarget=null,dragScrollFrame=0,suppressPlaceClick=false;
  function copyDragAppearance(source,clone){
    if(typeof window.getComputedStyle!=='function')return;
    const styles=window.getComputedStyle(source);
    for(let index=0;index<styles.length;index++){
      const property=styles[index];clone.style.setProperty(property,styles.getPropertyValue(property));
    }
    Array.from(source.children).forEach((child,index)=>copyDragAppearance(child,clone.children[index]));
  }
  function dropButtonAt(x,y){
    const element=document.elementFromPoint(x,y);
    return element?.closest('[data-act="place"]')||element?.closest('.slot,.bench-card')?.querySelector('[data-act="place"]')||null;
  }
  function clearDrag(){
    if(dragScrollFrame)cancelAnimationFrame(dragScrollFrame);
    dragScrollFrame=0;
    dragGhost?.remove();dragGhost=null;
    dragTarget?.classList.remove('drag-target');dragTarget=null;
    dragStart?.source?.classList.remove('drag-source');
    if(dragStart?.button?.hasPointerCapture?.(dragStart.pointerId))dragStart.button.releasePointerCapture(dragStart.pointerId);
    dragStart=null;
  }
  function autoScrollWhileDragging(){
    if(!dragStart?.moved){dragScrollFrame=0;return}
    const bounds=els.roster.getBoundingClientRect(),edge=54,y=dragStart.currentY;
    const delta=y<bounds.top+edge?-Math.min(12,Math.ceil((bounds.top+edge-y)/4)):y>bounds.bottom-edge?Math.min(12,Math.ceil((y-bounds.bottom+edge)/4)):0;
    if(delta)els.roster.scrollTop+=delta;
    dragScrollFrame=requestAnimationFrame(autoScrollWhileDragging);
  }
  document.addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-act="place"]');
    if(screen!=='roster'||!button||!game.run||game.run.lastBattle)return;
    const place=placeFromElement(button);
    if(!place||event.isPrimary===false||event.button>0)return;
    const source=button.closest('.slot,.bench-card');
    dragStart=hasPlayer(game.run,place)?{place,x:event.clientX,y:event.clientY,source,button,pointerId:event.pointerId,moved:false}:null;
    if(dragStart&&event.isTrusted&&button.setPointerCapture)button.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove',event=>{
    if(!dragStart||event.pointerId!==dragStart.pointerId)return;
    const distance=Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y);
    if(!dragStart.moved&&distance<8)return;
    if(!dragStart.moved){
      dragStart.moved=true;
      dragGhost=dragStart.source.cloneNode(true);copyDragAppearance(dragStart.source,dragGhost);
      dragStart.source.classList.add('drag-source');dragGhost.classList.add('drag-ghost');dragGhost.classList.remove('selected');dragGhost.classList.remove('drag-source');
      dragGhost.style.width=dragStart.source.getBoundingClientRect().width+'px';
      dragGhost.style.height=dragStart.source.getBoundingClientRect().height+'px';
      document.body.appendChild(dragGhost);
      dragScrollFrame=requestAnimationFrame(autoScrollWhileDragging);
    }
    dragStart.currentY=event.clientY;
    dragGhost.style.left=event.clientX+'px';dragGhost.style.top=event.clientY+'px';
    const target=dropButtonAt(event.clientX,event.clientY),place=placeFromElement(target);
    const same=place&&place.kind===dragStart.place.kind&&place.key===dragStart.place.key;
    const targetCard=!same&&target?target.closest('.slot,.bench-card'):null;
    if(targetCard!==dragTarget){dragTarget?.classList.remove('drag-target');dragTarget=targetCard;dragTarget?.classList.add('drag-target')}
    event.preventDefault();
  },{passive:false});
  document.addEventListener('pointerup',event=>{
    if(!dragStart||event.pointerId!==dragStart.pointerId)return;
    const start=dragStart;
    if(!start.moved){clearDrag();return}
    suppressPlaceClick=true;setTimeout(()=>{suppressPlaceClick=false},500);
    const target=dropButtonAt(event.clientX,event.clientY);
    const place=placeFromElement(target);
    clearDrag();
    if(place&&C.swapPositions(game.run,start.place,place)){
      selectedPlace=null;save();renderRoster();top();notify('换位成功，融合属性已刷新');
    }
  });
  document.addEventListener('pointercancel',clearDrag);
  async function handle(action,button){
    return performAction(action,button);
  }
  async function performAction(action,button){
    const r=game.run,id=button.dataset.id;
    if(action==='feedback-open'){
      if(screen!=='home'||feedbackBusy)return;
      showFeedback=true;feedbackMessage='';renderPending();$('feedback-content')?.focus?.();return;
    }
    if(action==='feedback-close'){
      if(feedbackBusy)return;
      showFeedback=false;feedbackMessage='';renderPending();return;
    }
    if(action==='feedback-submit'){
      if(!showFeedback||feedbackBusy)return;
      if(!window.SupFusionFeedback){feedbackMessage='反馈暂不可用，请刷新后再试。';renderPending();return}
      feedbackBusy=true;feedbackMessage='';renderPending();
      try{
        await window.SupFusionFeedback.submitUserFeedback(feedbackDraft);
        feedbackDraft='';feedbackMessage='反馈已提交，感谢你的建议。';
      }catch(error){feedbackMessage=error?.message||'提交结果暂不确定，请稍后确认后再试。'}
      finally{feedbackBusy=false;renderPending()}
      return;
    }
    if(rewardVideoBusy||talentAdBusy||reportReviveBusy)return;
    if(action==='home'||action==='report-new'){go('home');if(action==='report-new'){queueFinalization(r);syncSaveBackup();void syncPendingRuns()}return}
    if(cloudStartBusy)return;
    if(r?.lastBattle&&['roster','shop','recruit'].includes(action)){go('result');return}
    if(action==='home'){go('home');return}
    if(action==='career-report'){if(r?.ended){reportReviveMessage='';go('report')}return}
    if(action==='report-revive'){
      if(!r||!r.ended||r.reviveUsed||r.morale>0||r.lastBattle?.won!==false||reportReviveBusy)return;
      if(typeof window.ColorboxAI?.vatask?.completeRewardVideo!=='function'){reportReviveMessage='请在支持激励广告的虎扑 App 中打开活动后再试。';renderCareerReport();return}
      reportReviveBusy=true;reportReviveMessage='';renderCareerReport();
      try{
        const response=await window.ColorboxAI.vatask.completeRewardVideo();
        if(response?.code!==200||response?.data?.rewarded!==true){reportReviveMessage=response?.message||'广告未完整观看，本次没有恢复体力。';return}
        void refreshRewardTaskState();
        const bonus=C.reviveRun(game);
        if(bonus===false){reportReviveMessage='当前无法恢复体力，请刷新页面后重试。';return}
        r.cloudResumePending=!!r.cloudRunId;r.cloudFinished=false;
        if(r.cloudRunId||r.cloudStartPending){r.cloudResumePending=true;r.cloudFinalizationQueued=false;queueEvent(r,'resume')}
        reportReviveMessage='';save();go('roster');return;
      }catch(_){reportReviveMessage='激励广告拉起失败，请稍后重试。'}
      finally{reportReviveBusy=false;if(screen==='report')renderCareerReport()}
    }
    if(action==='report-poster'){
      if(!r?.ended||screen!=='report'||showPosterPreview)return;
      showPosterPreview=true;renderPending();await generateCareerPoster();
      return;
    }
    if(action==='poster-close'){closeCareerPoster();return}
    if(action==='poster-share'){
      if(!showPosterPreview||screen!=='report'||!posterBlob||posterPhase==='rendering'||posterPhase==='uploading'||posterPhase==='opening')return;
      try{
        await publishCareerPoster(posterBlob,careerReportSummary());
        const rewardedNow=!r.posterRewarded&&r.wins+r.losses>0;
        if(rewardedNow){r.posterRewarded=true;game.profile.legend+=100;save()}
        if(rewardedNow&&(r.cloudRunId||r.cloudStartPending)){r.cloudSharePending=true;save()}
        posterPhase='done';posterMessage=rewardedNow?'已获得奖励·100传奇点':'';renderCareerReport();
        void finishCloudRun(r);
      }catch(_){posterPhase='error';posterMessage='分享未完成，请稍后重试。'}
      if(showPosterPreview&&screen==='report')renderPending();
      return;
    }
    if(action==='profile'){go('profile');return}
    if(action==='leaderboard'){leaderboardTab='legend';go('leaderboard');void loadLeaderboard();return}
    if(action==='leaderboard-refresh'){if(screen==='leaderboard'&&!leaderboardBusy)void loadLeaderboard();return}
    if(action==='jersey-unlock-confirm'){jerseyUnlockResult='';renderPending();return}
    if(action==='leaderboard-tab'){if(screen==='leaderboard'&&['legend','ovr'].includes(id)){leaderboardTab=id;renderLeaderboard()}return}
    if(action==='pointshop'){go('pointshop');return}
    if(action==='profile-tier'){profileTier=['SSR','S','A','B','C'].includes(id)?id:'all';renderProfile();return}
    if(action==='profile-tab'){profileSlideFrom=profileTab;profileTab=['stars','bonds','jerseys'].includes(id)?id:'stars';renderProfile();return}
    if(action==='pointshop-tab'){pointShopSlideFrom=pointShopTab;pointShopTab=['upgrades','jerseys'].includes(id)?id:'upgrades';renderPointShop();els.pointshop.scrollTo({top:0,behavior:'auto'});return}
    if(action==='meta-upgrade'){if(C.buyMetaUpgrade(game.profile,id)){save();renderPointShop()}return}
    if(action==='meta-unlock'){if(C.buyMetaUnlock(game.profile,id)){save();renderPointShop()}return}
    if(action==='jersey-unlock'){
      if(jerseyUnlockResult)return;
      const item=C.unlockJersey(game.profile);
      if(item){lastJerseyUnlock=item.id;jerseyUnlockResult=item.id;pointShopMessage='';save()}
      renderPointShop();renderPending();return;
    }
    if(action==='new'){
      if(r&&!r.ended){showNewJourneyConfirm=true;renderPending();return}
      if(r?.ended){queueFinalization(r);archiveCloudRun(r);void finishCloudRun(r)}
      startNewJourney();return;
    }
    if(action==='new-cancel'){showNewJourneyConfirm=false;renderPending();return}
    if(action==='new-confirm'){if(showNewJourneyConfirm&&r&&!r.ended){C.finishRun(game);queueFinalization(r);archiveCloudRun(r);void finishCloudRun(r);save();startNewJourney()}return}
    if(action==='continue'){if(!r||r.ended)return;go(r.lastBattle?'result':C.starterCount(r)<6?'recruit':'roster');return}
    if(action==='talent'){selectedTalent=id;renderTalent();return}
    if(action==='talent-ad'){
      if(screen!=='talent'||talentAdBusy||talentAdUnlocked)return;
      if(typeof window.ColorboxAI?.vatask?.completeRewardVideo!=='function'){talentAdMessage='请在支持激励广告的虎扑 App 中打开活动后再试。';renderTalent();return}
      talentAdBusy=true;talentAdMessage='';renderTalent();
      try{
        const response=await window.ColorboxAI.vatask.completeRewardVideo();
        if(response?.code!==200||response?.data?.rewarded!==true){talentAdMessage=response?.message||'广告未完整观看，未解锁自选天赋。';return}
        void refreshRewardTaskState();
        talentAdUnlocked=true;talentOffer=C.availableTalents(game.profile);talentAdMessage='已解锁自选天赋，请在上方选择。';
      }catch(error){talentAdMessage=error?.message||'广告拉起失败，请稍后重试。'}
      finally{talentAdBusy=false;if(screen==='talent')renderTalent()}
      return;
    }
    if(action==='talent-catalog'){showTalentCatalog=true;renderPending();return}
    if(action==='talent-catalog-close'){showTalentCatalog=false;renderPending();return}
    if(action==='current-talent-open'){if(r){showCurrentTalent=true;renderPending()}return}
    if(action==='current-talent-close'){showCurrentTalent=false;renderPending();return}
    if(action==='begin'){
      if(cloudStartBusy)return;
      if(screen!=='talent'||!talentOffer.some(talent=>talent.id===selectedTalent))return;
      const talent=selectedTalent||talentOffer[0].id;
      archiveCloudRun(game.run);
      const progress={...(game.profile.upgrades||{}),jerseyUnlocks:[...(game.profile.jerseyUnlocks||[])]},seed=localSeed();
      game.run=C.createRun(talent,seed,progress);
      const run=game.run;run.cloudProofVersion=cloudEnabled()?3:0;run.cloudSequence=0;run.cloudOperations=[];run.cloudOutbox=[];
      if(cloudEnabled())run.cloudStartPending={requestId:requestId(),talent,seed,displayName:playerName,progress};
      selectedPlace=null;selectedOffer='';rosterTraining=false;strategy='collapse';save();go('recruit');return;
    }
    if(action==='roster'){go('roster');return}
    if(action==='recruit'){
      if(!r||r.ended||r.lastBattle)return;
      if(r.offerMode==='ten-batch'){go('recruit');return}
      showRecruitSheet=true;recruitSheetMessage='';renderPending();return;
    }
    if(action==='recruit-sheet-close'){showRecruitSheet=false;recruitSheetMessage='';renderPending();return}
    if(action==='recruit-normal'){
      if(!r||r.ended||r.lastBattle||r.free<=0&&r.cash<C.recruitCost(r))return;
      showRecruitSheet=false;recruitSheetMessage='';go('recruit');return;
    }
    if(action==='recruit-ten'){
      if(!r||r.lastBattle||!C.buyRecruitPack(r,10)){recruitSheetMessage='当前奖金不足，无法购买十连招募。';renderPending();return}
      showRecruitSheet=false;recruitSheetMessage='';selectedOffer='';batchRevealPending=true;save();go('recruit');return;
    }
    if(action==='recruit-ad'){
      if(!r||r.rewardedRecruitUsed||rewardVideoBusy)return;
      if(typeof window.ColorboxAI?.vatask?.completeRewardVideo!=='function'){
        recruitSheetMessage='请在支持激励广告的虎扑 App 中打开活动后再试。';renderPending();return;
      }
      rewardVideoBusy=true;recruitSheetMessage='';renderPending();
      try{
        const response=await window.ColorboxAI.vatask.completeRewardVideo();
        if(response?.code!==200||response?.data?.rewarded!==true){recruitSheetMessage=response?.message||'广告未完整观看，本次没有获得招募奖励。';return}
        void refreshRewardTaskState();
        if(!C.grantRewardedSOffer(r)){recruitSheetMessage='当前无法生成 S 级招募候选，请稍后再试。';return}
        showRecruitSheet=false;recruitSheetMessage='';selectedOffer='';save();go('recruit');return;
      }catch(_){recruitSheetMessage='激励广告拉起失败，请稍后重试。'}
      finally{rewardVideoBusy=false;if(showRecruitSheet)renderPending()}
    }
    if(action==='shop'){go('shop');return}
    if(action==='duel'){if(r?.lastBattle){go('result');return}if(!r||C.starterCount(r)<6){notify('先招满六个能力槽');return}go('duel');return}
    if(action==='select-offer'){
      if(r?.offerMode==='ten-batch'){
        const index=Number(button.dataset.index);if(!Number.isInteger(index)||index<0||index>=r.offer.length)return;
        if(!C.toggleRecruitBatchSelection(r,index))return;
        save();renderRecruit();return;
      }
      selectedOffer=id;renderRecruit();return;
    }
    if(action==='toggle-recruit-batch'){
      if(r?.offerMode!=='ten-batch')return;
      const selectAll=!r.batchSelected.every(Boolean);r.batchSelected=r.offer.map(()=>selectAll);save();renderRecruit();return;
    }
    if(action==='star-detail'){detailStar=id;detailContext={kind:'other'};renderPending();return}
    if(action==='close-star-detail'){detailStar='';detailContext=null;renderPending();return}
    if(action==='reroll'){if(C.starterCount(r)<6)return;if(!C.refreshOffer(r)){notify('刷新所需奖金不足');return}selectedOffer='';save();renderRecruit();top();return}
    if(action==='pick'){
      const answer=C.recruit(r,selectedOffer);
      if(!answer.ok){notify(answer.reason);return}
      save();top();
      if(answer.kind==='pending'){renderPending();return}
      notify(answer.kind==='duplicate'?answer.star.name+' 已升星':answer.star.name+' 已加入'+(answer.kind==='bench'?'备战席':'首发'));
      selectedOffer='';selectedPlace=null;
      if(r.recruitCredits>0||C.starterCount(r)<6&&(r.free>0||r.cash>=C.recruitCost(r))){C.makeOffer(r);save();renderRecruit()}else go('roster');
      return;
    }
    if(action==='confirm-recruit-batch'){
      const answer=C.confirmRecruitBatch(r,r.batchSelected);
      if(!answer.ok)return;
      selectedOffer='';selectedPlace=null;save();top();
      if(answer.pending){renderPending();return}
      go('roster');return;
    }
    if(action==='resolve'){
      const mode=button.dataset.mode,target=mode==='replace-slot'?button.dataset.slot:Number(button.dataset.index);
      if(!C.resolvePending(r,mode,target))return;
      selectedPlace=null;save();notify(mode==='sell'?'新球星已出售':'阵容已替换');
      if(r.batchQueue?.length){
        const batch=C.advanceRecruitBatch(r);save();
        if(batch.pending){renderPending();return}
      }
      go('roster');return;
    }
    if(action==='sell-detail'||action==='sell-bench'){
      const index=Number(button.dataset.index);
      if(!r||r.lastBattle||!Number.isInteger(index)||r.bench[index]!==id)return;
      sellConfirm={id,index};renderPending();return;
    }
    if(action==='sell-cancel'){sellConfirm=null;renderPending();return}
    if(action==='sell-confirm'){
      if(!sellConfirm||!r||r.lastBattle)return;
      const {id:playerId,index}=sellConfirm;
      if(r.bench[index]!==playerId){sellConfirm=null;renderPending();return}
      const value=C.sellBench(r,index);
      if(!value)return;
      sellConfirm=null;detailStar='';detailContext=null;selectedPlace=null;save();renderRoster();renderPending();top();return;
    }
    if(action==='toggle-training'){rosterTraining=!rosterTraining;selectedPlace=null;renderRoster();return}
    if(action==='bonds'){showBonds=true;renderPending();return}
    if(action==='close-bonds'){showBonds=false;renderPending();return}
    if(action==='place'){
      const place=placeFromElement(button);
      if(!place||!r)return;
      const playerId=place.kind==='slot'?r.slots[place.key]:r.bench[place.key];
      if(playerId){detailStar=playerId;detailContext=place;renderPending()}
      return;
    }
    if(action==='shop-tab'){shopSlideFrom=shopTab;shopTab=id;renderShop();return}
    if(action==='equip-gear'){if(C.equipGear(r,id)){save();go('shop')}return}
    if(action==='expand-open'){if(!r||r.cash<10||r.benchLimit>=C.benchExpansionLimit(r)||r.lastBattle)return;showExpandConfirm=true;renderPending();return}
    if(action==='expand-close'){showExpandConfirm=false;renderPending();return}
    if(action==='expand-confirm'){if(showExpandConfirm&&r&&!r.lastBattle&&C.expandBench(r)){showExpandConfirm=false;save();renderRoster();renderPending();top()}return}
    if(action==='train'){if(!r||r.lastBattle){go('result');return}if(C.train(r,id)){save();renderRoster({preserveScroll:true});top();notify('训练完成')}else notify('本关已训练、已满级或奖金不足');return}
    if(action==='buy-boost'){if(C.buyBoost(r,id)){save();go('shop');notify('赛前强化已生效')}else notify('奖金不足或商品已刷新');return}
    if(action==='buy-gear'){if(C.buyGear(r,id)){save();go('shop');notify('装备已购买')}else notify('奖金不足或已有该部位装备');return}
    if(action==='replace-gear'){
      gearReplaceId=id;renderPending();return;
    }
    if(action==='gear-replace-cancel'){gearReplaceId='';renderPending();return}
    if(action==='gear-replace-confirm'){
      if(id!==gearReplaceId)return;
      const oldId=C.replaceGear(r,id),old=C.GEAR.find(item=>item.id===oldId),next=C.GEAR.find(item=>item.id===id);
      gearReplaceId='';
      if(oldId){save();go('shop');notify(`${old?.displayName||'旧装备'}已出售，替换为${next?.displayName||'新装备'}`)}else {renderPending();notify('奖金不足或当前装备无法替换')}
      return;
    }
    if(action==='gear-detail-open'){gearDetailId=id;renderPending();return}
    if(action==='gear-detail-close'){gearDetailId='';renderPending();return}
    if(action==='sell-gear'){const value=C.sellGear(r,id);if(value){gearDetailId='';save();go('shop');notify('装备已出售')}return}
    if(action==='shop-refresh'){if(C.refreshShop(r,shopTab)){save();go('shop');notify('商店商品已刷新')}else notify('刷新所需奖金不足');return}
    if(action==='close-strategy'){showStrategyPicker=false;renderPending();return}
    if(action==='strategy'){
      if(!showStrategyPicker||screen!=='duel'||!Object.hasOwn(C.STRATEGIES,id))return;
      strategy=id;showStrategyPicker=false;
      const before=r?.cloudProofVersion===3?{cloudOperations:JSON.parse(JSON.stringify(r.cloudOperations||[]))}:null;
      const report=C.battle(game,strategy);
      if(!report){renderPending();notify('请先确认六个能力槽都有球员');return}
      if(before)void sendCloudBattle(before,strategy,r);
      save();go('result');return;
    }
    if(action==='battle'){
      if(r?.lastBattle){go('result');return}
      if(!r||C.starterCount(r)<6){notify('请先确认六个能力槽都有球员');return}
      showRecruitSheet=false;recruitSheetMessage='';showBonds=false;showCurrentTalent=false;showTalentCatalog=false;showExpandConfirm=false;gearDetailId='';gearReplaceId='';detailStar='';detailContext=null;showStrategyPicker=true;renderPending();return;
    }
    if(action==='retry'){if(C.continueRun(game,'retry')){save();go('roster')}return}
    if(action==='next'){if(C.continueRun(game,'next')){selectedPlace=null;save();go('roster')}return}
    if(action==='finish'){if(C.continueRun(game,'finish')){save();renderResult();finishCloudRun(r)}return}
  }
  document.addEventListener('input',event=>{
    if(!showFeedback||feedbackBusy||event.target.id!=='feedback-content')return;
    feedbackDraft=event.target.value;feedbackMessage='';
    const length=Array.from(feedbackDraft.trim()).length,remaining=2000-length;
    const count=$('feedback-count'),status=$('feedback-status'),submit=$('feedback-submit');
    if(count)count.textContent=remaining>=0?`还可输入 ${remaining} 字`:`已超出 ${-remaining} 字`;
    if(status)status.textContent='';
    if(submit)submit.disabled=length<1||length>2000;
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-act]');
    if(restoring||!button||button.disabled)return;
    const action=button.dataset.act;
    if(action==='place'&&suppressPlaceClick)return;
    handle(action,button);
  });
  async function init(){
    // Do not expose mutable game actions until the asynchronous local/cloud restore finishes.
    els.home.markup='<div class="panel game-loading" role="status">正在读取游戏存档…</div>';
    if(STORAGE.available()){
      try{const loaded=await STORAGE.load();game=restoreGame(loaded);if(loaded&&(loaded.profile?.talentRulesVersion!==2||loaded?.run&&JSON.stringify(loaded.run.gear)!==JSON.stringify(game.run?.gear)))save()}catch(_){notify('存档读取失败，本次从新旅程开始')}
    }
    restoring=false;
    go('home');
    loadPlayerName();
    refreshRewardTaskState();
    syncSaveBackup();
    void syncPendingRuns(true);
  }
  window.addEventListener('online',()=>{void syncPendingRuns()});
  init();
})();
