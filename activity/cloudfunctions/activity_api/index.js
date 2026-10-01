const http = require('http');
const zlib = require('zlib');
const tcb = require('@cloudbase/node-sdk');
const C = require('./game/game-core.js');

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
  let payload = Buffer.from(String(raw).trim(), 'base64');
  if (payload[0] === 0x1f && payload[1] === 0x8b) payload = zlib.gunzipSync(payload);
  let context;
  try { context = JSON.parse(payload.toString('utf8')); } catch { fail('登录信息无效', 401); }
  const puid = context.customUserId || context.userId || context.uid;
  if (!puid) fail('请先登录虎扑', 401);
  return String(puid);
}
function rowsOf(result) {
  return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.rows) ? result.rows : [];
}
function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 180000) reject(Object.assign(new Error('请求内容过大'), { statusCode: 413 }));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
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
    }, body: JSON.stringify(args)
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
      !Number.isSafeInteger(run.stage) || run.stage < 1 || run.stage > 300 ||
      !Number.isSafeInteger(run.wins) || run.wins < 0 || run.wins > 300 ||
      !Number.isSafeInteger(run.losses) || run.losses < 0 || run.losses > 300 ||
      !Object.hasOwn(C.STRATEGIES, strategy)) fail('本局状态无效');
  if (!run.slots || !run.owned || typeof run.owned !== 'object') fail('阵容数据无效');
  for (const slot of C.SLOTS) {
    const id = run.slots[slot.id];
    const own = run.owned[id];
    if (!C.BY_ID[id] || !own || !Number.isInteger(own.stars) || own.stars < 1 || own.stars > 5 ||
        !Number.isInteger(own.train) || own.train < 0 || own.train > 8) fail('阵容数据无效');
  }
  if (Object.keys(run.owned).length > 25 || !Array.isArray(run.gear) || run.gear.length > 10 ||
      run.gear.some(id => !C.GEAR.some(item => item.id === id))) fail('阵容数据无效');
}
async function handle(req, res) {
  const path = pathOf(req);
  if (req.method === 'GET' && path === '/health') return { code: 0, message: 'ok' };
  if (req.method === 'GET' && path === '/leaderboard') {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const board = boardOf(query.get('board'));
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.get('limit') || '50', 10) || 50));
    const result = await rdb.from('leaderboard_entries').select('id, display_name, score, updated_at')
      .eq('board', board).order('score', { ascending: false })
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
    return { code: 0, message: 'success', data: await rpc('start_game_leaderboard_run', {
      p_puid: puid, p_talent: body.talent, p_display_name: displayName || '玩家'
    }) };
  }
  if (req.method === 'POST' && path === '/runs/battle') {
    const puid = puidOf(req);
    const body = await jsonBody(req);
    const run = body.run;
    validateRun(run, body.strategy);
    if (typeof body.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.runId)) fail('本局标识无效');
    const simulated = JSON.parse(JSON.stringify(run));
    const game = C.createGame();
    game.run = simulated;
    let report;
    try { report = C.battle(game, body.strategy); } catch { fail('本局状态无法复算'); }
    if (!report || report.stage !== run.stage || !Number.isInteger(report.rating)) fail('战斗结果无效');
    return { code: 0, message: 'success', data: await rpc('record_game_leaderboard_battle', {
      p_puid: puid, p_run_id: body.runId, p_seed: run.seed,
      p_battle_index: run.wins + run.losses + 1, p_stage: run.stage,
      p_wins_before: run.wins, p_losses_before: run.losses,
      p_won: report.won, p_rating: report.rating
    }) };
  }
  if (req.method === 'POST' && path === '/runs/finish') {
    const puid = puidOf(req);
    const body = await jsonBody(req);
    if (typeof body.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.runId)) fail('本局标识无效');
    return { code: 0, message: 'success', data: await rpc('finish_game_leaderboard_run', {
      p_puid: puid, p_run_id: body.runId
    }) };
  }
  fail('接口不存在', 404);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const result = await handle(req, res);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
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
