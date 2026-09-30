export async function startGameRuntime() {
  await import('../h5/storage-adapter.js');
  await import('../h5/game-data.js');
  await import('../h5/gear-catalog.js');
  await import('../h5/game-core.js');
  await import('../h5/game-ui.js');
}
