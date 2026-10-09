import { createElement, Fragment, createRoot, flushSync } from './dom-runtime.mjs';

const roots = new WeakMap();

function renderInto(element, content) {
  element.dataset.renderer = 'react';
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  flushSync(() => root.render(content));
}

const reactAttributeNames = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'fill-opacity': 'fillOpacity',
  'text-anchor': 'textAnchor',
  'paint-order': 'paintOrder',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight'
};
const booleanAttributes = new Set(['disabled', 'hidden', 'checked', 'selected', 'multiple', 'readonly']);
const allowedTags = new Set(['article', 'b', 'br', 'button', 'div', 'em', 'h1', 'h2', 'h3', 'header', 'i', 'img', 'p', 'path', 'section', 'small', 'span', 'strong', 'svg', 'text']);
const allowedAttributes = new Set([
  'alt', 'class', 'colspan', 'd', 'disabled', 'fill', 'fill-opacity', 'font-family', 'font-size',
  'font-weight', 'height', 'hidden', 'id', 'key', 'opacity', 'paint-order', 'preserveaspectratio',
  'readonly', 'role', 'rowspan', 'src', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width',
  'style', 'tabindex', 'text-anchor', 'title', 'type', 'value', 'viewbox', 'width', 'x', 'y'
]);
const voidTags = new Set(['br', 'img']);
const entityValues = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: '\u00a0', quot: '"' };

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const numeric = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : '\ufffd';
    }
    return entityValues[code.toLowerCase()] ?? entity;
  });
}

