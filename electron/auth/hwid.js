const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');

/**
 * Returns a stable, salted hash of this machine's ID.
 *
 * node-machine-id reads a platform-native identifier (Windows: MachineGuid
 * from the registry; macOS: IOPlatformUUID via ioreg; Linux: /etc/machine-id)
 * and hashes it. We hash it again with an app-specific salt so the value we
 * send to the backend is not the same as any other app on the same machine
 * using the same library, and never leaves the device in raw form.
 */
function getHwid() {
  const raw = machineIdSync(true); // true = already SHA-256 hashed by the lib
  return crypto.createHash('sha256').update(`lumen:${raw}`).digest('hex');
}

module.exports = { getHwid };
