const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const C=require('../h5/game-core.js');
const {transformSync}=require('esbuild');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function renderer(){
  const source=read('src/react-screens.jsx');
  const context={createElement:React.createElement,Fragment:React.Fragment};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const reactAttributeNames'),source.indexOf('function HomeScreen')),context);
  return context;
}
test('OVR medals show peak stage below score and list rows show it inline',()=>{
  const source=read('src/react-screens.jsx');
  const component=source.slice(source.indexOf('function LeaderboardPage('),source.indexOf('function LeaderboardScreen('));
  const context={React,module:{exports:{}}};
  vm.runInNewContext(transformSync(component+'\nmodule.exports=LeaderboardPage;', {loader:'jsx'}).code,context);
  const entries=[1,2,3,4].map(rank=>({rank,name:'Player '+rank,score:334,stage:rank===2?null:58}));
  const render=unit=>renderToStaticMarkup(React.createElement(context.module.exports,{entries,title:'Board',unit,status:'',playerName:'Me'}));
  const ovr=render('OVR');
  assert.ok(ovr.includes('<small>334</small><small class="leaderboard-peak-stage">第58关</small>'));
  assert.ok(ovr.includes('<b>334 <small>第58关</small></b>'));
  assert.equal((ovr.match(/leaderboard-peak-stage/g)||[]).length,2);
  assert.ok(!render('点').includes('第58关'));
});
test('weekly OVR layout keeps the cumulative legend board and gates archive on backend support',()=>{
  const source=read('src/react-screens.jsx');
  const component=source.slice(source.indexOf('function LeaderboardPage('),source.indexOf('function TalentScreen('));
  const context={React,module:{exports:{}}};
  vm.runInNewContext(transformSync(component+'\nmodule.exports=LeaderboardScreen;', {loader:'jsx'}).code,context);
  const props={boards:{legend:[],ovr:[]},mine:{legend:{rank:1,score:300},ovr:null},status:{legend:'',ovr:'暂无成绩'},playerName:'Me',busy:false,week:{range:'10月12日—10月18日 · 北京时间',countdown:'2天 08:35:16'}};
  const render=extra=>renderToStaticMarkup(React.createElement(context.module.exports,{...props,...extra}));
  const legacy=render({tab:'ovr'});
  assert.ok(!legacy.includes('周榜即将开放，当前展示历史最高 OVR'));
  assert.match(legacy,/disabled="".*查看上周前50名/);
  assert.ok(!legacy.includes('本周最高 OVR'));
  const weekly=render({tab:'ovr',weeklySupported:true});
  assert.match(weekly,/本周最高 OVR/);assert.match(weekly,/距离下一周/);assert.match(weekly,/2天 08:35:16/);
  const archive=render({tab:'ovr',weeklySupported:true,period:'previous'});
  assert.match(archive,/上周最高 OVR/);assert.match(archive,/返回本周排行榜/);
  assert.ok(archive.includes('我的排名'));assert.ok(archive.includes('未上榜'));assert.ok(!archive.includes('data-week-countdown'));
  assert.ok(!archive.includes('上一周排名已封榜'));assert.ok(!archive.includes('已封榜'));
  const rankedArchive=render({tab:'ovr',weeklySupported:true,period:'previous',boards:{legend:[],ovr:[{rank:12,name:'旧昵称',score:391,stage:58,isCurrent:true}]}});
  assert.match(rankedArchive,/391 <small class="leaderboard-inline-rank" aria-label="第12名">#12/);
  assert.ok(rankedArchive.includes('旧昵称'));assert.ok(weekly.indexOf('leaderboard-switch')<weekly.indexOf('leaderboard-my-rank'));
  const legend=render({tab:'legend',weeklySupported:true});
  assert.match(legend,/300/);assert.ok(!legend.includes('leaderboard-week-card'));assert.ok(!legend.includes('距离下一周'));
});

test('weekly clock uses Beijing Monday boundaries and accepts only explicit weekly metadata',()=>{
  const source=read('h5/game-ui.js');
  const fakeDate=class extends Date {static now(){return Date.parse('2026-10-11T15:59:59Z')}};
  const context={Date:fakeDate,leaderboardWeek:null};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function leaderboardWeekView('),source.indexOf("  document.addEventListener('visibilitychange'")),context);
  assert.equal(context.leaderboardWeekView().countdown,'0天 00:00:01');
  assert.equal(context.leaderboardWeekView().range,'10月5日—10月11日');
  fakeDate.now=()=>Date.parse('2026-10-11T16:00:00Z');
  assert.equal(context.leaderboardWeekView().countdown,'7天 00:00:00');
  assert.equal(context.acceptLeaderboardWeek([]),null);
  assert.equal(context.acceptLeaderboardWeek({scope:'weekly',weekId:'bad'}),null);
  context.leaderboardWeek=context.acceptLeaderboardWeek({scope:'weekly',weekId:'2026-10-12',startsAt:'2026-10-11T16:00:00Z',endsAt:'2026-10-18T16:00:00Z',serverTime:'2026-10-12T16:00:00Z'});
  assert.equal(context.leaderboardWeekView().countdown,'6天 00:00:00');
});

test('leaderboard fetch accepts old arrays but never shows them as last week rankings',async()=>{
  const source=read('h5/game-ui.js');
  const context={window:{ACTIVITY_API_BASE:'https://example.test',ColorboxAI:{cloud:{request:async()=>({statusCode:200,data:[{score:427,stage:58}]})}}},
    leaderboardPeriod:'current',leaderboardWeek:null,leaderboardWeeklySupported:false,leaderboardPreview:null,leaderboardBoards:{legend:[],ovr:[]},leaderboardStatus:{},leaderboardMine:{legend:null,ovr:null},screen:'leaderboard',renderLeaderboard(){},withTimeout:value=>value};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function acceptLeaderboardWeek('),source.indexOf("  document.addEventListener('visibilitychange'")),context);
  vm.runInContext(source.slice(source.indexOf('  async function fetchLeaderboard('),source.indexOf('  function renderTalent(')),context);
  await context.fetchLeaderboard();
  assert.equal(context.leaderboardBoards.ovr[0].score,427);assert.equal(context.leaderboardWeeklySupported,false);
  context.leaderboardPeriod='previous';context.leaderboardBoards.ovr=[];
  await context.fetchLeaderboard();
  assert.equal(context.leaderboardBoards.ovr.length,0);assert.match(context.leaderboardStatus.ovr,/暂不可用/);
  context.window.ColorboxAI.cloud.request=async()=>({statusCode:200,data:{scope:'weekly',period:'current',weekId:'2026-10-12',startsAt:'2026-10-11T16:00:00Z',endsAt:'2026-10-18T16:00:00Z',serverTime:'2026-10-12T00:00:00Z',entries:[{score:500}]}});
  await context.fetchLeaderboard();assert.equal(context.leaderboardBoards.ovr.length,0);
  context.window.ColorboxAI.cloud.request=async()=>({statusCode:200,data:{scope:'weekly',period:'previous',weekId:'2026-10-05',startsAt:'2026-10-04T16:00:00Z',endsAt:'2026-10-11T16:00:00Z',serverTime:'2026-10-12T00:00:00Z',entries:[{score:427,stage:58,displayName:'旧昵称',isCurrent:true}]}});
  await context.fetchLeaderboard();assert.equal(context.leaderboardBoards.ovr[0].isCurrent,true);assert.equal(context.leaderboardBoards.ovr[0].name,'旧昵称');
});

function profileMarkup({collected=true,tab='stars',tier='all',bondSize='all'}={}){
  const source=read('h5/game-ui.js'),game=C.createGame();
  if(collected)game.profile.discovered=C.STARS.map(star=>star.id);
  const context={C,game,profileTier:tier,profileBondSize:bondSize,profileTab:tab,profileSlideFrom:tab,
    tierClass:{SSR:'tier-legend',S:'tier-s',A:'tier-a',B:'tier-b',C:'tier-c'},
    els:{profile:{}},escapeText:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function renderProfile(){'),source.indexOf('  function legacyIcon(')),context);
  vm.runInContext(source.slice(source.indexOf('  function renderEventCatalog('),source.indexOf('  function randomEventMarkup(')),context);
  context.renderProfile();return context.els.profile.markup;
}
test('collected player catalog and all tier filters pass the production React renderer',()=>{
  const render=renderer();
  for(const tier of ['all','SSR','S','A','B','C']){
    const output=renderToStaticMarkup(render.MarkupScreen({html:profileMarkup({tier})}));
    const expected=C.STARS.filter(star=>tier==='all'||star.tier===tier).length;
    assert.equal((output.match(/<span class="profile-star-card/g)||[]).length,expected);
    assert.ok(output.includes('我的传奇档案'));
  }
});
test('bond catalog and empty catalogs pass the production React renderer',()=>{
  const render=renderer();
  for(const collected of [true,false]){
    const output=renderToStaticMarkup(render.MarkupScreen({html:profileMarkup({collected,tab:'bonds'})}));
    assert.equal((output.match(/<article class="codex-bond-entry/g)||[]).length,C.SYNERGIES.length);
    assert.ok(output.includes('<header>'));
    assert.ok(!output.includes('codex-bond-progress'));
    assert.ok(!output.includes('codex-bond-number'));
  }
  for(const tab of ['stars','jerseys'])assert.ok(renderToStaticMarkup(render.MarkupScreen({html:profileMarkup({collected:false,tab})})).includes('我的传奇档案'));
});
test('additional catalog tags retain unsafe-tag and attribute restrictions',()=>{
  const render=renderer();
  assert.throws(()=>render.parseGeneratedMarkup('<script>alert(1)</script>'),/Unsupported generated markup tag/);
  assert.throws(()=>render.parseGeneratedMarkup('<article><header></article>'),/Invalid generated markup closing tag/);
  const output=renderToStaticMarkup(render.MarkupScreen({html:'<article onclick="alert(1)"><header>图鉴</header></article>'}));
  assert.equal(output,'<article><header>图鉴</header></article>');
});

test('unseen event catalog contains only question marks and no event content',()=>{
  const output=renderToStaticMarkup(renderer().MarkupScreen({html:profileMarkup({tab:'events'})}));
  assert.equal((output.match(/event-catalog-card unknown/g)||[]).length,36);
  assert.equal((output.match(/aria-hidden="true">\?/g)||[]).length,36);
  assert.match(output,/事件图鉴 <small>0 \/ 36<\/small>/);
  for(const e of C.EVENTS){assert.ok(!output.includes(e.name));assert.ok(!output.includes(e.story));assert.ok(!output.includes(e.id));}
});
