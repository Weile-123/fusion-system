const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const C=require('../h5/game-core.js');
// React server rendering is a reference oracle for the unchanged JSX templates;
// the shipped DOM renderer is exercised separately in dom-runtime.test.cjs.
const jsx=fs.readFileSync('src/react-screens.jsx','utf8').replace("import { createElement, Fragment, createRoot, flushSync } from './dom-runtime.mjs';", "import { createElement, Fragment } from 'react'; import { createRoot } from 'react-dom/client'; import { flushSync } from 'react-dom';")+'\nexport {MarkupScreen,HomeScreen,TalentScreen,TopBar,DuelScreen,ResultScreen,CareerReportScreen,LeaderboardScreen,FeedbackScreen,AnnouncementScreen};';
const compiled=transformSync(jsx,{loader:'jsx',format:'cjs',jsx:'automatic'}).code,moduleShim={exports:{}};
new Function('require','module','exports',compiled)(require,moduleShim,moduleShim.exports);
const components=moduleShim.exports;
const {documentFixture}=require('./dom-fixture.cjs');
const shippedRuntimeModule={exports:{}};
const shippedRuntimeCode=transformSync(fs.readFileSync('src/dom-runtime.mjs','utf8'),{format:'cjs'}).code;
new Function('module','exports',shippedRuntimeCode)(shippedRuntimeModule,shippedRuntimeModule.exports);
const shippedRenderer=shippedRuntimeModule.exports;
const shippedComponents=(()=>{
  const source=fs.readFileSync('src/react-screens.jsx','utf8')+'\nexport {MarkupScreen,HomeScreen,TalentScreen,TopBar,DuelScreen,ResultScreen,CareerReportScreen,LeaderboardScreen,FeedbackScreen,AnnouncementScreen};';
  const code=transformSync(source,{loader:'jsx',format:'cjs',jsx:'transform',jsxFactory:'createElement',jsxFragment:'Fragment'}).code;
  const module={exports:{}};
  new Function('require','module','exports',code)(()=>shippedRenderer,module,module.exports);
  return module.exports;
})();
function runtime(sdk={},timers={}){
  const screens={},listeners={},saved=[],rendered=[],backups=[];
  function element(id=''){
    return {id,dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},
      appendChild(child){if(child?.id)screens[child.id]=child},append(){},replaceChildren(){},scrollTo(){},querySelector(){return null},querySelectorAll(){return []},
      getBoundingClientRect(){return {height:0,width:400,top:0}},setAttribute(){},removeAttribute(){}};
  }
  const document={getElementById:id=>screens[id]||=(element(id)),createElement:()=>element(),body:element(),
    querySelector:selector=>selector==='.app'||selector==='.top'?(screens[selector]||=element()):null,
    querySelectorAll:()=>[],addEventListener:(name,fn)=>{listeners[name]=fn}};
  const domRoots=new WeakMap();
  const render=(el,component,props)=>{
    let native=domRoots.get(el);
    if(!native){const fixture=documentFixture();native={element:fixture.element,root:shippedRenderer.createRoot(fixture.element)};domRoots.set(el,native)}
    native.root.render(shippedRenderer.createElement(shippedComponents[component.name],props));
    el.nativeOutput=native.element;
    el.output=renderToStaticMarkup(React.createElement(component,props));rendered.push(el.id);
  };
  const window={SupFusionGameCore:C,ColorboxAI:sdk,ACTIVITY_API_BASE:'https://example.invalid',ACTIVITY_ENV_ID:'test',
    FusionStorage:{available:()=>true,localAvailable:()=>true,platformAvailable:()=>!!sdk.storage,save:async value=>saved.push(structuredClone(value)),syncToCloud:async value=>backups.push(structuredClone(value))},
    SupFusionReactScreens:{renderMarkup:(el,html)=>render(el,components.MarkupScreen,{html})},addEventListener(){}};
  for(const name of ['Home','Talent','TopBar','Duel','Result','CareerReport','Leaderboard','Feedback','Announcement'])window.SupFusionReactScreens['render'+name]=(el,props)=>render(el,components[name+'Screen']||components.TopBar,props);
  const context={window,document,console,WeakMap,URL,Blob,Promise,setTimeout:timers.setTimeout||(()=>0),clearTimeout:timers.clearTimeout||(()=>{}),requestAnimationFrame(){}};
  vm.createContext(context);
  let source=fs.readFileSync('h5/game-ui.js','utf8');
  source=source.replace('  init();',`  window.audit={restoreGame,handle,go,syncPendingRuns,syncSaveBackup,flushCloudBattle,finishCloudRun,loadPlayerName,loadLeaderboard,publishCareerPoster,careerReportSummary,getGame:()=>game,setGame:value=>{game=value},state:()=>({screen,talentAdBusy,rewardVideoBusy,reportReviveBusy,playerName}),setTalent:id=>{talentOffer=C.TALENTS.filter(t=>t.id===id);selectedTalent=id},renderPending};`);
  vm.runInContext(source,context);
  return {audit:window.audit,window,screens,saved,rendered,backups,document,fire:(name,event)=>listeners[name](event),input:value=>listeners.input({target:{id:'feedback-content',value}}),click:(act,id='')=>window.audit.handle(act,{dataset:{id}})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('new recovery counters and overflow health survive save restoration',()=>{
  const app=runtime(),game=C.createGame();game.run=C.createRun('steady_interest',911);
  game.run.morale=8;game.run.bondWinHealCounters={royal_recovery:1,purple_gold_recovery:2,champion_recovery:3};
  const restored=app.audit.restoreGame(JSON.parse(JSON.stringify(game)));
  assert.equal(restored.run.morale,8);
  assert.equal(JSON.stringify(restored.run.bondWinHealCounters),JSON.stringify(game.run.bondWinHealCounters));
  app.audit.setGame(restored);app.audit.go('roster');assert.match(app.screens['.top'].output,/3\/3 \+5/);
  game.run=C.createRun('steady_interest',911,{},1);
  const legacy=app.audit.restoreGame(JSON.parse(JSON.stringify(game)));
  assert.equal(legacy.run.balanceRulesVersion,undefined);assert.equal(C.recruitPackCost(legacy.run,10),76);
});
const V=require('../activity/cloudfunctions/activity_api/verified-game.js');
function rankedSdk(onRequest){return {cloud:{request:async args=>{
  const response=onRequest?await onRequest(args):{statusCode:200,code:0,data:args.url.endsWith('/start')?{runId:args.data.requestId,seed:args.data.seed,proofVersion:3}:{}};
  if(args.url.endsWith('/start')&&response?.data)response.data.balanceRulesVersion=args.data.balanceRulesVersion||1;
  return response;
}}}}
test('all twenty talents traverse actual UI controller drafts, roster, shop, duel and report renderers',async()=>{
  const app=runtime(rankedSdk());
  for(const talent of C.TALENTS){
    app.audit.setGame(C.createGame());app.audit.go('talent');app.audit.setTalent(talent.id);
    await app.click('begin');const game=app.audit.getGame(),run=game.run;
    for(let i=0;i<6;i++){await app.click('select-offer',run.offer[0]);await app.click('pick')}
    assert.equal(C.starterCount(run),6,talent.id);
    app.audit.go('roster');await app.click('shop');await app.click('shop-tab','gear');await app.click('shop-tab','jersey');
    await app.click('duel');await app.click('battle');await app.click('strategy','outside');
    await app.audit.flushCloudBattle(run);assert.ok(app.screens.result.output.includes('关键回合'));
    C.finishRun(game);app.audit.go('report');assert.ok(app.screens.report.output.includes('最终阵容'));
    await app.click('report-new');assert.equal(app.audit.state().screen,'home');
    await app.click('profile');await app.click('profile-tab','bonds');await app.click('profile-tab','jerseys');
    await app.click('pointshop');await app.click('pointshop-tab','jerseys');
  }
});
test('failed cloud battles survive reload and are retried without dropping the run identifier',async()=>{
  let fail=true,submissions=0;
  const app=runtime(rankedSdk(async args=>{
    if(args.url.endsWith('/battle')){submissions++;if(fail)throw Error('网络失败')}
    return {statusCode:200,code:0,data:{}};
  }));
  const game=C.createGame(),run=game.run=C.createRun('captain',911);run.cloudRunId='00000000-0000-0000-0000-000000000001';run.cloudProofVersion=3;run.cloudSequence=0;
  for(let i=0;i<6;i++){const offer=C.makeOffer(run);C.recruit(run,offer[0])}
  const prior=structuredClone(run);C.battle(game,'outside');run.cloudPendingBattle={run:prior,strategy:'outside'};
  app.audit.setGame(game);assert.equal(await app.audit.flushCloudBattle(run),false);assert.ok(run.cloudRunId);
  const restored=app.audit.restoreGame(JSON.parse(JSON.stringify(game)));assert.equal(restored.run.cloudOutbox.length,1);
  app.audit.setGame(restored);fail=false;assert.equal(await app.audit.flushCloudBattle(restored.run),true);
  assert.equal(restored.run.cloudOutbox.length,0);assert.equal(submissions,2);
});
test('revival reopens the cloud run before finalization and share reward retries remain pending',async()=>{
  const calls=[];let shareFails=true;
  const app=runtime(rankedSdk(async args=>{const name=args.url.split('/').at(-1);calls.push(name);if(name==='share'&&shareFails)throw Error('网络失败');return {statusCode:200,code:0,data:{}}}));
  const game=C.createGame(),run=game.run=C.createRun('captain',911);
  Object.assign(run,{cloudRunId:'00000000-0000-0000-0000-000000000001',cloudResumePending:true,cloudFinished:false,cloudSharePending:true,ended:true});
  app.audit.setGame(game);assert.equal(await app.audit.finishCloudRun(run),false);
  assert.deepEqual(calls,['resume','finish','share']);assert.equal(run.cloudSharePending,true);
  shareFails=false;assert.equal(await app.audit.finishCloudRun(run),true);assert.deepEqual(calls,['resume','finish','share','share']);
  assert.equal(run.cloudSharePending,false);
});
test('native ads require both success fields and lock all competing actions',async()=>{
  let release,adCalls=0,stateCalls=0;
  const app=runtime({vatask:{completeRewardVideo:()=>{adCalls++;return new Promise(resolve=>release=resolve)},getActivityTaskState:async()=>{stateCalls++;return {code:200,data:{tasks:[]}}}}});
  await app.click('new');const pending=app.click('talent-ad');await tick();
  await app.click('home');await app.click('talent-ad');assert.equal(adCalls,1);assert.equal(app.audit.state().screen,'talent');
  release({code:200,data:{rewarded:false}});await pending;assert.equal(stateCalls,0);
  const success=app.click('talent-ad');await tick();release({code:200,data:{rewarded:true}});await success;
  assert.equal(stateCalls,1);assert.equal(app.audit.state().talentAdBusy,false);
});
test('earned captain health, capacity and share flags survive the production restore path',()=>{
  const app=runtime(),game=C.createGame();game.run=C.createRun('captain',911);
  Object.assign(game.run,{morale:12,talentWinHealGranted:9,posterRewarded:true,cloudSharePending:true});
  const restored=app.audit.restoreGame(game);assert.equal(restored.run.morale,12);assert.equal(restored.run.talentWinHealGranted,9);assert.equal(restored.run.cloudSharePending,true);
  game.run=C.createRun('deep_bench',911,{benchSeat:5});assert.equal(app.audit.restoreGame(game).run.benchLimit,14);
  const id=C.STARS[0].id;game.run.stage=8;game.run.slots.three=id;game.run.owned[id]={stars:20,train:8,trainedAt:8};
  const sanitized=app.audit.restoreGame(game);assert.equal(sanitized.run.owned[id].stars,3);assert.equal(sanitized.run.owned[id].train,3);
});

test('all unlocked jerseys render in the shop and archive through the production React parser',async()=>{
  const app=runtime(),game=C.createGame();game.profile.jerseyUnlocks=C.GEAR.filter(item=>item.unlockable).map(item=>item.id);
  app.audit.setGame(game);app.audit.go('pointshop');await app.click('pointshop-tab','jerseys');assert.ok(app.screens.pointshop.output.includes('已全部解锁'));
  app.audit.go('profile');await app.click('profile-tab','jerseys');assert.ok(app.screens.profile.output.includes('球衣图鉴'));
});

test('user info handles nicknames and guests with the documented login fields',async()=>{
  const app=runtime({auth:{getUserInfo:async()=>({code:200,data:{islogin:1,nickname:'虎扑球迷'}})}});
  app.audit.loadPlayerName();await tick();assert.equal(app.audit.state().playerName,'虎扑球迷');
  const guest=runtime({auth:{getUserInfo:async()=>({code:200,data:null})}});guest.audit.loadPlayerName();await tick();assert.equal(guest.audit.state().playerName,'玩家');
});

test('poster upload uses explicit business topic fields without fetching config and validates HTTPS',async()=>{
  const editorCalls=[],uploadCalls=[];
  const sdk={oss:{uploadFile:async params=>{uploadCalls.push(params);return {downloadUrl:'https://i1.hoopchina.com.cn/poster.png'}}},
    bbsConfig:{get:async()=>{throw Error('Must not read dynamic config')}},request:{bbs:{openPostEditor:async params=>{editorCalls.push(params);return {code:200}}}}};
  const app=runtime(sdk),blob=new Blob(['png'],{type:'image/png'}),summary={goat:500,stage:7,wins:6,losses:3,lineup:[],bonds:[]};
  await app.audit.publishCareerPoster(blob,summary);assert.equal(uploadCalls[0].file,blob);
  assert.equal(editorCalls[0].topicId,'871');assert.equal(editorCalls[0].tagId,'158640');
  assert.equal(editorCalls[0].topicName,'AI工坊');assert.equal(editorCalls[0].tagName,'我的球星融合系统');
  assert.equal(editorCalls[0].title,'我的球星融合系统 | 第7关生涯报告');assert.ok(!('content' in editorCalls[0]));
  delete sdk.bbsConfig;
  await app.audit.publishCareerPoster(blob,summary);assert.equal(editorCalls[1].topicId,'871');assert.equal(editorCalls[1].tagId,'158640');
  sdk.oss.uploadFile=async()=>({downloadUrl:'javascript:alert(1)'});await assert.rejects(app.audit.publishCareerPoster(blob,summary),/海报分享失败/);assert.equal(editorCalls.length,2);
  sdk.oss.uploadFile=async()=>({downloadUrl:'https://hupu.com.evil.test/poster.png'});await assert.rejects(app.audit.publishCareerPoster(blob,summary),/海报分享失败/);assert.equal(editorCalls.length,2);
  sdk.oss.uploadFile=async()=>({downloadUrl:'https://i1.hoopchina.com.cn/poster.png'});sdk.request.bbs.openPostEditor=async()=>({code:403,message:'未登录'});
  await assert.rejects(app.audit.publishCareerPoster(blob,summary),/未登录/);
});

test('revival ad confirms the reward and refreshes task status exactly once',async()=>{
  let taskCalls=0;
  const app=runtime({vatask:{completeRewardVideo:async()=>({code:200,data:{rewarded:true}}),getActivityTaskState:async()=>{taskCalls++;return {code:200,data:{tasks:[]}}}}});
  const game=C.createGame(),run=game.run=C.createRun('reserve_fund',911);run.morale=0;run.lastBattle={won:false,stage:1};C.finishRun(game);
  app.audit.setGame(game);app.audit.go('report');await app.click('report-revive');assert.equal(taskCalls,1);assert.equal(run.reviveUsed,true);assert.equal(run.morale,3);assert.equal(game.profile.runs,0);
});

test('production UI operation journal replays identically for all talents across battles',async()=>{
  for(const talent of C.TALENTS){
    let state,sequence=0;
    const app=runtime(rankedSdk(async ({url,data})=>{
      if(url.endsWith('/start')){state=C.createRun(data.talent,data.seed,data.progress);return {statusCode:200,code:0,data:{runId:data.requestId,seed:data.seed,proofVersion:3}}}
      if(url.endsWith('/battle')||url.endsWith('/finish')||url.endsWith('/resume')){
        assert.equal(data.sequence,sequence,talent.id);
        state=V.replay(state,data.operations,url.split('/').at(-1),data.strategy).state;sequence++;
      }
      return {statusCode:200,code:0,data:{sequence}};
    }));
    app.audit.go('talent');app.audit.setTalent(talent.id);await app.click('begin');
    const run=app.audit.getGame().run;
    for(let i=0;i<6;i++){await app.click('select-offer',run.offer[0]);await app.click('pick')}
    await app.click('train',run.slots.three);await app.click('shop');await app.click('shop-tab','gear');
    const gear=C.ensureShop(run).gear.find(id=>C.gearPrice(run,C.GEAR.find(item=>item.id===id))<=run.cash);
    if(gear)await app.click('buy-gear',gear);
    for(let i=0;i<3&&!run.ended;i++){
      await app.click('duel');await app.click('battle');await app.click('strategy','outside');
      assert.equal(await app.audit.flushCloudBattle(run),true,`${talent.id}: ${run.cloudRankError}`);
      assert.equal(run.rng,state.rng);assert.equal(run.cash,state.cash);assert.equal(run.morale,state.morale);assert.deepEqual(run.owned,state.owned);
      if(!run.ended)await app.click(run.lastBattle.won?'next':'retry');
    }
    C.finishRun(app.audit.getGame());assert.equal(await app.audit.finishCloudRun(run),true,talent.id);
  }
});

test('navigation responds immediately to a stalled cloud request and late responses keep home visible',async()=>{
  let resolveStart,resolveFinish,startData;
  const app=runtime(rankedSdk(({url,data})=>new Promise(resolve=>{if(url.endsWith('/start')){resolveStart=resolve;startData=data}else resolveFinish=resolve})));
  app.audit.go('talent');app.audit.setTalent('reserve_fund');const start=app.click('begin');
  assert.equal(app.audit.state().screen,'recruit');assert.match(app.screens.recruit.output,/球星招募/);await tick();
  const syncing=app.audit.flushCloudBattle(app.audit.getGame().run);await tick();
  await app.click('home');resolveStart({statusCode:200,code:0,data:{seed:startData.seed,runId:startData.requestId,proofVersion:3}});await start;await tick();
  assert.equal(app.audit.state().screen,'home');await syncing;
  C.finishRun(app.audit.getGame());app.audit.go('report');await app.click('report-new');assert.equal(app.audit.state().screen,'home');
  await tick();resolveFinish({statusCode:200,code:0,data:{sequence:1}});await tick();assert.equal(app.audit.state().screen,'home');
});

test('captain hearts use a three-life base and show earned overflow separately',()=>{
  const app=runtime(),game=C.createGame();game.run=C.createRun('captain',911);app.audit.setGame(game);app.audit.go('roster');
  assert.match(app.screens['.top'].output,/3\/3/);assert.doesNotMatch(app.screens['.top'].output,/3\/13/);
  game.run.morale=4;app.audit.go('roster');assert.match(app.screens['.top'].output,/3\/3 \+1/);
});

test('a fifteen-second timeout keeps the committed local seed and persistent start for retry',async()=>{
  let timeout,late;
  const app=runtime(rankedSdk(()=>new Promise(resolve=>late=resolve)),{setTimeout:(fn,ms)=>{if(ms===15000)timeout=fn;return 1}});
  app.audit.go('talent');app.audit.setTalent('reserve_fund');await app.click('begin');await tick();
  const syncing=app.audit.flushCloudBattle(app.audit.getGame().run);await tick();
  const run=app.audit.getGame().run,pending=structuredClone(run.cloudStartPending);timeout();await syncing;await tick();
  assert.ok(!run.cloudRunId);assert.match(run.cloudRankError,/超时/);assert.equal(app.audit.state().screen,'recruit');assert.ok(run.cloudStartPending);
  late({statusCode:200,code:0,data:{runId:pending.requestId,seed:pending.seed,proofVersion:3}});await tick();
  assert.equal(app.audit.getGame().run,run);assert.ok(!run.cloudRunId);assert.equal(run.seed,pending.seed);
});

test('jersey unlock completes locally without a request, charges once and shows confirmation',async()=>{
  const requests=[];
  const app=runtime(rankedSdk(async args=>{requests.push(args);throw Error('?????')}));
  const game=C.createGame();game.profile.legend=1000;app.audit.setGame(game);app.audit.go('pointshop');await app.click('pointshop-tab','jerseys');
  await app.click('jersey-unlock');await tick();
  assert.equal(requests.length,0);assert.equal(game.profile.legend,500);assert.equal(game.profile.jerseyUnlocks.length,1);
  const jersey=C.GEAR.find(item=>item.id===game.profile.jerseyUnlocks[0]);
  assert.match(app.screens['game-modal'].output,/获得传奇球衣/);assert.match(app.screens['game-modal'].output,new RegExp(jersey.name));
  await app.click('jersey-unlock');assert.equal(game.profile.legend,500);assert.equal(game.profile.jerseyUnlocks.length,1);
  assert.match(app.screens['game-modal'].output,/jersey-unlock-confirm/);await app.click('jersey-unlock-confirm');
  await app.click('jersey-unlock');assert.equal(game.profile.legend,0);assert.equal(new Set(game.profile.jerseyUnlocks).size,2);assert.equal(requests.length,0);
  await app.click('jersey-unlock-confirm');await app.click('jersey-unlock');assert.equal(game.profile.jerseyUnlocks.length,2);
  const restored=app.audit.restoreGame(JSON.parse(JSON.stringify(game)));assert.deepEqual([...restored.profile.jerseyUnlocks],game.profile.jerseyUnlocks);
});

test('legacy reserved jersey points are released once when restoring a local-unlock save',()=>{
  const app=runtime(),game=C.createGame();game.profile.legend=500;game.profile.cloudJerseyReserved=true;
  game.profile.cloudJerseyPurchaseId='00000000-0000-4000-8000-000000000001';
  const restored=app.audit.restoreGame(game);assert.equal(restored.profile.legend,1000);
  assert.equal(app.audit.restoreGame(JSON.parse(JSON.stringify(restored))).profile.legend,1000);
});

test('two unsent battles and a settlement survive starting another run and reloading',async()=>{
  let online=false;const serverRuns=new Map(),calls=[];
  const sdk=rankedSdk(async ({url,data})=>{
    if(!online)throw Error('断网');const name=url.split('/').at(-1);calls.push(name);
    if(name==='start'){
      if(!serverRuns.has(data.requestId))serverRuns.set(data.requestId,{state:C.createRun(data.talent,data.seed,data.progress),sequence:0});
      return {statusCode:200,code:0,data:{runId:data.requestId,seed:data.seed,proofVersion:3}};
    }
    const record=serverRuns.get(data.runId);assert.equal(data.sequence,record.sequence);
    record.state=V.replay(record.state,data.operations,name,data.strategy).state;record.sequence++;
    return {statusCode:200,code:0,data:{sequence:record.sequence}};
  });
  const app=runtime(sdk);app.audit.go('talent');app.audit.setTalent('reserve_fund');await app.click('begin');
  const old=app.audit.getGame().run;
  for(let i=0;i<6;i++){await app.click('select-offer',old.offer[0]);await app.click('pick')}
  for(let i=0;i<2;i++){
    await app.click('duel');await app.click('battle');await app.click('strategy','outside');
    if(i===0)await app.click(old.lastBattle.won?'next':'retry');
  }
  C.finishRun(app.audit.getGame());await app.click('new');app.audit.setTalent('reserve_fund');await app.click('begin');await tick();
  assert.equal(app.audit.getGame().pendingCloudRuns.length,1);assert.equal(old.cloudOutbox.length,3);assert.equal(old.cloudOutbox[0].type,'battle');
  const reloaded=runtime(sdk),restored=reloaded.audit.restoreGame(JSON.parse(JSON.stringify(app.audit.getGame())));reloaded.audit.setGame(restored);
  const pending=restored.pendingCloudRuns[0];assert.equal(pending.cloudStartPending.requestId,old.cloudStartPending.requestId);
  online=true;assert.equal(await reloaded.audit.flushCloudBattle(pending),true);
  assert.deepEqual(calls,['start','battle','battle','finish']);assert.equal(serverRuns.get(pending.cloudRunId).state.ended,true);
  assert.equal(restored.pendingCloudRuns.length,0);assert.equal(pending.cloudOutbox.length,0);
});


test('gameplay saves stay on the device and only final settlement uploads validation events',async()=>{
  const requests=[];
  const app=runtime(rankedSdk(async ({url,data})=>{
    requests.push(url.split('/').at(-1));
    return {statusCode:200,code:0,data:url.endsWith('/start')?{runId:data.requestId,seed:data.seed,proofVersion:3}:{sequence:(data.sequence||0)+1}};
  }));
  app.audit.go('talent');app.audit.setTalent('captain');await app.click('begin');
  const game=app.audit.getGame(),run=game.run;
  for(let i=0;i<6;i++){await app.click('select-offer',run.offer[0]);await app.click('pick')}
  app.audit.go('duel');await app.click('battle');await app.click('strategy','outside');await tick();
  assert.ok(run.lastBattle);
  assert.equal(run.ended,false);assert.deepEqual(requests,[]);assert.equal(app.backups.length,0);assert.ok(app.saved.length);
  await app.click('home');await app.click('continue');await tick();assert.deepEqual(requests,[]);
  C.finishRun(game);await app.audit.finishCloudRun(run);
  assert.deepEqual(requests,['start','battle','finish']);assert.equal(app.backups.length,1);
  assert.equal(run.cloudOutbox.length,0);
});

test('entry uploads a device backup and pending battle events without finalizing an unfinished run',async()=>{
  const requests=[];
  const app=runtime(rankedSdk(async ({url,data})=>{
    requests.push(url.split('/').at(-1));
    return {statusCode:200,code:0,data:url.endsWith('/start')?{runId:data.requestId,seed:data.seed,proofVersion:3}:{sequence:(data.sequence||0)+1}};
  }));
  app.audit.go('talent');app.audit.setTalent('captain');await app.click('begin');
  app.audit.syncSaveBackup();await app.audit.syncPendingRuns(true);
  assert.deepEqual(requests,['start']);assert.equal(app.backups.length,1);assert.equal(app.audit.getGame().run.ended,false);
});


test('home feedback replaces save text, preserves typed content, locks duplicate submits and clears on success',async()=>{
  const app=runtime();app.audit.go('home');
  assert.match(app.screens.home.output,/feedback-open/);assert.doesNotMatch(app.screens.home.output,/footer-note/);
  let release,submissions=0,submitted;
  app.window.SupFusionFeedback={submitUserFeedback:content=>{submitted=content;submissions++;return new Promise(resolve=>release=resolve)}};
  await app.click('feedback-open');app.input('  suggestion  ');
  const saved=app.saved.length,pending=app.click('feedback-submit');await tick();
  assert.equal(submitted,'  suggestion  ');assert.equal(app.screens['game-modal'].nativeOutput.childNodes[0].childNodes[2].value,'  suggestion  ');
  assert.match(app.screens['game-modal'].output,/aria-busy="true"/);
  await app.click('feedback-submit');await app.click('feedback-close');assert.equal(submissions,1);
  release();await pending;
  assert.equal(app.screens['game-modal'].nativeOutput.childNodes[0].childNodes[2].value,'');
  assert.equal(app.saved.length,saved);assert.match(app.screens['game-modal'].output,/feedback-submit/);
  await app.click('feedback-close');assert.equal(app.screens['game-modal'].output,'');
});

test('feedback failure preserves the draft for manual retry without saving it',async()=>{
  const app=runtime();app.audit.go('home');let calls=0;
  app.window.SupFusionFeedback={submitUserFeedback:async()=>{calls++;throw Error('Please retry later')}};
  await app.click('feedback-open');app.input('do not lose this');await app.click('feedback-submit');
  assert.match(app.screens['game-modal'].output,/Please retry later/);
  assert.equal(app.screens['game-modal'].nativeOutput.childNodes[0].childNodes[2].value,'do not lose this');
  assert.equal(calls,1);assert.equal(app.saved.length,0);
});


test('pending sync diagnostics never render in game screens or leaderboard statuses',async()=>{
  let fail=false;
  const app=runtime(rankedSdk(async()=>fail?{statusCode:500,message:'PRIVATE_SYNC_NOTE'}:{statusCode:200,code:0,data:{entries:[{displayName:'Tester',score:10}]}}));
  const game=C.createGame(),run=game.run=C.createRun('reserve_fund',911);
  run.cloudRankError='PRIVATE_SYNC_NOTE';run.cloudStartPending={requestId:'pending'};run.cloudOutbox=[];
  app.audit.setGame(game);
  for(const screen of ['home','recruit']){app.audit.go(screen);assert.doesNotMatch(app.screens[screen].output,/PRIVATE_SYNC_NOTE/)}
  for(let i=0;i<6;i++){const offer=C.makeOffer(run);C.recruit(run,offer[0])}
  C.battle(game,'outside');app.audit.go('result');assert.doesNotMatch(app.screens.result.output,/PRIVATE_SYNC_NOTE/);
  C.finishRun(game);app.audit.go('report');assert.doesNotMatch(app.screens.report.output,/PRIVATE_SYNC_NOTE/);
  app.audit.go('leaderboard');await app.audit.loadLeaderboard();assert.doesNotMatch(app.screens.leaderboard.output,/PRIVATE_SYNC_NOTE/);
  fail=true;await app.audit.loadLeaderboard();assert.doesNotMatch(app.screens.leaderboard.output,/PRIVATE_SYNC_NOTE/);
  assert.equal(run.cloudRankError,'PRIVATE_SYNC_NOTE');
});


test('touch drag starts on bench player text and swaps through a slot border hit target',async()=>{
  const app=runtime(),game=C.createGame(),run=game.run=C.createRun('reserve_fund',911);
  const ids=C.STARS.slice(0,7).map(star=>star.id);
  ids.forEach(id=>run.owned[id]={stars:1,train:0,trainedAt:0});C.SLOTS.forEach((slot,i)=>run.slots[slot.id]=ids[i]);run.bench=[ids[6]];
  app.audit.setGame(game);app.audit.go('roster');
  const classes={add(){},remove(){},contains(){return false}};
  const source={classList:classes,getBoundingClientRect:()=>({width:150}),cloneNode:()=>({classList:classes,style:{},remove(){}})};
  const targetCard={classList:classes,querySelector:()=>targetButton};
  const targetButton={dataset:{act:'place',kind:'slot',key:C.SLOTS[0].id},closest:()=>targetCard};
  const benchButton={dataset:{act:'place',kind:'bench',key:'0'},closest:()=>source};
  const textTarget={closest:selector=>selector==='[data-act="place"]'?benchButton:null};
  app.document.elementFromPoint=()=>({closest:selector=>selector==='[data-act="place"]'?null:targetCard});
  const event={target:textTarget,pointerType:'touch',pointerId:1,isPrimary:true,button:0,isTrusted:false,clientX:30,clientY:150,preventDefault(){}};
  app.fire('pointerdown',event);app.fire('pointermove',{...event,clientX:70,clientY:50});
  app.fire('pointerup',{...event,pointerId:2,clientX:70,clientY:50});assert.equal(run.bench[0],ids[6]);
  app.fire('pointerup',{...event,clientX:70,clientY:50});
  assert.equal(run.slots[C.SLOTS[0].id],ids[6]);assert.equal(run.bench[0],ids[0]);assert.ok(app.saved.length);
});

test('leaderboard reads coalesce and a forced post-settlement refresh wins over an earlier response',async()=>{
  const oldResponses=[],reads=[];
  const app=runtime(rankedSdk(async ({url,data})=>{
    if(url.endsWith('/me'))return {statusCode:200,code:0,data:{rank:4,score:99}};
    reads.push(data);
    if(reads.length<=2)return new Promise(resolve=>oldResponses.push(resolve));
    return {statusCode:200,code:0,data:{entries:Array.from({length:4},(_,i)=>({rank:i+1,displayName:'Player '+i,score:99-i}))}};
  }));
  app.audit.go('leaderboard');const first=app.audit.loadLeaderboard(),same=app.audit.loadLeaderboard();assert.equal(first,same);await tick();
  assert.equal(reads.length,2);const refreshed=app.audit.loadLeaderboard(true);
  oldResponses.forEach(resolve=>resolve({statusCode:200,code:0,data:{entries:[{displayName:'OLD_ROW',score:1}]}}));
  await first;await refreshed;
  assert.equal(reads.length,4);assert.ok(reads.every(data=>Number.isSafeInteger(data.refreshId)));
  assert.doesNotMatch(app.screens.leaderboard.output,/OLD_ROW/);assert.match(app.screens.leaderboard.output,/leaderboard-row current/);
});

test('leaderboard refresh waits five seconds after completion, locks requests and stops on exit',async()=>{
  const timers=new Map(),pending=[];let nextTimer=0,reads=0;
  const app=runtime(rankedSdk(async ({url})=>{
    if(url.endsWith('/me'))return {statusCode:200,code:0,data:{rank:1,score:88}};
    reads++;return new Promise(resolve=>pending.push(resolve));
  }),{setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn:()=>{timers.delete(id);fn()},ms});return id},clearTimeout:id=>timers.delete(id)});
  const polls=()=>[...timers.values()].filter(timer=>timer.ms===5000);
  const resolveReads=()=>pending.splice(0).forEach(resolve=>resolve({statusCode:200,code:0,data:{entries:[{rank:2,displayName:'VISIBLE_PLAYER',score:88}]}}));
  await app.click('leaderboard');await tick();
  assert.equal(reads,2);assert.equal(polls().length,0);
  assert.match(app.screens.leaderboard.output,/leaderboard-loading-icon/);
  assert.match(app.screens.leaderboard.output,/leaderboard-refresh[^>]*disabled/);
  assert.match(app.screens.leaderboard.output,/正在加载榜单/);
  await app.click('leaderboard-refresh');assert.equal(reads,2);
  resolveReads();await tick();assert.equal(polls().length,1);
  assert.doesNotMatch(app.screens.leaderboard.output,/leaderboard-loading-icon/);
  await app.click('leaderboard-refresh');await tick();assert.equal(reads,4);assert.equal(polls().length,0);
  assert.match(app.screens.leaderboard.output,/VISIBLE_PLAYER/);
  assert.doesNotMatch(app.screens.leaderboard.output,/正在加载榜单/);
  resolveReads();await tick();assert.equal(polls().length,1);
  polls()[0].fn();await tick();assert.equal(reads,6);
  await app.click('home');resolveReads();await tick();assert.equal(polls().length,0);
});

