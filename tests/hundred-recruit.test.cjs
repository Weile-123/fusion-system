const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../h5/game-core.js'),V=require('../activity/cloudfunctions/activity_api/verified-game.js');
function ready(seed=911){const r=C.createRun('reserve_fund',seed,{},18);r.cash=2000;return r}
function full(){const r=ready(),ids=C.STARS.filter(s=>s.tier!=='SSR').slice(0,12).map(s=>s.id);C.SLOTS.forEach((s,i)=>r.slots[s.id]=ids[i]);r.bench=ids.slice(6);ids.forEach(id=>r.owned[id]={stars:1,train:0,trainedAt:0});r.cash=2000;return r}
test('players already at their current star cap never enter single, ten or hundred recruit offers',()=>{
 for(const count of [4,10,100])for(const seed of [12,88,911]){
  const r=full();r.seed=seed;r.rng=seed;
  const capped=C.STARS.filter(s=>C.playerAvailable(r,s.id)).filter((_,i)=>i%3===0).map(s=>s.id);
  capped.forEach(id=>r.owned[id]={stars:C.starLimit(r,id),train:0,trainedAt:0});
  if(count===4){r.offer=[];C.makeOffer(r)}else C.makeTenOffer(r,count);
  assert.equal(r.offer.length,count);assert.ok(r.offer.every(id=>!capped.includes(id)));
 }
});
test('hundred pack charges nine tenths exactly and generates 100 actual sequential draws',()=>{
 for(const seed of [911,12,88]){
  const r=ready(seed),before=JSON.parse(JSON.stringify(r)),draws=r.recruitDraws,cost=C.recruitPackCost(r,100);
  assert.equal(cost,Math.floor(C.recruitCost(r)*90));assert.equal(C.buyRecruitPack(r,100),true);assert.equal(r.offer.length,100);assert.ok(r.offer.every(id=>C.playerAvailable(r,id)));assert.equal(r.recruitDraws-draws,100);assert.equal(r.cash,before.cash-cost);
  const expected=ready(seed);expected.cash-=cost;expected.recruitCredits=0;C.makeTenOffer(expected,100);assert.deepEqual(r.offer,expected.offer);assert.equal(r.rng,expected.rng);assert.equal(r.noSSRDraws,expected.noSSRDraws);
  const snapshot=JSON.stringify(r);assert.equal(C.buyRecruitPack(r,100),false);assert.equal(C.recruit(r,r.offer[0]),false);assert.equal(JSON.stringify(r),snapshot);
 }
 const old=C.createRun('reserve_fund',911,{},17);old.cash=2000;const original=JSON.stringify(old);assert.equal(C.buyRecruitPack(old,100),false);assert.equal(JSON.stringify(old),original);
 const poor=ready();poor.cash=0;const low=JSON.stringify(poor);assert.equal(C.buyRecruitPack(poor,100),false);assert.equal(JSON.stringify(poor),low);
 const invalid=ready(),validSnapshot=JSON.stringify(invalid);for(const size of [1,20,99,100.5,'100']){assert.equal(C.buyRecruitPack(invalid,size),false);assert.equal(JSON.stringify(invalid),validSnapshot)}
 const unfinished=ready();C.buyRecruitPack(unfinished,10);const ten=JSON.stringify(unfinished);assert.equal(C.buyRecruitPack(unfinished,100),false);assert.equal(JSON.stringify(unfinished),ten);
});

