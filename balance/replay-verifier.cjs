'use strict';
// Local replay simulation only. Rule 12 is NOT supported by the unchanged deployed backend.
const fs=require('node:fs'),C=require('../h5/game-core.js');
const deployed=require('../activity/cloudfunctions/activity_api/verified-game.js');
const deployedCore=require('../activity/cloudfunctions/activity_api/game/game-core.js');
const moduleCopy={exports:{}};
new Function('require','module','exports',fs.readFileSync(require.resolve('../activity/cloudfunctions/activity_api/verified-game.js'),'utf8'))(name=>name==='./game/game-core.js'?C:require(name),moduleCopy,moduleCopy.exports);
function forRules(version){return version>deployedCore.BALANCE_RULES_VERSION?{core:C,verifier:moduleCopy.exports,pendingDeployment:true}:{core:deployedCore,verifier:deployed,pendingDeployment:false};}
module.exports={...moduleCopy.exports,forRules,deployedRulesVersion:deployedCore.BALANCE_RULES_VERSION,replay(state,...args){return forRules(state.balanceRulesVersion||1).verifier.replay(state,...args);}};
