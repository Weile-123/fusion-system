'use strict';
const fs=require('node:fs'),path=require('node:path');
const C=require('../h5/game-core.js');
const destination=path.resolve('docs/无尽关卡OVR曲线-2026-10-14.html');
const baselineRulesVersion=21,candidateOnly=C.BALANCE_RULES_VERSION<22;
const rows=[];let prior=C.opponent({stage:10,balanceRulesVersion:baselineRulesVersion}).rating;
for(let stage=11;stage<=1000;stage++){
  const o=C.opponent({stage,balanceRulesVersion:baselineRulesVersion});
  if(!Number.isSafeInteger(o.rating)||o.rating<=prior)throw Error('Invalid curve at '+stage);
  rows.push({stage,ovr:o.rating,increase:o.rating-prior,growth:(o.rating/prior-1)*100});prior=o.rating;
}
const fmt=n=>n.toLocaleString('en-US'),point=s=>rows.find(x=>x.stage===s);
// 展示候选：每十关锚点取原实际OVR，前九关分摊约30%增长，其余在下一锚点兑现。
const gentleShare=.30;
for(const r of rows){
  if(r.stage<50||r.stage%10===0)r.candidateOVR=r.ovr;
  else {const start=Math.floor(r.stage/10)*10,base=point(start).ovr,next=point(start+10).ovr;
    const gentle=Math.max(9,Math.round((next-base)*gentleShare));
    r.candidateOVR=base+Math.round(gentle*(r.stage-start)/9);
  }
  const previous=r.stage===11?C.opponent({stage:10,balanceRulesVersion:baselineRulesVersion}).rating:point(r.stage-1).candidateOVR;
  r.candidateIncrease=r.candidateOVR-previous;r.candidateGrowth=(r.candidateOVR/previous-1)*100;
  if(r.candidateIncrease<=0||r.candidateOVR>r.ovr)throw Error('Invalid candidate at '+r.stage);
  if(!candidateOnly&&C.opponent({stage:r.stage,balanceRulesVersion:C.BALANCE_RULES_VERSION}).rating!==r.candidateOVR)throw Error('Implemented curve mismatch at '+r.stage);
}
function chart(data,{maxY,xTicks,yTicks,id,title}){
  const W=1160,H=410,L=88,R=32,T=30,B=54,w=W-L-R,h=H-T-B;
  const first=data[0].stage,last=data.at(-1).stage;
  const px=s=>L+(s-first)/(last-first)*w,py=n=>T+h-n/maxY*h;
  const points=data.map(r=>`${px(r.stage).toFixed(2)},${py(r.ovr).toFixed(2)}`).join(' ');
  const candidatePoints=data.map(r=>`${px(r.stage).toFixed(2)},${py(r.candidateOVR).toFixed(2)}`).join(' ');
  const grid=yTicks.map(y=>`<line x1="${L}" y1="${py(y)}" x2="${W-R}" y2="${py(y)}" class="gridline"/><text x="${L-14}" y="${py(y)+5}" text-anchor="end" class="tick">${fmt(y)}</text>`).join('');
  const ticks=xTicks.map(x=>`<text x="${px(x)}" y="${H-24}" text-anchor="middle" class="tick">${x}</text>`).join('');
  const hover=`<g class="hover-layer" hidden><line class="hover-guide" y1="${T}" y2="${T+h}"/><circle class="hover-dot" r="5"/><circle class="hover-candidate-dot" r="5"/><g class="hover-box"><rect width="245" height="106" rx="10"/><text class="hover-stage" x="14" y="23"></text><text class="hover-value" x="14" y="47"></text><text class="hover-candidate-value" x="14" y="70"></text><text class="hover-growth" x="14" y="91"></text></g></g><rect class="hover-surface" x="${L}" y="${T}" width="${w}" height="${h}" fill="transparent" pointer-events="all"/>`;
  const marks=xTicks.filter(s=>point(s)&&s!==11).map(s=>{const r=point(s);return `<circle cx="${px(s)}" cy="${py(r.ovr)}" r="4" class="marker"/>`}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" data-first="${first}" data-last="${last}" data-max-y="${maxY}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${title}</title><desc id="${id}-desc">第${first}至${last}关，原版及阶段式候选对比，纵轴为线性尺度。</desc><defs><linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e5b85e" stop-opacity=".24"/><stop offset="100%" stop-color="#e5b85e" stop-opacity=".015"/></linearGradient></defs>${grid}<polygon points="${L},${T+h} ${points} ${W-R},${T+h}" fill="url(#${id}-fill)"/><polyline points="${points}" class="curve"/><polyline points="${candidatePoints}" class="curve candidate-curve"/>${marks}${ticks}<text x="${L}" y="17" class="axislabel">对手 OVR</text><text x="${W-R}" y="${H-3}" text-anchor="end" class="axislabel">关卡</text>${hover}</svg>`;
}
const anchors=[11,20,30,40,50,60,75,100,150,200,300,400,500,600,700,800,900,1000];
const main=chart(rows,{maxY:200000,xTicks:[11,100,200,300,400,500,600,700,800,900,1000],yTicks:[0,50000,100000,150000,200000],id:'all',title:'无尽11—1000关对手OVR完整曲线'});
const early=chart(rows.filter(x=>x.stage<=100),{maxY:900,xTicks:[11,20,30,40,50,60,70,80,90,100],yTicks:[0,150,300,450,600,750,900],id:'early',title:'无尽11—100关对手OVR放大曲线'});
const csv='关卡,原版OVR,阶段式候选OVR,原版每关增加,候选每关增加,候选每关增长率百分比\n'+rows.map(r=>`${r.stage},${r.ovr},${r.candidateOVR},${r.increase},${r.candidateIncrease},${r.candidateGrowth.toFixed(6)}`).join('\n');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>无尽关卡 OVR 曲线 · 规则${C.BALANCE_RULES_VERSION}</title><style>
:root{color-scheme:dark;--bg:#121311;--panel:#1c1e1b;--line:#34382f;--gold:#e5b85e;--text:#f3efdf;--muted:#a5ac9b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}main{max-width:1320px;margin:auto;padding:48px 36px 32px}.eyebrow{color:var(--gold);font-size:12px;letter-spacing:3px;font-weight:700}header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:28px}h1{font-size:clamp(26px,4vw,40px);line-height:1.3;margin:8px 0 10px;letter-spacing:-1px}h2{font-size:20px;margin:0}p{margin:7px 0;color:var(--muted)}.meta{font-size:12px;padding:7px 12px;border:1px solid var(--line);border-radius:30px;white-space:nowrap}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}.stat,.panel{background:var(--panel);border:1px solid var(--line);border-radius:16px}.stat{padding:20px}.stat span{font-size:12px;color:var(--muted)}.stat strong{display:block;font-size:30px;line-height:1.3;margin-top:8px;font-variant-numeric:tabular-nums}.stat small{color:var(--gold);font-size:12px}.panel{padding:24px;margin-bottom:20px}.panel-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:12px}.legend{font-size:12px;color:var(--muted);white-space:nowrap}.legend:before{content:"";display:inline-block;width:24px;height:3px;background:var(--gold);vertical-align:middle;margin-right:8px}svg{display:block;width:100%;height:auto;overflow:visible}.gridline{stroke:#34382f;stroke-width:1}.tick{fill:#a5ac9b;font-size:13px;font-variant-numeric:tabular-nums}.axislabel{fill:#a5ac9b;font-size:12px}.curve{fill:none;stroke:var(--gold);stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round}.marker{fill:var(--panel);stroke:var(--gold);stroke-width:2}.hit{fill:transparent;cursor:crosshair}.hit:hover{fill:var(--gold);stroke:#fff;stroke-width:1}.note{border-top:1px solid var(--line);padding-top:12px;font-size:13px}.two{display:grid;grid-template-columns:1.3fr 1fr;gap:20px}.two .panel{margin-bottom:0}.table-wrap{overflow:auto;max-height:420px}table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:9px 12px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--muted);font-weight:500;background:var(--panel);position:sticky;top:0}th:first-child,td:first-child{text-align:left}td:nth-child(2){color:var(--gold);font-weight:650}details{margin-top:20px}summary{cursor:pointer;font-weight:600;padding-bottom:10px}.button{display:inline-block;text-decoration:none;color:#181910;background:var(--gold);padding:8px 14px;border-radius:9px;font-size:12px;font-weight:700}footer{margin-top:24px;color:var(--muted);font-size:12px}code{color:#d7cbae}.high{color:var(--text)}@media(max-width:700px){main{padding:25px 16px}header{display:block}.meta{display:inline-block;margin-top:8px}.stats{grid-template-columns:repeat(2,1fr)}.stat{padding:14px}.stat strong{font-size:24px}.panel{padding:16px}.two{grid-template-columns:1fr}.panel-head{align-items:flex-start}svg{min-width:650px}.plot{overflow-x:auto}.legend{font-size:11px}.tick{font-size:13px}}@media print{body{background:white;color:#222;--panel:#fff;--line:#ddd;--text:#222;--muted:#555;--gold:#9b6c11}.panel,.stat{break-inside:avoid}.button{display:none}.table-wrap{max-height:none}.hit{display:none}}
.hover-layer{pointer-events:none}.hover-layer[hidden]{display:none}.hover-guide{stroke:#e5b85e80;stroke-width:1;stroke-dasharray:4 5}.hover-dot{fill:var(--gold);stroke:var(--text);stroke-width:2}.hover-box rect{fill:var(--bg);stroke:var(--gold);stroke-width:1}.hover-stage{fill:var(--muted);font-size:13px}.hover-value{fill:var(--text);font-size:19px;font-weight:700}.hover-growth{fill:var(--muted);font-size:12px}.hover-surface{cursor:crosshair}@media print{.hover-layer,.hover-surface{display:none}}
</style></head><body><main><header><div><div class="eyebrow">ENDLESS · OPPONENT POWER</div><h1>无尽关卡 OVR 曲线</h1><p>第11—1000关 · 当前本地规则${C.BALANCE_RULES_VERSION} · 990个逐关实际计算值</p></div><span class="meta">数据快照 / 2026.10.14</span></header>
<section class="stats" aria-label="关键关卡"><div class="stat"><span>无尽起点 · 第11关</span><strong>${fmt(point(11).ovr)}</strong><small>前20关沿用基础曲线与现行减免</small></div><div class="stat"><span>指数段转折 · 第60关</span><strong>${fmt(point(60).ovr)}</strong><small>实际面板含规则修正与取整</small></div><div class="stat"><span>中后期 · 第500关</span><strong>${fmt(point(500).ovr)}</strong><small>相较第100关 ${(point(500).ovr/point(100).ovr).toFixed(2)} 倍</small></div><div class="stat"><span>展示终点 · 第1000关</span><strong>${fmt(point(1000).ovr)}</strong><small>相较第500关 ${(point(1000).ovr/point(500).ovr).toFixed(2)} 倍</small></div></section>
<section class="panel"><div class="panel-head"><div><h2>完整曲线</h2><p>线性纵轴 · 同一尺度观察后期增长</p></div><span class="legend">对手实际OVR</span></div><div class="plot">${main}</div><p class="note">悬停曲线可查看逐关数值。前期曲线在完整尺度下接近底部，请结合下方放大图阅读。</p></section>
<section class="panel"><div class="panel-head"><div><h2>前段放大 · 第11—100关</h2><p>看清进入无尽、指数连接与第60关后的变化</p></div><span class="legend">线性纵轴 0—900</span></div><div class="plot">${early}</div></section>
<div class="two"><section class="panel"><h2>关键关卡</h2><div class="table-wrap"><table><thead><tr><th>关卡</th><th>对手OVR</th><th>较上一关增加</th><th>增长率</th></tr></thead><tbody>${anchors.map(s=>{const r=point(s);return `<tr><td>第${s}关</td><td>${fmt(r.ovr)}</td><td>+${fmt(r.increase)}</td><td>${r.growth.toFixed(2)}%</td></tr>`}).join('')}</tbody></table></div></section><section class="panel"><h2>数据口径</h2><p><span class="high">调用当前真实游戏核心</span>：<code>opponent({stage, balanceRulesVersion: ${C.BALANCE_RULES_VERSION}}).rating</code>。</p><p>当前规则沿用规则14的关卡曲线。指数连接以第20关为起点，第60关为转折；此后基础目标采用指数增长。</p><p>曲线包括原对手属性比例、难度修正、无尽减免、取整及逐关递增保护，所以展示值不等于基础目标公式。</p><p>这是对手未加入战术的面板OVR，不是玩家成长曲线或战斗胜率；没有假设玩家阵容、装备或奖金。</p><p>所有数据与SVG内嵌，可离线打开；没有外部依赖。</p><a class="button" download="无尽关卡OVR-规则${C.BALANCE_RULES_VERSION}.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFF'+csv)}">下载990关CSV</a></section></div>
<details class="panel"><summary>展开全部逐关数据 · 11—1000关</summary><div class="table-wrap"><table><thead><tr><th>关卡</th><th>对手OVR</th><th>较上一关增加</th><th>增长率</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.stage}</td><td>${fmt(r.ovr)}</td><td>+${fmt(r.increase)}</td><td>${r.growth.toFixed(2)}%</td></tr>`).join('')}</tbody></table></div></details>
<footer>数据生成：scripts/export-endless-ovr-page.cjs · 本地规则${C.BALANCE_RULES_VERSION} · 本页面不读取云端、不改游戏配置</footer></main>
<script type="application/json" id="curve-data">${JSON.stringify(rows)}</script>
<script>
(()=>{
  const values=JSON.parse(document.getElementById('curve-data').textContent),byStage=new Map(values.map(r=>[r.stage,r]));
  for(const svg of document.querySelectorAll('svg[data-first]')){
    const first=Number(svg.dataset.first),last=Number(svg.dataset.last),maxY=Number(svg.dataset.maxY);
    const layer=svg.querySelector('.hover-layer'),surface=svg.querySelector('.hover-surface'),guide=layer.querySelector('line'),dot=layer.querySelector('.hover-dot'),candidateDot=layer.querySelector('.hover-candidate-dot'),box=layer.querySelector('.hover-box');
    function show(event){
      const transform=svg.getScreenCTM();if(!transform)return;
      const pointer=svg.createSVGPoint();pointer.x=event.clientX;pointer.y=event.clientY;
      const p=pointer.matrixTransform(transform.inverse());
      const stage=Math.max(first,Math.min(last,Math.round(first+(p.x-88)/1040*(last-first)))),r=byStage.get(stage);
      const x=88+(stage-first)/(last-first)*1040,y=356-r.ovr/maxY*326;
      guide.setAttribute('x1',x);guide.setAttribute('x2',x);dot.setAttribute('cx',x);dot.setAttribute('cy',y);
      candidateDot.setAttribute('cx',x);candidateDot.setAttribute('cy',356-r.candidateOVR/maxY*326);
      const boxX=x+16+245<=1128?x+16:x-261,boxY=Math.max(30,Math.min(250,y-118>=30?y-118:y+16));
      box.setAttribute('transform','translate('+boxX+' '+boxY+')');
      layer.querySelector('.hover-stage').textContent='第 '+stage+' 关';
      layer.querySelector('.hover-value').textContent='原版 OVR '+r.ovr.toLocaleString('en-US');
      layer.querySelector('.hover-candidate-value').textContent='候选 OVR '+r.candidateOVR.toLocaleString('en-US');
      layer.querySelector('.hover-growth').textContent='候选比上一关 +'+r.candidateIncrease+'（'+r.candidateGrowth.toFixed(2)+'%）';
      layer.removeAttribute('hidden');
    }
    surface.addEventListener('pointermove',show);surface.addEventListener('pointerdown',show);
    surface.addEventListener('pointerleave',()=>layer.setAttribute('hidden',''));
  }
})();
</script></body></html>`;
const legend='<div class="compare-legend"><span class="legend">原版曲线</span><span class="legend candidate-legend">阶段式候选</span></div>';
const comparisonTable=list=>'<table><thead><tr><th>关卡</th><th>原版OVR</th><th>候选OVR</th><th>候选每关增加</th><th>候选增长率</th></tr></thead><tbody>'+list.map(r=>`<tr${r.stage>=50&&r.stage%10===0?' class="anchor-row"':''}><td>${r.stage}${r.stage>=50&&r.stage%10===0?' · 梯度锚点':''}</td><td>${fmt(r.ovr)}</td><td>${fmt(r.candidateOVR)}</td><td>+${fmt(r.candidateIncrease)}</td><td>${r.candidateGrowth.toFixed(2)}%</td></tr>`).join('')+'</tbody></table>';
let tableIndex=0;
const example='<section class="panel"><h2>50—60关 · 阶段式增长示例</h2><p>50关保持368，51—59关缓慢增至414，60关保持原值522：59→60关增加108。候选只改变阶段内分配，不改变整十关锚点。</p><div class="table-wrap">'+comparisonTable(rows.filter(r=>r.stage>=50&&r.stage<=60))+'</div></section>';
let page=html.replace(/<table>[\s\S]*?<\/table>/g,()=>comparisonTable(tableIndex++===0?anchors.map(point):rows));
page=page.replace('<h1>无尽关卡 OVR 曲线</h1>','<h1>无尽关卡 OVR · 新旧曲线对比</h1>')
  .replace('990个逐关实际计算值','990个原版实际值＋阶段式候选值')
  .replace('数据快照 / 2026.10.14','展示实验 · 游戏数值未改')
  .replaceAll('<span class="legend">对手实际OVR</span>',legend).replace('<span class="legend">线性纵轴 0—900</span>',legend)
  .replace('<div class="two">',example+'<div class="two">')
  .replace('这是对手未加入战术的面板OVR','候选从50关开始：每段原版总增长的30%分摊到中间九关，剩余约70%在下一个整十关兑现。取整后确保每关至少+1，因此极低增长段的缓增占比可能略高于30%。50以前及50、60、70……1000关完全不变。<br>这是对手未加入战术的面板OVR')
  .replace('本页面不读取云端、不改游戏配置','仅候选展示，不改游戏或云函数数值')
  .replace('</style>','.candidate-curve{stroke:#69d9b0;stroke-width:2.4}.compare-legend{display:flex;gap:18px;flex-wrap:wrap}.candidate-legend:before{background:#69d9b0}.hover-candidate-dot{fill:#69d9b0;stroke:var(--text);stroke-width:2}.hover-candidate-value{fill:#69d9b0;font-size:17px;font-weight:700}.hover-value{fill:var(--gold);font-size:17px}.anchor-row{background:#69d9b00a}td:nth-child(3){color:#69d9b0;font-weight:650}</style>');
if(!candidateOnly)page=page.replaceAll('候选','新版').replace('展示实验 · 游戏数值未改','本地已实装 · 暂未部署').replace('仅新版展示，不改游戏或云函数数值','新版曲线已实装本地规则22，暂未部署或上传');
fs.writeFileSync(destination,page);fs.writeFileSync(destination.replace('.html','.json'),JSON.stringify({rulesVersion:C.BALANCE_RULES_VERSION,baselineRulesVersion,source:'h5/game-core.js / opponent',date:'2026-10-14',candidateOnly,gentleShare,rows},null,2)+'\n');
console.log(JSON.stringify({page:destination,count:rows.length,checkpoints:anchors.map(s=>point(s))}));
