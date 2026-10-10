'use strict';
// 对既有批量记录抽样回放，重现驱动器异常；不混入统计样本。
const fs=require('node:fs'),path=require('node:path');
const {C,clone,hash,manifest}=require('./engine.cjs');
const {simulate,validate}=require('./runner.cjs');
const {enumerate}=require('./driver.cjs');
const {names}=require('./policies.cjs');
const dir=path.resolve(process.argv[2]||'artifacts/balance/batch-1000-20261010');
const result={sourceHashes:manifest(),checks:[],errors:[],resources:[]};
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1];
for(const policy of names){
  const group=JSON.parse(fs.readFileSync(path.join(dir,policy,'summary.json'),'utf8'));
  const valid=group.runs.filter(x=>x.status==='death');
  const selected=[...valid].sort((a,b)=>b.highestCleared-a.highestCleared)[0];
  const record=JSON.parse(fs.readFileSync(selected.file,'utf8'));
  result.checks.push({policy,seed:selected.seed,file:selected.file,...validate(record)});
  const money=valid.map(x=>x.finalCash);
  result.resources.push({policy,n:valid.length,deathCashP50:percentile(money,.5),deathCashP90:percentile(money,.9),deathsWithCashAtLeast40:money.filter(x=>x>=40).length});
  for(const item of group.runs.filter(x=>x.status==='error')){
    const old=JSON.parse(fs.readFileSync(item.file,'utf8')),again=simulate(old.config);
    if(again.outcome.status!=='error'||again.outcome.finalHash!==old.outcome.finalHash||again.outcome.error.message!==old.outcome.error.message)throw Error('Error did not reproduce');
    const game=clone(old.finalGame),listed=enumerate(C,game,old.config).find(x=>x.name==='recruit');
    const rejected=C.recruit(clone(game.run),listed.args[0]);
    const cloud=require('../activity/cloudfunctions/activity_api/game/game-core.js');
    const cloudRejected=cloud.recruit(clone(game.run),listed.args[0]);
    const battle=C.battle(clone(game),'outside');
    result.errors.push({policy,seed:item.seed,file:item.file,status:again.outcome.status,finalHash:hash(game),deterministicMatch:true,prefixValidation:validate(old),
      cash:game.run.cash,free:game.run.free,recruitCost:C.recruitCost(game.run),listedAction:listed,coreResponse:rejected,cloudResponse:cloudRejected,actualBattleAllowed:!!battle});
  }
}
const gapFile=path.join(dir,'novice','0068-novice-20068.json');
result.checks.push({policy:'novice',seed:20068,file:gapFile,label:'largest OVR ratio',...validate(JSON.parse(fs.readFileSync(gapFile,'utf8')))});
fs.writeFileSync(path.join(dir,'analysis','verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