test('lineup drag clone retains scoped child styles before dimming its source',()=>{
  const app=runtime(),game=C.createGame(),run=game.run=C.createRun('reserve_fund',911);
  const id=C.STARS[0].id;run.owned[id]={stars:1,train:0,trainedAt:0};run.slots[C.SLOTS[0].id]=id;
  app.audit.setGame(game);app.audit.go('roster');
  let dimmed=false;
  const sourceClasses={add:()=>{dimmed=true},remove(){}};
  const cloneClasses={add(){},remove(){}};
  const style=()=>({setProperty(key,value){this[key]=value}});
  const clone={classList:cloneClasses,style:style(),children:[{style:style(),children:[]}],remove(){}};
  const source={classList:sourceClasses,children:[{children:[]}],getBoundingClientRect:()=>({width:150,height:95}),cloneNode:()=>clone};
  app.window.getComputedStyle=element=>{
    assert.equal(dimmed,false);
    return {0:'font-size',1:'background-color',length:2,getPropertyValue:key=>key==='font-size'?(element===source?'12px':'10px'):'#112233'};
  };
  const button={dataset:{act:'place',kind:'slot',key:C.SLOTS[0].id},closest:()=>source};
  app.document.elementFromPoint=()=>null;
  const event={target:{closest:()=>button},pointerId:1,isPrimary:true,button:0,clientX:30,clientY:150,preventDefault(){}};
  app.fire('pointerdown',event);app.fire('pointermove',{...event,clientX:70});
  assert.equal(clone.children[0].style['font-size'],'10px');
  assert.equal(clone.children[0].style['background-color'],'#112233');
  assert.equal(clone.style.width,'150px');assert.equal(clone.style.height,'95px');
  app.fire('pointercancel',event);
});


