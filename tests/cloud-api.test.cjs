const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Readable}=require('node:stream'),C=require('../h5/game-core.js');
function api(records=[],onRpc,onQuery){
  const calls=[];
  let columns;
  const query={select(value){columns=value;return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:onQuery?onQuery(columns):records})}};
  const fakeApp={rdb:()=>({from:()=>query}),auth:()=>({getClientCredential:async()=>({access_token:'test-service-token'})})};
  const context={module:{exports:{}},exports:{},process:{env:{TCB_ENV:'test'}},Buffer,URL,console,
    require:name=>name==='@cloudbase/node-sdk'?{init:()=>fakeApp}:name==='./game/game-core.js'?C:name==='./verified-game.js'?require('../activity/cloudfunctions/activity_api/verified-game.js'):require(name),
    fetch:async(url,options)=>{const args=JSON.parse(options.body);calls.push({url,args});return {ok:true,status:200,text:async()=>JSON.stringify(onRpc?onRpc(url,args):{ok:true})}}};
  vm.runInNewContext(fs.readFileSync('activity/cloudfunctions/activity_api/index.js','utf8'),context);
  return {...context.module.exports,calls};
}
function request(path,body,loggedIn=true){
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);req.method=body===undefined?'GET':'POST';req.url='/api'+path;
  req.headers=loggedIn?{'x-cloudbase-context':Buffer.from(JSON.stringify({customUserId:'test-user'})).toString('base64')}:{};return req;
}
function lineup(stage=1){
  const run=C.createRun('phase_pressure',911);run.stage=stage;run.endless=stage>10;
  for(let i=0;i<6;i++){const id=C.STARS[i].id;run.slots[C.SLOTS[i].id]=id;run.owned[id]={stars:stage>10?C.starLimit(run,id):1,train:stage>10?stage:1,trainedAt:stage}}
  return run;
}
test('OVR leaderboard returns the peak battle stage and caps requested page size',async()=>{
  const entries=[{rank:1,displayName:'Player',score:334,stage:58},{rank:2,displayName:'No battle record',score:300,stage:null}];
  const server=api([],()=>({entries}));
  const response=await server.handle(request('/leaderboard?board=ovr&limit=100',undefined,false));
  assert.equal(JSON.stringify(response.data),JSON.stringify(entries));
  assert.ok(server.calls[0].url.endsWith('/get_ovr_leaderboard_page'));
  assert.equal(server.calls[0].args.p_limit,50);
});

test('weekly OVR requests use new RPCs while old clients and legend keep original contracts',async()=>{
  const weekly={enabled:true,scope:'weekly',period:'previous',weekId:'2026-10-05',startsAt:'2026-10-04T16:00:00Z',endsAt:'2026-10-11T16:00:00Z',serverTime:'2026-10-12T00:00:00Z',entries:[{rank:1,score:391,stage:58}]};
  const server=api([],url=>url.endsWith('get_weekly_ovr_page')?weekly:url.endsWith('get_weekly_ovr_rank')?{enabled:true,scope:'weekly',weekId:weekly.weekId,entry:{rank:1,score:391}}:{entries:[{rank:1,score:999}]});
  const response=await server.handle(request('/leaderboard?board=ovr&scope=weekly&period=previous&limit=999',undefined,false));
  assert.equal(JSON.stringify(response.data),JSON.stringify(weekly));
  assert.deepEqual(server.calls[0].args,{p_period:'previous',p_limit:50});
  await server.handle(request('/leaderboard/me?board=ovr&scope=weekly&period=previous&weekId=2026-10-05'));
  assert.deepEqual(server.calls[1].args,{p_puid:'test-user',p_period:'previous',p_week_id:'2026-10-05'});
  const old=await server.handle(request('/leaderboard?board=ovr',undefined,false));assert.ok(Array.isArray(old.data));
  assert.ok(server.calls[2].url.endsWith('get_ovr_leaderboard_page'));
  const count=server.calls.length;await server.handle(request('/leaderboard?board=legend&scope=weekly',undefined,false));assert.equal(server.calls.length,count);
});

