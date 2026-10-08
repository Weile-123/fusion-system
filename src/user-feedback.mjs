const config = Object.freeze({
  apiBase: 'https://feedback-public-d8fnf79rd0e395c3-1252166086.ap-shanghai.app.tcloudbase.com/api',
  envId: 'feedback-public-d8fnf79rd0e395c3',
  applicationId: typeof __FEEDBACK_APPLICATION_ID__ === 'string' ? __FEEDBACK_APPLICATION_ID__ : ''
});

export const feedbackContentLength = value => Array.from(String(value || '').trim()).length;

function timed(task) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('提交结果暂不确定，请稍后确认后再试。')), 15000);
    Promise.resolve(task).then(value => { clearTimeout(timer); resolve(value); }, () => {
      clearTimeout(timer);
      reject(new Error('提交结果暂不确定，请稍后确认后再试。'));
    });
  });
}

export async function submitUserFeedback(rawContent, sdk = window.ColorboxAI) {
  const content = String(rawContent || '').trim(), length = feedbackContentLength(content);
  if (length < 1 || length > 2000) throw new Error('请输入 1～2000 个字符的反馈内容。');
  if (!/^app_[0-9a-f]{10}$/.test(config.applicationId)) throw new Error('反馈配置暂不可用，请稍后再试。');
  if (!sdk?.auth?.getUserInfo || !sdk?.cloud?.request) throw new Error('请在虎扑 App 中登录后提交反馈。');
  const userInfo = await timed(Promise.resolve().then(() => sdk.auth.getUserInfo()));
  if (userInfo?.code !== 200 || userInfo?.data?.islogin !== 1) throw new Error('请先登录虎扑，再提交反馈。');
  const user = userInfo.data;
  const nickname = typeof user.nickname === 'string' ? user.nickname.trim() : '';
  const avatar = (typeof user.avatar === 'string' && user.avatar.trim()) || (typeof user.userHeadUrl === 'string' && user.userHeadUrl.trim()) || '';
  const data = { applicationId: config.applicationId, content };
  if (nickname) data.nickname = nickname;
  try { if (avatar && new URL(avatar).protocol === 'https:') data.avatarUrl = avatar; } catch (_) {}
  const response = await timed(Promise.resolve().then(() => sdk.cloud.request({
    url: `${config.apiBase}/feedback`, method: 'POST', data, envId: config.envId, auth: true
  })));
  if (response?.statusCode === 201 && response.code === 0) return;
  const errors = {
    400: '反馈内容不符合要求，请修改后再提交。',
    401: '登录状态已失效，请重新登录后提交。',
    413: '反馈内容过长，请精简后提交。',
    429: '提交过于频繁，请稍后再试。'
  };
  throw new Error(errors[response?.statusCode] || '提交结果暂不确定，请稍后确认后再试。');
}

window.SupFusionFeedback = Object.freeze({ feedbackContentLength, submitUserFeedback });