test('home announcement opens, closes and preserves current save',async()=>{
  const app=runtime(),game=C.createGame();game.run=C.createRun('steady_interest',911,{},2);const before=JSON.stringify(game);
  app.audit.setGame(game);app.audit.go('home');
  assert.match(app.screens.home.output,/data-act="announcement-open"/);assert.match(app.screens.home.output,/aria-label="更新公告"/);
  await app.click('announcement-open');assert.match(app.screens['game-modal'].output,/更多羁绊，更多搭配/);assert.match(app.screens['game-modal'].output,/数值调整/);assert.match(app.screens['game-modal'].output,/样式调整/);
  assert.match(app.screens['game-modal'].output,/羁绊从原有81新增至100，包括格林公式、金州连接器、芝城侧翼网、洛城快攻链等，阵容搭配更加丰富。/);
  assert.match(app.screens['game-modal'].output,/class="announcement-note"/);
  await app.click('announcement-close');assert.equal(app.screens['game-modal'].output,'');assert.equal(JSON.stringify(app.audit.getGame()),before);
  const restored=app.audit.restoreGame(JSON.parse(before));assert.equal(restored.run.balanceRulesVersion,2);assert.equal(C.synergiesForRun(restored.run).length,84);
});

test('recruit sheet allows free and credited drafts even with zero cash',async()=>{
  for(const kind of ['free','credits','rewarded']){
    const app=runtime(),game=C.createGame(),r=game.run=C.createRun('steady_interest',911);
    r.cash=0;r.free=kind==='free'?1:0;r.recruitCredits=kind==='credits'?1:0;
    if(kind==='rewarded')assert.ok(C.grantRewardedSOffer(r));
    app.audit.setGame(game);app.audit.go('roster');await app.click('recruit');
    const sheet=app.screens['game-modal'].output;
    assert.ok(!/data-act="recruit-normal"[^>]*disabled/.test(sheet),kind);
    assert.ok(/data-act="recruit-ten"[^>]*disabled/.test(sheet),kind);
    await app.click('recruit-normal');assert.equal(app.audit.state().screen,'recruit');
    assert.ok(!/data-act="pick"[^>]*disabled/.test(app.screens.recruit.output),kind);
    await app.click('pick');assert.equal(Object.keys(r.owned).length,1,kind);assert.equal(r.cash,0,kind);
  }
});

