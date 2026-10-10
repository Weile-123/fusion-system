#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {simulate,replay,validate,writeRecord}=require('./runner.cjs');
const {names}=require('./policies.cjs');
const {manifest,normalize}=require('./engine.cjs');
async function isolated(config){
  const cfg=normalize(config);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(__filename,{workerData:cfg});let checkpoint=null,done=false;
    const timer=setTimeout(async()=>{done=true;await worker.terminate();resolve({schemaVersion:1,config:cfg,partial:true,outcome:{status:'censored',limit:'worker-time',checkpoint},journal:[],battles:[],events:[]})},cfg.maxMs+2000);
    worker.on('message',message=>{if(message.type==='checkpoint')checkpoint=message.value;else if(message.type==='result'&&!done){done=true;clearTimeout(timer);resolve(message.value)}});
    worker.on('error',e=>{if(!done){done=true;clearTimeout(timer);reject(e)}});
    worker.on('exit',code=>{if(!done){done=true;clearTimeout(timer);reject(Error('Worker exited '+code))}});
  });
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');out[argv[i].slice(2)]=argv[++i]}return out}
async function main(){
  const [command='smoke',...rest]=process.argv.slice(2),a=args(rest),dir=path.resolve(a.out||'artifacts/balance');
  if(['replay','validate'].includes(command)){
    if(!a.file)throw Error('--file required');const record=JSON.parse(fs.readFileSync(a.file,'utf8'));
    if(record.partial)throw Error('Partial timeout record cannot be replayed');
    console.log(JSON.stringify(command==='replay'?replay(record):validate(record),null,2));return;
  }
  const config=a.config?JSON.parse(fs.readFileSync(a.config,'utf8')):{};
  for(const [arg,key] of Object.entries({seed:'seed','max-stage':'maxStage','max-ms':'maxMs','max-actions':'maxActions','max-battles':'maxBattles'}))if(a[arg])config[key]=Number(a[arg]);
  if(a.policy)config.policy=a.policy;if(a.ads)config.ads=a.ads;
  fs.mkdirSync(dir,{recursive:true});
  if(command==='run'){
    const record=await isolated(config),file=path.join(dir,`${record.config.policy}-${record.config.seed}.json`);writeRecord(record,file);
    console.log(JSON.stringify({file,...record.outcome},null,2));if(record.outcome.status==='error')process.exitCode=1;return;
  }
  if(!['smoke','batch'].includes(command))throw Error('Expected smoke, run, batch, replay or validate');
  const count=Number(a.count||(command==='smoke'?20:1000));if(!Number.isInteger(count)||count<1)throw Error('Invalid count');
  const summaries=[];
  for(let i=0;i<count;i++){
    const policy=a.policy||config.policy||names[i%names.length],seed=(Number(config.seed??10001)+(a.policy||config.policy?i:Math.floor(i/names.length)))>>>0;
    const cfg={...config,policy,seed,maxStage:config.maxStage??(command==='smoke'?30:500)};
    const record=await isolated(cfg);let check=null;
    if(command==='smoke'&&!record.partial&&record.outcome.status!=='error')check=validate(record);
    const file=path.join(dir,`${String(i+1).padStart(4,'0')}-${policy}-${seed}.json`);writeRecord(record,file);
    const summary={file,policy,seed,mode:record.mode,validation:check,...record.outcome};summaries.push(summary);console.log(JSON.stringify(summary));
  }
  const summaryFile=path.join(dir,'summary.json');fs.writeFileSync(summaryFile,JSON.stringify({command,count,config,sourceHashes:manifest(),runs:summaries},null,2)+'\n');
  if(summaries.some(r=>r.status==='error'||command==='smoke'&&!r.validation))process.exitCode=1;
}
if(!isMainThread){
  const record=simulate({...workerData,onStep:({row})=>{if(row.name==='battle'||row.index%50===0)parentPort.postMessage({type:'checkpoint',value:{index:row.index,stage:row.stage,resources:row.resources,hash:row.afterHash}})}});
  parentPort.postMessage({type:'result',value:record});
}else if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1});
module.exports={isolated};
