const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, suffix) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, suffix);
    return full.endsWith(suffix) ? [full] : [];
  });
}

function extract(source, regex) {
  return new Set([...source.matchAll(regex)].map((match) => match[1]));
}

const jsFiles = [
  ...walk(path.join(ROOT, 'electron'), '.js'),
  ...walk(path.join(ROOT, 'src'), '.js'),
];

for (const file of jsFiles) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

const electronSource = walk(path.join(ROOT, 'electron'), '.js')
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
const main = fs.readFileSync(path.join(ROOT, 'electron', 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(ROOT, 'electron', 'preload.js'), 'utf8');

const handled = extract(main, /(?:ipcMain\.(?:handle|on)|safeHandle|safeOn)\(\s*['"]([^'"]+)['"]/g);
const invoked = extract(preload, /ipcRenderer\.(?:invoke|send)\(\s*['"]([^'"]+)['"]/g);
const emitted = extract(electronSource, /(?:webContents\.send|sendToRenderer|send)\(\s*['"]([^'"]+)['"]/g);
const observed = extract(preload, /ipcRenderer\.on\(\s*['"]([^'"]+)['"]/g);

const missingHandlers = [...invoked].filter((channel) => !handled.has(channel));
const missingEmitters = [...observed].filter((channel) => !emitted.has(channel));

if (missingHandlers.length || missingEmitters.length) {
  if (missingHandlers.length) {
    console.error(`Canais sem handler no main: ${missingHandlers.join(', ')}`);
  }
  if (missingEmitters.length) {
    console.error(`Eventos sem emissor no main: ${missingEmitters.join(', ')}`);
  }
  process.exitCode = 1;
} else {
  console.log(`OK: ${jsFiles.length} arquivos JavaScript e ${invoked.size + observed.size} canais IPC validados.`);
}
