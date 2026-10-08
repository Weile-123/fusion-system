const http = require('http');
const zlib = require('zlib');
const tcb = require('@cloudbase/node-sdk');
const C = require('./game/game-core.js');
const V = require('./verified-game.js');
const crypto = require('crypto');

const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV;
const app = tcb.init({ env: envId, accessKey: process.env.COLORBOX__ACCESS_KEY });
const rdb = app.rdb({ database: 'public' });
const allowedBoards = new Set(['legend', 'ovr']);

function pathOf(req) {
  return new URL(req.url, 'http://localhost').pathname.replace(/^\/api(?=\/|$)/, '') || '/';
}
function fail(message, status = 400) {
  const error = new Error(message);
  error.statusCode = status;
  throw error;
}
function puidOf(req) {
  const raw = req.headers['x-cloudbase-context'];
  if (!raw) fail('请先登录虎扑', 401);
  let context;
  try {
    let payload = Buffer.from(String(raw).trim(), 'base64');
    if (payload[0] === 0x1f && payload[1] === 0x8b) payload = zlib.gunzipSync(payload,{maxOutputLength:16384});
    context = JSON.parse(payload.toString('utf8'));
  } catch { fail('登录信息无效', 401); }
  if (!context || typeof context !== 'object') fail('登录信息无效',401);
  const puid = context.customUserId || context.userId || context.uid;
  if (!puid) fail('请先登录虎扑', 401);
  return String(puid);
}
function rowsOf(result) {
  return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.rows) ? result.rows : [];
}
function jsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 180000) {reject(Object.assign(new Error('请求内容过大'), { statusCode: 413 }));return}
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { const body=Buffer.concat(chunks).toString('utf8'),value=body ? JSON.parse(body) : {};if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid body');resolve(value); }
      catch { reject(Object.assign(new Error('请求格式不正确'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}
async function serviceToken() {
  const credential = await app.auth().getClientCredential();
  const token = typeof credential === 'string' ? credential : credential?.access_token;
  if (typeof token === 'string' && token.trim()) return token.trim();
  if (process.env.COLORBOX__ACCESS_KEY) return process.env.COLORBOX__ACCESS_KEY;
  fail('数据库服务暂不可用', 503);
}
async function rpc(name, args) {
  const response = await fetch(`https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/${name}`, {
    method: 'POST', headers: {
      Authorization: `Bearer ${await serviceToken()}`,
      'X-Db-Instance': 'default', 'Accept-Profile': 'public', 'Content-Profile': 'public',
      'Content-Type': 'application/json'
    }, body: JSON.stringify(args),signal:typeof AbortSignal!=='undefined'?AbortSignal.timeout(14000):undefined
  });
  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : null; } catch { result = null; }
  if (!response.ok) {
    console.error('Leaderboard RPC failed', name, response.status, String(raw).slice(0, 250));
    fail(response.status === 429 ? '操作太频繁，请稍后重试' : '云端暂时无法保存成绩', response.status === 429 ? 429 : 503);
  }
  return Array.isArray(result) ? result[0] : result;
}
function boardOf(value) {
  if (!allowedBoards.has(value)) fail('排行榜类型无效');
  return value;
}
function validateRun(run, strategy) {
  if (!run || typeof run !== 'object' || Array.isArray(run) || run.lastBattle || run.ended) fail('本局状态无效');
  if (!Number.isSafeInteger(run.seed) || run.seed < 0 || run.seed > 4294967295 ||
      !Number.isSafeInteger(run.stage) || run.stage < 1 || run.stage > 100000 ||
      !Number.isSafeInteger(run.wins) || run.wins < 0 || run.wins > 100000 ||
      !Number.isSafeInteger(run.losses) || run.losses < 0 || run.losses > 100000 ||
      !Object.hasOwn(C.STRATEGIES, strategy)) fail('本局状态无效');
  if (!run.slots || !run.owned || typeof run.owned !== 'object') fail('阵容数据无效');
  const starters = new Set();
  if (!C.KNOWN_TALENTS.some(item => item.id === run.talent) ||
      !Number.isInteger(run.rng) || run.rng < 0 || run.rng > 4294967295 ||
      run.endless !== (run.stage > 10)) fail('本局状态无效');
  for (const slot of C.SLOTS) {
    const id = run.slots[slot.id];
    const own = run.owned[id];
    if (!C.BY_ID[id] || starters.has(id) || !own || !Number.isInteger(own.stars) || own.stars < 1 || own.stars > C.starLimit(run,id) ||
        !Number.isInteger(own.train) || own.train < 0 || own.train > Math.min(run.stage,C.trainingLimit(run,id))) fail('阵容数据无效');
    starters.add(id);
  }
  if (Object.keys(run.owned).length > 25 || !Array.isArray(run.gear) || run.gear.length > 10 ||
      run.gear.some(id => !C.GEAR.some(item => item.id === id))) fail('阵容数据无效');
  if (!Array.isArray(run.bench) || new Set([...starters,...run.bench]).size !== starters.size+run.bench.length ||
      !Number.isInteger(run.benchLimit) || run.benchLimit < 1 || run.benchLimit > 14 || run.bench.length > run.benchLimit ||
      Object.keys(run.owned).length !== starters.size+run.bench.length || run.bench.some(id=>!C.BY_ID[id]||!run.owned[id])) fail('阵容数据无效');
  const limits={rarityBonus:5,metaInterestCap:5,metaTrainingBoost:3,metaPolicyOffers:1,metaFilmStudy:3};
  for (const [key,max] of Object.entries(limits)) if(!Number.isInteger(run[key])||run[key]<0||run[key]>max) fail('本局加成无效');
  if(!Array.isArray(run.boosts)||run.boosts.length>200||run.boosts.some(id=>!C.BOOSTS.some(item=>item.id===id))||
      !Array.isArray(run.gearReserve)||run.gearReserve.some(id=>!C.GEAR.some(item=>item.id===id&&item.slot==='球衣'))||
      new Set([...run.gear,...run.gearReserve]).size!==run.gear.length+run.gearReserve.length||
      new Set(run.gear.map(id=>C.GEAR.find(item=>item.id===id).slot)).size!==run.gear.length) fail('装备数据无效');
}
async function handle(req, res) {
  const path = pathOf(req);
  if (req.method === 'GET' && path === '/health') return { code: 0, message: 'ok', data: {rulesVersion:2, recoveryVersion:1, proofVersion:3, backgroundSyncVersion:1, talents:C.TALENTS.length} };
  if (req.method === 'GET' && path === '/leaderboard') {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const board = boardOf(query.get('board'));
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.get('limit') || '50', 10) || 50));
    const result = await rdb.from('leaderboard_entries').select('id, display_name, score, updated_at')
      .eq('board', board).eq('verified',true).order('score', { ascending: false })
      .order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
    return { code: 0, message: 'success', data: rowsOf(result).map((row, index) => ({
      rank: index + 1, displayName: row.display_name, score: Number(row.score)
    })) };
  }
  if (req.method === 'GET' && path === '/leaderboard/me') {
    const puid = puidOf(req);
    const board = boardOf(new URL(req.url, 'http://localhost').searchParams.get('board'));
    return { code: 0, message: 'success', data: await rpc('get_game_leaderboard_rank', {
      p_puid: puid, p_board: board
    }) };
  }
  if (req.method === 'POST' && path === '/runs/start') {
    const puid = puidOf(req);
    const body = await jsonBody(req);
    if (!C.KNOWN_TALENTS.some(item => item.id === body.talent)) fail('天赋无效');
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : '玩家';
    const runId=body.requestId;
    if(typeof runId!=='string'||!/^[0-9a-f-]{36}$/i.test(runId)||!Number.isInteger(body.seed)||body.seed<0||body.seed>4294967295)fail('开局请求无效');
    const prior=rowsOf(await rdb.from('leaderboard_runs').select('id, seed, talent, proof_version').eq('id',runId).eq('puid',puid).limit(1));
    if(prior.length){if(Number(prior[0].seed)!==body.seed||prior[0].talent!==body.talent||prior[0].proof_version!==3)fail('开局记录不一致',409);return {code:0,message:'success',data:{runId,seed:body.seed,proofVersion:3}}}
    const context=await rpc('get_verified_game_profile',{p_puid:puid});
    const progress=body.progress||{};
    const cost=V.reconcileProgress(context.progress||{},progress,Number(context.earned)||0);
    const profile={...C.createGame().profile,...context.profile};
    if(!C.talentUnlocked(C.KNOWN_TALENTS.find(item=>item.id===body.talent),profile))fail('该天赋尚无云端解锁记录；可继续本地游戏。',409);
    const seed=body.seed;
    const state=C.createRun(body.talent,seed,progress);
    return {code:0,message:'success',data:await rpc('start_verified_game_run',{
      p_puid:puid,p_run_id:runId,p_talent:body.talent,p_display_name:displayName||'玩家',p_seed:seed,
      p_state:state,p_progress:progress,p_cost:cost,p_previous:context.progress||{}
    })};
  }
  if(req.method==='POST'&&path==='/profile/jersey'){
    const puid=puidOf(req),body=await jsonBody(req);
    if(typeof body.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.requestId))fail('解锁请求无效');
    const prior=rowsOf(await rdb.from('verified_jersey_purchases').select('result').eq('puid',puid).eq('request_id',body.requestId).limit(1));
    if(prior.length)return {code:0,message:'success',data:prior[0].result};
    const context=await rpc('get_verified_game_profile',{p_puid:puid});
    const progress=body.progress||{},cost=V.reconcileProgress(context.progress||{},progress,Number(context.earned)||0);
    // Compatibility endpoint for older clients: this endpoint still draws on the server.
    if((progress.jerseyUnlocks||[]).length!==(context.progress?.jerseyUnlocks||[]).length)fail('球衣需要通过云端随机解锁后才能使用旧解锁接口。',409);
    const profile={...C.createGame().profile,legend:Number(context.earned)-cost,jerseyUnlocks:[...(progress.jerseyUnlocks||[])]};
    const item=C.unlockJersey(profile,()=>crypto.randomBytes(4).readUInt32BE()/4294967296);
    if(!item)fail('已验证传奇点不足或球衣已全部解锁。',409);
    const next={...progress,jerseyUnlocks:profile.jerseyUnlocks};
    return {code:0,message:'success',data:await rpc('unlock_verified_game_jersey',{
      p_puid:puid,p_request_id:body.requestId,p_previous:context.progress||{},p_progress:next,
      p_cost:cost+C.JERSEY_UNLOCK_PRICE,p_item:item.id
    })};
  }
  if (req.method === 'POST' && path === '/runs/battle') {
    const puid = puidOf(req);
    const body = await jsonBody(req);
    if (typeof body.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.runId)) fail('本局标识无效');
    return {code:0,message:'success',data:await verifiedTransition(puid,body,'battle')};
  }
  if (req.method === 'POST' && path === '/runs/finish') {
    const puid = puidOf(req);
    const body = await jsonBody(req);
    if (typeof body.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.runId)) fail('本局标识无效');
    return {code:0,message:'success',data:await verifiedTransition(puid,body,'finish')};
  }
  if (req.method === 'POST' && ['/runs/resume','/runs/share'].includes(path)) {
    const puid=puidOf(req),body=await jsonBody(req);
    if (typeof body.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.runId)) fail('本局标识无效');
    if(path==='/runs/resume')return {code:0,message:'success',data:await verifiedTransition(puid,body,'resume')};
    const records=rowsOf(await rdb.from('leaderboard_runs').select('proof_version, battle_count').eq('id',body.runId).eq('puid',puid).limit(1));
    if(records[0]?.proof_version!==3)fail('旧对局不能提交验证奖励，请重新开局。',409);
    if(!(records[0].battle_count>0))fail('完成一场有效对战后才可领取分享奖励。',409);
    return {code:0,message:'success',data:await rpc('reward_game_leaderboard_share',{p_puid:puid,p_run_id:body.runId})};
  }
  fail('接口不存在', 404);
}

