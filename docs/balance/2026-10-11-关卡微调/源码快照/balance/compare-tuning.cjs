'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('../h5/game-core.js');
const root='docs/balance/2026-10-11-关卡微调',prior='docs/balance/2026-10-11-词条天赋更新';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const versions=[{id:'old',label:'旧版',file:prior+'/旧版/正常游玩.json',rule:6,color:'#77b9ff'},{id:'original',label:'更新未微调',file:prior+'/新版/正常游玩.json',rule:8,color:'#bbb0ff'},{id:'adjusted',label:'本次微调',file:root+'/新版/正常游玩.json',rule:9,color:'#5fe49c'}].map(v=>({...v,data:read(v.file)}));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,round=n=>Math.round(n*100)/100;
for(const v of versions){assert.equal(v.data.rulesVersion,v.rule);assert.equal(v.data.seeds.length,100);assert.deepEqual(v.data.seeds,versions[0].data.seeds);assert.deepEqual(v.data.limits,versions[0].data.limits)}
const groups=versions[0].data.groups.map(base=>{
 const observations=versions.map(v=>{const g=v.data.groups.find(g=>g.id===base.id);assert.equal(g.n,100);for(const key of ['policy','growthLevel','ads'])assert.equal(g[key],base[key]);assert.equal(g.summary.errors,0);assert.equal(g.summary.censored,0);assert.equal(g.validation.browserGlobal.match,true);assert.equal(g.validation.cloud.match,true);return{id:v.id,label:v.label,...g.summary,meanCleared:round(mean(g.runs.map(r=>r.highestCleared))),firstOvr:g.points[0].player,points:g.points,adTotals:Object.fromEntries(['talentSelection','recruitment','skillSelection','resurrection'].map(k=>[k,g.runs.reduce((s,r)=>s+(r.adUsage?.[k]||0),0)])),validation:g.validation};});
 const adjusted=versions[2].data.groups.find(g=>g.id===base.id),pairs=base.runs.map(r=>{const a=adjusted.runs.find(n=>n.seed===r.seed),b=versions[1].data.groups.find(g=>g.id===base.id).runs.find(n=>n.seed===r.seed);return{seed:r.seed,old:r.highestCleared,original:b.highestCleared,adjusted:a.highestCleared,deltaOld:a.highestCleared-r.highestCleared,deltaOriginal:a.highestCleared-b.highestCleared};});
 return{id:base.id,label:{low:'低阶',mid:'中阶',high:'高阶'}[base.id],observations,pairs};
});
const foes=versions.map(v=>({id:v.id,values:Array.from({length:1000},(_,i)=>C.opponent({stage:i+1,balanceRulesVersion:v.rule}).rating)}));
for(const v of versions)for(const g of v.data.groups)for(const p of g.points)assert.equal(p.enemy,foes.find(f=>f.id===v.id).values[p.stage-1]);
const goalCheck=groups.map(g=>{const[a,b,c]=g.observations;return{tier:g.id,meanBetween:c.meanCleared>a.meanCleared&&c.meanCleared<b.meanCleared,medianBetween:c.p50>a.p50&&c.p50<b.p50,retainedGainPercent:round((c.meanCleared-a.meanCleared)/(b.meanCleared-a.meanCleared)*100)};});
const data={date:'2026-10-11',kind:'opponent-tuning-comparison',goalCheck,seeds:versions[0].data.seeds,limits:versions[0].data.limits,versions:versions.map(({data,...v})=>v),groups,foes};
fs.writeFileSync(root+'/三版本对比.json',JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(root+'/同种子逐局对比.csv','\uFEFF档位,种子,旧版通过关卡,未微调通过关卡,微调通过关卡,微调相对旧版,微调相对未微调\n'+groups.flatMap(g=>g.pairs.map(p=>[g.label,p.seed,p.old,p.original,p.adjusted,p.deltaOld,p.deltaOriginal].join(','))).join('\n')+'\n');
const statRow=g=>'|'+g.label+'|'+['clears','p50','meanCleared','max','firstOvr'].map(k=>g.observations.map(o=>o[k]+(k==='clears'?'%':'')).join(' → ')).join('|')+'|';
const sameStages=[1,5,10,20,30,50,60,70,80,100];
const curveRows=groups.flatMap(g=>sameStages.map(s=>{const ps=g.observations.map(o=>o.points.find(p=>p.stage===s));return ps.some(Boolean)?'|'+g.label+'|'+s+'|'+ps.map(p=>p?p.player+'（'+p.n+'/100）':'—（0/100）').join('|')+'|':null;}).filter(Boolean)).join('\n');
const conclusions=groups.map(g=>{const[a,b,c]=g.observations;return g.label+'平均通过关卡相对旧版'+(c.meanCleared>=a.meanCleared?'增加':'减少')+round(Math.abs(c.meanCleared-a.meanCleared))+'关（'+round((c.meanCleared/a.meanCleared-1)*100)+'%），相对未微调版'+(c.meanCleared>=b.meanCleared?'增加':'减少')+round(Math.abs(c.meanCleared-b.meanCleared))+'关。';}).join('\n\n');
fs.writeFileSync(root+'/关卡微调报告.md',`# 关卡数值微调与三版本对比

仅提高新局对手数值，保留词条、天赋、经济和玩家成长收益。规则9生效，规则1—8已有对局继续按原曲线运行。三个版本使用相同种子81101—81200、相同策略、成长与广告条件；复用已验收的旧版规则6和未微调规则8各300局，本次另跑规则9三档各100局。

对手原始六项属性统一缩放，再计算五维和OVR；前3关+3%，第4—10关从3%平滑升至6%，第11—20关+6%，第21—50关从6%升至9%，第51—80关从9%升至12%，第81关起固定+12%。整数取整与单调修正会令实际OVR比例略有差异；不根据玩家阵容动态调难。

## 结果（旧版 → 更新未微调 → 本次微调）

|档位|主线通关率|已通过关卡中位数|平均已通过关卡|样本最高已通过|第一关OVR中位数|
|---|---:|---:|---:|---:|---:|
${groups.map(statRow).join('\n')}

${conclusions}

${goalCheck.every(g=>g.meanBetween&&g.medianBetween)?'三档平均值与中位数均位于旧版和未微调新版之间，达到“新版仍更容易，同时缩小难度差距”的本轮目标。':'三档尚未全部达到平均值及中位数位于两版之间的目标，需继续核对。'}按平均通过关卡的增量计算，低、中、高阶分别保留原更新收益的${goalCheck.map(g=>g.retainedGainPercent+'%').join('、')}。

## 同关玩家OVR与到达人数

|档位|关卡|旧版OVR（到达）|未微调OVR（到达）|微调OVR（到达）|
|---|---:|---:|---:|---:|
${curveRows}

## 对手数值

|关卡|旧版／未微调OVR|微调OVR|
|---|---:|---:|
${sameStages.map(s=>'|'+s+'|'+foes[0].values[s-1]+'|'+foes[2].values[s-1]+'|').join('\n')}

## 验证与解读

本次300局运行至死亡，错误0、截断0；每档首局浏览器全局核心与本地云函数回放一致。高阶满局外成长、全解锁，积极观看收益广告；低、中阶无广告，全部从空阵容正常获取球员与装备。旧、新版采用相同高阶广告策略；不能直接与更早的无广告30局高阶数据比较。

批量任务曾因与完整测试同时运行而耗尽本机内存，中断后复用配置与源码校验通过的完整记录续跑；未完成任务不计入300局，不当作玩家死亡。正式样本的执行错误与截断统计以完整记录为准。

提高对手会改变胜负、收入、事件、恢复与后续成长，因此采用完整重新游玩，未把旧轨迹简单乘系数当作新结果。玩家OVR只统计首次开战，死亡后不补点。后期存在幸存者偏差，样本最高不等于理论极限；高阶固定偏好领袖回归，并未穷举所有天赋的最优玩法。

[三版本曲线](index.html) · [本次独立曲线](新版/index.html) · [上轮600局对比](../2026-10-11-词条天赋更新/index.html) · [最早30局页面](../2026-10-11/index.html) · [逐局对比](同种子逐局对比.csv) · [完整统计](三版本对比.json)
`);
const table=groups.map(g=>'<tr><td>'+g.label+'</td>'+['clears','p50','max'].map(k=>'<td>'+g.observations.map(o=>o[k]+(k==='clears'?'%':'')).join(' → ')+'</td>').join('')+'</tr>').join('');
fs.writeFileSync(root+'/index.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>关卡微调·三版本对比</title><style>body{margin:0;padding:24px;background:#101310;color:#ecebdf;font:15px/1.6 system-ui}main{max-width:1200px;margin:auto}h1,h2,a{color:#f4ca67}article{padding:18px;border:1px solid #495342;border-radius:12px;margin:20px 0}svg{width:100%}text{fill:#c5c9be;font-size:12px}table{border-collapse:collapse;width:100%}td,th{padding:10px;border-bottom:1px solid #394132;text-align:left}select{padding:8px;background:#242b20;color:white}.tip{min-height:32px}</style><main><h1>关卡微调 · 三版本各300局</h1><p>旧版 → 更新未微调 → 本次微调。相同种子与广告条件，满局外成长不赠送开局阵容。</p><p><a href="关卡微调报告.md">详细报告</a> · <a href="新版/index.html">本次独立曲线</a> · <a href="../2026-10-11-词条天赋更新/index.html">保留的上轮曲线</a> · <a href="../2026-10-11/index.html">保留的最早30局曲线</a></p><table><tr><th>档位</th><th>主线通关率</th><th>通过关卡中位数</th><th>样本最高通过关卡</th></tr>${table}</table><p>蓝：旧版玩家；紫：未微调玩家；绿：本次玩家；红色虚线：旧对手；红色实线：本次对手。金色节点标记各版本最高已通过关卡。</p><label>范围 <select id="range"><option value="10">1—10</option><option value="50">1—50</option><option value="100">1—100</option><option value="1000" selected>1—1000</option></select></label> <label>纵轴 <select id="scale"><option value="linear">线性</option><option value="log">对数</option></select></label><div id="charts"></div><p>每局每关只采首次开战数据，死亡后不补点；后期中位数存在幸存者偏差。测试错误0、截断0，样本最高不是理论上限。</p></main><script>
const D=${JSON.stringify(data)};
function el(tag,attrs,parent){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n}
function draw(){const root=document.getElementById('charts');root.replaceChildren();const limit=+document.getElementById('range').value,log=document.getElementById('scale').value==='log';for(const g of D.groups){const a=document.createElement('article');root.append(a);const h=document.createElement('h2');h.textContent=g.label;a.append(h);const max=Math.max(...D.foes[2].values.slice(0,limit),...g.observations.flatMap(o=>o.points.filter(p=>p.stage<=limit).map(p=>p.player)))*1.1,top=log?Math.log10(max):max,x=s=>75+(s-1)/(limit-1)*990,y=v=>310-(log?Math.log10(Math.max(1,v)):v)/top*290,svg=el('svg',{viewBox:'0 0 1100 365',role:'img','aria-label':g.label+'三版本曲线'},a);for(let i=0;i<=5;i++){const yy=310-i*58;el('line',{x1:75,y1:yy,x2:1065,y2:yy,stroke:'#35402f'},svg);el('text',{x:65,y:yy+4,'text-anchor':'end'},svg).textContent=Math.round(log?10**(top*i/5):max*i/5);el('text',{x:75+i*198,y:334,'text-anchor':'middle'},svg).textContent=Math.round(1+(limit-1)*i/5)}for(const o of g.observations){const v=D.versions.find(v=>v.id===o.id),p=o.points.filter(p=>p.stage<=limit);el('path',{d:p.map((p,i)=>(i?'L':'M')+x(p.stage).toFixed(2)+','+y(p.player).toFixed(2)).join(' '),stroke:v.color,'stroke-width':2.5,fill:'none','data-version':v.id},svg);const peak=p.find(p=>p.stage===o.max);if(peak){el('circle',{cx:x(peak.stage),cy:y(peak.player),r:6,fill:'#f4ca67',stroke:v.color,'stroke-width':2,'data-highest-cleared':o.max},svg)}}for(const id of ['old','adjusted'])el('path',{d:D.foes.find(f=>f.id===id).values.slice(0,limit).map((v,i)=>(i?'L':'M')+x(i+1).toFixed(2)+','+y(v).toFixed(2)).join(' '),stroke:id==='old'?'#c7786e':'#ff897c','stroke-width':2,'stroke-dasharray':id==='old'?'6 4':'none',fill:'none'},svg);const tip=document.createElement('div');tip.className='tip';tip.textContent='移动或点击查看各版本OVR与到达人数';a.append(tip);function hover(e){const b=svg.getBoundingClientRect(),s=Math.max(1,Math.min(limit,Math.round(1+((e.clientX-b.left)/b.width*1100-75)/990*(limit-1))));tip.textContent='第'+s+'关 · 对手 '+D.foes[0].values[s-1]+' → '+D.foes[2].values[s-1]+' · '+g.observations.map(o=>{const p=o.points.find(p=>p.stage===s);return o.label+' '+(p?.player??'无实测数据')+'（到达 '+(p?.n||0)+'/100；范围 '+(p?.playerMin??'—')+'—'+(p?.playerMax??'—')+'）'}).join(' · ')}svg.addEventListener('pointermove',hover);svg.addEventListener('pointerdown',hover)}}document.getElementById('range').addEventListener('change',draw);document.getElementById('scale').addEventListener('change',draw);draw();
</script></html>`);
console.log(JSON.stringify(groups.map(g=>({id:g.id,observations:g.observations.map(({points,validation,...s})=>s)})),null,2));
