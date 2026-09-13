const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

async function loadUiModule() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('escapeHtml neutralizes markup in data returned by IPC', async () => {
  const { escapeHtml } = await loadUiModule();
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)"> & \'quoted\''),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#039;quoted&#039;'
  );
});

test('safeExternalUrl rejects executable protocols', async () => {
  const { safeExternalUrl } = await loadUiModule();
  assert.equal(safeExternalUrl('javascript:alert(1)', 'fallback'), 'fallback');
  assert.equal(safeExternalUrl('file:///C:/Windows/System32', 'fallback'), 'fallback');
  assert.equal(safeExternalUrl('http://example.com/avatar.png', 'fallback'), 'fallback');
  assert.equal(safeExternalUrl('https://user:secret@example.com/avatar.png', 'fallback'), 'fallback');
  assert.match(safeExternalUrl('https://example.com/avatar.png'), /^https:\/\//);
});

test('formatBytes handles malformed and very large values', async () => {
  const { formatBytes } = await loadUiModule();
  assert.equal(formatBytes(undefined), '0 B');
  assert.equal(formatBytes(-1), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1024 ** 5), '1 PB');
});

test('tools keep every category visible and long option lists scrollable', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
  const tools = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Tools.js'), 'utf8');
  const tabRail = css.match(/#tools-subtabs\s*\{([^}]+)\}/)?.[1] || '';
  const subview = css.match(/#tools-subview\s*\{([^}]+)\}/)?.[1] || '';
  const scrollRegion = css.match(/#tools-subview\s*>\s*\.tool-page-content\s*\{([^}]+)\}/)?.[1] || '';

  assert.match(tabRail, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(subview, /display:\s*flex/);
  assert.match(subview, /flex-direction:\s*column/);
  assert.match(subview, /min-height:\s*0/);
  assert.match(scrollRegion, /overflow-y:\s*auto/);
  assert.match(scrollRegion, /overscroll-behavior:\s*contain/);
  assert.match(tools, /tabName:\s*'Debloat'/);
  assert.match(tools, /\['ArrowLeft',\s*'ArrowRight',\s*'Home',\s*'End'\]/);
});

test('dashboard exposes the power plan directly below the diagnostic action', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const analyzeIndex = app.indexOf('id="btn-run-diag"');
  const powerIndex = app.indexOf('id="btn-open-power-plan"');

  assert.ok(analyzeIndex >= 0, 'diagnostic action should exist');
  assert.ok(powerIndex > analyzeIndex, 'power plan action should follow the diagnostic action');
  assert.doesNotMatch(app, /data-page="powerplan"/);
  assert.match(app, /getElementById\('btn-open-power-plan'\).*openPowerPlanModal/);
});

test('secure deletion warning uses a compact resilient card layout', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
  const shredder = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Shredder.js'), 'utf8');
  const warning = css.match(/\.destructive-warning\s*\{([^}]+)\}/)?.[1] || '';
  const copy = css.match(/\.destructive-warning-copy\s*\{([^}]+)\}/)?.[1] || '';

  assert.match(shredder, /class="destructive-warning" role="note"/);
  assert.match(warning, /display:\s*grid/);
  assert.match(warning, /grid-template-columns:\s*34px\s+minmax\(0,\s*1fr\)/);
  assert.match(warning, /font-size:\s*0\.65rem/);
  assert.match(copy, /overflow-wrap:\s*anywhere/);
});

test('app category rail has adaptive overflow controls and keyboard navigation', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
  const apps = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Apps.js'), 'utf8');
  const rail = css.match(/\.apps-tabs\s*\{([^}]+)\}/)?.[1] || '';

  assert.match(apps, /id="apps-tabs-previous"/);
  assert.match(apps, /id="apps-tabs-next"/);
  assert.match(apps, /\['ArrowRight'\]|event\.key === 'ArrowRight'/);
  assert.match(apps, /event\.key === 'End'/);
  assert.match(apps, /const revealTab =/);
  assert.match(apps, /tabRail\.scrollTo/);
  assert.match(rail, /overflow-x:\s*auto/);
  assert.match(rail, /scroll-snap-type:\s*x\s+proximity/);
});
