'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {C,assertState,loadBrowserCore}=require('../balance/engine.cjs');
const {setup:buildSetup,trials:buildTrials,eventCeiling}=require('../balance/difficulty-baseline.cjs');
const data=require('../docs/balance/2026-10-11/baseline.json');
const setup=(spec,stage,peak)=>buildSetup({...spec,rulesVersion:data.rulesVersion??6},stage,peak);
const trials=(spec,stage)=>buildTrials({...spec,rulesVersion:data.rulesVersion??6},stage);
const cloud=require('../activity/cloudfunctions/activity_api/game/game-core.js');
test('all 3000 curve points match actual core and obey roster, training, star and gear limits',()=>{
  for(const s of data.series)for(const p of s.points){
    const spec=s.id==='high'?s.candidates[p.candidate]:s.spec,r=setup(spec,p.stage);
    assertState(C,r);assert.equal(C.fused(r).rating,p.player);assert.equal(C.opponent(r).rating,p.enemy);
    assert.equal(new Set(Object.keys(r.owned).map(C.identityOf)).size,Object.keys(r.owned).length);
    for(const [id,own] of Object.entries(r.owned)){assert.ok(own.stars<=C.starLimit(r,id));assert.ok(own.train<=Math.min(p.stage,C.trainingLimit(r,id)));}
    const slots=r.gear.map(id=>C.GEAR.find(x=>x.id===id).slot);assert.equal(new Set(slots).size,slots.length);assert.ok(slots.length<=6);
    assert.ok(Number.isFinite(p.peak)&&p.peak>=p.player);
    if(p.stage>1)assert.ok(p.enemy>s.points[p.stage-2].enemy);
  }
});
test('frontend browser and cloud core agree for all profiles at rule breakpoints',()=>{
  const browser=loadBrowserCore();for(const s of data.series)for(const stage of [1,10,11,20,21,50,51,1000]){
    const p=s.points[stage-1],spec=s.id==='high'?s.candidates[p.candidate]:s.spec,r=setup(spec,stage);
    for(const core of [browser,cloud]){assert.equal(core.fused(r).rating,p.player);assert.equal(core.opponent(r).rating,p.enemy);}
  }
});
test('battle samples repeat exactly and uncertainty is not presented as certain',()=>{
  const s=data.series[0],b=s.battles.find(x=>x.stage===10);assert.deepEqual(trials(s.spec,10),b);
  for(const s of data.series)for(const b of s.battles){assert.equal(b.n,300);assert.ok(b.ci95[0]>=0&&b.ci95[1]<=1);assert.ok(b.ci95[0]<=b.rate&&b.ci95[1]>=b.rate);}
  assert.deepEqual(eventCeiling(1000),data.eventCeiling);
});
test('high envelope includes every talent and reproduces the finite peak bound',()=>{
  const s=data.series.find(x=>x.id==='high');assert.equal(s.candidates.length,C.TALENTS.length*3);
  for(const talent of C.TALENTS)assert.equal(s.candidates.filter(x=>x.talent===talent.id).length,3);
  for(const stage of [1,10,11,50,1000]){
    let highest=0;for(const spec of s.candidates){const r=setup(spec,stage,true);assertState(C,r);highest=Math.max(highest,C.fused(r).rating);}
    assert.equal(highest,s.points[stage-1].peak);
  }
});
test('offline page contains all data and valid JavaScript',()=>{
  const html=fs.readFileSync('docs/balance/2026-10-11/pressure-upper.html','utf8');assert.ok(!/<script[^>]+src=/.test(html));
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
  assert.ok(html.includes('pointermove'));assert.ok(html.includes('95% Wilson'));
  assert.equal(JSON.parse(script.match(/const D=(.*);\nconst ids=/)[1]).series.length,3);
});
test('offline chart renders three two-line charts across every range and scenario',()=>{
  class Element{
    constructor(){this.children=[];this.attributes={};this.listeners={};}
    append(x){this.children.push(x);}setAttribute(k,v){this.attributes[k]=v;}
    addEventListener(k,v){this.listeners[k]=v;}replaceChildren(){this.children=[];}
    getBoundingClientRect(){return {left:0,width:1100};}
  }
  const elements=Object.fromEntries(['range','scale','scenario','charts','config','csv'].map(id=>[id,new Element()]));
  elements.range.value='100';elements.scale.value='linear';elements.scenario.value='player';
  const document={getElementById:id=>elements[id],createElement:()=>new Element(),createElementNS:()=>new Element()};
  const html=fs.readFileSync('docs/balance/2026-10-11/pressure-upper.html','utf8');
  const context=vm.createContext({document,Blob,URL,setTimeout});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  for(const end of [10,50,100,300,1000])for(const scale of ['linear','log'])for(const scenario of ['player','peak']){
    elements.range.value=String(end);elements.scale.value=scale;elements.scenario.value=scenario;vm.runInContext('draw()',context);
    assert.equal(elements.charts.children.length,3);
    for(const article of elements.charts.children){const svg=article.children.find(x=>x.attributes.viewBox);const lines=svg.children.filter(x=>x.attributes.d);assert.equal(lines.length,2);assert.ok(lines.every(x=>!/(NaN|Infinity)/.test(x.attributes.d)));svg.listeners.pointermove({clientX:600});assert.ok(article.children.find(x=>x.className==='tip').textContent.includes('差值'));}
  }
});
