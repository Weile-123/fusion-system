import '../h5/styles/dev-tools.css';

const key='mySupFusionDevTestV1';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function prepareLocalRuntime(root){
  root.ACTIVITY_API_BASE='';root.ACTIVITY_ENV_ID='';
  root.FusionStorage={available:()=>!!root.localStorage,localAvailable:()=>!!root.localStorage,platformAvailable:()=>false,
    async load(){try{return JSON.parse(root.localStorage.getItem(key)||'null')}catch{return null}},
    async save(game){root.localStorage.setItem(key,JSON.stringify(game))},async syncToCloud(){}};
  root.SupFusionDevTools={install:hooks=>installDevTools(root,hooks)};
}
function snapshot(C,run){
  if(run.lastBattle?.eventSnapshot)return run.lastBattle.eventSnapshot;
  const members=C.SLOTS.map(slot=>{const id=run.slots[slot.id];return id&&run.owned[id]?{id:C.identityOf(id),stats:Object.fromEntries(C.ATTRS.map(attr=>[attr,C.playerScore(C.BY_ID[id],run.owned[id],attr,run)]))}:null}).filter(Boolean);
  return {members,stage:run.stage,battle:run.wins+run.losses};
}
export function inspectEvent(C,run,event){
  if(!run)return {met:false,conditions:[{label:'已开启一局游戏',met:false}],missing:['请先开启一局游戏']};
  const state=run.eventState||{seen:[],bonuses:{},lastBattle:-2,jerseys:0},s=snapshot(C,run),conditions=[];
  const add=(label,met)=>conditions.push({label,met:!!met});
  add('当前事件规则版本且本局仍存活',run.balanceRulesVersion>=C.BALANCE_RULES_VERSION&&!run.ended&&run.morale>0);
  add('已完成对战，处于战后继续阶段',!!run.lastBattle);
  add('融合面板六位满员',s.members.length===6);
  for(const id of event.players)add(C.BY_ID[id].name+'在融合面板上（备战席不算）',s.members.some(m=>m.id===id));
  add('第 '+event.minStage+' 关起',s.stage>=event.minStage);
  if(event.afterLoss)add('本场失败且存活',run.lastBattle?.won===false&&run.morale>0);
  add('本局尚未触发该事件',!state.seen.includes(event.id));
  add('距上次事件至少间隔一场对战',s.battle-state.lastBattle>=2);
  add('没有正在处理的事件',!run.randomEvent);
  if(event.cost)add('奖金至少 '+event.cost,run.cash>=event.cost);
  if(event.type==='R'){add('生命低于 3',run.morale<3);add('本局未接受事件恢复',!state.recovered)}
  if(event.jersey){
    add('目标球衣已永久解锁',(run.unlockedJerseys||[]).includes(event.jersey));
    add('目标球衣具备本局商店池资格',C.gearAvailable(run,C.GEAR.find(g=>g.id===event.jersey)));
    add('更衣室未拥有目标球衣',![...run.gear,...(run.gearReserve||[])].includes(event.jersey));
    add('本局事件球衣奖励少于 2 件',state.jerseys<2);
  }
  if(event.gear){const gear=C.GEAR.find(g=>g.id===event.gear);add('未拥有目标装备',![...run.gear,...(run.gearReserve||[])].includes(event.gear));add('可直接装备或收藏容量有空位',!C.gearStorageFull(run,gear))}
  const met=conditions.every(c=>c.met);
  const chance=Math.round(Math.min(.6,.3+.1*(state.misses||0))*100);
  const ability=met?C.eventAbility(event,s):null;
  const success=met?Math.round(C.clamp(.70+(ability-C.eventDifficulty(s.stage))*.025,.35,.9)*100):null;
  const eligibleCount=met?C.EVENTS.filter(e=>C.eventEligible(run,e,s)).length:0;
  return {met,conditions,missing:conditions.filter(c=>!c.met).map(c=>c.label),chance,success,eligibleCount,direct:['R','X'].includes(event.type)};
}
export function forceEvent(C,game,id){
  const event=C.EVENT_BY_ID[id];if(!event)return false;
  let run=game.run;
  if(!run||run.ended||!(run.balanceRulesVersion>=C.BALANCE_RULES_VERSION)){run=game.run=C.createRun('steady_interest',Date.now()>>>0,{...game.profile.upgrades,jerseyUnlocks:game.profile.jerseyUnlocks,gearUnlocks:game.profile.gearUnlocks})}
  const standalone=!run.lastBattle||run.randomEvent?.devStandalone===true;
  // 只在测试存档中补齐结算必要资源；人物、关卡、冷却等筛选条件直接绕过。
  run.cash=Math.max(run.cash,event.cost);run.morale=Math.max(1,run.morale);
  run.eventState||={seen:[],misses:0,lastBattle:-2,bonuses:{},jerseys:0,recovered:false};
  if(event.type==='R'){run.morale=Math.min(2,run.morale);run.eventState.recovered=false}
  if(event.jersey){run.unlockedJerseys=[...new Set([...run.unlockedJerseys,event.jersey])];run.gear=run.gear.filter(id=>id!==event.jersey);run.gearReserve=run.gearReserve.filter(id=>id!==event.jersey);run.eventState.jerseys=Math.min(1,run.eventState.jerseys)}
  if(event.gear){const gear=C.GEAR.find(g=>g.id===event.gear);if([...run.gear,...(run.gearReserve||[])].includes(event.gear)||C.gearStorageFull(run,gear))return false}
  let s=snapshot(C,run);
  // 空面板也能预览；快照仅供本地测试，不改当前球员或关卡。
  if(s.members.length!==6){const ids=[...new Set([...event.players,...C.STARS.filter(p=>p.tier==='S').map(p=>p.id)])].slice(0,6);s={...s,members:ids.map(id=>({id,stats:{...C.BY_ID[id].attrs}}))}}
  const all=s.members.reduce((sum,m)=>sum+m.stats[event.attr],0)/6,matched=s.members.filter(m=>event.players.includes(m.id));
  const ability=(all+(matched.length?matched.reduce((sum,m)=>sum+m.stats[event.attr],0)/matched.length:all))/2,difficulty=C.eventDifficulty(s.stage);
  if(standalone)run.lastBattle={stage:run.stage,won:true,us:0,them:0,reward:0,detail:[],log:[],strategy:'outside',foe:'curry',foeName:C.BY_ID.curry.name,rating:0,goat:0,eventSnapshot:s};
  run.randomEvent={id,choice:run.lastBattle.won?'next':'retry',stage:s.stage,ability,difficulty,successRate:C.clamp(.70+(ability-difficulty)*.025,.35,.9),snapshot:s,result:null,devStandalone:standalone};
  run.eventState.seen=[...new Set([...run.eventState.seen,id])];run.eventState.lastBattle=s.battle;
  game.profile.discoveredEvents=[...new Set([...(game.profile.discoveredEvents||[]),id])];
  return true;
}
export function clampPosition(x,y,width,height){return {x:Math.max(8,Math.min(x,Math.max(8,width-64))),y:Math.max(8,Math.min(y,Math.max(8,height-64)))}}
function installDevTools(root,{C,getGame,save,render,go}){
  if(root.document.getElementById('dev-test-button'))return;
  const doc=root.document,button=doc.createElement('button'),overlay=doc.createElement('div');
  button.id='dev-test-button';button.textContent='测试';button.setAttribute('aria-label','打开本地测试工具，可拖动');
  overlay.id='dev-test-overlay';overlay.hidden=true;doc.body.append(button,overlay);
  let drag=null,moved=false,message='';
  const place=(x,y)=>{const p=clampPosition(x,y,root.innerWidth,root.innerHeight);button.style.left=p.x+'px';button.style.top=p.y+'px';button.style.right='auto';button.style.bottom='auto'};
  button.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=button.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};moved=false;button.setPointerCapture(e.pointerId)});
  button.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)moved=true;if(moved)place(drag.left+dx,drag.top+dy)});
  button.addEventListener('pointerup',()=>{drag=null});button.addEventListener('pointercancel',()=>{drag=null;moved=true});
  root.addEventListener('resize',()=>{if(button.style.left){const r=button.getBoundingClientRect();place(r.left,r.top)}});
  const acknowledge=C.acknowledgeRandomEvent;
  C.acknowledgeRandomEvent=function(game,id){const r=game?.run,p=r?.randomEvent;if(p?.id===id&&p.result&&p.devStandalone){r.randomEvent=null;if(!r.ended)r.lastBattle=null;return true}return acknowledge(game,id)};
  function draw(){
    const run=getGame().run;
    const rows=C.EVENTS.map(event=>{const info=inspectEvent(C,run,event);return '<article class="dev-event"><header><b>'+escape(event.id+' '+event.name)+'</b><span class="'+(info.met?'met':'unmet')+'">'+(info.met?'已达成':'未达成')+'</span></header><p>'+escape(event.category)+'</p><ul>'+info.conditions.map(c=>'<li class="'+(c.met?'met':'unmet')+'">'+(c.met?'✓ ':'✗ ')+escape(c.label)+'</li>').join('')+'</ul>'+(info.met?'<p>事件出现率 '+info.chance+'% · 候选 '+info.eligibleCount+' 个（等概率） · '+(info.direct?'选项直接结算': '成功率 '+info.success+'%')+'</p>':'<p class="unmet">还差：'+escape(info.missing.join('；'))+'</p>')+'<button data-dev="event" data-id="'+event.id+'">强制触发</button></article>'}).join('');
    overlay.innerHTML='<section class="dev-test-panel" role="dialog" aria-modal="true" aria-labelledby="dev-test-title"><header><h2 id="dev-test-title">本地测试</h2><button data-dev="close" aria-label="关闭测试弹窗">×</button></header><p>独立测试存档 · 排行榜同步已停用</p><div class="dev-test-actions"><button data-dev="cash">+999 奖金</button><button data-dev="legend">传奇点 +999</button><button data-dev="rarity">'+(run?.forceRareRecruit?'关闭':'开启')+' S / SSR 招募提升</button></div><p>招募提升开启时，每组优先加入 S、SSR 各一名（对应牌池可用时）；当前候选不重抽。</p><p role="status">'+escape(message)+'</p><h3>全部事件（'+C.EVENTS.length+'）</h3><p>强制触发会绕过筛选条件，并补齐结算所需奖金或球衣资格。</p>'+rows+'</section>';
  }
  button.addEventListener('click',()=>{if(moved){moved=false;return}overlay.hidden=false;draw()});
  overlay.addEventListener('click',e=>{if(e.target===overlay){overlay.hidden=true;return}const target=e.target.closest('[data-dev]');if(!target)return;
    const action=target.dataset.dev,game=getGame();
    if(action==='close'){overlay.hidden=true;return}
    if(action==='event'){if(forceEvent(C,game,target.dataset.id)){save();overlay.hidden=true;go('roster')}else{message='装备槽位已占用或装备栏已满，请先腾出对应槽位。';draw()}return}
    if(action==='legend'){game.profile.legend=(game.profile.legend||0)+999;message='已增加 999 传奇点。';save();render();draw();return}
    if(!game.run||game.run.ended){message='请先开局，或点击事件创建测试对局。';draw();return}
    if(action==='cash'){game.run.cash+=999;message='已增加 999 奖金。'}
    if(action==='rarity'){game.run.forceRareRecruit=!game.run.forceRareRecruit;message=game.run.forceRareRecruit?'后续招募优先出现 S、SSR。':'已恢复正常招募。'}
    save();render();draw();
  });
  doc.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.hidden=true});
}
