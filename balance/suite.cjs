'use strict';
const fs=require('node:fs'),path=require('node:path');
const {isolated}=require('./cli.cjs');
const {manifest}=require('./engine.cjs');
const {writeRecord,validate}=require('./runner.cjs');
const groups=[{id:'novice-none',policy:'novice',growthLevel:'none',label:'新手：无局外成长'},{id:'ordinary-none',policy:'ordinary',growthLevel:'none',label:'普通：无局外成长'},{id:'expert-none',policy:'expert',growthLevel:'none',label:'高手：无局外成长'},{id:'expert-half',policy:'expert',growthLevel:'half',label:'高手：半局外成长'},{id:'expert-full',policy:'expert',growthLevel:'full',label:'高手：满局外成长'}];
async function main(){
  const pilot=process.argv.includes('--pilot'),count=pilot?3:400,baseSeed=pilot?31001:40001;
  const dir=path.resolve(pilot?'artifacts/balance/round2-pilot-v3':'artifacts/balance/batch-2000-20261010-v3');
  fs.mkdirSync(dir,{recursive:true});const hashes=manifest();
  const jobs=[];for(let i=0;i<count;i++)for(const g of groups)jobs.push({g,i,seed:baseSeed+i});
  let next=0;const results=new Map(groups.map(g=>[g.id,[]]));
  async function worker(){while(next<jobs.length){
    const {g,i,seed}=jobs[next++],config={policy:g.policy,growthLevel:g.growthLevel,seed,maxStage:1000,maxMs:180000,maxActionsPerBattle:180};
    const folder=path.join(dir,g.id);fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,`${String(i+1).padStart(4,'0')}-${g.policy}-${seed}.json`);
    let record;
    if(fs.existsSync(file)){record=JSON.parse(fs.readFileSync(file,'utf8'));if(JSON.stringify(record.sourceHashes)!==JSON.stringify(hashes))throw Error('Resume source mismatch '+file)}
    else{record=await isolated(config);writeRecord(record,file)}
    const validation=pilot&&!record.partial&&record.outcome.status!=='error'?validate(record):null;
    const row={file,group:g.id,policy:g.policy,growthLevel:g.growthLevel,seed,validation,...record.outcome};results.get(g.id).push(row);console.log(JSON.stringify(row));
  }}
  await Promise.all(Array.from({length:pilot?2:8},()=>worker()));
  if(JSON.stringify(manifest())!==JSON.stringify(hashes))throw Error('Source changed during batch');
  for(const g of groups){const runs=results.get(g.id).sort((a,b)=>a.seed-b.seed);fs.writeFileSync(path.join(dir,g.id,'summary.json'),JSON.stringify({command:pilot?'pilot':'suite',count,group:g,sourceHashes:hashes,runs},null,2)+'\n')}
  fs.writeFileSync(path.join(dir,'suite.json'),JSON.stringify({groups,count,baseSeed,total:jobs.length,sourceHashes:hashes},null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1});
module.exports={groups};
