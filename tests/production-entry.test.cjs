const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('production chunks initialize event globals before the browser game core', () => {
  const result = execFileSync(process.execPath, ['--experimental-vm-modules', '-e', `
    const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
    const context = vm.createContext({ window: {}, console });
    const files = fs.readdirSync('dist/assets');
    (async () => {
      for (const prefix of ['game-data-', 'gear-catalog-', 'event-data-', 'event-system-', 'game-core-']) {
        const file = files.find(name => name.startsWith(prefix) && name.endsWith('.js'));
        assert.ok(file, 'Missing production chunk: ' + prefix);
        const module = new vm.SourceTextModule(fs.readFileSync('dist/assets/' + file, 'utf8'), { context });
        await module.link(() => { throw new Error('Unexpected static dependency'); });
        await module.evaluate();
      }
      const core = context.window.SupFusionGameCore;
      assert.equal(context.window.SupFusionEventData.length, 36);
      assert.equal(typeof context.window.SupFusionEventSystem.createSystem, 'function');
      assert.equal(core.EVENTS.length, 36);
      assert.equal(core.BALANCE_RULES_VERSION, 6);
      assert.equal(core.createRun('steady_interest', 911).balanceRulesVersion, 6);
      console.log('Production browser modules initialized');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8' });
  assert.match(result, /Production browser modules initialized/);
});
