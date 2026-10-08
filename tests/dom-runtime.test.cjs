const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');

const { documentFixture } = require('./dom-fixture.cjs');

test('DOM renderer preserves keyed elements, scroll state, styles and disabled state', async () => {
  const { createRoot, createElement: h } = await import('../src/dom-runtime.mjs');
  const { element } = documentFixture(), root = createRoot(element);
  root.render(h('section', null, h('button', { key: 'a', disabled: true }, 'A'), h('button', { key: 'b' }, 'B')));
  const section = element.childNodes[0], [a, b] = section.childNodes;
  section.scrollTop = 37;
  root.render(h('section', null, h('button', { key: 'b', style: { '--round-order': 2 } }, 'B2'), h('button', { key: 'a', disabled: false }, 'A2')));
  assert.equal(element.childNodes[0], section);
  assert.equal(section.scrollTop, 37);
  assert.deepEqual(section.childNodes, [b, a]);
  assert.equal(a.attributes.disabled, undefined);
  assert.equal(b.styles['--round-order'], '2');
  assert.equal(section.textContent, 'B2A2');
  root.render(h('section', null, h('button', { key: 'b' }, 'B3')));
  assert.equal(b.styles['--round-order'], undefined);
  assert.equal(a.parentNode, null);
});

test('SVG hearts and clip paths use the browser SVG namespace and retain correct attributes', async () => {
  const { createRoot, createElement: h } = await import('../src/dom-runtime.mjs');
  const { element, svgTemplate } = documentFixture();
  createRoot(element).render(h('svg', { viewBox: '0 0 24 24' }, h('defs', null, h('clipPath', { id: 'heart' }, h('path', { d: 'M0 0' }))), h('rect', { clipPath: 'url(#heart)', strokeWidth: 2 })));
  const svg = element.childNodes[0], clip = svg.childNodes[0].childNodes[0], rect = svg.childNodes[1];
  assert.equal(svg.namespaceURI, svgTemplate.namespaceURI);
  assert.equal(clip.namespaceURI, svgTemplate.namespaceURI);
  assert.equal(clip.type, 'clipPath');
  assert.equal(svg.attributes.viewBox, '0 0 24 24');
  assert.equal(rect.attributes['clip-path'], 'url(#heart)');
  assert.equal(rect.attributes['stroke-width'], '2');
});

test('untrusted text remains text and unsupported HTML/event properties fail closed', async () => {
  const { createRoot, createElement: h } = await import('../src/dom-runtime.mjs');
  const { element } = documentFixture(), root = createRoot(element);
  const attack = '<img src=x onerror=alert(1)>';
  root.render(h('p', null, attack));
  assert.equal(element.childNodes[0].childNodes[0].type, '#text');
  assert.equal(element.textContent, attack);
  for (const property of ['dangerouslySetInnerHTML', 'innerHTML', 'outerHTML', 'srcdoc', 'onClick']) {
    assert.throws(() => root.render(h('p', { [property]: attack })), /Unsupported DOM property/);
  }
});

test('actual game JSX mounts through the shipped renderer including talent buttons and full hearts', async () => {
  const runtime = await import('../src/dom-runtime.mjs');
  const source = fs.readFileSync('src/react-screens.jsx', 'utf8') + '\nexport { HomeScreen, TalentScreen, TopBar, MarkupScreen };';
  const code = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'transform', jsxFactory: 'createElement', jsxFragment: 'Fragment' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => { assert.equal(name, './dom-runtime.mjs'); return runtime; }, module, module.exports);
  const { HomeScreen, TalentScreen, TopBar, MarkupScreen } = module.exports;
  const C = require('../h5/game-core.js');
  const { element } = documentFixture(), root = runtime.createRoot(element);
  root.render(runtime.createElement(HomeScreen, { active: false, storageMessage: '存档可用' }));
  assert.match(element.textContent, /排行榜/);
  for (const talent of C.TALENTS) {
    root.render(runtime.createElement(TalentScreen, { offer: [talent], selectedTalent: talent.id, unlockedCount: 20, totalCount: 20, talentAdBusy: false }));
    assert.match(element.textContent, /确认天赋/);
  }
  root.render(runtime.createElement(TopBar, { hasRun: true, screen: 'roster', morale: 4, moraleMax: 3 }));
  assert.match(element.textContent, /3\/3 \+1/);
  root.render(runtime.createElement(MarkupScreen, { html: '<p title="safe" onclick="bad">&lt;script&gt;name&lt;/script&gt;</p>' }));
  assert.equal(element.textContent, '<script>name</script>');
  assert.equal(element.childNodes[0].attributes.onclick, undefined);
});

test('release JavaScript excludes React diagnostics, W3C URL literals and HTML write sinks', () => {
  const files = fs.readdirSync('dist/assets').filter(file => file.endsWith('.js'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = fs.readFileSync(path.join('dist/assets', file), 'utf8');
    assert.doesNotMatch(source, /react\.dev|www\.w3\.org|Minified React error/);
    assert.doesNotMatch(source, /\.(?:innerHTML|outerHTML)\s*=|\[\s*['"](?:innerHTML|outerHTML)['"]\s*\]\s*=|\.insertAdjacentHTML\s*\(/);
  }
});
