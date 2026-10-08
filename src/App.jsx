import { startGameRuntime } from './runtime-loader.js';
import { installReactScreens } from './react-screens.jsx';

const screens = ['home', 'leaderboard', 'talent', 'recruit', 'roster', 'shop', 'duel', 'result', 'report', 'profile', 'pointshop'];

export function startApplication() {
    const reportRuntimeError = (reason) => {
      console.error(reason);
      const detail = reason?.message || String(reason || 'unknown error');
      let panel = document.getElementById('page-load-error');
      if (!panel) {
        const page = document.createElement('main');
        page.className = 'screen active';
        panel = document.createElement('div');
        panel.id = 'page-load-error';
        panel.className = 'panel page-load-error m-5 p-5 text-center';
        page.appendChild(panel);
        document.getElementById('page-root').appendChild(page);
      }
      panel.textContent = import.meta.env.DEV ? `页面加载失败：${detail}` : '页面加载失败，请刷新后重试。';
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
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
}

export default function App() {
  return (
    <>
      <div className="app home-mode">
        <header className="top" />
        <div id="page-root" className="contents">
          {screens.map((screen) => <main id={screen} className={`screen${screen === 'home' ? ' active' : ''}`} key={screen} />)}
        </div>
      </div>
      <div id="batch-action-root" hidden />
    </>
  );
}
