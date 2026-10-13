(function(root){
 'use strict';
 function create({C,getRun,getProfile,host,footer,save,waitForSave,go,getScreen,notify}){
  let timer=null,animationToken='',group=0,filter='all',shown=18,picker='',message='',busy=false,quick=[],currentToken='';
  let masonryObserver=null,masonryGrid=null,footerObserver=null;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const button=(act,label,id='',extra='')=>`<button type="button" data-act="hundred-${act}" data-id="${escape(id)}" ${extra}>${label}</button>`;
  const draft=()=>getRun()?.hundredRecruit;
  const selected=()=>draft()?.selected||[];
  const plan=()=>C.previewHundredRecruit(getRun(),selected(),draft()?.replacements||{});
  function stop(){
   if(timer!==null)clearTimeout(timer);timer=null;animationToken='';
   if(masonryObserver)masonryObserver.disconnect();masonryObserver=null;
   // The renderer can reuse these divs for another stage. Clear imperative layout
   // before patching markup, including child widths/positions, not just the observer.
   if(masonryGrid){masonryGrid.classList.remove('is-positioned');masonryGrid.style.removeProperty('height');for(const card of masonryGrid.children)for(const property of ['width','left','top'])card.style.removeProperty(property);masonryGrid=null;}
  }
  function layoutMasonry(){
   const grid=host.querySelector?.('.hundred-masonry');if(!grid)return;
   masonryGrid=grid;
   const cards=[...grid.children],gap=8;
   const layout=()=>{
    if(masonryGrid!==grid)return;
    const width=grid.clientWidth;if(!width)return;
    grid.classList.add('is-positioned');const cardWidth=(width-gap)/2,heights=[0,0];
    cards.forEach(card=>{card.style.width=cardWidth+'px';card.classList.toggle('is-compact',cardWidth<155)});
    cards.forEach(card=>{const column=heights[0]<=heights[1]?0:1;card.style.left=column*(cardWidth+gap)+'px';card.style.top=heights[column]+'px';heights[column]+=card.offsetHeight+gap});
    grid.style.height=Math.max(0,Math.max(...heights)-gap)+'px';
   };
   layout();
   if(root.ResizeObserver){masonryObserver=new root.ResizeObserver(layout);masonryObserver.observe(grid);cards.forEach(card=>masonryObserver.observe(card));}
  }
  function syncFooter(){
   const sync=()=>{
    const height=Math.ceil(footer.getBoundingClientRect?.().height||0);
    if(height>0)host.style.setProperty('--fixed-dock-height',height+'px');
   };
   sync();
   if(!footerObserver&&root.ResizeObserver){footerObserver=new root.ResizeObserver(sync);footerObserver.observe(footer)}
  }
  function leave(){stop();if(footerObserver)footerObserver.disconnect();footerObserver=null;host.style.removeProperty('--fixed-dock-height');const d=draft();if(d?.stage==='animation'){d.stage='results';save()}}
  function groups(){const r=getRun(),items=new Map();r.offer.forEach((id,i)=>{if(!items.has(id))items.set(id,{id,indexes:[]});items.get(id).indexes.push(i)});return [...items.values()].sort((a,b)=>priority(b.id)-priority(a.id)||C.playerScore(C.BY_ID[b.id],{stars:1,train:0},C.BY_ID[b.id].best,getRun())-C.playerScore(C.BY_ID[a.id],{stars:1,train:0},C.BY_ID[a.id].best,getRun()));}
  function priority(id){const r=getRun(),star=C.BY_ID[id];return (r.owned[id]&&r.owned[id].stars<C.starLimit(r,id)?20:0)+({SSR:10,S:7,A:3,B:2,C:1}[star.tier]||0)}
  function copyCount(id){return getRun().offer.reduce((sum,item,i)=>sum+(item===id&&selected()[i]?1:0),0)}
  // Draw duplicates are still new players unless they occupy a roster position.
  function rosterOwn(id){const r=getRun();return r.bench.includes(id)||Object.values(r.slots).includes(id)?r.owned[id]:null}
  function saleStars(id){const r=getRun();return Math.min(C.starLimit(r,id),(r.owned[id]?.stars||1)+copyCount(id))}
  function badge(id){const skills=C.getRoleSkills(getRun(),id);return skills.length?skills.map(({skill})=>`<span class="draft-skill-badge skill-star-${skill.star}" title="${escape(skill.name)}"><span>${escape(skill.name)}</span><b aria-label="${skill.star}星">${'★'.repeat(skill.star)}</b></span>`).join(''):'<span class="hundred-badge-empty">查看徽章详情</span>'}
  function card(item,animation=false,index=0){
   const r=getRun(),star=C.BY_ID[item.id],qty=item.indexes.length,keep=item.indexes.filter(i=>selected()[i]).length,own=rosterOwn(item.id);
   const total=copyCount(item.id),after=own?Math.min(C.starLimit(r,item.id),own.stars+total):Math.min(C.starLimit(r,item.id),total);
   const status=!keep?'未保留':own?(after>own.stars?`升星 ${after}★`:''): '新球员';
   const previewIds=new Set([...Object.keys(r.owned).filter(id=>!Object.values(draft().replacements||{}).includes(id)),...r.offer.filter((_,i)=>selected()[i])].map(C.identityOf));
   const bonds=C.starSynergies(item.id,r).map(bond=>({bond,count:bond.ids.filter(id=>previewIds.has(id)).length})).sort((a,b)=>Number(b.count===b.bond.ids.length)-Number(a.count===a.bond.ids.length)||b.count-a.count).slice(0,3).map(({bond,count})=>`<span class="${count===bond.ids.length?'is-active':''}">${escape(bond.name)} ${count}/${bond.ids.length}</span>`).join('');
   return `<article class="hundred-card hundred-tier-${star.tier.toLowerCase()} ${animation?'hundred-reveal':''} ${keep?'is-kept':'is-unselected'}" style="--reveal-delay:${index*65}ms"><div class="hundred-card-top"><b>${star.tier}</b>${animation?'':`<span class="hundred-card-status">${status}</span>`}<strong>${C.playerScore(star,{stars:1,train:0},star.best,r)}</strong></div>${animation?'':`<button type="button" class="hundred-card-check" data-act="hundred-toggle-group" data-id="${item.id}" aria-label="${keep?'取消选择':'选择'}${escape(star.name)}全部卡片" aria-pressed="${!!keep}">${keep?'✓':'＋'}</button>`}<div class="hundred-card-name"><h3>${escape(star.name)}</h3><div class="hundred-badges">${badge(item.id)}</div></div>${animation?'':`${own?'':`<div class="hundred-bonds">${bonds||'暂无关联羁绊'}</div>`}<div class="hundred-card-actions"><span>抽到 ${qty}张</span><div class="hundred-quantity">${button('quantity','−',item.id,`data-delta="-1"`)}<b>${keep}</b>${button('quantity','+',item.id,`data-delta="1"`)}</div><button type="button" data-act="star-detail" data-id="${item.id}">详情</button></div>`}</article>`;
  }
  function animate(r){
   const items=r.offer.slice(group*10,group*10+10),rare=items.some(id=>C.BY_ID[id].tier==='SSR'),special=items.some(id=>C.BY_ID[id].tier==='S');
   host.markup=`<div class="hundred-heading"><div><h1>百连招募</h1></div><span class="hundred-reveal-status">第 ${group+1} / 10 组 · 已揭晓 ${(group+1)*10} / 100张</span></div><div key="reveal-${r.hundredRecruit.token}-${group}" class="hundred-animation ${rare?'has-ssr':special?'has-s':''}"><div class="hundred-spotlight" aria-hidden="true"></div><div class="hundred-grid">${items.map((id,i)=>card({id,indexes:[group*10+i]},true,i)).join('')}</div></div><div class="hundred-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${(group+1)*10}"><i style="width:${(group+1)*10}%"></i></div><p class="hundred-caption">完整揭晓后自动进入结果页</p>`;
   footer.hidden=false;footer.markup=`<div class="hundred-footer">${button('skip','跳过动画，查看百连结果')}</div>`;syncFooter();
   if(timer!==null)clearTimeout(timer);
   animationToken=r.hundredRecruit.token;
   const token=animationToken;
   timer=setTimeout(()=>{timer=null;if(getRun()!==r||getScreen()!=='recruit'||r.hundredRecruit?.token!==token||r.hundredRecruit.stage!=='animation')return;if(group<9){group++;animate(r)}else{stop();r.hundredRecruit.stage='results';save();render()}},rare?1900:special?1500:1200);
  }
  function matches(id,kind){const r=getRun();return kind==='upgrade'?!!r.owned[id]&&r.owned[id].stars<C.starLimit(r,id):kind==='rare'?['S','SSR'].includes(C.BY_ID[id].tier):kind==='bond'?C.starSynergies(id,r).length>0:true;}
  function filtered(item){const star=C.BY_ID[item.id],some=item.indexes.some(i=>selected()[i]);return filter==='all'||filter==='selected'&&some||filter==='unselected'&&!some||['upgrade','bond'].includes(filter)&&matches(item.id,filter)||star.tier===filter;}
  function results(r){
   if(!r.hundredRecruit.selectionInitialized){r.hundredRecruit.selected=r.offer.map(()=>true);r.hundredRecruit.selectionInitialized=true;save();}
   const p=plan(),all=groups(),items=all.filter(filtered),counts={};r.offer.forEach(id=>counts[C.BY_ID[id].tier]=(counts[C.BY_ID[id].tier]||0)+1);
   host.markup=`<div class="hundred-heading"><div><h1>百连结果</h1></div><span>100张 · ${all.length}名球员</span></div><div class="hundred-counts">${['SSR','S','A','B','C'].map(tier=>`<div class="hundred-count hundred-text-${tier.toLowerCase()}"><span>${tier}</span><b>${counts[tier]||0}</b><small>张</small></div>`).join('')}</div><div class="hundred-filters">${[['all','全部'],['upgrade','可升星'],['bond','羁绊'],['SSR','SSR'],['S','S'],['A','A'],['B','B'],['C','C'],['selected','已选'],['unselected','未选']].map(([id,label])=>button('filter',label,id,`class="${filter===id?'active':''}"`)).join('')}</div><section class="hundred-quick"><h2>快捷操作 <small>多项保留条件取交集</small></h2><div class="hundred-presets">${button('select-all',selected().every(Boolean)?'一键取消':'一键全选','',`aria-pressed="${selected().every(Boolean)}"`)}${[['upgrade','保留升星'],['bond','保留羁绊'],['rare','保留SSR/S']].map(([id,label])=>button('quick',label,id,`class="${quick.includes(id)?'active':''}" aria-pressed="${quick.includes(id)}"`)).join('')}</div></section><div class="hundred-grid hundred-masonry">${items.slice(0,shown).map(item=>card(item)).join('')}</div>${items.length>shown?button('more',`查看更多 · 还剩${items.length-shown}组`,'','class="hundred-more"'):''}${items.length?'':'<p class="hundred-caption">暂无符合条件的球员</p>'}${message?`<p class="hundred-message" role="alert">${escape(message)}</p>`:''}`;
   footer.hidden=false;footer.markup=`<div class="hundred-footer"><p>保留 <b>${p.kept||0}张</b> · 出售 <b>${p.sold??100}张</b></p>${button('next',p.newIds?.length?`下一步：安排${p.newIds.length}名新球员`:'下一步：检查处理名单')}</div>`;syncFooter();
   layoutMasonry();
  }
  function arrange(r){
   const p=plan();if(!p.ok){r.hundredRecruit.stage='results';message=p.reason;results(r);return}
   const assigned=r.hundredRecruit.replacements||{};
   // Automatic destinations follow the core's draw order and preferred vacant slot.
   const vacant=C.SLOTS.filter(slot=>!r.slots[slot.id]),destinations={};let benchFree=Math.max(0,r.benchLimit-r.bench.length);
   for(const id of p.newIds){
    const old=assigned[id];
    if(old){const slot=C.SLOTS.find(slot=>r.slots[slot.id]===old);destinations[id]={title:`替换并出售 ${C.BY_ID[old].name}`,note:`${slot?slot.label+'槽':'备战席'} · 回收 ${C.saleValue(old,saleStars(old),r)} 奖金`,kind:'replacement'};}
    else if(vacant.length){const i=Math.max(0,vacant.findIndex(slot=>slot.id===C.BY_ID[id].best)),slot=vacant.splice(i,1)[0];destinations[id]={title:`加入${slot.label}槽空位`,note:'直接加入 · 不出售现有球员',kind:'free'};}
    else if(benchFree>0){benchFree--;destinations[id]={title:'加入备战席空位',note:'直接加入 · 不出售现有球员',kind:'free'};}
    else destinations[id]={title:'未安排位置',note:'阵容和备战席已满，请选择一名球员替换',kind:'pending'};
   }
   host.markup=`<div class="hundred-heading"><div><h1>统一安排阵容</h1></div>${button('back','返回选人')}</div><div class="hundred-plan-steps"><span>① 选人</span><span>›</span><b>② 安排位置</b><span>›</span><span>③ 检查处理</span></div><div class="hundred-plan-stats"><div><b>${p.newIds.length}</b><small>新增球员</small></div><div><b>${p.newIds.length-p.needed}</b><small>已安排</small></div><div class="${p.needed?'needs-arrangement':''}"><b>${p.needed}</b><small>待安排位置</small></div></div><div class="hundred-plan-note hundred-arrange-bonds">${p.newBonds.length?'新增羁绊：'+p.newBonds.map(escape).join('、'):'暂无新增羁绊'}${p.lostBonds.length?'<br><strong>将失效：'+p.lostBonds.map(escape).join('、')+'</strong>':''}</div><div class="hundred-plan-subhead"><h2>新球员 → 目标位置</h2><small>当前空位 ${p.free} 个</small></div>${p.newIds.map(id=>{const star=C.BY_ID[id],dest=destinations[id],pending=dest.kind==='pending';return `<section class="hundred-pair ${pending?'is-unassigned':'is-assigned'}" data-player-id="${id}"><div class="hundred-pair-incoming hundred-tier-${star.tier.toLowerCase()}"><span class="hundred-pair-grade">${star.tier}</span><div><b>${escape(star.name)}</b><small>保留 ${copyCount(id)}张 · 入队 ${Math.min(C.starLimit(r,id),copyCount(id))}★ · 推荐${escape(C.SLOTS.find(slot=>slot.id===star.best)?.label||'')}</small></div><div class="hundred-pair-header-actions"><button type="button" data-act="star-detail" data-id="${id}">详情</button>${button('discard','不保留此球员',id,'class="hundred-discard"')}</div></div><div class="hundred-pair-route"><small>↓ ${pending?'待安排去向':'入队去向'}</small><div class="hundred-pair-destination"><div><b>${pending?'＋':'✓'} ${escape(dest.title)}</b><small>${escape(dest.note)}</small></div><div class="hundred-destination-actions">${button('pick',pending?'安排':'调整',id)}${assigned[id]?button('unassign','取消替换',id):''}</div></div></div></section>`}).join('')}<p class="hundred-plan-help">直接升星不占新位置。保留升星的现有球员受到保护；SSR同名替换时先升星再出售，替换名单将在下一步汇总核对。</p>${message?`<p class="hundred-message" role="alert">${escape(message)}</p>`:''}`;
   footer.hidden=false;footer.markup=`<div class="hundred-footer"><p>新增 ${p.newIds.length}名 · 替换 ${p.removed.length}名 · 保留 ${p.kept}张</p>${button('review',p.needed?`还需安排${p.needed}个位置`:'检查出售名单并确认','',''+(p.ready?'':'disabled'))}</div>`;syncFooter();
  }
  function review(r){
   const p=plan();if(!p.ok||!p.ready){r.hundredRecruit.stage='arrange';arrange(r);return}
   const sold=groups().map(item=>({...item,count:item.indexes.filter(i=>!selected()[i]).length})).filter(item=>item.count),rare=sold.filter(item=>['S','SSR'].includes(C.BY_ID[item.id].tier)),rareOld=p.removed.filter(id=>['S','SSR'].includes(C.BY_ID[id].tier));
   const list=(kind,rows)=>`<div class="hundred-review-list hundred-review-${kind} ${kind==='upgrade'&&rows.length>=2?'is-two-column':''}">${rows.join('')||'<p>无</p>'}</div>`;
   const row=(id,value,showTier=false)=>`<p><span>${showTier?`<strong class="hundred-sale-tier hundred-text-${C.BY_ID[id].tier.toLowerCase()}">${C.BY_ID[id].tier}</strong>`:''}${escape(C.BY_ID[id].name)}</span><b>${value}</b></p>`;
   host.markup=`<div class="hundred-heading"><div><h1>确认本次处理</h1></div><div class="hundred-heading-actions">${p.newIds.length?button('edit-plan','返回调整'):''}${button('back','返回选人')}</div></div><div class="hundred-receipt"><p>用于升星 / 入队 <b>${p.kept}张</b></p><p>出售本次新卡 <b>${p.sold}张</b></p><p>出售现有球员 <b>${p.removed.length}名</b></p><p>共回收奖金 <b><img src="assets/cash-stack.png" alt="" class="hundred-cash-icon"> ${p.cashDelta}</b></p></div>${rare.length||rareOld.length?`<div class="hundred-warning">包含高评级出售，请核对：<br>本次新卡 ${rare.map(x=>escape(C.BY_ID[x.id].name)+' ×'+x.count).join('、')||'无'}<br>现有球员 ${rareOld.map(id=>escape(C.BY_ID[id].name)).join('、')||'无'}</div>`:''}<h2 class="hundred-section-title">升星预览</h2>${list('upgrade',p.upgrades.filter(x=>x.after>x.before).map(x=>row(x.id,`${x.before} → ${x.after}★`)))}<div class="hundred-review-roster"><section><h2 class="hundred-section-title">新增球员</h2>${list('new',p.newIds.map(id=>row(id,`${Math.min(C.starLimit(r,id),copyCount(id))}★`)))}</section><section><h2 class="hundred-section-title">出售现有球员</h2>${list('old-sale',p.removed.map(id=>row(id,`${p.removedStars?.[id]||r.owned[id].stars}★`)))}</section></div><div class="hundred-plan-note hundred-review-bonds">${p.newBonds.length?'新增羁绊：'+p.newBonds.map(escape).join('、'):'暂无新增羁绊'}${p.lostBonds.length?'<br><strong>失效：'+p.lostBonds.map(escape).join('、')+'</strong>':''}</div><h2 class="hundred-section-title">出售本次新卡 · ${p.sold}张</h2>${list('draw-sale',sold.map(x=>row(x.id,`×${x.count}`,true)))}${message?`<p class="hundred-message" role="alert">${escape(message)}</p>`:''}`;
   footer.hidden=false;footer.markup=`<div class="hundred-footer"><p>确认后统一执行，不再逐张弹出出售确认</p>${button('commit',busy?'保存处理中…':'确认整批处理','',''+(busy?'disabled':''))}</div>`;syncFooter();
  }
  function render(){const r=getRun();if(!r?.hundredRecruit||r.offerMode!=='hundred-batch')return false;if(currentToken!==r.hundredRecruit.token){currentToken=r.hundredRecruit.token;filter='all';shown=18;picker='';message='';quick=[]}host.classList.add('hundred-recruit-screen');host.classList.remove('draft-ten-mode','batch-reveal','draft-rewarded-mode');const stage=r.hundredRecruit.stage;if(stage==='animation'){if(animationToken!==r.hundredRecruit.token){stop();group=0;animate(r)}return true}stop();if(stage==='arrange')arrange(r);else if(stage==='review')review(r);else results(r);return true;}
  function renderDialog(){
   const r=getRun();if(!picker||!r?.hundredRecruit)return '';
   const used=Object.values(draft().replacements||{}),items=Object.keys(r.owned).filter(id=>(copyCount(id)===0||C.canHundredReplace(picker,id))&&(!used.includes(id)||draft().replacements[picker]===id));
   const groupList=(label,ids)=>`<section class="hundred-picker-section"><h3>${label} <small>${ids.length}名</small></h3><div class="modal-list">${ids.map(id=>{const star=C.BY_ID[id],tier={SSR:'tier-legend',S:'tier-s',A:'tier-a',B:'tier-b',C:'tier-c'}[star.tier];return `<div class="pending-player-row ${tier}"><button type="button" class="pending-player-replace" data-act="hundred-target" data-id="${id}"><span class="pending-player-tier">${star.tier}</span><span class="pending-player-copy"><b>${escape(star.name)}</b><small>${r.bench.includes(id)?'备战席':C.SLOTS.find(s=>r.slots[s.id]===id)?.label+'位'} · ${saleStars(id)}★</small></span><em>出售 ${C.saleValue(id,saleStars(id),r)} 奖金</em></button><button type="button" class="pending-player-detail" data-act="star-detail" data-id="${id}">查看详情</button></div>`}).join('')||'<p class="hundred-picker-empty">暂无可替换球员</p>'}</div></section>`;
   return `<section class="modal-card hundred-dialog"><div class="hundred-heading"><h2>为${escape(C.BY_ID[picker].name)}选择替换</h2>${button('pick-close','×','','aria-label="关闭替换选择"')}</div><p>该球员会被出售。保留升星的球员受到保护；SSR可替换同名普通球员，已选新卡先用于升星后出售。其他新球员已选的目标不在列表中。</p><div class="hundred-picker">${groupList('备战席',items.filter(id=>r.bench.includes(id)))}${groupList('融合面板',items.filter(id=>!r.bench.includes(id)))}</div></section>`;

  }
  function prune(){const r=getRun(),d=draft();for(const [id,old]of Object.entries(d.replacements||{}))if(!copyCount(id)||copyCount(old)&&!C.canHundredReplace(id,old))delete d.replacements[id];}
  async function handle(action,data){
   if(!action.startsWith('hundred-'))return false;
   const r=getRun(),d=draft();if(!d||busy)return true;
   const id=data.id,scrollTop=host.scrollTop;
   message='';
   if(action==='hundred-skip'){stop();d.stage='results'}
   else if(action==='hundred-filter'){filter=id;shown=18}
   else if(action==='hundred-more')shown+=18;
   else if(action==='hundred-toggle-group'){const value=!r.offer.some((item,i)=>item===id&&d.selected[i]);r.offer.forEach((item,i)=>{if(item===id)d.selected[i]=value});quick=[];prune()}
   else if(action==='hundred-select-all'){d.selected=Array(r.offer.length).fill(!d.selected.every(Boolean));quick=[];prune()}
   else if(action==='hundred-quick'){
    if(!['upgrade','bond','rare'].includes(id))return true;
    quick=quick.includes(id)?quick.filter(kind=>kind!==id):[...quick,id];
    const seen={};d.selected=r.offer.map(item=>{const nth=seen[item]||0;seen[item]=nth+1;return quick.every(kind=>matches(item,kind))&&(!quick.includes('upgrade')||nth<C.starLimit(r,item)-r.owned[item].stars)});prune();
   }
   else if(action==='hundred-quantity'){quick=[];
    const indexes=r.offer.map((item,i)=>item===id?i:-1).filter(i=>i>=0),delta=Number(data.delta);
    if(delta>0){const i=indexes.find(i=>!d.selected[i]);if(i!==undefined)d.selected[i]=true}
    else {const i=indexes.filter(i=>d.selected[i]).pop();if(i!==undefined)d.selected[i]=false}
    prune();
   }else if(action==='hundred-next'){const p=plan();if(!p.ok)message=p.reason;else d.stage=p.newIds.length?'arrange':'review'}
   else if(action==='hundred-edit-plan')d.stage='arrange';
   else if(action==='hundred-back'){picker='';d.stage='results'}
   else if(action==='hundred-pick')picker=id;
   else if(action==='hundred-pick-close')picker='';
   else if(action==='hundred-target'){if(picker){d.replacements[picker]=id;const p=plan();if(!p.ok){delete d.replacements[picker];message=p.reason}else picker=''}}
   else if(action==='hundred-unassign')delete d.replacements[id];
   else if(action==='hundred-discard'){r.offer.forEach((item,i)=>{if(item===id)d.selected[i]=false});prune()}
   else if(action==='hundred-review'){const p=plan();if(p.ok&&p.ready)d.stage='review'}
   else if(action==='hundred-commit'){
    if(d.stage!=='review')return true;
    const token=d.token,choice=[...d.selected],targets={...d.replacements};busy=true;render();
    await waitForSave();if(getRun()!==r||r.hundredRecruit?.token!==token){busy=false;return true}
    const snapshot=JSON.parse(JSON.stringify(r)),profile=getProfile(),profileSnapshot=JSON.parse(JSON.stringify(profile)),answer=C.confirmHundredRecruit(r,token,choice,targets);
    if(!answer.ok){message=answer.reason;busy=false;render();return true}
    if(!await save()){for(const key of Object.keys(r))delete r[key];Object.assign(r,snapshot);for(const key of Object.keys(profile))delete profile[key];Object.assign(profile,profileSnapshot);message='存档保存失败，已恢复本批选择，请重试';busy=false;render();return true}
    busy=false;picker='';host.classList.remove('hundred-recruit-screen');go('roster');notify(`百连处理完成，回收${answer.cashDelta}奖金`);return true;
   }
   save();render();
   // Clearing old absolute positions briefly collapses the grid before rebuilding
   // it. Restore the viewport after result selection or expansion updates.
   if(['hundred-more','hundred-quantity','hundred-toggle-group','hundred-select-all','hundred-quick'].includes(action))host.scrollTop=scrollTop;
   return true;
  }
  function input(){return false}
  return {render,renderDialog,handle,leave,stop,input,isBusy:()=>busy};
 }
 root.SupFusionHundredRecruit={create};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.SupFusionHundredRecruit;
})(typeof window!=='undefined'?window:globalThis);
