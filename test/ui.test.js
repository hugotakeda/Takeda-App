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
