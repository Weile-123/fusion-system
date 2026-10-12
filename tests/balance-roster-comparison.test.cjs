'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const root='docs/balance/2026-10-12-球员羁绊更新',data=JSON.parse(fs.readFileSync(root+'/版本对比.json','utf8'));
test('300 new runs use the existing historical baseline with explicit comparison limitations',()=>{
  const versions=['docs/balance/2026-10-11-关卡微调/新版/正常游玩.json',root+'/新版/正常游玩.json'].map(n=>JSON.parse(fs.readFileSync(n,'utf8')));
  assert.deepEqual(versions[0].seeds,versions[1].seeds);assert.equal(versions[0].seeds.length,100);
  assert.equal(data.comparisonScope,'historical-reference');assert.notDeepEqual(versions[0].sourceHashes,versions[1].sourceHashes);
  for(const key of ['maxStage','maxActions','maxBattles','maxActionsPerBattle'])assert.equal(versions[0].limits[key],versions[1].limits[key]);
  for(const [i,v]of versions.entries())for(const g of v.groups){assert.equal(g.n,100);assert.equal(g.summary.errors,0);assert.equal(g.summary.censored,0);assert.ok(g.runs.every(r=>r.status==='death'));assert.equal(g.validation.browserGlobal.match,true);assert.equal(g.validation.cloud.match,true);if(i===1)assert.equal(g.validation.cloud.pendingDeployment,true)}
  for(const g of data.groups){assert.equal(g.pairs.length,100);assert.equal(g.paired.better+g.paired.same+g.paired.worse,100);assert.ok(g.pairs.every(p=>p.delta===p.new-p.old))}
});
test('historical references and tested source snapshots remain intact',()=>{
  const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for(const [file,hash]of Object.entries(JSON.parse(fs.readFileSync(root+'/历史文件校验.json','utf8'))))assert.equal(digest(file),hash,file);
  for(const [file,hash]of Object.entries(data.sourceHashes))assert.equal(digest(root+'/源码快照/'+file),hash,file);
});
test('comparison chart supports all ranges/scales and never extends a player line beyond observations',()=>{
  class Element{constructor(){this.children=[];this.attributes={};this.listeners={}}append(x){this.children.push(x)}setAttribute(k,v){this.attributes[k]=v}addEventListener(k,v){this.listeners[k]=v}replaceChildren(){this.children=[]}getBoundingClientRect(){return {left:0,width:1100}}}
  const elements=Object.fromEntries(['range','scale','charts'].map(id=>[id,new Element()]));elements.range.value='100';elements.scale.value='linear';
  const document={getElementById:id=>elements[id],createElement:()=>new Element(),createElementNS:()=>new Element()};
  const html=fs.readFileSync(root+'/index.html','utf8'),context=vm.createContext({document});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  for(const range of [10,50,100,200,1000])for(const scale of ['linear','log']){
    elements.range.value=String(range);elements.scale.value=scale;vm.runInContext('draw()',context);assert.equal(elements.charts.children.length,3);
    for(const [i,a]of elements.charts.children.entries()){
      const svg=a.children.find(x=>x.attributes.viewBox),paths=svg.children.filter(x=>x.attributes.d);assert.equal(paths.length,4);assert.ok(paths.every(x=>!/(NaN|Infinity)/.test(x.attributes.d)));
      for(let j=0;j<2;j++)assert.equal(paths[j].attributes.d.split(' ').length,data.groups[i].observations[j].points.filter(p=>p.stage<=range).length);
      assert.equal(paths[2].attributes.d.split(' ').length,range);svg.listeners.pointermove({clientX:1000});assert.ok(a.children.find(x=>x.className==='tip').textContent.includes('到达'));
      if(range===1000)assert.ok(a.children.find(x=>x.className==='tip').textContent.includes('无玩家实测数据'));
    }
  }
});
