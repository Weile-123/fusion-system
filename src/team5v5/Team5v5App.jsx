import { useEffect, useRef, useState } from 'react';
import * as C from './core.mjs';
import { loadGame, saveGame } from './storage.mjs';
import { modeLink } from '../mode-links.js';
import './styles.css';

const strategyNames = { balanced: '均衡攻防', space: '外线空间', paint: '内线强攻', transition: '快速转换' };
const slotNames = { shoes: '战靴', protect: '护具', board: '战术板', jersey: '球衣' };
const tierClass = tier => `t5-tier-${tier.toLowerCase()}`;
function Button({ children, secondary = false, ...props }) { return <button {...props} className={`t5-button${secondary ? ' t5-secondary' : ''}${props.className ? ` ${props.className}` : ''}`}>{children}</button>; }
function Panel({ children, className = '' }) { return <section className={`t5-panel ${className}`}>{children}</section>; }
export function ModeHub() {
  return <main className="team5v5 t5-hub"><div className="t5-hub-ball" aria-hidden="true" /><div className="t5-kicker">HOOP LEGEND</div><h1>我的球星<br /><em>融合系统</em></h1><p className="t5-muted">选择你的篮球旅程</p><a className="t5-mode-card" href={modeLink('fusion')}><span className="t5-kicker">FUSION · 经典玩法</span><h2>融合单挑 <span>→</span></h2><p>六项能力融合，打造你的终极王牌</p></a><a className="t5-mode-card t5-mode-new" href={modeLink('5v5')}><span className="t5-kicker">DYNASTY · 新玩法</span><h2>5v5 王朝 <span>→</span></h2><p>五人首发 · 十人替补 · 团队篮球</p><div className="t5-position-badges">{C.POSITIONS.map(p => <b key={p}>{p}</b>)}</div></a><p className="t5-muted t5-center">两种模式分别保留进度</p></main>;
}
function PlayerCard({ player, card, run, pos, onClick, selected, label }) {
  return <button className={`t5-player ${tierClass(player.tier)}${selected ? ' t5-selected' : ''}`} onClick={onClick}><div className="t5-player-top"><b>{label || pos || player.pos}</b><span>{player.tier} · {card?.star || 1}★</span></div><strong className="t5-player-ovr">{C.playerOVR(run || { talent: null, teamGear: {} }, card || { id: player.id, star: 1, training: 0, gear: [] }, pos || player.pos)}</strong><h3>{player.name}</h3><small>{player.team} · {player.pos}{player.secondary.length ? ` / ${player.secondary.join(' / ')}` : ''}</small>{card && <div className="t5-player-bottom">训练 {card.training}{card.gear.length > 0 ? ` · 装备 ${card.gear.length}` : ''}{pos && <span>适配 {Math.round(C.fit(player, pos, run) * 100)}%</span>}</div>}</button>;
}
function Modal({ title, children, close }) { return <div className="t5-overlay" onClick={close}><section className="t5-modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><header><h2>{title}</h2><button aria-label="关闭" onClick={close}>×</button></header>{children}</section></div>; }

export default function Team5v5App() {
  const [game, setGame] = useState(null), [home, setHome] = useState(true), [tab, setTab] = useState('roster');
  const [notice, setNotice] = useState(''), [modal, setModal] = useState(null), [selectedTalent, setSelectedTalent] = useState(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [name, setName] = useState('玩家');
  const ref = useRef(null), saveQueue = useRef(Promise.resolve()), noticeTimer = useRef(null), busy = useRef(false);
  const scrollRoot = useRef(null);
  function toast(message) { setNotice(message); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 3200); }
  useEffect(() => {
    let live = true;
    loadGame().then(value => { if (live) { const g = value || C.freshGame(); ref.current = g; setGame(g); } }).catch(() => { if (live) { const g = C.freshGame(); ref.current = g; setGame(g); } });
    const api = window.ColorboxAI?.auth;
    if (api?.getUserInfo) Promise.resolve().then(() => api.getUserInfo()).then(v => { if (!live) return; if (v.code !== 200) toast(v.message || '暂时无法获取用户信息'); else if (v.data?.islogin === 1) setName(v.data.nickname?.trim().slice(0, 30) || '玩家'); }).catch(() => { if (live) toast('暂时无法获取用户信息'); });
    return () => { live = false; clearTimeout(noticeTimer.current); };
  }, []);
  useEffect(() => { scrollRoot.current?.scrollTo({ top: 0 }); }, [home, tab, game?.run?.phase]);
  function commit(next) {
    ref.current = next; setGame(next); setSaving(true); setSaveError('');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveGame(next)).then(() => { if (ref.current === next) setSaving(false); }).catch(error => { setSaving(false); setSaveError(error.message); });
  }
  function action(type, payload) { if (busy.current) return false; busy.current = true; try { commit(C.act(ref.current, type, payload)); return true; } catch (error) { toast(error.message); return false; } finally { busy.current = false; } }
  function begin() { commit(C.startRun(ref.current)); setHome(false); setTab('roster'); setModal(null); setSelectedTalent(null); }
  const r = game?.run, phase = r?.phase, ready = !home && r;
  const card = modal?.uid ? r?.cards.find(c => c.uid === modal.uid) : null;
  function close() { setModal(null); }
  const equipmentText = item => Object.entries(item.stats).map(([key, value]) => `${C.LABELS[C.ATTRS.indexOf(key)]} +${value}`).join(' · ');
  const activeBonds = r ? C.bonds(C.starters(r).map(c => C.BY_ID[c.id])) : [];
  const allBonds = r ? C.bonds(r.cards.map(c => C.BY_ID[c.id])) : [];
  if (!game) return <main className="team5v5 t5-loading"><span className="t5-spinner" />载入王朝存档…</main>;
  return <main className="team5v5" ref={scrollRoot}>
    {(home || !['talent', 'draft'].includes(phase)) && <header className="t5-top"><button onClick={() => { setHome(true); close(); }}>5v5 王朝</button><div>{ready ? <><b>OVR {C.teamOVR(r)}</b><span>第 {r.stage} 关</span><span className="t5-gold">奖金 {r.gold}</span><span className="t5-heart">♥ {r.morale}/3</span></> : <a href={modeLink(null)}>切换模式 ↗</a>}</div></header>}
    <div className="t5-content">
      {home ? <>
        <section className="t5-hero"><div className="t5-kicker">BUILD YOUR DYNASTY</div><h1>五人一心<br /><em>建立王朝</em></h1><p>招募巨星，组建五人首发。<br />以团队之名，挑战十关与无尽赛场。</p><div className="t5-position-badges">{C.POSITIONS.map(p => <b key={p}>{p}</b>)}</div></section>
        <Panel><div className="t5-records"><div><small>传奇点</small><b>{game.profile.legend}</b></div><div><small>最高 OVR</small><b>{game.profile.bestOVR}</b></div><div><small>最远关卡</small><b>{game.profile.bestStage}</b></div></div></Panel>
        {r && !r.ended && <Button onClick={() => { setHome(false); setTab('roster'); }}>继续征程 · 第 {r.stage} 关 →</Button>}
        <Button secondary={r && !r.ended} onClick={() => r && !r.ended ? setModal({ type: 'restart' }) : begin()}>开启王朝征程 →</Button>
        {r?.ended && <Button secondary onClick={() => setHome(false)}>查看上局报告</Button>}
        <p className="t5-muted t5-center">{name} · 王朝生涯 {game.profile.runs} 局 · 获胜 {game.profile.wins} 场</p>
      </> : phase === 'talent' ? <>
        <div className="t5-heading"><span className="t5-kicker">NEW DYNASTY</span><h1>选择你的建队路线</h1><button className="t5-text-button" onClick={() => setHome(true)}>返回</button></div>
        {r.talentChoices.map(id => { const t = C.TALENTS.find(t => t.id === id); return <button key={id} className={`t5-talent${selectedTalent === id ? ' t5-selected' : ''}`} onClick={() => setSelectedTalent(id)}><h2>✦ {t.name}</h2><p>{t.text}</p></button>; })}
        <Button secondary disabled={!selectedTalent} onClick={() => action('talent', selectedTalent)}>确认天赋</Button>
      </> : ['draft', 'recruit'].includes(phase) ? <>
        <div className="t5-heading"><span className="t5-kicker">DRAFT · 招募</span><h1>{phase === 'draft' ? `选择首发 ${C.POSITIONS[r.draftIndex]}` : '选择一名球员'}</h1><p>{phase === 'draft' ? `首发拼图 ${r.draftIndex + 1} / 5` : '重复球员升星，新球员加入替补席'}</p></div>
        <div className="t5-grid">{r.choices.map(id => <PlayerCard key={id} player={C.BY_ID[id]} onClick={() => { if (action('pick', id)) toast('球员已加入阵容'); }} />)}</div>
        <p className="t5-muted">点击卡片确认招募</p>
      </> : phase === 'roster' ? <>
        <div className="t5-tabs">{[['roster', '阵容'], ['shop', '装备商店'], ['battle', '对战']].map(([key, title]) => <button key={key} onClick={() => setTab(key)} className={tab === key ? 't5-active' : ''}>{title}</button>)}</div>
        {tab === 'roster' ? <>
          <div className="t5-section-title"><h2>首发阵容 <small>5 / 5</small></h2><b className="t5-gold">OVR {C.teamOVR(r)}</b></div>
          <div className="t5-court"><div className="t5-starters">{r.lineup.map((uid, index) => { const c = r.cards.find(c => c.uid === uid); return c ? <PlayerCard key={index} player={C.BY_ID[c.id]} card={c} run={r} pos={C.POSITIONS[index]} onClick={() => setModal({ type: 'player', uid })} /> : <button key={index} className="t5-empty" onClick={() => toast('招募球员以补全首发')}>{C.POSITIONS[index]}</button>; })}</div></div>
          <Panel><div className="t5-section-title"><h2>激活羁绊</h2><small>{activeBonds.length} 组</small></div><div className="t5-tags">{activeBonds.length ? activeBonds.map(b => <span title={equipmentText(b)} key={b.name}>{b.name}</span>) : <small className="t5-muted">同队两人或经典组合同时登场可激活羁绊</small>}</div>{allBonds.some(b => !activeBonds.some(a => a.name === b.name)) && <p className="t5-muted">待上阵：{allBonds.filter(b => !activeBonds.some(a => a.name === b.name)).map(b => b.name).join('、')}</p>}</Panel>
          <div className="t5-section-title"><h2>替补席</h2><small>{r.cards.length - 5} / 10</small></div>
          <div className="t5-grid">{r.cards.filter(c => !r.lineup.includes(c.uid)).map(c => <PlayerCard key={c.uid} player={C.BY_ID[c.id]} card={c} run={r} label={r.rotation.includes(c.uid) ? `轮换 ${C.POSITIONS[r.rotation.indexOf(c.uid)]}` : C.BY_ID[c.id].pos} onClick={() => setModal({ type: 'player', uid: c.uid })} />)}</div>
          {r.cards.length === 5 && <Panel><p className="t5-muted">招募替补，增加轮换深度；比赛每节会按体能轮换。</p></Panel>}
          <div className="t5-actions"><Button disabled={r.cards.length >= 15} onClick={() => action('recruit')}>招募球员 · {r.free ? '免费' : `${8 - (r.talent === 'bargain' ? 2 : 0)} 奖金`}</Button><Button secondary onClick={() => setTab('battle')}>准备比赛 →</Button></div>
          <Panel><h2>球队装备</h2><div className="t5-tags">{Object.entries(r.teamGear).map(([slot, id]) => <span className={tierClass(C.GEARS.find(g => g.id === id).tier)} key={slot}>{C.GEARS.find(g => g.id === id).name}</span>)}{!Object.keys(r.teamGear).length && <small className="t5-muted">暂无战术板和球衣</small>}</div></Panel>
        </> : tab === 'shop' ? <>
          <div className="t5-section-title"><h2>装备商店</h2><button className="t5-text-button" disabled={r.gold < 3} onClick={() => action('refresh')}>刷新 · 3 奖金</button></div>
          {r.shop.map((entry, index) => { const item = C.GEARS.find(g => g.id === entry.id); return <Panel key={`${index}-${item.id}`} className={tierClass(item.tier)}><div className="t5-shop-row"><div><small>{item.tier} · {slotNames[item.slot]}</small><h2>{item.name}</h2><p>{equipmentText(item)}</p></div><Button disabled={entry.bought || r.gold < item.cost} onClick={() => { if (action('buy', index)) toast('装备已放入仓库'); }}>{entry.bought ? '已售' : `${item.cost} 奖金`}</Button></div></Panel>; })}
          <h2>装备仓库 <small>{r.gear.length} 件</small></h2>
          {r.gear.map((id, index) => { const item = C.GEARS.find(g => g.id === id); return <Panel key={`${id}-${index}`} className={tierClass(item.tier)}><div className="t5-shop-row"><div><h3>{item.name}</h3><small>{equipmentText(item)}</small></div><Button secondary onClick={() => ['board', 'jersey'].includes(item.slot) ? action('equip', { id }) : setModal({ type: 'equip', id })}>装备</Button></div></Panel>; })}
          {!r.gear.length && <Panel><p className="t5-muted">仓库暂无装备</p></Panel>}
        </> : <>
          <Panel className="t5-opponent"><span className="t5-kicker">{r.endless ? 'ENDLESS' : 'SEASON'} · 第 {r.stage} 关</span><h1>{C.opponent(r).name}</h1><div className="t5-versus"><span>我方 <b>{C.teamOVR(r)}</b></span><strong>VS</strong><span>对手 <b>{C.opponent(r).ovr}</b></span></div><div className="t5-tags">{C.opponent(r).players.map(p => <span key={p.id}>{p.pos} {p.name}</span>)}</div></Panel>
          <h2>本场战术</h2><div className="t5-grid">{Object.entries(strategyNames).map(([id, text]) => <button key={id} className={`t5-tactic${r.strategy === id ? ' t5-selected' : ''}`} onClick={() => action('strategy', id)}><b>{text}</b><small>{ { balanced: '内外结合，稳定出手', space: '提高三分出手占比', paint: '以内线能力决定终结', transition: '体能越好，快攻越强' }[id]}</small></button>)}</div>
          <Panel><label className="t5-check"><input type="checkbox" checked={r.autoRotate} onChange={() => action('toggleRotation')} />节间自动轮换</label><p className="t5-muted">优先使用指定替补；未指定时选择适配位置的替补。体能在本场比赛内消耗，战后恢复。</p></Panel>
          <Panel><h2>当前天赋：{C.TALENTS.find(t => t.id === r.talent)?.name}</h2><p className="t5-muted">{C.TALENTS.find(t => t.id === r.talent)?.text}</p></Panel>
          <Button onClick={() => action('battle')}>开始 5v5 比赛 →</Button><button className="t5-text-button" onClick={() => setModal({ type: 'retire' })}>结束本局并结算</button>
        </>}
      </> : phase === 'result' ? <>
        <span className="t5-kicker">第 {r.last.stage} 关 · {r.last.opponent}</span><h1 className="t5-center">{r.last.won ? '团队制胜' : '再战一场'}</h1><div className="t5-score"><strong>{r.last.score[0]}</strong><span>:</span><strong>{r.last.score[1]}</strong></div>
        <Panel><div className="t5-quarter-grid"><div><b>节次</b><span>我方</span><span>对手</span></div>{r.last.quarters.map((q, i) => <div key={i}><b>{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</b><span>{q.us}</span><span>{q.them}</span></div>)}</div></Panel>
        <Panel><div className="t5-section-title"><h2>本场最佳</h2><b className="t5-gold">{r.last.mvp}</b></div><p>奖金 +{r.last.reward} <small>（含利息 {r.last.interest}）</small> · {r.wins} 胜 {r.losses} 负</p></Panel>
        <BoxScore boxes={r.last.boxes} />
        {r.last.rotations.length > 0 && <Panel><h2>节间轮换</h2>{r.last.rotations.map((line, i) => <p className="t5-muted" key={i}>{line}</p>)}</Panel>}
        <Panel><h2>关键攻防 <small>全场 {r.last.attacks} 次攻防</small></h2>{r.last.logs.slice(-12).map((line, i) => <p className="t5-log" key={i} style={{ '--t5-order': i }}><small>{line.quarter <= 4 ? `Q${line.quarter}` : 'OT'} · 第{line.attack}次攻防</small><span>{line.text}</span><b>{line.score.join(':')}</b></p>)}</Panel>
        <Button onClick={() => { action('next'); setTab('roster'); }}>{r.morale <= 0 ? '查看生涯报告' : r.last.won && r.stage === 10 && !r.endless ? '王朝冠军 →' : r.last.won ? '进入下一关 →' : '调整阵容，再次挑战 →'}</Button>
      </> : phase === 'champion' ? <>
        <section className="t5-hero"><div className="t5-kicker">DYNASTY CHAMPION</div><h1>你的王朝<br /><em>已经诞生</em></h1><p>十关主线通关 · {r.wins} 胜 {r.losses} 负<br />继续无尽挑战，突破星级和训练上限。</p></section><Button onClick={() => action('endless')}>进入无尽挑战 →</Button><Button secondary onClick={() => action('finish')}>结算生涯报告</Button>
      </> : phase === 'report' ? <>
        <div className="t5-heading"><span className="t5-kicker">{name}的王朝生涯</span><h1>生涯报告</h1></div>
        <Panel><div className="t5-report-top"><div><small>达到第 {r.stage} 关</small><strong>{r.peakOVR}</strong><b>最高 OVR</b></div><div className="t5-records"><div><small>胜负记录</small><b>{r.wins} 胜 {r.losses} 负</b></div><div><small>招募球员</small><b>{r.recruitCount} 次</b></div><div><small>累计奖金</small><b>{r.income}</b></div><div><small>购买装备</small><b>{r.gearCount} 次</b></div></div></div></Panel>
        <Panel><h2>最终首发</h2><div className="t5-grid">{r.lineup.map((uid, i) => { const c = r.cards.find(v => v.uid === uid); return c && <PlayerCard key={uid} player={C.BY_ID[c.id]} card={c} run={r} pos={C.POSITIONS[i]} />; })}</div></Panel>
        <Panel><h2>激活羁绊</h2><div className="t5-tags">{activeBonds.map(b => <span key={b.name}>{b.name}</span>)}{!activeBonds.length && <small className="t5-muted">未激活羁绊</small>}</div></Panel>
        <Panel><h2>装备与球衣</h2><div className="t5-tags">{[...Object.values(r.teamGear), ...C.starters(r).flatMap(c => c.gear)].map((id, i) => { const item = C.GEARS.find(g => g.id === id); return <span className={tierClass(item.tier)} key={i}>{item.name}</span>; })}</div></Panel>
        <Panel className="t5-center"><h2 className="t5-gold">+{r.reward} 传奇点</h2><p className="t5-muted">王朝传奇点 {game.profile.legend}</p></Panel>
        <Button onClick={() => { setHome(true); }}>返回王朝主页</Button><Button secondary onClick={begin}>再建一支王朝</Button>
      </> : null}
      {saveError && <Panel><p role="alert">{saveError}</p><Button secondary onClick={() => commit(ref.current)}>重试保存</Button></Panel>}
      <p className="t5-save-state" aria-live="polite">{saving ? '保存中…' : saveError ? '' : '进度已保存'}</p>
    </div>
    {modal && <Modal title={modal.type === 'player' && card ? C.BY_ID[card.id].name : modal.type === 'equip' ? '选择装备球员' : modal.type === 'sell' ? '确认出售球员' : modal.type === 'retire' ? '结束本局' : '开启新征程'} close={close}>
      {modal.type === 'player' && card ? <>
        <PlayerCard player={C.BY_ID[card.id]} card={card} run={r} />
        <div className="t5-attributes">{Object.entries(C.playerStats(r, card, C.BY_ID[card.id].pos)).map(([key, value]) => <div key={key}><small>{C.LABELS[C.ATTRS.indexOf(key)]}</small><b>{value}</b></div>)}</div>
        <div className="t5-tags">{card.gear.map(id => <span key={id} className={tierClass(C.GEARS.find(g => g.id === id).tier)}>{C.GEARS.find(g => g.id === id).name}</span>)}</div>
        <label className="t5-field">安排首发位置<select value="" onChange={e => { if (action('lineup', { uid: card.uid, index: Number(e.target.value) })) close(); }}><option value="" disabled>选择位置（与原球员交换）</option>{C.POSITIONS.map((p, i) => <option key={p} value={i}>{p} · 适配 {Math.round(C.fit(C.BY_ID[card.id], p, r) * 100)}%</option>)}</select></label>
        {!r.lineup.includes(card.uid) && <label className="t5-field">指定节间轮换<select value={r.rotation.includes(card.uid) ? String(r.rotation.indexOf(card.uid)) : ''} onChange={e => action('rotation', { uid: e.target.value === '' ? null : card.uid, index: e.target.value === '' ? r.rotation.indexOf(card.uid) : Number(e.target.value) })}><option value="">不指定</option>{C.POSITIONS.map((p, i) => <option key={p} value={i}>{p} 替补</option>)}</select></label>}
        <Button disabled={r.trained.includes(card.uid) || card.training >= (r.endless ? Math.min(8, 3 + Math.floor((r.stage - 10) / 2)) : 3)} onClick={() => { if (action('train', card.uid)) toast('训练完成，前八项属性 +2'); }}>{r.trained.includes(card.uid) ? '本关已训练' : `训练 · ${C.trainingCost(r, card)} 奖金`}</Button>
        {!r.lineup.includes(card.uid) && <Button secondary onClick={() => setModal({ type: 'sell', uid: card.uid })}>出售球员</Button>}
      </> : modal.type === 'equip' ? <div className="t5-grid">{r.cards.map(c => <PlayerCard key={c.uid} player={C.BY_ID[c.id]} card={c} run={r} onClick={() => { if (action('equip', { id: modal.id, uid: c.uid })) { close(); toast('装备完成'); } }} />)}</div> : modal.type === 'sell' ? <><p>确认出售 {card && C.BY_ID[card.id].name}？装备将退回仓库。</p><Button onClick={() => { if (action('sell', modal.uid)) close(); }}>确认出售</Button><Button secondary onClick={close}>取消</Button></> : modal.type === 'retire' ? <><p>结束当前征程并领取本局传奇点。</p><Button onClick={() => { if (action('finish')) close(); }}>确认结算</Button><Button secondary onClick={close}>继续征程</Button></> : <><p>当前王朝征程尚未结束。开始新征程将覆盖本模式的当前进度。</p><Button onClick={begin}>确认开始</Button><Button secondary onClick={close}>继续当前征程</Button></>}
    </Modal>}
    {notice && <div className="t5-toast" role="status">{notice}</div>}
  </main>;
}
function BoxScore({ boxes }) { return <Panel><h2>球员数据</h2><div className="t5-table-scroll"><table className="t5-table"><thead><tr>{['球员', '得分', '篮板', '助攻', '抢断', '盖帽', '失误'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{boxes.filter(b => b.possessions > 0 || b.rebounds > 0 || b.assists > 0 || b.steals > 0 || b.blocks > 0).map(b => <tr key={b.uid}><td>{b.name}</td>{['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers'].map(k => <td key={k}>{b[k]}</td>)}</tr>)}</tbody></table></div></Panel>; }