test('disabled weekly rollout falls back to cumulative results and invalid periods cannot query DB',async()=>{
  const server=api([],url=>url.includes('get_weekly_ovr_')?{enabled:false}:{entries:[{rank:1,score:391}]});
  const result=await server.handle(request('/leaderboard?board=ovr&scope=weekly',undefined,false));assert.ok(Array.isArray(result.data));assert.equal(server.calls.length,2);
  await server.handle(request('/leaderboard/me?board=ovr&scope=weekly'));assert.ok(server.calls.at(-1).url.endsWith('get_game_leaderboard_rank'));
  const count=server.calls.length;
  await assert.rejects(server.handle(request('/leaderboard?board=ovr&scope=weekly&period=invalid',undefined,false)),e=>e.statusCode===400);
  await assert.rejects(server.handle(request('/leaderboard/me?board=ovr&scope=weekly&weekId=invalid')),e=>e.statusCode===400);
  await assert.rejects(server.handle(request('/leaderboard/me?board=ovr&scope=weekly',undefined,false)),e=>e.statusCode===401);
  assert.equal(server.calls.length,count);
});
test('cloud accepts legitimate endless star and training limits and rejects overflow',()=>{
  const server=api(),run=lineup(30);assert.doesNotThrow(()=>server.validateRun(run,'outside'));
  const id=run.slots.three;run.owned[id].stars=C.starLimit(run,id)+1;assert.throws(()=>server.validateRun(run,'outside'),/阵容数据无效/);
  run.owned[id].stars=1;run.owned[id].train=31;assert.throws(()=>server.validateRun(run,'outside'),/阵容数据无效/);
  const main=lineup();main.owned[main.slots.three].stars=4;assert.throws(()=>server.validateRun(main,'outside'),/阵容数据无效/);
});
test('cloud rejects duplicate starters and invalid combat modifiers',()=>{
  const server=api(),run=lineup();run.slots.mid=run.slots.three;assert.throws(()=>server.validateRun(run,'outside'),/阵容数据无效/);
  const forged=lineup();forged.metaTrainingBoost=100;assert.throws(()=>server.validateRun(forged,'outside'),/本局加成无效/);
  const gear=lineup();gear.gear=['not-real'];assert.throws(()=>server.validateRun(gear,'outside'),/阵容数据无效/);
});
test('anonymous writes and malformed identity contexts are rejected',async()=>{
  const server=api();
  for(const path of ['/runs/start','/runs/battle','/runs/finish','/runs/resume','/runs/share','/profile/jersey'])await assert.rejects(server.handle(request(path,{},false)),error=>error.statusCode===401);
  const malformed=request('/runs/start',{talent:'reserve_fund'});malformed.headers['x-cloudbase-context']='H4sI';
  await assert.rejects(server.handle(malformed),error=>error.statusCode===401);
});

test('jersey unlock is drawn by the server and retries return the existing transaction',async()=>{
  const requestId='00000000-0000-4000-8000-000000000001';
  const server=api([], (url,args)=>url.endsWith('/get_verified_game_profile')?{progress:{},earned:2000,profile:{}}:{item:args.p_item,progress:args.p_progress});
  const response=await server.handle(request('/profile/jersey',{requestId,progress:{}}));
  assert.ok(C.GEAR.some(item=>item.id===response.data.item&&item.unlockable));
  assert.equal(JSON.stringify(response.data.progress.jerseyUnlocks),JSON.stringify([response.data.item]));assert.equal(server.calls[1].args.p_cost,500);
  const duplicate=api([{result:response.data}]);const retried=await duplicate.handle(request('/profile/jersey',{requestId,progress:{}}));
  assert.deepEqual(retried.data,response.data);assert.equal(duplicate.calls.length,0);
  const forged={jerseyUnlocks:[response.data.item]};await assert.rejects(server.handle(request('/profile/jersey',{requestId,progress:forged})),/云端随机解锁/);
});
test('battle uses only authoritative stored state and verifies operation sequence',async()=>{
  const run=lineup(30),runId='00000000-0000-0000-0000-000000000001';
  const wrong=api([{state:run,proof_version:0}]);await assert.rejects(wrong.handle(request('/runs/battle',{runId,sequence:0,operations:[],strategy:'outside'})),/旧对局/);
  const right=api([{state:run,proof_version:3,verification_sequence:0}]);await right.handle(request('/runs/battle',{runId,sequence:0,operations:[],strategy:'outside',run:{rng:0,gear:['fake'],owned:{}}}));
  assert.ok(right.calls[0].url.endsWith('/commit_verified_game_transition'));assert.ok(Number.isInteger(right.calls[0].args.p_report.rating));
  await assert.rejects(right.handle(request('/runs/battle',{runId,sequence:2,operations:[],strategy:'outside'})),/次序不一致/);
});
test('resume and sharing use authenticated idempotent database events',async()=>{
  const game=C.createGame();game.run=lineup();game.run.morale=0;game.run.lastBattle={stage:1,won:false};C.finishRun(game);
  const server=api([{state:game.run,proof_version:3,verification_sequence:0,battle_count:1}]),runId='00000000-0000-0000-0000-000000000001';
  await server.handle(request('/runs/resume',{runId,sequence:0,operations:[]}));await server.handle(request('/runs/share',{runId}));
  assert.ok(server.calls[0].url.endsWith('/commit_verified_game_transition'));assert.ok(server.calls[1].url.endsWith('/reward_game_leaderboard_share'));
  assert.equal(server.calls[1].args.p_puid,'test-user');assert.equal(server.calls[1].args.p_run_id,runId);
});

