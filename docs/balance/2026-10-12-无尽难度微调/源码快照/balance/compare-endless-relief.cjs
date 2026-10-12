'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),C=require('../h5/game-core.js');
const root='docs/balance/2026-10-12-无尽难度微调';
const versions=[{id:'old',label:'微调前规则12',rule:12,color:'#77b9ff',file:'../2026-10-12-球员羁绊更新/新版/正常游玩.json'},{id:'new',label:'微调后规则13',rule:13,color:'#5fe49c',file:'新版/正常游玩.json'}].map(v=>({...v,data:JSON.parse(fs.readFileSync(path.join(root,v.file),'utf8'))}));
const round=x=>Math.round(x*100)/100,mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
assert.deepEqual(versions[0].data.seeds,versions[1].data.seeds);assert.deepEqual(versions[0].data.limits,versions[1].data.limits);
for(const file of ['balance/engine.cjs','balance/driver.cjs','balance/policies.cjs','balance/objectives.cjs','h5/game-data.js','h5/player-economy.js'])assert.equal(versions[0].data.sourceHashes[file],versions[1].data.sourceHashes[file],file);
// Reuse the matching subset of the preserved baseline; do not alter its files.
function subset(g,seeds){
 const selected=new Set(seeds),runs=g.runs.filter(r=>selected.has(r.seed)),n=runs.length,stages=new Map(),median=require('./natural-reference.cjs').median;
 for(const r of runs)for(const p of r.trajectory){if(!stages.has(p.stage))stages.set(p.stage,[]);stages.get(p.stage).push(p)}
 const sorted=runs.map(r=>r.highestCleared).sort((a,b)=>a-b),q=p=>p===.5?median(sorted):sorted[Math.ceil(n*p)-1];
 const points=[...stages].sort((a,b)=>a[0]-b[0]).map(([stage,rows])=>({stage,player:median(rows.map(p=>p.player)),enemy:rows[0].enemy,n:rows.length,reachRate:rows.length/n,playerMin:Math.min(...rows.map(p=>p.player)),playerMax:Math.max(...rows.map(p=>p.player))}));
 return {...g,n,seeds,runs,points,summary:{clears:runs.filter(r=>r.highestCleared>=10).length,p10:q(.1),p50:q(.5),p90:q(.9),max:sorted.at(-1),errors:runs.filter(r=>r.status==='error').length,censored:runs.filter(r=>r.status==='censored').length}};
}
versions[0].data.groups=versions[0].data.groups.map(g=>subset(g,versions[1].data.groups.find(n=>n.id===g.id).runs.map(r=>r.seed)));
const groups=versions[0].data.groups.map(base=>{
 const observations=versions.map(v=>{const g=v.data.groups.find(g=>g.id===base.id);assert.equal(v.data.rulesVersion,v.rule);assert.equal(g.n,base.id==='high'?90:100);assert.equal(g.summary.errors,0);assert.equal(g.summary.censored,0);assert.ok(g.runs.every(r=>r.status==='death'));for(const key of ['policy','growthLevel','ads'])assert.equal(g[key],base[key]);assert.equal(g.validation.browserGlobal.match,true);assert.equal(g.validation.cloud.match,true);for(const p of g.points)assert.equal(p.enemy,C.opponent({stage:p.stage,balanceRulesVersion:v.rule}).rating);return {id:v.id,label:v.label,...g.summary,n:g.n,mainlineCleared:g.summary.clears,clears:round(g.summary.clears/g.n*100),meanCleared:round(mean(g.runs.map(r=>r.highestCleared))),maxAttempted:Math.max(...g.runs.map(r=>r.highestAttempted)),points:g.points,validation:g.validation}});
 const fresh=versions[1].data.groups.find(g=>g.id===base.id),pairs=base.runs.map(r=>{const n=fresh.runs.find(n=>n.seed===r.seed);assert.equal(r.highestCleared>=10,n.highestCleared>=10,'mainline clear seed '+r.seed);for(const p of r.trajectory.filter(p=>p.stage<=10))assert.deepEqual(p,n.trajectory.find(n=>n.stage===p.stage),'mainline trajectory seed '+r.seed);return {seed:r.seed,old:r.highestCleared,new:n.highestCleared,delta:n.highestCleared-r.highestCleared}});
 return {id:base.id,label:{low:'低阶',mid:'中阶',high:'高阶'}[base.id],observations,pairs,paired:{better:pairs.filter(p=>p.delta>0).length,same:pairs.filter(p=>p.delta===0).length,worse:pairs.filter(p=>p.delta<0).length}};
});
const foes=versions.map(v=>({id:v.id,values:Array.from({length:1000},(_,i)=>C.opponent({stage:i+1,balanceRulesVersion:v.rule}).rating)}));
const data={kind:'endless-relief-comparison',date:'2026-10-12',rulesVersion:13,seeds:versions[1].data.seeds,limits:versions[1].data.limits,sourceHashes:versions[1].data.sourceHashes,versions:versions.map(({data,...v})=>v),groups,foes};
fs.writeFileSync(root+'/版本对比.json',JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(root+'/同种子逐局对比.csv','\uFEFF档位,种子,微调前已通过,微调后已通过,差值\n'+groups.flatMap(g=>g.pairs.map(p=>[g.label,p.seed,p.old,p.new,p.delta].join(','))).join('\n')+'\n');
const statRows=groups.map(g=>'|'+g.label+'|'+['clears','p50','meanCleared','max','maxAttempted'].map(k=>g.observations.map(o=>o[k]+(k==='clears'?'%':'')).join(' → ')).join('|')+'|').join('\n');
const stages=[10,11,15,20,30,50,60,80,100,138,200,456];
fs.writeFileSync(root+'/无尽微调报告.md',`# 无尽难度小幅调整\n\n仅重测新版规则13：低、中各100局，高阶90局；微调前直接复用规则12的既有记录，匹配低、中各100局与高阶前90局。低、中种子81101—81200，高阶81101—81190；使用相同策略、成长、广告与所有测试边界，均从第一关空阵容开始。\n\n第1—10关主线完全不变；第11关起在原分段难度倍率上进一步降低基础属性约3%，至第20关平滑增至降低5%，此后固定降低约5%。先缩放基础六维，再计算面板OVR；取整与关卡严格递增保护会造成少量偏差，第11关实际OVR降幅略小。新规则13只在新局生效，规则1—12旧存档保留原曲线。球员、羁绊、天赋、经济、广告策略没有另行调整。\n\n## 结果（规则12 → 规则13）\n\n|档位|主线通关率|已通过中位数|平均已通过|样本最高已通过|最高挑战关卡|\n|---|---:|---:|---:|---:|---:|\n${statRows}\n\n${groups.map(g=>{const[a,b]=g.observations;return g.label+'平均通过关卡变化 '+round(b.meanCleared-a.meanCleared)+'（'+round((b.meanCleared/a.meanCleared-1)*100)+'%）；同种子提高／持平／降低 '+g.paired.better+'／'+g.paired.same+'／'+g.paired.worse+'局。'}).join('\n\n')}\n\n高阶对照仅取前90个相同种子，不含上一轮种子81192通过138关的极端样本；旧版完整100局与该样本仍原样保留，因此本表的旧版最高73关与上一轮完整样本最高138关口径不同。\n\n## 对手数值\n\n|关卡|原OVR|新OVR|降幅|\n|---|---:|---:|---:|\n${stages.map(s=>{const a=foes[0].values[s-1],b=foes[1].values[s-1];return '|'+s+'|'+a+'|'+b+'|'+round((1-b/a)*100)+'%|'}).join('\n')}\n\n## 验证与局限\n\n290局错误0、截断0，全部运行至死亡；逐种子核对前10关首次开战轨迹与主线通关结果完全一致。三档首局浏览器全局核心与本地校验器完整回放一致。后端保持规则11未更新，规则13只能进行本地回放模拟，不能宣称完成生产后端兼容验收。\n\n与上一轮使用完全相同的测试策略。高阶全局外成长／全解锁，积极观看可带来收益的广告，但阵容与装备必须正常获取，不预置。AI仍保留固定成长路线，未穷举所有新羁绊的最优组合。玩家曲线仅取每局每关第一次开战前面板，死亡后不补点，无人到达处不外推；后期存在幸存者偏差。最高已通过关卡是样本极值，不是理论上限。\n\n种子、配置、源码哈希、逐关轨迹随汇总保留；完整操作与状态日志仅本地保存，不上传Git。原规则12页面、统计、源码快照原样保留，历史文件校验记录见历史文件校验.json。历史回归仍存在一项上轮已记录的旧源码快照 game-ui.js 哈希不符，本轮未修改该文件，也未覆盖旧校验记录。\n\n[对比网页](index.html) · [本次独立曲线](新版/index.html) · [微调前记录](../2026-10-12-球员羁绊更新/index.html) · [逐局对比](同种子逐局对比.csv) · [统计JSON](版本对比.json)\n`);
let html=require('./curve-comparison-page.cjs').page(data);
html=html.replaceAll('球员与羁绊更新','无尽难度微调').replaceAll('数值对比报告.md','无尽微调报告.md').replaceAll('历史规则9','微调前规则12').replaceAll('规则12玩家','规则13玩家').replaceAll('规则12对手','规则13对手').replaceAll('规则12后端','规则13后端');
html=html.replace('仅重测规则12低／中／高各100局，共300局；旧版引用规则9既有300局记录。同种子，空阵容正常成长；测试器覆盖存在差异，结果作为历史参照。','仅重测规则13低、中各100局，高阶90局，共290局；微调前直接引用规则12相同种子记录。同种子、同策略、同边界；主线1—10关完全不变，无尽约降低3%—5%。');
html=html.replace('本次使用补齐商店、SSR解锁与徽章广告评估后的测试器仅重跑新版，历史参照差异不能全部归因于球员／羁绊更新。','相同测试器策略与成长口径，仅调整无尽对手数值。');
html=html.replaceAll('../2026-10-11-关卡微调/新版/index.html','../2026-10-12-球员羁绊更新/新版/index.html');
fs.writeFileSync(root+'/index.html',html.replaceAll('微调前规则13','微调前规则12')); 
console.log(JSON.stringify(groups.map(g=>({id:g.id,versions:g.observations.map(({points,validation,...o})=>o)})),null,2));
