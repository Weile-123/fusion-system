'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=process.env.BALANCE_COMPARISON_DIR||'docs/balance/2026-10-11-词条天赋更新';
const enabled=fs.existsSync(path.join(root,'版本对比.json'));
const data=enabled?JSON.parse(fs.readFileSync(path.join(root,'版本对比.json'),'utf8')):null;
const load=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
// Full traces are optional local evidence; summaries and protected non-trace files remain required.
const isTrace=file=>/(?:^|[\\/])完整记录[\\/](low|mid|high)-\d+\.json\.gz$/.test(file);
test('paired version comparison contains 600 natural runs with aligned seeds, account tiers, boundaries and ads',{skip:!enabled},()=>{
 const a=load('旧版/正常游玩.json'),b=load('新版/正常游玩.json');assert.equal(a.rulesVersion,6);assert.equal(b.rulesVersion,8);assert.deepEqual(a.seeds,b.seeds);assert.equal(a.seeds.length,100);assert.deepEqual(a.limits,b.limits);
 assert.equal(data.pairs.length,300);
 for(const old of a.groups){const current=b.groups.find(g=>g.id===old.id);assert.equal(old.n,100);assert.equal(current.n,100);assert.equal(old.ads,current.ads);assert.equal(old.ads,old.id==='high'?'rewarded-success':'none');assert.equal(old.policy,current.policy);assert.equal(old.growthLevel,current.growthLevel);
  for(const g of [old,current]){assert.equal(g.validation.browserGlobal.match,true);assert.equal(g.validation.cloud.match,true);assert.equal(g.summary.errors,0);const traceDir=path.join(root,g===old?'旧版':'新版','完整记录');if(fs.existsSync(traceDir))assert.equal(fs.readdirSync(traceDir).filter(f=>f.startsWith(g.id+'-')).length,100);for(const r of g.runs){assert.ok(isTrace(r.log));if(fs.existsSync(traceDir))assert.ok(fs.existsSync(path.join(root,g===old?'旧版':'新版',r.log)));assert.equal(r.config.ads,g.ads);assert.equal(r.config.maxActionsPerBattle,500);assert.equal(r.config.maxMs,600000);assert.equal(new Set(r.trajectory.map(p=>p.stage)).size,r.trajectory.length);assert.ok(r.trajectory.every(p=>p.stage<=r.highestAttempted));if(g.id==='high'){assert.equal(r.adUsage.talentSelection,1);assert.ok(r.adUsage.recruitment>0);assert.ok(r.adUsage.resurrection<=1);if(g===current)assert.ok(r.adUsage.skillSelection>0)}else assert.equal(Object.values(r.adUsage).reduce((s,x)=>s+x,0),0)}}
 }
});
test('pairwise differences and conditional OVR medians match the source observations',{skip:!enabled},()=>{
 const a=load('旧版/正常游玩.json'),b=load('新版/正常游玩.json');
 for(const pair of data.pairs){const old=a.groups.find(g=>g.id===pair.tier).runs.find(r=>r.seed===pair.seed),current=b.groups.find(g=>g.id===pair.tier).runs.find(r=>r.seed===pair.seed);assert.equal(pair.delta,current.highestCleared-old.highestCleared)}
 for(const curve of data.curves){const old=a.groups.find(g=>g.id===curve.tier).points.find(p=>p.stage===curve.stage),current=b.groups.find(g=>g.id===curve.tier).points.find(p=>p.stage===curve.stage);assert.equal(curve.oldOvr,old?.player??null);assert.equal(curve.newOvr,current?.player??null);assert.equal(curve.oldReached,old?.n||0);assert.equal(curve.newReached,current?.n||0)}
 for(const g of data.groups)assert.equal(g.paired.better+g.paired.worse+g.paired.same,100);
});
test('previous 30-run static page and all protected reference files retain their original hashes',{skip:!enabled},()=>{
 for(const [file,expected]of Object.entries(load('旧参考文件校验.json'))){if(!fs.existsSync(file)){assert.ok(isTrace(file),file);continue;}assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,file);}
 assert.equal(data.historicalMatches,60);
 assert.ok(fs.existsSync('docs/balance/2026-10-11/index.html'));
});
test('comparison charts draw old and new observations plus enemy curves up to 1000 without extrapolating player data',{skip:!enabled},()=>{
 class Element{constructor(){this.children=[];this.attributes={};this.listeners={}}append(x){this.children.push(x)}setAttribute(k,v){this.attributes[k]=v}addEventListener(k,v){this.listeners[k]=v}replaceChildren(){this.children=[]}getBoundingClientRect(){return{left:0,width:1100}}}
 const elements=Object.fromEntries(['range','scale','charts'].map(id=>[id,new Element()]));elements.range.value='1000';elements.scale.value='linear';
 const document={getElementById:id=>elements[id],createElement:()=>new Element(),createElementNS:()=>new Element()};
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),context=vm.createContext({document});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 for(const range of [10,50,100,1000])for(const scale of ['linear','log']){elements.range.value=String(range);elements.scale.value=scale;vm.runInContext('draw()',context);assert.equal(elements.charts.children.length,3);for(const [i,article]of elements.charts.children.entries()){const svg=article.children.find(e=>e.attributes.viewBox),paths=svg.children.filter(e=>e.attributes.d),g=data.groups[i];assert.equal(paths.length,3);assert.ok(paths.every(p=>!/(NaN|Infinity)/.test(p.attributes.d)));assert.equal(paths[2].attributes.d.split(' ').length,range);for(const [j,key]of [[0,'oldOvr'],[1,'newOvr']])assert.equal(paths[j].attributes.d.split(' ').length,data.curves.filter(p=>p.tier===g.id&&p.stage<=range&&p[key]!==null).length);if(range===1000){svg.listeners.pointermove({clientX:1000});assert.ok(article.children.find(e=>e.className==='tip').textContent.includes('无实测数据'))}}}
 assert.match(html,/保留的上个版本30局页面/);
});