async function verifiedTransition(puid,body,terminal){
  if(!Number.isSafeInteger(body.sequence)||body.sequence<0||!Array.isArray(body.operations))fail('缺少养成验证记录，请重新开局。',409);
  const records=rowsOf(await rdb.from('leaderboard_runs').select('state, proof_version, verification_sequence, verification_digest').eq('id',body.runId).eq('puid',puid).limit(1));
  const record=records[0];if(record?.proof_version!==3||!record.state)fail('旧对局不能提交验证成绩，请重新开局。',409);
  const digest=V.digest(body.sequence,body.operations,terminal,body.strategy);
  if(record.verification_sequence===body.sequence+1&&record.verification_digest===digest)return {sequence:record.verification_sequence,alreadyRecorded:true};
  if(record.verification_sequence!==body.sequence)fail('养成记录次序不一致，请重新同步。',409);
  let replayed;try{replayed=V.replay(record.state,body.operations,terminal,body.strategy)}catch(error){fail(error.message||'养成记录验证失败。',409)}
  return rpc('commit_verified_game_transition',{p_puid:puid,p_run_id:body.runId,p_sequence:body.sequence,p_digest:digest,p_terminal:terminal,p_state:replayed.state,p_report:replayed.report});
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const result = await handle(req, res);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result));
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error(error);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: status, message: status >= 500 ? '服务暂时不可用' : error.message }));
  }
});
if (require.main === module) server.listen(Number(process.env.PORT) || 9000);
module.exports = { server, handle, validateRun };
