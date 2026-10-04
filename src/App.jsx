import { useEffect, useRef, useState } from 'react';
import { startGameRuntime } from './runtime-loader.js';
import { installReactScreens } from './react-screens.jsx';
import Team5v5App, { ModeHub } from './team5v5/Team5v5App.jsx';
import { modeLink } from './mode-links.js';

const screens = ['home', 'leaderboard', 'talent', 'recruit', 'roster', 'shop', 'duel', 'result', 'report', 'profile', 'pointshop'];

export default function App() {
  const mode = new URLSearchParams(window.location.search).get('mode');
  if (mode === '5v5') return <Team5v5App />;
  if (mode === 'fusion') return <ClassicApp />;
  return <ModeHub />;
}

function ClassicApp() {
  const pageRoot = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const reportRuntimeError = (reason) => {
      console.error(reason);
      if (!active) return;
      const detail = reason?.message || String(reason || 'unknown error');
      setError(import.meta.env.DEV ? `页面加载失败：${detail}` : '页面加载失败，请刷新后重试。');
    };
    const handleWindowError = (event) => reportRuntimeError(event.error || event.message);
    const handleUnhandledRejection = (event) => reportRuntimeError(event.reason);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    try {
      installReactScreens();
      startGameRuntime().catch(reportRuntimeError);
    } catch (reason) {
      reportRuntimeError(reason);
    }

    return () => {
      active = false;
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <>
      <div className="app home-mode">
        <a href={modeLink(null)} className="classic-mode-switch">切换模式</a>
        <header className="top" />
        <div id="page-root" className="contents" ref={pageRoot}>
          {screens.map((screen) => <main id={screen} className={`screen${screen === 'home' ? ' active' : ''}`} key={screen} />)}
          {error && <main className="screen active"><div className="panel page-load-error m-5 p-5 text-center">{error}</div></main>}
        </div>
      </div>
      <div id="batch-action-root" hidden />
    </>
  );
}
