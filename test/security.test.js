const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('production package enables Electron hardening fuses', () => {
  const pkg = require(path.join(ROOT, 'package.json'));
  assert.equal(pkg.build.asar, true);
  assert.deepEqual(pkg.build.electronFuses, {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
  });
});

test('renderer CSP blocks inline scripts and arbitrary connections', () => {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)/)?.[1] || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self' https:\/\/takeda-auth\.vercel\.app/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.match(csp, /object-src 'none'/);
});

test('shredder rejects protected targets and invalid passes', () => {
  const shredder = require(path.join(ROOT, 'electron', 'services', 'shredder.js'));
  const systemRoot = process.env.SYSTEMDRIVE || 'C:';
  const windowsDir = process.env.WINDIR || `${systemRoot}\\Windows`;

  assert.equal(shredder.isBlocked(path.join(windowsDir, 'System32')), true);
  assert.equal(shredder.isBlocked(`${systemRoot}\\`), true);
  assert.equal(shredder.isBlocked(os.homedir()), true);
  assert.equal(shredder.isBlocked('\\\\server\\share\\folder'), true);
  assert.equal(shredder.isBlocked(path.join(process.env.ProgramFiles || `${systemRoot}\\Program Files`, 'Anything')), true);
  assert.throws(() => shredder.validatePasses(0), /1 e 7/);
  assert.throws(() => shredder.validatePasses(8), /1 e 7/);
  assert.equal(shredder.validatePasses(3), 3);
});

test('installer target validation rejects shell metacharacters and insecure URLs', () => {
  const apps = require(path.join(ROOT, 'electron', 'services', 'apps.js'));
  assert.deepEqual(apps.validateInstallTarget('Valve.Steam'), { type: 'winget', value: 'Valve.Steam' });
  assert.throws(() => apps.validateInstallTarget('Valve.Steam"; calc; #'), /inválido/);
  assert.throws(() => apps.validateInstallTarget('http://example.com/file.exe'), /HTTPS/);
  assert.throws(() => apps.validateInstallTarget('https://user:secret@example.com/file.exe'), /credenciais/);
  assert.equal(apps.validateInstallTarget('https://example.com/file.exe').type, 'url');
});

test('power plan rejects renderer-controlled or non-POW paths before execution', async () => {
  const powerplan = require(path.join(ROOT, 'electron', 'services', 'powerplan.js'));
  assert.equal((await powerplan.apply('relative\\takeda.pow')).status, 'ERRO');
  assert.equal((await powerplan.apply(path.join(ROOT, 'assets', 'takeda.txt'))).status, 'ERRO');
  assert.equal((await powerplan.apply("C:\\fake.pow'; Start-Process calc; '")).status, 'ERRO');
});

test('registry cleaner only accepts capabilities from its allowlisted roots', () => {
  const registry = require(path.join(ROOT, 'electron', 'services', 'registry.js'));
  const valid = registry.normalizeOrphan({
    keyPath: 'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OldApp',
    displayName: 'Old App',
    checkedPath: 'C:\\Missing\\old.exe',
    category: 'uninstall',
  });
  assert.match(valid.id, /^orphan-/);
  assert.equal(registry.normalizeOrphan({
    keyPath: 'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
    displayName: 'Unsafe',
    checkedPath: 'C:\\Missing',
    category: 'uninstall',
  }), null);
  assert.equal(registry.normalizeOrphan({
    keyPath: 'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    displayName: 'Root itself',
    checkedPath: 'C:\\Missing',
    category: 'uninstall',
  }), null);
});

test('renderer templates do not use executable inline event handlers', () => {
  const renderer = [
    fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8'),
    ...fs.readdirSync(path.join(ROOT, 'src', 'pages'))
      .filter((name) => name.endsWith('.js'))
      .map((name) => fs.readFileSync(path.join(ROOT, 'src', 'pages', name), 'utf8')),
  ].join('\n');
  assert.doesNotMatch(renderer, /\son(?:click|error|load)\s*=/i);
});
