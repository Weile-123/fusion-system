const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{transformSync}=require('esbuild');
const C=require('../h5/game-core.js');
const source=fs.readFileSync('src/dev-tools.js','utf8').replace("import '../h5/styles/dev-tools.css';",'');
const moduleValue={exports:{}};new Function('module','exports',transformSync(source,{format:'cjs'}).code)(moduleValue,moduleValue.exports);
const D=moduleValue.exports;
function environment(){
 const nodes={},values=new Map();const element=()=>({style:{},dataset:{},listeners:{},hidden:false,innerHTML:'',setAttribute(){},setPointerCapture(){},getBoundingClientRect(){return {left:300,top:600}},addEventListener(name,fn){this.listeners[name]=fn}});
 const root={innerWidth:400,innerHeight:800,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},document:{getElementById:id=>nodes[id],createElement:element,body:{append(...els){for(const el of els)nodes[el.id]=el}},addEventListener(){}},addEventListener(){}};
 D.prepareLocalRuntime(root);const game=C.createGame();game.run=C.createRun('steady_interest',911);
 const calls={saves:0,screen:''},copy=Object.create(C);root.SupFusionDevTools.install({C:copy,getGame:()=>game,save(){calls.saves++},render(){},go(screen){calls.screen=screen}});
 const action=(name,id)=>nodes['dev-test-overlay'].listeners.click({target:{closest:()=>({dataset:{dev:name,id}})}});
 return {root,game,calls,nodes,values,action,copy};
}
test('local test storage is isolated and all cloud paths are disabled',async()=>{
 const {root,values,game}=environment();assert.equal(root.ACTIVITY_API_BASE,'');assert.equal(root.ACTIVITY_ENV_ID,'');assert.equal(root.FusionStorage.platformAvailable(),false);
 await root.FusionStorage.save(game);assert.equal(values.has('mySupFusionGameV1'),false);assert.equal(values.has('mySupFusionDevTestV1'),true);assert.deepEqual(await root.FusionStorage.load(),game);
});
test('floating button opens, drags within bounds and does not open on a drag release',()=>{
 const {nodes}=environment(),b=nodes['dev-test-button'],o=nodes['dev-test-overlay'];b.listeners.click();assert.equal(o.hidden,false);assert.equal((o.innerHTML.match(/class="dev-event"/g)||[]).length,36);o.hidden=true;
 b.listeners.pointerdown({button:0,pointerId:1,clientX:330,clientY:630});b.listeners.pointermove({clientX:1000,clientY:2000});b.listeners.pointerup();b.listeners.click();assert.equal(o.hidden,true);assert.equal(b.style.left,'336px');assert.equal(b.style.top,'736px');
 assert.deepEqual(D.clampPosition(-100,-100,400,800),{x:8,y:8});
});
test('cash and rarity buttons change the actual test run and subsequent recruit offers',()=>{
 const {game,action,calls}=environment(),before=game.run.cash;action('cash');assert.equal(game.run.cash,before+999);action('rarity');assert.equal(game.run.forceRareRecruit,true);
 game.run.offer=[];const offer=C.makeOffer(game.run);assert.ok(offer.some(id=>C.BY_ID[id].tier==='S'));assert.ok(offer.some(id=>C.BY_ID[id].tier==='SSR'));action('rarity');assert.equal(game.run.forceRareRecruit,false);assert.equal(calls.saves,3);
});
test('legendary points button works before a run and persists in isolated local test storage',async()=>{
 const {game,action,calls,root,nodes}=environment();game.run=null;nodes['dev-test-button'].listeners.click();assert.match(nodes['dev-test-overlay'].innerHTML,/data-dev="legend">传奇点 \+999/);
 action('legend');assert.equal(game.profile.legend,999);action('legend');assert.equal(game.profile.legend,1998);assert.equal(calls.saves,2);
 await root.FusionStorage.save(game);assert.equal((await root.FusionStorage.load()).profile.legend,1998);assert.equal(root.ACTIVITY_API_BASE,'');
});

