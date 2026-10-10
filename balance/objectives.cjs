'use strict';
const routeSlots={three:'durant',mid:'jordan',drive:'lebron',handle:'magic',inside:'shaq',def:'duncan'};
const routeBench=['iguodala','green','kobe','harper','pippen','curry','caruso','rodman','longley','klay'];
const routeIds=[...Object.values(routeSlots),...routeBench];
function profileFor(C,level,seed){
  const p=C.createGame().profile;if(level==='none')return p;
  if(!['half','full'].includes(level))throw Error('Unknown growth level');
  for(const u of C.META_UPGRADES)p.upgrades[u.id]=level==='full'?u.prices.length:Math.round(u.prices.length/2);
  let state=(seed^0x91ab1244)>>>0;
  const select=pool=>{const a=[...pool];for(let i=a.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=Math.floor(state/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,level==='full'?a.length:Math.round(a.length/2)).map(x=>x.id)};
  p.jerseyUnlocks=select(C.GEAR.filter(x=>x.slot==='球衣'&&x.unlockable));
  p.gearUnlocks=select(C.GEAR.filter(x=>x.legendary));
  p.metaUnlocks.talents=select(C.TALENTS.filter(x=>x.unlock));
  // 这里只建立用户指定的历史账号进度，不增加对局奖金、不赠送实物。
  return p;
}
function completion(C,r){
  const owned=new Set(Object.keys(r.owned).map(C.identityOf));
  const correct=Object.entries(routeSlots).filter(([s,id])=>C.identityOf(r.slots[s])===id).length;
  const members=routeIds.filter(id=>owned.has(id)).length;
  const stars=routeIds.filter(id=>Object.entries(r.owned).some(([pid,o])=>C.identityOf(pid)===id&&o.stars>=C.starLimit(r,pid))).length;
  const trained=Object.entries(r.slots).filter(([,pid])=>pid&&r.owned[pid].train>=C.trainingLimit(r,pid)).length;
  const jerseys=[...r.gear,...r.gearReserve].filter(id=>C.GEAR.find(x=>x.id===id)?.slot==='球衣').length;
  const jerseyPool=C.GEAR.filter(x=>x.slot==='球衣'&&C.gearAvailable(r,x)).length;
  return {members,correctSlots:correct,routeComplete:members===16&&correct===6,maxStarMembers:stars,trainedStarters:trained,jerseys,jerseyPool,jerseysComplete:jerseys===jerseyPool,equipmentSlots:r.gear.length};
}
module.exports={routeSlots,routeBench,routeIds,profileFor,completion};
