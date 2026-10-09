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
  assert.ok(ovr.includes('<small>334 OVR</small><small class="leaderboard-peak-stage">第58关</small>'));
  assert.ok(ovr.includes('<b>334 <small>OVR·第58关</small></b>'));
  assert.equal((ovr.match(/leaderboard-peak-stage/g)||[]).length,2);
  assert.ok(!render('点').includes('第58关'));
});
function profileMarkup({collected=true,tab='stars',tier='all',bondSize='all'}={}){
  const source=read('h5/game-ui.js'),game=C.createGame();
  if(collected)game.profile.discovered=C.STARS.map(star=>star.id);
  const context={C,game,profileTier:tier,profileBondSize:bondSize,profileTab:tab,profileSlideFrom:tab,
    tierClass:{SSR:'tier-legend',S:'tier-s',A:'tier-a',B:'tier-b',C:'tier-c'},
    els:{profile:{}},escapeText:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function renderProfile(){'),source.indexOf('  function legacyIcon(')),context);
  vm.runInContext(source.slice(source.indexOf('  function renderEventCatalog('),source.indexOf('  function eventArchiveDetail(')),context);
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
  assert.equal((output.match(/event-catalog-card unknown/g)||[]).length,28);
  assert.equal((output.match(/aria-hidden="true">\?/g)||[]).length,28);
  assert.match(output,/事件图鉴 <small>0 \/ 28<\/small>/);
  for(const e of C.EVENTS){assert.ok(!output.includes(e.name));assert.ok(!output.includes(e.story));assert.ok(!output.includes(e.id));}
});
