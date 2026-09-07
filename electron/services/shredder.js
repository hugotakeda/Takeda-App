const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Caminhos que nunca devem ser aceitos, mesmo que o usuário selecione por
// engano (ou um caminho malicioso seja passado). Bloqueia a raiz do sistema,
// Windows, Program Files e a própria pasta pessoal inteira (só permitimos
// itens DENTRO dela, não ela mesma).
function isBlocked(targetPath) {
  const normalized = path.resolve(targetPath).toLowerCase().replace(/\\+$/, '');
  const systemDrive = (process.env.SYSTEMDRIVE || 'C:').toLowerCase();
  const windir = (process.env.WINDIR || `${systemDrive}\\Windows`).toLowerCase();
  const home = os.homedir().toLowerCase().replace(/\\+$/, '');

  const blocked = [
    `${systemDrive}\\`,
    systemDrive,
    windir,
    `${systemDrive}\\program files`,
    `${systemDrive}\\program files (x86)`,
    `${systemDrive}\\programdata`,
    `${systemDrive}\\users`,
    home,
  ];

  return blocked.some((b) => normalized === b.replace(/\\+$/, ''));
}

async function shredFile(filePath, passes) {
  const stat = await fs.stat(filePath);
  const size = stat.size;

  if (size > 0) {
    const fh = await fs.open(filePath, 'r+');
    try {
      const chunkSize = Math.min(size, 4 * 1024 * 1024);
      for (let pass = 0; pass < passes; pass++) {
        let written = 0;
        while (written < size) {
          const remaining = size - written;
          const len = Math.min(chunkSize, remaining);
          const buf = crypto.randomBytes(len);
          await fh.write(buf, 0, len, written);
          written += len;
        }
      }
      await fh.sync().catch(() => {});
    } finally {
      await fh.close();
    }
  }

  // Renomeia para um nome aleatório antes de excluir, para dificultar a
  // recuperação do nome original via journal do sistema de arquivos.
  const dir = path.dirname(filePath);
  const randomName = crypto.randomBytes(10).toString('hex');
  const randomPath = path.join(dir, randomName);
  try {
    await fs.rename(filePath, randomPath);
    await fs.unlink(randomPath);
  } catch (e) {
    await fs.unlink(filePath).catch(() => {});
  }

  return size;
}

async function shredPath(targetPath, passes = 3, onProgress) {
  if (isBlocked(targetPath)) {
    throw new Error('Este caminho é protegido e não pode ser apagado por segurança.');
  }

  const stat = await fs.stat(targetPath);
  let freed = 0;
  let count = 0;

  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        const r = await shredPath(full, passes, onProgress);
        freed += r.freed;
        count += r.count;
      } else {
        const size = await shredFile(full, passes);
        freed += size;
        count += 1;
        if (onProgress) onProgress({ path: full, size });
      }
    }
    try {
      await fs.rmdir(targetPath);
    } catch (e) {}
  } else {
    const size = await shredFile(targetPath, passes);
    freed += size;
    count = 1;
    if (onProgress) onProgress({ path: targetPath, size });
  }

  return { freed, count };
}

module.exports = { shredPath, isBlocked };
