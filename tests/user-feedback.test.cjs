const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const applicationId = JSON.parse(fs.readFileSync('hupu-ai-game-skills/activity.json', 'utf8')).activityId;
const code = transformSync(fs.readFileSync('src/user-feedback.mjs', 'utf8'), {
  format: 'cjs', define: { __FEEDBACK_APPLICATION_ID__: JSON.stringify(applicationId) }
}).code;
function client(timers = {}) {
  const window = {}, module = { exports: {} };
  vm.runInNewContext(code, { window, module, exports: module.exports, URL, setTimeout: timers.setTimeout || setTimeout, clearTimeout: timers.clearTimeout || clearTimeout });
  return window.SupFusionFeedback;
}
function sdk(response = { statusCode: 201, code: 0 }, user = { islogin: 1, nickname: '球迷', avatar: 'https://i1.hoopchina.com.cn/avatar.png', puid: 'do-not-send' }) {
  const requests = [];
  return { requests, auth: { getUserInfo: async () => ({ code: 200, data: user }) }, cloud: { request: async args => { requests.push(args); return response; } } };
}

test('feedback uses the fixed public service, build-time activity ID and SDK user snapshot only', async () => {
  const api = sdk(); await client().submitUserFeedback('  改进建议  ', api);
  const args = api.requests[0];
  assert.equal(args.url, 'https://feedback-public-d8fnf79rd0e395c3-1252166086.ap-shanghai.app.tcloudbase.com/api/feedback');
  assert.equal(args.envId, 'feedback-public-d8fnf79rd0e395c3');
  assert.equal(args.auth, true); assert.equal(args.method, 'POST');
  assert.deepEqual(JSON.parse(JSON.stringify(args.data)), { applicationId, content: '改进建议', nickname: '球迷', avatarUrl: 'https://i1.hoopchina.com.cn/avatar.png' });
});

test('Unicode feedback boundaries allow 1 and 2000 characters and reject 2001 or whitespace', async () => {
  const feedback = client(), api = sdk();
  assert.equal(feedback.feedbackContentLength(' 😀 '), 1);
  await feedback.submitUserFeedback('😀', api);
  await feedback.submitUserFeedback('😀'.repeat(2000), api);
  for (const text of ['😀'.repeat(2001), ' \n ']) await assert.rejects(feedback.submitUserFeedback(text, api), /1～2000/);
  assert.equal(api.requests.length, 2);
});

test('feedback requires a logged-in user and drops invalid optional avatar data', async () => {
  const guest = sdk(undefined, { islogin: 0 });
  await assert.rejects(client().submitUserFeedback('建议', guest), /先登录/);
  assert.equal(guest.requests.length, 0);
  const api = sdk(undefined, { islogin: 1, nickname: '', avatar: 'javascript:alert(1)' });
  await client().submitUserFeedback('建议', api);
  assert.deepEqual(Object.keys(api.requests[0].data).sort(), ['applicationId', 'content']);
});

test('only HTTP 201 with code zero succeeds; failure messages do not expose response details', async () => {
  for (const [statusCode, pattern] of [[400, /修改/], [401, /重新登录/], [413, /精简/], [429, /过于频繁/], [500, /结果暂不确定/], [200, /结果暂不确定/]]) {
    const api = sdk({ statusCode, code: 0, message: 'INTERNAL_SECRET' });
    await assert.rejects(client().submitUserFeedback('建议', api), error => pattern.test(error.message) && !error.message.includes('INTERNAL_SECRET'));
    assert.equal(api.requests.length, 1);
  }
  await assert.rejects(client().submitUserFeedback('建议', sdk({ statusCode: 201, code: 403 })), /结果暂不确定/);
});

test('feedback timeouts never retry and synchronous SDK errors are sanitized', async () => {
  let expire, calls = 0;
  const feedback = client({ setTimeout: fn => { expire = fn; return 1; }, clearTimeout() {} });
  const api = sdk(); api.cloud.request = () => { calls++; return new Promise(() => {}); };
  const pending = feedback.submitUserFeedback('建议', api);
  await new Promise(resolve => setImmediate(resolve)); expire();
  await assert.rejects(pending, /结果暂不确定/); assert.equal(calls, 1);
  api.cloud.request = () => { throw Error('INTERNAL_SECRET'); };
  await assert.rejects(client().submitUserFeedback('建议', api), error => !error.message.includes('INTERNAL_SECRET'));
});