function parseStyle(value) {
  if (/url\s*\(|expression\s*\(|@import/i.test(value)) return {};
  return Object.fromEntries(value.split(';').map((entry) => entry.trim()).filter((entry) => entry.includes(':')).map((entry) => {
    const split = entry.indexOf(':');
    const name = entry.slice(0, split).trim();
    const property = name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return [property, entry.slice(split + 1).trim()];
  }));
}

function safeAttribute(name, value) {
  const lowerName = name.toLowerCase();
  if (!allowedAttributes.has(lowerName) && !lowerName.startsWith('data-') && !lowerName.startsWith('aria-')) return null;
  if (lowerName === 'src' && !/^(?:\.\.\/)?assets\/[\w./-]+$/i.test(value)) {
    try {
      if (!value.startsWith('blob:') || new URL(value.slice(5)).origin !== window.location.origin) return null;
    } catch (_) { return null; }
  }
  const reactName = reactAttributeNames[lowerName] || lowerName;
  if (lowerName === 'style') return [reactName, parseStyle(value)];
  return [reactName, booleanAttributes.has(lowerName) ? true : decodeEntities(value)];
}

function parseAttributes(source) {
  const props = {};
  const pattern = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gy;
  let cursor = 0;
  while (cursor < source.length) {
    if (/^\s*$/.test(source.slice(cursor))) break;
    pattern.lastIndex = cursor;
    const match = pattern.exec(source);
    if (!match) throw new Error('Invalid generated markup attribute');
    cursor = pattern.lastIndex;
    const attribute = safeAttribute(match[1], match[2] ?? match[3] ?? match[4] ?? '');
    if (attribute) props[attribute[0]] = attribute[1];
  }
  return props;
}

function parseGeneratedMarkup(source) {
  const root = { children: [] };
  const stack = [root];
  const tokens = source.match(/<!--[^]*?-->|<\/?[A-Za-z][^<>]*>|[^<]+|</g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (!token.startsWith('<')) {
      stack.at(-1).children.push(decodeEntities(token));
      continue;
    }
    const closing = token.match(/^<\/([A-Za-z][\w:-]*)\s*>$/);
    if (closing) {
      const tag = closing[1].toLowerCase();
      if (stack.length === 1 || stack.at(-1).tag !== tag) throw new Error(`Invalid generated markup closing tag: ${tag}`);
      stack.pop();
      continue;
    }
    const opening = token.match(/^<([A-Za-z][\w:-]*)([^<>]*?)(\/?)>$/);
    if (!opening) throw new Error('Invalid generated markup tag');
    const tag = opening[1].toLowerCase();
    if (!allowedTags.has(tag)) throw new Error(`Unsupported generated markup tag: ${tag}`);
    const node = { tag, props: parseAttributes(opening[2]), children: [] };
    stack.at(-1).children.push(node);
    if (!opening[3] && !voidTags.has(tag)) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`Unclosed generated markup tag: ${stack.at(-1).tag}`);
  return root.children;
}

function markupNodeToReact(node, key) {
  if (typeof node === 'string') return node;
  return createElement(node.tag, { ...node.props, key: node.props.key ?? key }, ...node.children.map(markupNodeToReact));
}

function MarkupScreen({ html }) {
  return createElement(Fragment, null, ...parseGeneratedMarkup(html).map(markupNodeToReact));
}

function HomeScreen({ active, stage }) {
  return (
    <>
      <section className="home-hero">
        <div className="home-orbit" aria-hidden="true"><span>11</span></div>
        <div className="home-eyebrow">BUILD YOUR OWN LEGEND</div>
        <h1>我的球星<br /><em>融合系统</em></h1>
        <div className="home-introduction">
          <p>六位球星，一位终极单挑者。招募、融合、闯关，打出独一无二的传奇之路。</p>
          <button type="button" className="home-announcement" data-act="announcement-open" aria-label="更新公告" title="更新公告">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 10h4l11-5v14L8 14H4zM8 14l2 6H6l-2-6M22 9v6" /></svg>
          </button>
        </div>
        <div className="home-scores">
          <div><b>06</b><small>能力槽位</small></div>
          <div><b>10</b><small>主线关卡</small></div>
          <div><b>∞</b><small>无尽挑战</small></div>
        </div>
      </section>
      {active && <button className="btn wide home-primary home-continue" data-act="continue">继续第 {stage} 关 <span>→</span></button>}
      <button className="btn wide home-primary home-new" data-act="new">{active ? '开启另一段旅程' : '开启新旅程'} <span>→</span></button>
      <button className="home-leaderboard-entry button-7" data-act="leaderboard">排行榜 <span>→</span></button>
      <div className="home-entry-row grid grid-cols-2">
        <button className="home-secondary home-pointshop" data-act="pointshop">点数商店</button>
        <button className="home-secondary home-profile" data-act="profile">传奇档案</button>
      </div>
      <button type="button" className="home-feedback button-7" data-act="feedback-open">反馈入口</button>
    </>
  );
}

function AnnouncementScreen() {
  return <section className="modal-card announcement-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
    <div className="modal-head"><div><small>2026.10.09 · 阵容多样性更新</small><h2 id="announcement-title">更新公告</h2></div><button type="button" className="button-8" data-act="announcement-close" aria-label="关闭公告">×</button></div>
    <div className="announcement-content">
      <h3>更多羁绊，更多搭配</h3><p>羁绊从原有81新增至100，包括格林公式、金州连接器、芝城侧翼网、洛城快攻链等，阵容搭配更加丰富。</p>
      <h3>数值调整</h3><p>重新分配羁绊的战力与奖金收益，对部分现有羁绊效果数值、战力成长进行调整。</p>
      <h3>样式调整</h3><p>羁绊图鉴样式调整，页面内模块间距统一调整，修复现有操作问题。</p>
      <p className="announcement-note">本次规则适用于新开局。已有对局继续使用原规则，传奇点、球衣收藏与生涯记录保留。</p>
    </div>
    <button type="button" className="btn button-1 wide" data-act="announcement-close">知道了</button>
  </section>;
}

function FeedbackScreen({ draft, remaining, busy, message }) {
  return <section className="modal-card feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
    <div className="modal-head"><h2 id="feedback-title">反馈入口</h2><button type="button" className="button-8" data-act="feedback-close" aria-label="关闭反馈" disabled={busy}>×</button></div>
    <label className="feedback-input-label" htmlFor="feedback-content">反馈内容</label>
    <textarea id="feedback-content" value={draft} rows={5} placeholder="遇到了什么问题，或有什么建议？" readOnly={busy} aria-describedby="feedback-status" />
    <p id="feedback-status" role="status" aria-live="polite">{message}</p>
    <button id="feedback-submit" type="button" className="btn button-1 wide" data-act="feedback-submit" disabled={busy || !draft.trim() || remaining < 0} aria-busy={busy}>
      {busy && <i className="ad-loading-icon" aria-hidden="true" />}{busy ? '提交中…' : '提交反馈'}
    </button>
  </section>;
}

function LeaderboardPage({ entries, title, unit, status, playerName }) {
  const podium = [entries[1], entries[0], entries[2]];
  return <section className="leaderboard-page" aria-label={title}>
    {status && <p className="leaderboard-status" role="status">{status}</p>}
    {entries.length > 0 && <>
      <div className="leaderboard-podium">{podium.map(entry => entry && <div className={`leaderboard-medal medal-${entry.rank}`} key={entry.rank}><span className="leaderboard-crown">{entry.rank === 1 ? '♛' : entry.rank === 2 ? '◆' : '★'}</span><strong>#{entry.rank}</strong><b>{entry.isCurrent ? playerName : entry.name}</b><small>{entry.score.toLocaleString()} {unit}</small>{unit === 'OVR' && entry.stage > 0 && <small className="leaderboard-peak-stage">第{entry.stage}关</small>}</div>)}</div>
      {entries.length > 3 && <div className="leaderboard-list-heading"><span>排名</span><span>玩家</span><span>{title}</span></div>}
      <div className="leaderboard-list">{entries.slice(3, 50).map(entry => <div className={`leaderboard-row${entry.isCurrent ? ' current' : ''}`} key={entry.rank}><strong>{entry.rank}</strong><span>{entry.isCurrent ? `${playerName} · 我` : entry.name}</span><b>{entry.score.toLocaleString()} <small>{unit}{unit === 'OVR' && entry.stage > 0 ? `·第${entry.stage}关` : ''}</small></b></div>)}</div>
    </>}
    {entries.length === 0 && (status === '' || status === '暂无成绩') && <p className="leaderboard-empty">暂时还没有成绩</p>}
  </section>;
}

function LeaderboardScreen({ boards, tab, status, mine, playerName, busy }) {
  const current = mine[tab];
  return <>
    <div className="leaderboard-heading"><div><span>LEGENDS BOARD</span><h1>排行榜</h1></div><div className="leaderboard-heading-actions"><button className="leaderboard-refresh button-7" data-act="leaderboard-refresh" disabled={busy} aria-busy={busy}>{busy&&<i className="leaderboard-loading-icon" aria-hidden="true"/>}刷新</button><button className="leaderboard-home button-7" data-act="home">返回主页</button></div></div>
    <div className="leaderboard-my-rank"><span>我的排名<small>{tab === 'legend' ? '总传奇点' : '单局最高 OVR'}</small></span><strong>{current?.rank ? `第 ${current.rank} 名` : status[tab] === '正在加载榜单…' ? '读取中' : status[tab] === '' || status[tab] === '暂无成绩' ? '未上榜' : '暂不可用'}</strong><b>{current?.score?.toLocaleString() ?? '—'} <small>{tab === 'legend' ? '点' : 'OVR'}</small></b></div>
    <div className={`leaderboard-switch ${tab === 'ovr' ? 'ovr' : ''}`} role="tablist" aria-label="排行榜类别"><button className="button-9" role="tab" aria-selected={tab === 'legend'} data-act="leaderboard-tab" data-id="legend">总传奇点</button><button className="button-9" role="tab" aria-selected={tab === 'ovr'} data-act="leaderboard-tab" data-id="ovr">单局最高 OVR</button><i aria-hidden="true" /></div>
    <div className="leaderboard-window"><div className={`leaderboard-track ${tab === 'ovr' ? 'ovr' : ''}`}><LeaderboardPage entries={boards.legend} title="总传奇点" unit="点" status={status.legend} playerName={playerName} /><LeaderboardPage entries={boards.ovr} title="单局最高 OVR" unit="OVR" status={status.ovr} playerName={playerName} /></div></div>
  </>;
}

function TalentScreen({ offer, selectedTalent, unlockedCount, totalCount, talentAdBusy, talentAdUnlocked, talentAdMessage, beginBusy = false }) {
  return (
    <>
      <button className="inline-back" data-act="home">← 返回首页</button>
      <div className="eyebrow">NEW RUN · 开局抉择</div>
      <h1 className="title">选择你的融合路线</h1>
      <div className="talent-catalog-row">
        <span>已解锁 {unlockedCount}/{totalCount}</span>
        <button data-act="talent-catalog">查看全部天赋</button>
      </div>
      <div className="list">
        {offer.map((talent) => (
          <button
            className={`talent button-6 ${selectedTalent === talent.id ? 'selected' : ''}`}
            data-act="talent"
            data-id={talent.id}
            key={talent.id}
            disabled={beginBusy || talentAdBusy}
          >
            <b>✦ {talent.name} <small>{talent.category}</small></b>
            <span>{talent.gain}</span>
            <i>{talent.cost === '无' ? '无代价' : `代价：${talent.cost}`}</i>
          </button>
        ))}
      </div>
      <div className="floatingaction talent-actions">
        <button className="btn wide talent-confirm button-3" data-act="begin" disabled={talentAdBusy || beginBusy}>{beginBusy && <i className="ad-loading-icon" aria-hidden="true" />}确认天赋</button>
        <button className={`talent-ad button-4${talentAdBusy ? ' ad-busy' : ''}`} data-act="talent-ad" disabled={talentAdBusy || talentAdUnlocked || beginBusy}><span><b>{talentAdUnlocked ? '已解锁自选天赋' : '看广告自选天赋'}</b><small>{talentAdUnlocked ? '请在上方选择天赋' : '从所有已解锁天赋中自选一个'}</small></span>{talentAdBusy ? <i className="ad-loading-icon" aria-hidden="true" /> : <img src="assets/reward-video-icon.svg" alt="" />}</button>
        {talentAdMessage && <p className="talent-ad-message" role="status">{talentAdMessage}</p>}
      </div>
    </>
  );
}

function TopBar({ hasRun, hideBack, backAction, backLabel, liveGoat, stageLabel, morale, moraleMax = 3 }) {
  const heartPath = 'M12 21s-9-5.5-9-11.7C3 5.6 5.4 3 8.5 3c1.8 0 3 1 3.5 2.1C12.5 4 13.7 3 15.5 3 18.6 3 21 5.6 21 9.3 21 15.5 12 21 12 21Z';
  const heartFillHeight = 18 * Math.min(1, morale / moraleMax);
  const isTalentAction = hasRun && backAction === 'current-talent-open';
  const backButton = !hideBack && (
    <button className={`top-back${isTalentAction ? ' top-talent' : ''}`} data-act={hasRun ? backAction : 'home'}>
      {isTalentAction ? backLabel : `← ${hasRun ? backLabel : '返回首页'}`}
    </button>
  );

  if (!hasRun) return backButton;

  return (
    <>
      {backButton}
      <div className="top-status">
        <span className="top-goat"><small>GOAT</small><b>{liveGoat}</b></span>
        <span><small>关卡</small><b>{stageLabel}</b></span>
        <span className="top-life">
          <svg className="life-heart" viewBox="0 0 24 24" aria-hidden="true">
            <defs><clipPath id="life-heart-fill"><path d={heartPath} /></clipPath></defs>
            <path
              d={heartPath}
              fill="#4a2729"
              stroke="#ff655c"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <rect x="2" y={21 - heartFillHeight} width="20" height={heartFillHeight} fill="#ff655c" clipPath="url(#life-heart-fill)" />
            <path d={heartPath} fill="none" stroke="#ff655c" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <b>{Math.min(moraleMax,morale)}/{moraleMax}{morale>moraleMax?` +${morale-moraleMax}`:''}</b>
        </span>
      </div>
    </>
  );
}

function SignaturePanel({ moves, embedded = false }) {
  if (!moves.length) return null;
  return (
    <section className={`signature-panel${embedded ? ' embedded' : ' panel'}`}>
      <div className="signature-title"><b>招牌动作</b><small>自动触发 · 每项每场最多 2 次</small></div>
      <div className="signature-list">
        {moves.map((move) => (
          <div className="signature-item" key={move.id}>
            <b>{move.name}<span>·{move.slotLabels.join('+')}</span></b>
            <small>{move.description}</small>
            {move.trained > 0 && <em>受训成员 {move.trained}/2 · 每人额外强化 2 个百分点</em>}
          </div>
        ))}
      </div>
    </section>
  );
}

function DuelScreen({ stage, fusion, attrStats, combatStats, moves, foe, foeCombat }) {
  return (
    <>
      <button className="inline-back" data-act="roster">← 返回融合球场</button>
      <div className="eyebrow">STAGE {String(stage).padStart(2, '0')} · 赛前情报</div>
      <div className="ace-panel panel compact-ace">
        <strong className="ace-rating">{fusion.rating}</strong>
        <div className="ace-detail">
          <div className="ace-section-label">融合六项 <small>升星、训练与换位</small></div>
          <div className="ace-stat-grid">{attrStats.map((item) => <span key={item.id}>{item.label} <b>{item.value}</b></span>)}</div>
        </div>
        <div className="ace-combat-wide">
          <div className="ace-section-label">单挑战力 <small>技能、羁绊与装备</small></div>
          <div className="ace-combat-grid">{combatStats.map((item) => <span key={item.id}>{item.label} <b>{item.value}</b></span>)}</div>
        </div>
        <SignaturePanel moves={moves} embedded />
      </div>
      <div className="sectionhead duel-foe-heading"><h2>本关对手</h2><span>基础战力 {fusion.rating} : {foe.rating}</span></div>
      <div className="panel opponent">
        <div className="opponent-name-row"><strong>{foe.name}</strong><span><small>OVR</small><b>{foe.rating}</b>{foe.stars > 1 && <em>{foe.stars}★</em>}</span></div>
        <p>三分 {foe.stats.three} · 突破 {foe.stats.drive} · 防守 {foe.stats.def}</p>
        <div className="opponent-combat">{foeCombat.map((item) => <span key={item.id}>{item.label} {item.value}</span>)}</div>
        <span className="versus">VS</span>
      </div>
      <div className="floatingaction"><button className="btn wide" data-act="battle">开始自动单挑 →</button></div>
    </>
  );
}

function ResultAction({ ended, final, won }) {
  if (ended) return <button className="btn wide" data-act="career-report">查看生涯报告 →</button>;
  if (final) {
    return <div className="result-actions"><button className="btn dark" data-act="finish">本局结算</button><button className="btn" data-act="next">进入无尽 →</button></div>;
  }
  return <button className="btn wide" data-act={won ? 'next' : 'retry'}>{won ? '下一关整备' : '整备重试'} →</button>;
}

function ResultScreen({ report, won, ended, final, wins, losses, battleKey, beatText, strategyName, strategyEffect, playerName, playerNameNotice }) {
  return (
    <>
      <div className="result-card panel">
        <div className="result-scoreboard">
          <div className="result-side"><div className="result-avatar you-avatar"><img src="assets/fusion-ace.png" alt="融合球员概念插画" /></div><strong>{playerName}</strong><small>OVR {report.rating}</small></div>
          <div className="result-middle"><div className="score">{report.us}<span>:</span>{report.them}</div><b>{won ? '胜利' : '失败'}</b></div>
          <div className="result-side"><div className="result-avatar opp-avatar"><img src="assets/rival-forward.png" alt="对手概念插画" /></div><strong>{report.foeName}</strong><small>OVR {report.foeRating}{report.foeStars > 1 ? ` · ${report.foeStars}★` : ''}</small></div>
        </div>
        <div className="result-strategy"><span>▣ {beatText}：{strategyName}</span><b>{strategyEffect}</b></div>
      </div>
      {playerNameNotice && <p className="result-user-notice" role="status">{playerNameNotice}</p>}
      <div className="sectionhead result-timeline-title"><h2>关键回合</h2></div>
      <div className="timeline" key={battleKey}>
        {!!report.signatures?.length && <div className="timeline-signatures">{report.signatures.map((move) => <span key={move.id}>{move.kind === 'offense' ? '进攻' : '防守'} · <b>{move.name}</b>　触发 {move.uses} 次</span>)}</div>}
        {report.log.map((line, index) => <p className="timeline-entry" style={{ '--round-order': index }} key={`${index}-${line}`}>{line.replace(/^(\d+)回合/, '第$1次攻防')}</p>)}
      </div>
      {ended && <div className="panel result-summary">本局 {wins} 胜 {losses} 负，获得 {report.legendEarned || 0} 传奇点。</div>}
      {final && <div className="panel result-summary">主线十关完成！可以带当前阵容进入无尽，或结算本局。</div>}
      <div className="result-dock">
        {!ended && <div className="panel battle-reward"><div className="battle-reward-main"><span className="shopicon">＄</span><div><strong>本场奖金 +{report.reward}</strong><small>{report.detail.join(' · ')}</small></div></div></div>}
        <ResultAction ended={ended} final={final} won={won} />
      </div>
    </>
  );
}

function CareerReportScreen({ summary, posterBusy, posterMessage, reviveBusy, reviveMessage }) {
  return (
    <>
      <div className="career-report-content">
        <div className="career-report-overview">
          <div className="career-report-hero panel">
            <span>第 {summary.stage} 关</span><h1>{summary.goat}</h1><small>GOAT 分数</small>
          </div>
          <section className="panel career-advanced">
            <div><span>胜负记录<b>{summary.wins} 胜 {summary.losses} 负</b></span><span>招募球员<b>{summary.recruits} 次</b></span><span>累计奖金收入<b>{summary.prizeIncome} 奖金</b></span><span>购买装备<b>{summary.gearPurchases} 次</b></span></div>
          </section>
        </div>
        <section className="career-report-section">
          <div className="sectionhead"><h2>最终阵容</h2><span>{summary.lineup.length}/6</span></div>
          <div className="career-lineup">{summary.lineup.map(player => <div className={player.tierClass} key={player.slot}><span>{player.slotLabel}位 · {player.stars}★</span><b>{player.name}</b></div>)}</div>
        </section>
        <section className="career-report-section">
          <div className="sectionhead"><h2>激活羁绊</h2><span>{summary.bonds.length} 组</span></div>
          <div className="career-bonds">{summary.bonds.length ? summary.bonds.map(bond => <div className="career-bond-tag" key={bond.name}>{bond.name}</div>) : <p>未激活羁绊</p>}</div>
        </section>
        <section className="career-report-section">
          <div className="sectionhead"><h2>装备和球衣</h2><span>{summary.gear.length} 件</span></div>
          <div className="career-gear">{summary.gear.length ? summary.gear.map(item => <div className={`career-gear-tag ${item.rarityClass}`} key={item.id}>{item.name}</div>) : <p>未购买装备和球衣</p>}</div>
        </section>
        <section className="career-report-section panel career-settlement">
          <div className="career-settlement-head"><span>本局获得 <b>+{summary.legendEarned} 传奇点</b></span><span>当前传奇点 <b>{summary.currentLegend}</b></span></div><p>{summary.formula}</p>
        </section>
      </div>
      <div className="career-report-actions">
        <div className="career-action-row"><button className={`btn wide career-revive${reviveBusy ? ' ad-busy' : ''}`} data-act="report-revive" disabled={!summary.canRevive || reviveBusy}>{reviveBusy && <i className="ad-loading-icon" aria-hidden="true" />}{summary.reviveUsed ? '本局已使用体力恢复' : !summary.canRevive ? '当前无需恢复体力' : '看视频恢复体力'}</button><button className="btn wide dark" data-act="report-new">返回首页</button></div>
        {reviveMessage && <p role="status">{reviveMessage}</p>}
        <button className="btn wide career-poster" data-act="report-poster" disabled={posterBusy}>{!summary.posterRewarded && summary.wins + summary.losses > 0 ? '生成海报·首次分享获得100传奇点' : '生成海报'}</button>
      </div>
    </>
  );
}

export function installReactScreens() {
  if (window.SupFusionReactScreens) return window.SupFusionReactScreens;

  window.SupFusionReactScreens = Object.freeze({
    renderAnnouncement(element) {
      renderInto(element, <AnnouncementScreen />);
    },
    renderFeedback(element, props) {
      renderInto(element, <FeedbackScreen {...props} />);
    },
    renderHome(element, props) {
      renderInto(element, <HomeScreen {...props} />);
    },
    renderLeaderboard(element, props) {
      renderInto(element, <LeaderboardScreen {...props} />);
    },
    renderTalent(element, props) {
      renderInto(element, <TalentScreen {...props} />);
    },
    renderTopBar(element, props) {
      renderInto(element, <TopBar {...props} />);
    },
    renderDuel(element, props) {
      renderInto(element, <DuelScreen {...props} />);
    },
    renderResult(element, props) {
      renderInto(element, <ResultScreen {...props} />);
    },
    renderCareerReport(element, props) {
      renderInto(element, <CareerReportScreen {...props} />);
    },
    renderMarkup(element, html) {
      renderInto(element, <MarkupScreen html={html} />);
    }
  });

  return window.SupFusionReactScreens;
}