test('every event exposes missing conditions and qualified events show correct rates',()=>{
 const game=C.createGame();game.run=C.createRun('steady_interest',911);
 for(const event of C.EVENTS){const info=D.inspectEvent(C,game.run,event);assert.equal(info.met,false);assert.ok(info.missing.includes('融合面板六位满员'));assert.equal(info.success,null)}
 const event=C.EVENT_BY_ID.T01;const ids=['curry','lebron','magic','shaq','jordan','bird'];ids.forEach((id,i)=>{game.run.slots[C.SLOTS[i].id]=id;game.run.owned[id]={stars:1,train:0}});game.run.wins=1;game.run.lastBattle={won:true,eventSnapshot:C.eventBattleSnapshot(game.run)};
 const info=D.inspectEvent(C,game.run,event);assert.equal(info.met,true);assert.equal(info.chance,30);assert.ok(info.success>=35&&info.success<=90);assert.ok(info.eligibleCount>0);
 game.run.eventState.seen.push('T01');assert.ok(D.inspectEvent(C,game.run,event).missing.includes('本局尚未触发该事件'));
});

test('gear event previews use spare storage and never force new events into legacy rules',()=>{
 const game=C.createGame(),run=game.run=C.createRun('steady_interest',911),event=C.EVENT_BY_ID.P06,item=C.GEAR.find(g=>g.id===event.gear);
 const sameSlot=C.GEAR.find(g=>g.slot===item.slot&&g.id!==item.id);run.gear=[sameSlot.id];
 const ids=['curry','lebron','magic','shaq','jordan','bird'];ids.forEach((id,i)=>{run.slots[C.SLOTS[i].id]=id;run.owned[id]={stars:1,train:0}});run.stage=10;run.wins=1;run.lastBattle={won:true,eventSnapshot:C.eventBattleSnapshot(run)};
 assert.equal(D.inspectEvent(C,run,event).met,true);assert.equal(D.forceEvent(C,game,event.id),true);run.rng=0;run.randomEvent.successRate=.9;
 assert.equal(C.resolveRandomEvent(game,event.id,'main').gear,item.id);assert.ok(run.gearReserve.includes(item.id));assert.ok(run.gear.includes(sameSlot.id));
 const old=C.createGame();old.run=C.createRun('steady_interest',911,{},4);assert.equal(D.forceEvent(C,old,'P06'),true);assert.equal(old.run.balanceRulesVersion,C.BALANCE_RULES_VERSION);old.run.rng=0;old.run.randomEvent.successRate=.9;assert.ok(C.resolveRandomEvent(old,'P06','main'));
});
test('all 36 events can be forced and settled even from an empty panel with no resources',()=>{
 for(const event of C.EVENTS){const game=C.createGame();game.run=C.createRun('steady_interest',911);game.run.cash=0;game.run.eventState.jerseys=2;game.run.eventState.recovered=true;game.run.eventState.bonuses={creation:15,shooting:15,finishing:15,perimeterStop:15,rimStop:15};
   assert.equal(D.forceEvent(C,game,event.id),true);assert.equal(game.run.randomEvent.id,event.id);assert.ok(Number.isFinite(game.run.randomEvent.successRate));game.run.rng=0;game.run.randomEvent.successRate=.9;assert.ok(C.resolveRandomEvent(game,event.id,'main'));assert.ok(game.profile.discoveredEvents.includes(event.id));
 }
 const game=C.createGame();assert.equal(D.forceEvent(C,game,'C01'),true);assert.equal(game.run.balanceRulesVersion,C.BALANCE_RULES_VERSION);
});
test('standalone forced event confirmation does not advance the real stage or grant stage resources',()=>{
 const {game,action,copy,calls}=environment();action('event','P01');assert.equal(calls.screen,'roster');const stage=game.run.stage,free=game.run.free;
 action('event','P01');assert.equal(game.run.randomEvent.devStandalone,true);
 copy.resolveRandomEvent(game,'P01','safe');assert.equal(copy.acknowledgeRandomEvent(game,'P01'),true);assert.equal(game.run.stage,stage);assert.equal(game.run.free,free);assert.equal(game.run.lastBattle,null);
});
test('production bundle excludes test panel, test storage and development module',()=>{
 for(const file of fs.readdirSync('dist/assets').filter(f=>/\.(js|css)$/.test(f))){const built=fs.readFileSync('dist/assets/'+file,'utf8');assert.ok(!built.includes('dev-test-button'),file);assert.ok(!built.includes('mySupFusionDevTestV1'),file);assert.ok(!built.includes('强制触发'),file)}
});
