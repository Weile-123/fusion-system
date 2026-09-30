const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const screen = process.argv[2] || 'home';
const output = path.resolve(process.argv[3] || `layout-${screen}.png`);
const previewHeight = Number(process.argv[4]) || 844;
if (!['home', 'talent', 'talentcatalog', 'shop', 'gear', 'gearsold', 'my', 'myreserve', 'myjersey', 'roster', 'rosterfull', 'recruit', 'result', 'profile'].includes(screen)) throw Error('Unknown screen');
const root = path.resolve(__dirname, '..');
const htmlFile = path.join(root, `h5/.layout-preview-${screen}.html`);
const uiFile = path.join(root, `h5/.layout-preview-${screen}-ui.js`);
const profileDir = path.join(root, `.tmp-edge-layout-${screen}`);
const source = fs.readFileSync(path.join(root, 'h5/index.html'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'h5/game-ui.js'), 'utf8');
const script = `<script>setTimeout(() => {
  const click = (action, selector = '') => document.querySelector('[data-act="' + action + '"]' + selector)?.click();
  if ('${screen}' === 'home') return;
  click('new');
  if ('${screen}' === 'talent') return;
  if ('${screen}' === 'talentcatalog') { click('talent-catalog'); return; }
  click('begin');
  if ('${screen}' === 'recruit') return;
  for (let i = 0; i < 6; i++) click('pick');
  const r = window.__preview.game().run;
  r.cash = 43;
  if ('${screen}' === 'profile') { click('home'); click('profile'); return; }
  window.__preview.go('roster');
  if ('${screen}' === 'roster') return;
  if ('${screen}' === 'rosterfull') {
    r.benchLimit = 10;
    const fillers = window.SupFusionGameCore.STARS.filter(star => !r.owned[star.id]).slice(0, 10);
    for (const star of fillers) { r.owned[star.id] = { stars: 1, train: 0, trainedAt: 0 }; r.bench.push(star.id); }
    window.__preview.go('roster');
    document.getElementById('benchGrid').scrollTop = 999;
    document.getElementById('roster').scrollTop = 230;
    return;
  }
  if ('${screen}' === 'shop') { click('shop'); return; }
  if ('${screen}' === 'gear') { click('shop'); click('shop-tab', '[data-id="gear"]'); click('buy-gear'); return; }
  if ('${screen}' === 'gearsold') { r.cash = 200; r.shopOffers.gear = ['kobe_wrist', 'wrist', 'deep_wrist']; click('shop'); click('shop-tab', '[data-id="gear"]'); click('buy-gear', '[data-id="kobe_wrist"]'); return; }
  if ('${screen}' === 'my') { click('shop'); click('shop-tab', '[data-id="my"]'); return; }
  if ('${screen}' === 'myreserve') { r.cash = 200; r.shopOffers.gear = ['curry_wrist', 'kobe_sleeve']; window.SupFusionGameCore.buyGear(r, 'curry_wrist'); window.SupFusionGameCore.buyGear(r, 'kobe_sleeve'); r.gearReserve.push('jordan_sleeve'); click('shop'); click('shop-tab', '[data-id="my"]'); return; }
  if ('${screen}' === 'myjersey') { r.gear = ['kobe_wrist']; r.gearReserve = ['kobe_sleeve', 'curry_wrist']; click('shop'); click('shop-tab', '[data-id="my"]'); return; }
  click('duel'); click('battle'); click('strategy');
}, 500);</script>`;
fs.writeFileSync(uiFile, uiSource.replace('  init();', '  window.__preview={game:()=>game,go}; init();'));
fs.writeFileSync(htmlFile, source.replace('<script src="storage-adapter.js"></script>',
  '<script>window.FusionStorage={available:()=>false,save:async()=>{},load:async()=>null};</script>')
  .replace('<script src="page-loader.js"></script>',
    `<script>window.SupFusionUiScript='${path.basename(uiFile)}';</script><script src="page-loader.js"></script>`)
  .replace('</body>', script + '</body>'));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const result = spawnSync(edge, ['--headless=old', '--disable-gpu', '--disable-gpu-compositing',
  '--disable-software-rasterizer', '--no-sandbox', '--no-first-run', '--virtual-time-budget=3000',
  `--window-size=500,${previewHeight}`, '--force-device-scale-factor=1', '--user-data-dir=' + profileDir,
  '--screenshot=' + output, 'file:///' + htmlFile.replace(/\\/g, '/')], { encoding: 'utf8', timeout: 30000 });
fs.unlinkSync(htmlFile);
fs.unlinkSync(uiFile);
if (!profileDir.startsWith(root + path.sep)) throw Error('Unsafe browser profile path');
fs.rmSync(profileDir, { recursive: true, force: true });
if (result.status !== 0 || !fs.existsSync(output)) throw Error(result.stderr.slice(-800));
console.log(output);