test('recruit sheet locks unpaid drafts but permits affordable ten packs',async()=>{
  const app=runtime(),game=C.createGame(),r=game.run=C.createRun('steady_interest',911);r.cash=0;r.free=0;
  app.audit.setGame(game);app.audit.go('roster');await app.click('recruit');
  assert.match(app.screens['game-modal'].output,/data-act="recruit-normal"[^>]*disabled/);
  await app.click('recruit-normal');assert.equal(app.audit.state().screen,'roster');
  r.cash=C.recruitPackCost(r);await app.click('recruit');
  assert.ok(!/data-act="recruit-ten"[^>]*disabled/.test(app.screens['game-modal'].output));
  await app.click('recruit-ten');assert.equal(app.audit.state().screen,'recruit');assert.equal(r.offer.length,10);assert.equal(r.cash,0);
  await app.click('confirm-recruit-batch');assert.ok(Object.keys(r.owned).length>0);
});

test('reported legacy screenshot: 9 cash and two free recruits permit a normal draft',async()=>{
  const app=runtime(),game=C.createGame(),r=game.run=C.createRun('scouting_network',911,{},1);
  r.cash=9;r.free=2;assert.equal(C.recruitPackCost(r),95);
  app.audit.setGame(game);app.audit.go('roster');await app.click('recruit');
  const sheet=app.screens['game-modal'].output;
  assert.match(sheet,/本轮还可免费招募 2 次/);
  assert.ok(!/data-act="recruit-normal"[^>]*disabled/.test(sheet));
  assert.match(sheet,/data-act="recruit-ten"[^>]*disabled/);
  await app.click('recruit-normal');await app.click('pick');
  assert.equal(r.free,1);assert.equal(r.cash,9);assert.equal(Object.keys(r.owned).length,1);
});