test('an empty finished run cannot farm verified sharing points',async()=>{
  const server=api([{proof_version:3,battle_count:0}]);
  await assert.rejects(server.handle(request('/runs/share',{runId:'00000000-0000-0000-0000-000000000001'})),/有效对战/);
  assert.equal(server.calls.length,0);
});

test('cloud start binds the balance version and keeps legacy starts compatible',async()=>{
  const body={requestId:'00000000-0000-4000-8000-000000000002',seed:911,talent:'reserve_fund',progress:{}};
  for(const version of Array.from({length:C.BALANCE_RULES_VERSION},(_,i)=>i+1)){
    const server=api([], (url,args)=>url.endsWith('get_verified_game_profile')?{progress:{},earned:0,profile:{}}:{runId:args.p_run_id,seed:args.p_seed,proofVersion:3});
    const response=await server.handle(request('/runs/start',version>=2?{...body,balanceRulesVersion:version}:body));
    assert.equal(response.data.balanceRulesVersion,version);
    assert.equal(server.calls[1].args.p_state.cash,version>=8?27:version>=2?20:24);
    assert.equal(server.calls[1].args.p_state.balanceRulesVersion,version>=2?version:undefined);
  }
  const retry=api([{id:body.requestId,seed:911,talent:body.talent,proof_version:3,state:{balanceRulesVersion:2}}]);
  await assert.rejects(retry.handle(request('/runs/start',body)));
  await assert.rejects(api().handle(request('/runs/start',{...body,balanceRulesVersion:C.BALANCE_RULES_VERSION+1})));
});

test('cloud inheritance unlock respects new thresholds, preserves old users, and keeps rule 7 open',async()=>{
  const body={requestId:'00000000-0000-4000-8000-000000000003',seed:911,talent:'win_bonus',balanceRulesVersion:8,progress:{}};
  function server(profile,oldestVersion){return api([], (url,args)=>url.endsWith('get_verified_game_profile')?{progress:{},earned:0,profile}:{runId:args.p_run_id,seed:args.p_seed,proofVersion:3},columns=>columns==='state'&&oldestVersion?[{state:{balanceRulesVersion:oldestVersion}}]:[])}
  await assert.rejects(server({}).handle(request('/runs/start',body)),/天赋尚无/);
  await assert.rejects(server({wins:15,discovered:[]}).handle(request('/runs/start',body)),/天赋尚无/);
  assert.equal((await server({wins:15,discovered:C.STARS.slice(0,20).map(s=>s.id)}).handle(request('/runs/start',body))).data.balanceRulesVersion,8);
  assert.equal((await server({runs:1},7).handle(request('/runs/start',body))).data.balanceRulesVersion,8);
  await assert.rejects(server({runs:1},8).handle(request('/runs/start',body)),/天赋尚无/);
  assert.equal((await server({}).handle(request('/runs/start',{...body,balanceRulesVersion:7}))).data.balanceRulesVersion,7);
});
test('cloud off-court unlock uses distinct authoritative discoveries instead of wins',async()=>{
 const body={requestId:'00000000-0000-4000-8000-000000000004',seed:911,talent:'streak_bonus',balanceRulesVersion:8,progress:{}};
 function server(profile){return api([], (url,args)=>url.endsWith('get_verified_game_profile')?{progress:{},earned:0,profile}:{runId:args.p_run_id,seed:args.p_seed,proofVersion:3})}
 await assert.rejects(server({bestEndless:13,wins:40,discoveredEvents:C.EVENTS.slice(0,9).map(e=>e.id)}).handle(request('/runs/start',body)),/天赋尚无/);
 const profile={bestEndless:13,wins:0,discoveredEvents:C.EVENTS.slice(0,10).map(e=>e.id)};
 assert.equal((await server(profile).handle(request('/runs/start',body))).data.balanceRulesVersion,8);
 await assert.rejects(server({...profile,bestEndless:12}).handle(request('/runs/start',body)),/天赋尚无/);
});
test('background start binds a committed seed and retries do not create another run',async()=>{
  const requestId='00000000-0000-4000-8000-000000000001',body={requestId,seed:911,talent:'reserve_fund',progress:{}};
  const fresh=api([], (url,args)=>url.endsWith('get_verified_game_profile')?{progress:{},earned:0,profile:{}}:{runId:args.p_run_id,seed:args.p_seed,proofVersion:3});
  const response=await fresh.handle(request('/runs/start',body));assert.equal(response.data.runId,requestId);assert.equal(fresh.calls[1].args.p_state.rng,C.createRun('reserve_fund',911,{},1).rng);
  const retry=api([{id:requestId,seed:911,talent:body.talent,proof_version:3}]);await retry.handle(request('/runs/start',body));assert.equal(retry.calls.length,0);
  await assert.rejects(retry.handle(request('/runs/start',{...body,seed:912})),/不一致/);
});
