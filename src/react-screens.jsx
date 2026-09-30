import { createElement, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

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
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'fill-opacity': 'fillOpacity'
};
const booleanAttributes = new Set(['disabled', 'hidden', 'checked', 'selected', 'multiple', 'readonly']);

function parseStyle(value) {
  return Object.fromEntries(value.split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const split = entry.indexOf(':');
    const name = entry.slice(0, split).trim();
    const property = name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return [property, entry.slice(split + 1).trim()];
  }));
}

function domToReact(node, key) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const props = { key };
  for (const attribute of node.attributes) {
    const name = reactAttributeNames[attribute.name] || attribute.name;
    props[name] = attribute.name === 'style' ? parseStyle(attribute.value) : booleanAttributes.has(attribute.name) ? true : attribute.value;
  }
  const children = [...node.childNodes].map((child, index) => domToReact(child, index));
  return createElement(node.tagName.toLowerCase(), props, ...children);
}

function MarkupScreen({ html }) {
  const document = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return createElement(Fragment, null, ...[...document.body.childNodes].map((node, index) => domToReact(node, index)));
}

function HomeScreen({ active, stage, storageMessage }) {
  return (
    <>
      <section className="home-hero">
        <div className="home-orbit" aria-hidden="true"><span>11</span></div>
        <div className="home-eyebrow">BUILD YOUR OWN LEGEND</div>
        <h1>我的球星<br /><em>融合系统</em></h1>
        <p>六位球星，一位终极单挑者。招募、融合、闯关，打出独一无二的传奇之路。</p>
        <div className="home-scores">
          <div><b>06</b><small>能力槽位</small></div>
          <div><b>10</b><small>主线关卡</small></div>
          <div><b>∞</b><small>无尽挑战</small></div>
        </div>
      </section>
      {active && <button className="btn wide home-primary home-continue" data-act="continue">继续第 {stage} 关 <span>→</span></button>}
      <button className="btn wide home-primary home-new" data-act="new">{active ? '开启另一段旅程' : '开启新旅程'} <span>→</span></button>
      <div className="home-entry-row grid grid-cols-2">
        <button className="home-secondary home-pointshop" data-act="pointshop">点数商店</button>
        <button className="home-secondary home-profile" data-act="profile">传奇档案</button>
      </div>
      <p className="footer-note">{storageMessage}</p>
    </>
  );
}

function TalentScreen({ offer, selectedTalent, unlockedCount, totalCount }) {
  return (
    <>
      <button className="inline-back" data-act="home">← 返回首页</button>
      <div className="eyebrow">NEW RUN · 开局抉择</div>
      <h1 className="title">选择你的融合路线</h1>
      <p className="lead">从 {totalCount} 项开局天赋中解锁路线，每局随机三选一，效果持续整局。</p>
      <div className="talent-catalog-row">
        <span>已解锁 {unlockedCount}/{totalCount}</span>
        <button data-act="talent-catalog">查看全部天赋</button>
      </div>
      <div className="list">
        {offer.map((talent) => (
          <button
            className={`talent ${selectedTalent === talent.id ? 'selected' : ''}`}
            data-act="talent"
            data-id={talent.id}
            key={talent.id}
          >
            <b>✦ {talent.name} <small>{talent.category}</small></b>
            <span>{talent.gain}</span>
            <i>{talent.cost === '无' ? '无代价' : `代价：${talent.cost}`}</i>
          </button>
        ))}
      </div>
      <div className="floatingaction">
        <button className="btn wide" data-act="begin">确定天赋，开始四选一招募 →</button>
      </div>
    </>
  );
}