test('bond archive requires actual achievement, persists after sale and restores history',async()=>{
  const app=runtime(),game=C.createGame();game.profile.discovered=C.STARS.map(s=>s.id);
  const restored=app.audit.restoreGame(game);
  const legacyIds=new Set(C.synergiesForRun({balanceRulesVersion:2}).map(b=>b.id));
  assert.ok(restored.profile.achievedBonds.every(id=>legacyIds.has(id)));
  const r=restored.run=C.createRun('steady_interest',911);r.free=1;
  const ids=['curry','jordan','lebron','magic','shaq','duncan'];r.slots=Object.fromEntries(C.SLOTS.map((s,i)=>[s.id,ids[i]]));r.bench=['green'];
  r.owned=Object.fromEntries([...ids,'green'].map(id=>[id,{stars:1,train:0}]));r.offer=['durant'];
  const bond=C.SYNERGIES.find(b=>b.name==='格林公式');
  app.audit.setGame(restored);app.audit.go('profile');
  assert.ok(!restored.profile.achievedBonds.includes(bond.id));
  app.audit.go('recruit');await app.click('pick');assert.ok(restored.profile.achievedBonds.includes(bond.id));
  await app.audit.handle('sell-bench',{dataset:{id:'durant',index:'1'}});await app.click('sell-confirm');
  assert.ok(!C.activeSynergies(r).some(b=>b.id===bond.id));assert.ok(restored.profile.achievedBonds.includes(bond.id));
  const reloaded=app.audit.restoreGame(JSON.parse(JSON.stringify(restored)));assert.ok(reloaded.profile.achievedBonds.includes(bond.id));
});

