const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const C=require('../h5/game-core.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function renderer(){
  const source=read('src/react-screens.jsx');
  const context={createElement:React.createElement,Fragment:React.Fragment};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const reactAttributeNames'),source.indexOf('function HomeScreen')),context);
  return context;
}
function profileMarkup({collected=true,tab='stars',tier='all',bondSize='all'}={}){
  const source=read('h5/game-ui.js'),game=C.createGame();
  if(collected)game.profile.discovered=C.STARS.map(star=>star.id);
  const context={C,game,profileTier:tier,profileBondSize:bondSize,profileTab:tab,profileSlideFrom:tab,
    tierClass:{SSR:'tier-legend',S:'tier-s',A:'tier-a',B:'tier-b',C:'tier-c'},
    els:{profile:{}},escapeText:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function renderProfile(){'),source.indexOf('  function legacyIcon(')),context);
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
