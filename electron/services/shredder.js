const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

function normalizedPath(targetPath) {
  if (typeof targetPath !== 'string' || targetPath.length === 0 || targetPath.length > 32767) return null;
  if (!path.isAbsolute(targetPath) || /^\\\\(?:[?.]\\|[^\\]+\\[^\\]+)/.test(targetPath)) return null;
  return path.resolve(targetPath).replace(/[\\/]+$/, '').toLowerCase();
}

function isSameOrDescendant(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isBlocked(targetPath) {
  const normalized = normalizedPath(targetPath);
  if (!normalized) return true;

  const root = path.parse(path.resolve(targetPath)).root.replace(/[\\/]+$/, '').toLowerCase();
  if (normalized === root) return true;

  const systemDrive = (process.env.SYSTEMDRIVE || 'C:').toLowerCase();
  const protectedTrees = [
    process.env.WINDIR || `${systemDrive}\\Windows`,
    process.env.ProgramFiles || `${systemDrive}\\Program Files`,
    process.env['ProgramFiles(x86)'] || `${systemDrive}\\Program Files (x86)`,
    process.env.ProgramData || `${systemDrive}\\ProgramData`
  ].map(normalizedPath).filter(Boolean);
  const protectedExact = [
    `${systemDrive}\\Users`,
    os.homedir()
  ].map(normalizedPath).filter(Boolean);

  if (protectedTrees.some((protectedPath) => isSameOrDescendant(normalized, protectedPath))) return true;
  if (protectedExact.includes(normalized)) return true;

  try {
    const real = normalizedPath(fsSync.realpathSync.native(targetPath));
    if (!real || real === root) return true;
    if (protectedTrees.some((protectedPath) => isSameOrDescendant(real, protectedPath))) return true;
    if (protectedExact.includes(real)) return true;
  } catch (error) {
    if (error?.code !== 'ENOENT') return true;
  }

  return false;
}

function validatePasses(passes) {
  if (!Number.isInteger(passes) || passes < 1 || passes > 7) {
    throw new RangeError('O número de passes deve ser um inteiro entre 1 e 7');
  }
  return passes;
}

async function shredFile(filePath, passes) {
  const stat = await fs.lstat(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Links e arquivos especiais não podem ser triturados');
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
          let offset = 0;
          while (offset < len) {
            const { bytesWritten } = await fh.write(buf, offset, len - offset, written + offset);
            if (bytesWritten <= 0) throw new Error('Não foi possível sobrescrever o arquivo por completo');
            offset += bytesWritten;
          }
          written += offset;
        }
      }
      await fh.sync();
    } finally {
      await fh.close();
    }
  }

  // Renomeia para um nome aleatório antes de excluir, para dificultar a
  // recuperação do nome original via journal do sistema de arquivos.
  const dir = path.dirname(filePath);
  const randomName = crypto.randomBytes(10).toString('hex');
  const randomPath = path.join(dir, randomName);
  await fs.rename(filePath, randomPath);
  await fs.unlink(randomPath);

  return size;
}

async function preflightPath(targetPath) {
  if (isBlocked(targetPath)) {
    throw new Error('Este caminho é protegido e não pode ser apagado por segurança.');
  }

  const stat = await fs.lstat(targetPath);
  if (stat.isSymbolicLink()) throw new Error('Links simbólicos e junções não podem ser triturados');
  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(targetPath, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Link simbólico ou junção recusado: ${full}`);
      await preflightPath(full);
    }
  } else if (!stat.isFile()) {
    throw new Error(`Tipo de arquivo não suportado: ${targetPath}`);
  }
}

async function shredPathInternal(targetPath, passes, onProgress) {
  const stat = await fs.lstat(targetPath);
  let freed = 0;
  let count = 0;

  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(targetPath, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Link simbólico ou junção recusado: ${full}`);
      } else if (entry.isDirectory()) {
        const r = await shredPathInternal(full, passes, onProgress);
        freed += r.freed;
        count += r.count;
      } else if (entry.isFile()) {
        const size = await shredFile(full, passes);
        freed += size;
        count += 1;
        if (onProgress) onProgress({ path: full, size });
      } else throw new Error(`Tipo de arquivo não suportado: ${full}`);
    }
    await fs.rmdir(targetPath);
  } else if (stat.isFile()) {
    const size = await shredFile(targetPath, passes);
    freed += size;
    count = 1;
    if (onProgress) onProgress({ path: targetPath, size });
  } else throw new Error('Somente arquivos e pastas regulares podem ser triturados');

  return { freed, count };
}

async function shredPath(targetPath, passes = 3, onProgress) {
  validatePasses(passes);
  await preflightPath(targetPath);
  return shredPathInternal(targetPath, passes, onProgress);
}

module.exports = { shredPath, isBlocked, validatePasses, preflightPath };
