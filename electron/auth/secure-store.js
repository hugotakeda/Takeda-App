const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

function filePath() {
  return path.join(app.getPath('userData'), 'session.enc');
}

/** Persists the session token encrypted with the OS keychain/DPAPI. */
function saveSession(token) {
  if (!safeStorage.isEncryptionAvailable()) {
    // Extremely rare (e.g. some locked-down Linux configs without a keyring).
    // We deliberately do NOT fall back to plaintext for an auth token.
    console.warn('[lumen] OS encryption unavailable — session will not persist between launches.');
    return false;
  }
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(filePath(), encrypted);
  return true;
}

/** Reads back the session token, or null if none/decryption fails. */
function loadSession() {
  try {
    const encrypted = fs.readFileSync(filePath());
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

function clearSession() {
  try { fs.unlinkSync(filePath()); } catch { /* nothing to remove */ }
}

module.exports = { saveSession, loadSession, clearSession };
