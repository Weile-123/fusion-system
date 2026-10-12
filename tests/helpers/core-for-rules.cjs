// Pin historical assertions to their original card catalog, while executing current core code.
module.exports=function(version){const core=require('../../h5/game-core.js'),catalog=core.catalogForRun({balanceRulesVersion:version});
 return new Proxy(core,{get(target,key){if(key in catalog)return catalog[key];if(key==='saleValue')return (id,stars=1,run={balanceRulesVersion:version})=>core.saleValue(id,stars,run);if(key==='createRun')return (talent,seed,progress={},rules=version)=>core.createRun(talent,seed,progress,rules);return target[key];}});
};
