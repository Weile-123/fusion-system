'use strict';
// Reuse measured rule13 players; rule14 only supplies a new opponent curve.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('../h5/game-core.js');
const root='docs/balance/2026-10-12-无尽60关节点';
const reference='docs/balance/2026-10-12-无尽难度微调/新版/正常游玩.json';
const measured=JSON.parse(fs.readFileSync(reference,'utf8'));
const round=x=>Math.round(x*100)/100;
const foes=[13,14].map((rule,i)=>({id:i?'new':'old',rule,values:Array.from({length:1000},(_,j)=>C.opponent({stage:j+1,balanceRulesVersion:rule}).rating)}));
const groups=measured.groups.map(g=>({id:g.id,label:{low:'低阶',mid:'中阶',high:'高阶'}[g.id],observations:[{
  id:'measured',label:'规则13既有实测',n:g.n,...g.summary,mainlineCleared:g.summary.clears,
  clears:round(g.summary.clears/g.n*100),meanCleared:round(g.runs.reduce((sum,r)=>sum+r.highestCleared,0)/g.n),
  maxAttempted:Math.max(...g.runs.map(r=>r.highestAttempted)),points:g.points
}]}));
const sourceHashes=require('./engine.cjs').manifest();
const data={kind:'opponent-curve-only',date:'2026-10-12',rulesVersion:14,testedRulesVersion:13,newSimulationRuns:0,
  turningStage:{before:50,after:60},reference,referenceHash:crypto.createHash('sha256').update(fs.readFileSync(reference)).digest('hex'),
  sourceHashes,referenceSourceHashes:measured.sourceHashes,seeds:measured.seeds,
  versions:[{id:'measured',label:'规则13既有实测',rule:13,color:'#5fe49c'}],groups,foes};
fs.mkdirSync(root,{recursive:true});
fs.writeFileSync(root+'/曲线对比.json',JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(root+'/对手曲线.csv','\uFEFF关卡,规则13对手OVR,规则14对手OVR\n'+foes[0].values.map((v,i)=>[i+1,v,foes[1].values[i]].join(',')).join('\n')+'\n');
const stages=[10,20,30,40,49,50,51,59,60,61,70,80,100,200,456];
const stats=groups.map(g=>{const o=g.observations[0];return '|'+[g.label,o.n,o.clears+'%',o.p50,o.meanCleared,o.max].join('|')+'|'}).join('\n');
fs.writeFileSync(root+'/节点调整说明.md',`# 无尽增长节点调整\n\n前端新局规则14：将基础对手曲线的指数增长段终点从第50关移至第60关，终点基础目标仍为500；第20关目标126与后续增长公式保持一致，指数段长度从30关延长到40关。第60关后以距60关的关数继续增长。第1—20关不变，主线不变；沿用规则13的无尽减免与原分段倍率。规则1—13旧对局保留原曲线，后端仍为规则11未部署。\n\n用户明确要求本次不重新测试。绿线引用刚完成的规则13玩家实测（低、中各100局，高阶90局）；红色虚线为规则13对手，红色实线为规则14对手。玩家OVR、到达人数、范围和止步统计均来自规则13，未改写原始轨迹，不能当作规则14实测结果，也不能据此推断新版通关率或止步上限。\n\n## 沿用的规则13统计\n\n|档位|样本数|主线通关率|已通过中位数|平均已通过|样本最高已通过|\n|---|---:|---:|---:|---:|---:|\n${stats}\n\n## 对手曲线变化\n\n|关卡|规则13 OVR|规则14 OVR|\n|---|---:|---:|\n${stages.map(s=>'|'+s+'|'+foes[0].values[s-1]+'|'+foes[1].values[s-1]+'|').join('\n')}\n\n原第50关转折是指数增长转入较慢增长的连接处，并非对手OVR下降。此次延后该连接点，拉长指数段，同阶段对手更低；其余属性取整、逐关OVR递增保护仍按正式核心执行。页面范围可切换至1000关，无人到达处只画对手曲线，不外推玩家。\n\n本次仅重新计算对手曲线与生成静态文件，没有新增模拟局数，也没有运行测试套件。此前规则13的290局验证结果仍属于规则13，不用于声明规则14已验收。历史页面、JSON、源码快照保持原样。\n\n[静态对比页面](index.html) · [刚才的完整测试](../2026-10-12-无尽难度微调/index.html) · [刚才的原始统计](../2026-10-12-无尽难度微调/新版/正常游玩.json) · [对手CSV](对手曲线.csv)\n`);
const table='<div class="scroll"><table><tr><th>档位</th><th>规则13样本数</th><th>主线通关率</th><th>通过中位数</th><th>平均已通过</th><th>样本最高已通过</th></tr>'+groups.map(g=>{const o=g.observations[0];return '<tr>'+[g.label,o.n,o.clears+'%',o.p50,o.meanCleared,o.max].map(x=>'<td>'+x+'</td>').join('')+'</tr>'}).join('')+'</table></div>';
let html=require('./curve-comparison-page.cjs').page({...data,groups:groups.map(g=>({...g,paired:{better:0,same:0,worse:0}}))});
html=html.replace(/<title>.*?<\/title>/,'<title>无尽60关节点·曲线对比</title>');
const header='<main><h1>无尽增长节点：50关 → 60关</h1><p>新局规则14：指数增长段终点移至60关，终点基础目标仍为500；主线及前20关保持不变。</p><p><a href="节点调整说明.md">调整说明</a> · <a href="../2026-10-12-无尽难度微调/index.html">刚才的实测对比页面</a> · <a href="../2026-10-12-无尽难度微调/新版/index.html">规则13独立实测曲线</a> · <a href="对手曲线.csv">对手CSV</a></p><div class="notice">本次未重新测试。绿线、到达人数与下表均为规则13既有实测；仅红色实线使用规则14新对手数值。不能将旧玩家轨迹当作规则14的通关结果。后端仍为规则11未部署。</div>'+table+'<p>绿线：规则13实测玩家；红色虚线：规则13对手（50关转折）；红色实线：规则14对手（60关转折）。金色节点仅标记规则13样本最高已通过关卡。</p>';
html=html.replace(/<main>[\s\S]*?(?=<label>范围)/,header).replace('<option value="100">','<option value="100" selected>').replace('<option value="200" selected>','<option value="200">');
html=html.replace("const tip=document.createElement('div');",`if(limit>=60){for(const [stage,color,label]of [[50,'#889283','旧转折：50'],[60,'#f4ca67','新转折：60']]){el('line',{x1:x(stage),x2:x(stage),y1:20,y2:310,stroke:color,'stroke-dasharray':'3 5',opacity:.65},svg);el('text',{x:x(stage)+4,y:stage===50?36:54,fill:color},svg).textContent=label}}const tip=document.createElement('div');`);
fs.writeFileSync(root+'/index.html',html);
for(const file of [...Object.keys(sourceHashes),'balance/compare-endless-node.cjs','balance/curve-comparison-page.cjs']){
  const out=path.join(root,'源码快照',file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(file,out);
}
console.log(JSON.stringify({rulesVersion:14,testedRulesVersion:13,newSimulationRuns:0,referenceSamples:groups.map(g=>({tier:g.id,n:g.observations[0].n})),page:root+'/index.html'}));