function TopBar({ hasRun, hideBack, backAction, backLabel, liveGoat, stageLabel, morale }) {
  const heartPath = 'M12 21s-9-5.5-9-11.7C3 5.6 5.4 3 8.5 3c1.8 0 3 1 3.5 2.1C12.5 4 13.7 3 15.5 3 18.6 3 21 5.6 21 9.3 21 15.5 12 21 12 21Z';
  const heartFillHeight = 18 * (morale / 3);
  const backButton = !hideBack && (
    <button className="top-back" data-act={hasRun ? backAction : 'home'}>
      ← {hasRun ? backLabel : '返回首页'}
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
          <b>{morale}/3</b>
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

function DuelScreen({ stage, fusion, talentName, attrStats, combatStats, moves, foe, foeCombat }) {
  return (
    <>
      <button className="inline-back" data-act="roster">← 返回融合球场</button>
      <div className="eyebrow">STAGE {String(stage).padStart(2, '0')} · 赛前情报</div>
      <h1 className="title">单挑赛前情报</h1>
      <div className="ace-panel panel compact-ace">
        <div className="ace-overview">
          <div className="ace-mark"><img src="assets/fusion-ace.png" alt="融合球员概念插画" /><span>LV.{stage}</span></div>
          <div className="ace-summary">
            <div className="ace-score"><strong>{fusion.rating}</strong><span><b>综合战力</b><br /><em>{talentName}</em></span></div>
            <small>{fusion.bondCount} 组羁绊生效</small>
          </div>
        </div>
        <div className="ace-detail">
          <div className="ace-section-label">融合六项 <small>升星、训练与换位</small></div>
          <div className="ace-stat-grid">{attrStats.map((item) => <span key={item.id}>{item.label} <b>{item.value}</b></span>)}</div>
          <div className="ace-section-label">单挑战力 <small>技能、羁绊与装备</small></div>
          <div className="ace-combat-grid">{combatStats.map((item) => <span key={item.id}>{item.label} <b>{item.value}</b></span>)}</div>
        </div>
        <SignaturePanel moves={moves} embedded />
      </div>
      <div className="sectionhead duel-foe-heading"><h2>本关对手</h2><span>基础战力 {fusion.rating} : {foe.rating}</span></div>
      <div className="panel opponent">
        <div className="eyebrow">本关对手 · OVR {foe.rating}{foe.stars > 1 ? ` · ${foe.stars}★` : ''}</div>
        <strong>{foe.name}</strong>
        <p>三分 {foe.stats.three} · 突破 {foe.stats.drive} · 防守 {foe.stats.def}</p>
        <div className="opponent-combat">{foeCombat.map((item) => <span key={item.id}>{item.label} {item.value}</span>)}</div>
        <span className="versus">VS</span>
      </div>
      <div className="floatingaction"><button className="btn wide" data-act="battle">开始自动单挑 →</button></div>
    </>
  );
}

function ResultAction({ ended, final, won }) {
  if (ended) return <button className="btn wide" data-act="home">查看档案 / 返回首页 →</button>;
  if (final) {
    return <div className="result-actions"><button className="btn dark" data-act="finish">本局结算</button><button className="btn" data-act="next">进入无尽 →</button></div>;
  }
  return <button className="btn wide" data-act={won ? 'next' : 'retry'}>{won ? '下一关整备' : '整备重试'} →</button>;
}

function ResultScreen({ report, won, ended, final, wins, losses, beatText, strategyName, strategyEffect }) {
  return (
    <>
      <div className="result-card panel">
        <div className="result-top"><b>11 分制 · 一局定胜负<br />最终比分</b><span>比赛结果{won && <><br /><strong>挑战成功</strong></>}</span></div>
        <div className="result-scoreboard">
          <div className="result-side"><div className="result-avatar you-avatar"><img src="assets/fusion-ace.png" alt="融合球员概念插画" /></div><strong>终极融合体</strong><small>阵容：融合王牌</small></div>
          <div className="result-middle"><div className="score">{report.us}<span>:</span>{report.them}</div><b>{won ? '胜利' : '失败'}</b></div>
          <div className="result-side"><div className="result-avatar opp-avatar"><img src="assets/rival-forward.png" alt="对手概念插画" /></div><strong>{report.foeName}</strong><small>OVR {report.foeRating}{report.foeStars > 1 ? ` · ${report.foeStars}★` : ''}</small></div>
        </div>
        <div className="result-strategy"><span>▣ {beatText}：{strategyName}</span><b>{strategyEffect}</b></div>
      </div>
      <div className="sectionhead result-timeline-title"><h2>关键回合</h2></div>
      <div className="timeline">
        {!!report.signatures?.length && <div className="timeline-signatures">{report.signatures.map((move) => <span key={move.id}>{move.kind === 'offense' ? '进攻' : '防守'} · <b>{move.name}</b>　触发 {move.uses} 次</span>)}</div>}
        {report.log.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
      </div>
      {ended && <div className="panel result-summary">本局 {wins} 胜 {losses} 负，获得 {report.legendEarned || 0} 传奇点。</div>}
      {final && <div className="panel result-summary">主线十关完成！可以带当前阵容进入无尽，或结算本局。</div>}
      <div className="result-dock">
        <div className="panel battle-reward"><div className="battle-reward-main"><span className="shopicon">＄</span><div><strong>本场奖金 +{report.reward}</strong><small>{report.detail.join(' · ')}</small></div></div></div>
        <ResultAction ended={ended} final={final} won={won} />
      </div>
    </>
  );
}

export function installReactScreens() {
  if (window.SupFusionReactScreens) return window.SupFusionReactScreens;

  window.SupFusionReactScreens = Object.freeze({
    renderHome(element, props) {
      renderInto(element, <HomeScreen {...props} />);
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
    renderMarkup(element, html) {
      renderInto(element, <MarkupScreen html={html} />);
    }
  });

  return window.SupFusionReactScreens;
}