test('archive migration preserves old collected entries once and never auto-unlocks added bonds',()=>{
  const app=runtime(),game=C.createGame();game.profile.discovered=C.STARS.map(s=>s.id);game.profile.achievedBonds=[];
  const migrated=app.audit.restoreGame(game),legacy=C.synergiesForRun({balanceRulesVersion:2});
  assert.equal(migrated.profile.achievedBonds.length,legacy.length);
  assert.equal(migrated.profile.bondArchiveVersion,1);
  const previousIds=new Set(legacy.map(b=>b.id));
  for(const b of C.SYNERGIES.filter(b=>!previousIds.has(b.id)))assert.ok(!migrated.profile.achievedBonds.includes(b.id));
  const newGame=C.createGame();newGame.profile.bondArchiveVersion=1;newGame.profile.achievedBonds=[];newGame.profile.discovered=C.STARS.map(s=>s.id);
  const unchanged=app.audit.restoreGame(newGame);assert.equal(unchanged.profile.achievedBonds.length,0);
  assert.equal(app.audit.restoreGame(JSON.parse(JSON.stringify(migrated))).profile.achievedBonds.length,legacy.length);
});

test('first migration, three new achievements, settlement and re-entry preserve the archive',async()=>{
  const app=runtime(),old=C.createGame();old.profile.discovered=C.STARS.map(s=>s.id);
  const migrated=app.audit.restoreGame(JSON.parse(JSON.stringify(old)));
  const legacyIds=new Set(C.synergiesForRun({balanceRulesVersion:2}).map(b=>b.id));
  const added=C.SYNERGIES.filter(b=>!legacyIds.has(b.id));
  assert.equal(migrated.profile.achievedBonds.length,legacyIds.size);
  app.audit.setGame(migrated);await app.click('new');app.audit.setTalent('steady_interest');await app.click('begin');
  const run=app.audit.getGame().run;run.benchLimit=10;run.free=9;
  const targetIds=['spurs_lock','detroit_champs','rocket_axes'];
  const players=targetIds.flatMap(id=>C.SYNERGIES.find(b=>b.id===id).ids);
  for(const id of players){run.offer=[id];run.offerMode='normal';app.audit.go('recruit');await app.click('pick');}
  const earned=added.filter(b=>app.audit.getGame().profile.achievedBonds.includes(b.id)).map(b=>b.id).sort();
  assert.deepEqual(earned,[...targetIds].sort());
  for(let attempts=0;!run.ended&&attempts<100;attempts++){
    app.audit.go('duel');await app.click('battle');await app.click('strategy','outside');
    if(!run.ended)await app.click(run.lastBattle.won?(run.stage===10?'finish':'next'):'retry');
  }
  assert.equal(run.ended,true);assert.equal(app.audit.getGame().profile.runs,1);await tick();
  const persisted=JSON.parse(JSON.stringify(app.saved.at(-1)));assert.equal(persisted.profile.bondArchiveVersion,1);
  const nextApp=runtime(),restored=nextApp.audit.restoreGame(persisted);nextApp.audit.setGame(restored);
  for(const id of legacyIds)assert.ok(restored.profile.achievedBonds.includes(id));
  assert.deepEqual(added.filter(b=>restored.profile.achievedBonds.includes(b.id)).map(b=>b.id).sort(),[...targetIds].sort());
  const before=JSON.stringify(restored.profile.achievedBonds);
  nextApp.audit.go('profile');await nextApp.click('profile-tab','bonds');
  for(const id of targetIds)assert.ok(nextApp.screens.profile.output.includes(C.SYNERGIES.find(b=>b.id===id).name));
  await nextApp.click('new');nextApp.audit.setTalent('steady_interest');await nextApp.click('begin');
  assert.equal(JSON.stringify(nextApp.audit.getGame().profile.achievedBonds),before);
  assert.equal(nextApp.audit.getGame().run.balanceRulesVersion,3);
});

test('pending replacement takes priority over reopening the recruit sheet',async()=>{
  const app=runtime(),game=C.createGame(),r=game.run=C.createRun('steady_interest',911);r.cash=100;r.pending='curry';
  app.audit.setGame(game);app.audit.go('roster');await app.click('recruit');
  assert.match(app.screens['game-modal'].output,/备战席已满/);
  assert.ok(!app.screens['game-modal'].output.includes('选择招募方式'));assert.equal(r.cash,100);
});
