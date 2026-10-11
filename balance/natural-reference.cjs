'use strict';
// Supplemental legal acquisition runs; not the fully built upper envelope.
const fs=require('node:fs'),path=require('node:path');
const zlib=require('node:zlib');
const {isolated}=require('./cli.cjs');
const {validate}=require('./runner.cjs');
const {manifest}=require('./engine.cjs');
const median=a=>{const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2;};
async function main(){
  const args=process.argv.slice(2),count=args.includes('--count')?Number(args[args.indexOf('--count')+1]):100;
  const rulesVersion=args.includes('--rules-version')?Number(args[args.indexOf('--rules-version')+1]):require('../h5/game-core.js').BALANCE_RULES_VERSION;
  const out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'docs/balance/2026-10-11-关卡微调/新版/正常游玩.json');
  const protectedDir=path.resolve('docs/balance/2026-10-11');if(out===protectedDir||out.startsWith(protectedDir+path.sep))throw Error('旧数值参考目录不可覆盖');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const maxActions=args.includes('--max-actions')?Number(args[args.indexOf('--max-actions')+1]):30000,maxMs=args.includes('--max-ms')?Number(args[args.indexOf('--max-ms')+1]):600000;
  const concurrency=args.includes('--concurrency')?Number(args[args.indexOf('--concurrency')+1]):1;
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw Error('Invalid --concurrency');
  if(!Number.isInteger(count)||count<1)throw Error('Invalid --count');
  const specs=[{id:'low',policy:'novice',growthLevel:'none'},{id:'mid',policy:'ordinary',growthLevel:'half'},{id:'high',policy:'expert',growthLevel:'full'}];
  const groups=await Promise.all(specs.map(async spec=>{
    const runs=[],byStage=new Map();let checked=null;
    let next=0;
    await Promise.all(Array.from({length:concurrency},async()=>{while(next<count){
      const i=next++,config={policy:spec.policy,growthLevel:spec.growthLevel,rulesVersion,seed:81101+i,maxStage:1000,maxActions,maxMs,maxBattles:2000,maxActionsPerBattle:500,ads:spec.id==='high'?'rewarded-success':'none'};
      const log=path.join('完整记录',spec.id+'-'+config.seed+'.json.gz'),file=path.join(path.dirname(out),log);
      const record=fs.existsSync(file)?JSON.parse(zlib.gunzipSync(fs.readFileSync(file))):await isolated(config);
      if(Object.keys(config).some(key=>record.config[key]!==config[key])||JSON.stringify(record.sourceHashes)!==JSON.stringify(manifest()))throw Error('缓存配置或源码不符：'+file);
      if(record.outcome.status==='error'||record.partial)throw Error(JSON.stringify(record.outcome));
      if(i===0)checked=validate(record);
      fs.mkdirSync(path.join(path.dirname(out),'完整记录'),{recursive:true});
      if(!fs.existsSync(file))fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(record),{level:1}));
      runs.push({seed:81101+i,talent:record.chosen,config:record.config,log,stats:record.finalGame.run.stats,...record.outcome});
      // One observation per run per stage, immediately before its first battle. Retries do not overweight unlucky runs.
      const observed=new Set(),trajectory=[];
      for(const battle of record.battles){
        if(observed.has(battle.stage))continue;observed.add(battle.stage);
        const point={stage:battle.stage,player:battle.before.rating,enemy:battle.foeRating,cash:battle.before.cash,bonds:battle.before.bonds.length,won:battle.won};
        trajectory.push(point);if(!byStage.has(point.stage))byStage.set(point.stage,[]);byStage.get(point.stage).push(point);
      }
      runs.at(-1).trajectory=trajectory;
      console.log(JSON.stringify({group:spec.id,completed:runs.length,status:record.outcome.status,cleared:record.outcome.highestCleared,seed:config.seed}));
    }}));
    runs.sort((a,b)=>a.seed-b.seed);
    const sorted=runs.map(x=>x.highestCleared).sort((a,b)=>a-b),q=p=>p===.5?median(sorted):sorted[Math.ceil(sorted.length*p)-1];
    const points=[...byStage].sort((a,b)=>a[0]-b[0]).map(([stage,rows])=>({stage,player:median(rows.map(x=>x.player)),enemy:rows[0].enemy,n:rows.length,reachRate:rows.length/count,playerMin:Math.min(...rows.map(x=>x.player)),playerMax:Math.max(...rows.map(x=>x.player))}));
    return {...spec,ads:spec.id==='high'?'rewarded-success':'none',label:{low:'低阶：新手／无局外成长',mid:'中阶：普通策略／半局外成长',high:'高阶：高手策略／满局外成长／广告'}[spec.id],n:runs.length,points,validation:checked,summary:{clears:runs.filter(x=>x.highestCleared>=10).length,p10:q(.1),p50:q(.5),p90:q(.9),max:sorted.at(-1),errors:runs.filter(x=>x.status==='error').length,censored:runs.filter(x=>x.status==='censored').length},runs};
  }));
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const data={kind:'natural',date:'2026-10-11',rulesVersion,seeds:Array.from({length:count},(_,i)=>81101+i),description:count+' fresh runs per tier; low/mid no ads, high rewarded ads succeed with real limits. Legal recruitment/training/economy and events. High uses full account growth but acquires roster naturally. Limits are censored, not defeats.',limits:{maxStage:1000,maxActions,maxMs,maxBattles:2000,maxActionsPerBattle:500},sourceHashes:manifest(),groups};
  fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');
  fs.writeFileSync(path.join(path.dirname(out),'index.html'),require('./natural-page.cjs').page(data));
  fs.writeFileSync(path.join(path.dirname(out),'natural-curves.csv'),'\uFEFFtier,stage,playerMedian,enemy,reached,total,reachRate,playerMin,playerMax\n'+groups.flatMap(g=>g.points.map(p=>[g.id,p.stage,p.player,p.enemy,p.n,g.n,p.reachRate,p.playerMin,p.playerMax].join(','))).join('\n')+'\n');
  console.log(JSON.stringify(groups.map(x=>({id:x.id,summary:x.summary})),null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={median};