test('hundred draws can exceed the remaining upgrade copies and preview refunds selected overflow',()=>{
 const id=C.STARS.find(s=>s.tier==='C').id;
 let found=false;
 for(let seed=1;seed<=100&&!found;seed++){
  const r=ready(seed);r.owned[id]={stars:C.starLimit(r,id)-2,train:0,trainedAt:0};r.slots[C.SLOTS[0].id]=id;
  C.buyRecruitPack(r,100);
  const count=r.offer.filter(copy=>copy===id).length;if(count<=2)continue;
  found=true;const before=JSON.stringify(r),choice=r.offer.map(copy=>copy===id),p=C.previewHundredRecruit(r,choice,{});
  assert.equal(p.ready,true);assert.equal(p.state.owned[id].stars,C.starLimit(r,id));
  const otherSales=r.offer.filter(copy=>copy!==id).reduce((sum,copy)=>sum+C.saleValue(copy,1,r),0);
  assert.equal(p.cashDelta,otherSales+(count-2)*4);assert.equal(JSON.stringify(r),before);
 }
 assert.equal(found,true,'real sequential draws include more than two copies of a nearly capped player');
});
test('whole-batch sale preview is pure and committing twice grants no duplicate rewards',()=>{
 const r=ready();C.buyRecruitPack(r,100);const choice=Array(100).fill(false),token=r.hundredRecruit.token,before=JSON.stringify(r),cash=r.cash;
 const expected=r.offer.reduce((sum,id)=>sum+C.saleValue(id,1,r),0),p=C.previewHundredRecruit(r,choice,{});assert.equal(JSON.stringify(r),before);assert.equal(p.ready,true);assert.equal(p.cashDelta,expected);
 assert.equal(C.confirmHundredRecruit(r,token,choice,{}).ok,true);assert.equal(r.cash,cash+expected);assert.equal(r.stats.recruits,100);assert.equal(r.pending,null);assert.equal(r.offer.length,0);
 const finished=JSON.stringify(r);assert.equal(C.confirmHundredRecruit(r,token,choice,{}).ok,false);assert.equal(JSON.stringify(r),finished);
});
test('full roster uses explicit unique replacements and bulk duplicates reach the real star limit',()=>{
 const r=full(),old=r.bench[0],existing=r.slots.three,newStar=C.STARS.find(s=>!r.owned[s.id]&&s.tier==='S').id;C.buyRecruitPack(r,100);
 r.offer=Array(100).fill(newStar);r.offer[0]=existing;r.offer[1]=existing;const choice=Array(100).fill(false);choice[0]=choice[1]=choice[2]=choice[3]=true;
 const before=JSON.stringify(r);assert.equal(C.previewHundredRecruit(r,choice,{}).needed,1);assert.equal(C.confirmHundredRecruit(r,r.hundredRecruit.token,choice,{}).ok,false);assert.equal(JSON.stringify(r),before);
 const p=C.previewHundredRecruit(r,choice,{[newStar]:old});assert.equal(p.ready,true);assert.equal(p.state.owned[existing].stars,3);assert.equal(p.state.owned[newStar].stars,2);assert.ok(!p.state.owned[old]);assert.ok(p.state.bench.includes(newStar));assert.equal(p.state.pending,null);
 assert.equal(C.previewHundredRecruit(r,choice,{[newStar]:existing}).ok,false);assert.equal(JSON.stringify(r),before);
 const forged={};for(const id of ['missing','__proto__'])Object.defineProperty(forged,id,{value:old,enumerable:true});assert.equal(C.previewHundredRecruit(r,choice,forged).ok,false);
});
test('assigned fusion slots are respected even when draw order differs from the target order',()=>{
 const r=full(),oldThree=r.slots.three,oldDef=r.slots.def,newIds=C.STARS.filter(s=>!r.owned[s.id]).slice(0,2).map(s=>s.id);C.buyRecruitPack(r,100);r.offer=Array(100).fill(oldThree);r.offer[0]=newIds[1];r.offer[1]=newIds[0];const choice=Array(100).fill(false);choice[0]=choice[1]=true;
 const p=C.previewHundredRecruit(r,choice,{[newIds[0]]:oldThree,[newIds[1]]:oldDef});assert.equal(p.ready,true);assert.equal(p.state.slots.three,newIds[0]);assert.equal(p.state.slots.def,newIds[1]);
 assert.equal(C.previewHundredRecruit(r,choice,{[newIds[0]]:oldThree,[newIds[1]]:oldThree}).ok,false);
});
test('default recommendation sells capped copies and exact preview includes overflow refunds',()=>{
 const r=full(),id=r.slots.three;C.buyRecruitPack(r,100);r.owned[id].stars=C.starLimit(r,id);r.offer=Array(100).fill(id);
 assert.ok(C.recommendHundredSelection(r).every(v=>!v));const p=C.previewHundredRecruit(r,Array(100).fill(true),{});assert.equal(p.state.owned[id].stars,C.starLimit(r,id));assert.equal(p.cashDelta,400);
});
test('server replay accepts rule18 hundred plans and rejects malformed or old-version operations',()=>{
 const r=ready(),start=JSON.parse(JSON.stringify(r));C.buyRecruitPack(r,100);const token=r.hundredRecruit.token,choice=Array(100).fill(false);C.confirmHundredRecruit(r,token,choice,{});
 const operations=[{action:'buyRecruitPack',args:[100]},{action:'confirmHundredRecruit',args:[token,choice,{}]}];const actual=V.replay(start,operations,'finish');const game=C.createGame();game.run=r;C.finishRun(game);assert.deepEqual(actual.state,game.run);
 for(const args of [[token,choice.slice(1),{}],[token,choice.map(()=>1),{}],['fake',choice,{}],[token,choice,[]]])assert.throws(()=>V.replay(start,[operations[0],{action:'confirmHundredRecruit',args}],'finish'));
 const old=ready();old.balanceRulesVersion=17;assert.throws(()=>V.replay(old,[operations[0]],'finish'));
 const before=JSON.stringify(start);assert.throws(()=>V.replay(start,[operations[0]],'finish'),/请先处理百连招募结果/);assert.equal(JSON.stringify(start),before);
});

test('SSR same-identity replacement consumes selected base upgrades without readding the sold player',()=>{
 const variant=C.STARS.find(s=>s.tier==='SSR'&&s.variantOf&&!full().owned[s.variantOf]),base=variant.variantOf;
 for(const place of ['bench','slot'])for(const count of [0,1,4]){
  const r=full();delete r.owned[r.bench[0]];r.bench[0]=base;r.owned[base]={stars:1,train:0,trainedAt:0};
  if(place==='slot'){const displaced=r.slots.three;r.slots.three=base;r.bench[0]=displaced}
  C.buyRecruitPack(r,100);r.offer=Array(100).fill(base);r.offer[0]=variant.id;const selected=r.offer.map((_,i)=>i<=count),targets={[variant.id]:base},before=JSON.stringify(r);
  const p=C.previewHundredRecruit(r,selected,targets);assert.equal(p.ready,true);assert.equal(JSON.stringify(r),before);
  assert.equal(p.state.owned[base],undefined);assert.equal(p.state.owned[variant.id].stars,1);assert.equal(p.upgrades.some(x=>x.id===base),false);
  assert.equal(p.removedStars[base],Math.min(C.starLimit(r,base),1+count));
  if(place==='slot')assert.equal(p.state.slots.three,variant.id);else assert.ok(p.state.bench.includes(variant.id));
  const actual=V.replay(JSON.parse(before),[{action:'confirmHundredRecruit',args:[r.hundredRecruit.token,selected,targets]}],'finish');
  const expected=C.createGame();expected.run=structuredClone(p.state);C.finishRun(expected);assert.deepEqual(actual.state,expected.run);
 }
 assert.equal(C.canHundredReplace(base,variant.id),false);assert.equal(C.canHundredReplace(variant.id,C.STARS.find(s=>s.id!==base&&s.tier==='C').id),false);
});
