'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {median}=require('../balance/natural-reference.cjs');
const C=require('../h5/game-core.js');
const {initialize,normalize}=require('../balance/engine.cjs');
const snapshot=process.env.BALANCE_NATURAL_SNAPSHOT||'docs/balance/2026-10-11/natural-baseline.json';
const data=JSON.parse(fs.readFileSync(snapshot,'utf8'));
test('natural curves exactly aggregate real first-battle trajectories without post-death extrapolation',()=>{
  assert.equal(data.kind,'natural');assert.equal(data.groups.length,3);
  for(const g of data.groups){
    assert.equal(g.n,g.seeds?.length||data.seeds?.length||30);assert.equal(g.runs.length,g.n);assert.equal(g.summary.errors,0);
    assert.equal(g.validation.browserGlobal.match,true);assert.equal(g.validation.cloud.match,true);
    for(const r of g.runs){assert.equal(new Set(r.trajectory.map(p=>p.stage)).size,r.trajectory.length);assert.ok(r.trajectory.every(p=>p.stage<=r.highestAttempted));assert.ok(r.trajectory.every(p=>p.player>0&&Number.isFinite(p.player)));}
    for(const p of g.points){
      const reached=g.runs.flatMap(r=>r.trajectory.filter(x=>x.stage===p.stage));assert.equal(p.n,reached.length);assert.equal(p.player,median(reached.map(x=>x.player)));assert.equal(p.enemy,C.opponent({stage:p.stage,balanceRulesVersion:data.rulesVersion??6}).rating);assert.equal(p.reachRate,p.n/g.n);if(p.stage>1)assert.ok(p.n<=g.points[p.stage-2].n);
    }
    assert.equal(g.points.at(-1).stage,Math.max(...g.runs.map(r=>r.highestAttempted)));
  }
});
test('every natural seed starts empty with only the actual core opening resources',()=>{
  for(const group of data.groups)for(const run of group.runs){
    const config=normalize({policy:group.policy,growthLevel:group.growthLevel,seed:run.seed,rulesVersion:data.rulesVersion??6,ads:group.ads||'none'}),{game}=initialize(C,config),p=game.profile;
    if(run.talent)assert.equal(game.run.talent,run.talent);
    const expected=C.createRun(game.run.talent,run.seed,{...p.upgrades,jerseyUnlocks:p.jerseyUnlocks,gearUnlocks:p.gearUnlocks,playerUnlocks:p.playerUnlocks},data.rulesVersion??6);
    assert.deepEqual(game.run,expected);assert.equal(Object.keys(game.run.owned).length,0);assert.equal(game.run.stage,1);assert.equal(game.run.gearReserve.length,0);assert.equal(game.run.boosts.length,0);assert.deepEqual(game.run.eventState.bonuses,{});
  }
});
test('natural charts render two lines, surviving counts, and stop at actual observed stages',()=>{
  class Element{constructor(){this.children=[];this.attributes={};this.listeners={};}append(x){this.children.push(x);}setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,v){this.listeners[k]=v;}replaceChildren(){this.children=[];}getBoundingClientRect(){return {left:0,width:1100};}}
  const elements=Object.fromEntries(['range','scale','charts','config'].map(id=>[id,new Element()]));elements.range.value='100';elements.scale.value='linear';
  const document={getElementById:id=>elements[id],createElement:()=>new Element(),createElementNS:()=>new Element()};
  const html=fs.readFileSync(require('node:path').join(require('node:path').dirname(snapshot),'index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.ok(!html.includes('强化＋事件压力上界'));const context=vm.createContext({document});vm.runInContext(script,context);
  for(const range of [10,50,100,1000])for(const scale of ['linear','log']){
    elements.range.value=String(range);elements.scale.value=scale;vm.runInContext('draw()',context);assert.equal(elements.charts.children.length,3);
    for(const [index,article] of elements.charts.children.entries()){
      const svg=article.children.find(x=>x.attributes.viewBox),paths=svg.children.filter(x=>x.attributes.d),group=data.groups[index];
      assert.equal(paths.length,2);assert.ok(paths.every(x=>!/(NaN|Infinity)/.test(x.attributes.d)));
      assert.equal(paths[0].attributes.d.split(' ').length,group.points.filter(p=>p.stage<=range).length);
      assert.equal(paths[1].attributes.d.split(' ').length,range);
      assert.ok(paths[1].attributes.d.endsWith('1065.00,'+paths[1].attributes.d.split(',').at(-1)));
      const marker=svg.children.find(x=>x.attributes['data-highest-cleared']);
      assert.equal(Boolean(marker),group.summary.max<=range);
      if(marker)assert.equal(marker.attributes['data-highest-cleared'],group.summary.max);
      svg.listeners.pointermove({clientX:1000});assert.ok(article.children.find(x=>x.className==='tip').textContent.includes('到达'));
      if(range===1000)assert.ok(article.children.find(x=>x.className==='tip').textContent.includes('无玩家实测数据'));
    }
  }
});
