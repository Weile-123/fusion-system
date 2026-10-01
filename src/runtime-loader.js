export async function startGameRuntime() {
  window.ACTIVITY_API_BASE = String(import.meta.env.VITE_ACTIVITY_API_BASE || '').trim();
  window.ACTIVITY_ENV_ID = String(import.meta.env.VITE_ACTIVITY_ENV_ID || '').trim();
  await import('../h5/storage-adapter.js');
  await import('../h5/game-data.js');
  await import('../h5/gear-catalog.js');
  await import('../h5/game-core.js');
  await import('../h5/game-ui.js');
}
