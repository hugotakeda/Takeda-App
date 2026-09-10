const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('disk analyzer scans a directory once and reports consistent totals', async (context) => {
  if (process.platform !== 'win32') {
    context.skip('Recurso específico do Windows');
    return;
  }

  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'takeda-disk-test-'));
  assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
  try {
    await fs.mkdir(path.join(fixture, 'nested'));
    await fs.writeFile(path.join(fixture, 'root.txt'), Buffer.alloc(11));
    await fs.writeFile(path.join(fixture, 'nested', 'child.bin'), Buffer.alloc(29));

    const analyzer = require(path.join(ROOT, 'electron', 'services', 'diskAnalyzer.js'));
    const result = await analyzer.scanFolder(fixture);
    assert.equal(result.totalSize, 40);
    assert.equal(result.children.reduce((sum, item) => sum + Number(item.size || 0), 0), 40);
    assert.deepEqual(result.topFiles.map((item) => Number(item.size)).sort((a, b) => a - b), [11, 29]);
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});

test('elevated PowerShell payload encoding is lossless', () => {
  const { encodePowerShell } = require(path.join(ROOT, 'electron', 'services', 'elevated.js'));
  const source = "$ErrorActionPreference = 'Stop'\nWrite-Output 'Takeda'";
  assert.equal(Buffer.from(encodePowerShell(source), 'base64').toString('utf16le'), source);
});
