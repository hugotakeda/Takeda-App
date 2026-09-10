const { spawn } = require('child_process');
const { shell } = require('electron');

const WINGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;
const MAX_APPS_PER_REQUEST = 50;
const INSTALL_TIMEOUT_MS = 30 * 60 * 1000;
const activeChildren = new Set();

function validateInstallTarget(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new TypeError('Identificador de aplicativo inválido');
  }

  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new TypeError('Somente URLs HTTPS sem credenciais são permitidas');
    }
    return { type: 'url', value: url.toString() };
  }

  if (!WINGET_ID_PATTERN.test(value)) {
    throw new TypeError('ID do winget inválido');
  }
  return { type: 'winget', value };
}

async function installApps(appIds, onProgress) {
  if (!Array.isArray(appIds)) throw new TypeError('Lista de aplicativos inválida');
  if (appIds.length > MAX_APPS_PER_REQUEST) throw new RangeError('Muitos aplicativos na mesma solicitação');

  const targets = appIds.map(validateInstallTarget);
  const results = [];

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const base = { appId: target.value, index: i + 1, total: targets.length };
    onProgress?.({ ...base, status: 'Instalando...' });

    try {
      const detail = await installSingleApp(target);
      const result = { ...base, ok: true, status: 'Concluído', ...detail };
      results.push(result);
      onProgress?.(result);
    } catch (error) {
      const result = {
        ...base,
        ok: false,
        status: 'Erro',
        error: error instanceof Error ? error.message : String(error)
      };
      results.push(result);
      onProgress?.(result);
    }
  }

  return { ok: results.every((result) => result.ok), results };
}

async function installSingleApp(target) {
  if (target.type === 'url') {
    await shell.openExternal(target.value);
    return { action: 'opened-url' };
  }

  return new Promise((resolve, reject) => {
    const child = spawn('winget.exe', [
      'install', '--id', target.value, '--exact',
      '--accept-package-agreements', '--accept-source-agreements'
    ], {
      shell: false,
      windowsHide: false,
      stdio: 'ignore'
    });
    activeChildren.add(child);

    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeChildren.delete(child);
      if (error) reject(error);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('A instalação excedeu o limite de 30 minutos'));
    }, INSTALL_TIMEOUT_MS);
    timer.unref?.();

    child.once('error', (error) => finish(error));
    child.once('exit', (code, signal) => {
      if (code === 0) finish(null, { action: 'installed', exitCode: 0 });
      else finish(new Error(`winget terminou com código ${code ?? 'desconhecido'}${signal ? ` (${signal})` : ''}`));
    });
  });
}

function stopAll() {
  for (const child of activeChildren) child.kill();
  activeChildren.clear();
}

module.exports = {
  installApps,
  stopAll,
  validateInstallTarget
};
