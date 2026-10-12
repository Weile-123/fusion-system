/* Rule 12 economic quotas. Quotes are read-only; successful purchases consume quotas. */
(function(root){
  'use strict';
  function createSystem(C){
    const operations={freeBoostRefresh:'boostRefresh',freeGearRefresh:'gearRefresh',freeTraining:'training',boostRefreshDiscount:'boostRefresh',recruitRefreshDiscount:'recruitRefresh',trainingDiscount:'training',freeBasicBoost:'boostPurchase'};
    const deals=e=>e?.designEconomies||(e?.designEconomy?[e.designEconomy]:[]);
    function quote(run,type,price,item){
      if(run?.balanceRulesVersion<12||price<=0)return {price};
      const ledger=run.playerEconomy||{identities:{},freeBoosts:0};let best={price};
      for(const slot of C.SLOTS){
        const id=run.slots[slot.id],player=C.catalogForRun(run).BY_ID[id];if(!player)continue;
        const current=deals(C.resolveTalentEffect(run,slot.id)),identity=player.variantOf||id,entry=ledger.identities[identity];
        for(const active of current){
          const deal=entry?entry.deals.find(d=>d.type===active.type):active;
          if(!deal||operations[deal.type]!==type||(entry?.used[deal.type]||0)>=deal.uses)continue;
          if(deal.type==='freeBasicBoost'&&((ledger.freeBoosts||0)>=1||!deal.eligibleBoosts.includes(item)))continue;
          const free=deal.type.startsWith('free'),floor=free||type==='gearRefresh'?0:1;
          const saved=Math.max(0,Math.min(free?price:deal.amount,price-floor));
          if(saved>(price-best.price))best={price:price-saved,identity,deal,current};
        }
      }
      return best;
    }
    function consume(run,q){
      if(!q.identity)return;
      const ledger=run.playerEconomy||(run.playerEconomy={identities:{},freeBoosts:0,window:0});
      const entry=ledger.identities[q.identity]||(ledger.identities[q.identity]={deals:JSON.parse(JSON.stringify(q.current)),used:{}});
      entry.used[q.deal.type]=(entry.used[q.deal.type]||0)+1;
      if(q.deal.type==='freeBasicBoost')ledger.freeBoosts++;
    }
    function reset(run){if(run.balanceRulesVersion>=12)run.playerEconomy={identities:{},freeBoosts:0,window:(run.playerEconomy?.window||0)+1};}
    function restore(run,source){
      if(run.balanceRulesVersion<12)return;
      const saved=source?.playerEconomy;
      run.playerEconomy={identities:{},freeBoosts:saved?.freeBoosts===1?1:0,window:Number.isInteger(saved?.window)&&saved.window>=0?saved.window:0};
      const catalog=C.catalogForRun(run),allowedByIdentity={};
      for(const p of catalog.STARS){const identity=p.variantOf||p.id;for(const s of p.talentEffect.slots)(allowedByIdentity[identity]||(allowedByIdentity[identity]=[])).push(deals(p.talentEffect.slotEffects?.[s]||p.talentEffect));}
      for(const [identity,entry]of Object.entries(saved?.identities||{})){
        if(!entry||!Array.isArray(entry.deals)||!entry.used||typeof entry.used!=='object')continue;
        // Preserve spent quotas even when the owner has been sold or upgraded.
        const frozen=(allowedByIdentity[identity]||[]).find(ds=>JSON.stringify(ds)===JSON.stringify(entry.deals));if(!frozen)continue;
        run.playerEconomy.identities[identity]={deals:JSON.parse(JSON.stringify(frozen)),used:Object.fromEntries(frozen.filter(d=>Object.hasOwn(entry.used,d.type)).map(d=>[d.type,Number.isInteger(entry.used[d.type])?Math.max(0,Math.min(d.uses,entry.used[d.type])):0]))};
      }
    }
    return {quote,consume,reset,restore};
  }
  const api={createSystem};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SupFusionPlayerEconomy=api;
})(typeof window!=='undefined'?window:globalThis);
