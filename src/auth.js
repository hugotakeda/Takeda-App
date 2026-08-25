import { DISCORD_CLIENT_ID } from './config.js';
import { backend } from './api.js';

/**
 * Tries to resume a session from the encrypted local store. Called once on
 * app boot, before deciding whether to render the login screen or the
 * dashboard. Always re-checks with the backend (never trusts a stale local
 * token) so a revoke from the admin panel takes effect on next launch.
 */
export async function resumeSession() {
  const token = await window.pulso.auth.loadSession();
  if (!token) return null;

  const hwid = await window.pulso.auth.getHwid();
  try {
    const res = await backend.verifySession(token, hwid);
    return { token, user: res.user };
  } catch {
    await window.pulso.auth.clearSession();
    return null;
  }
}

/**
 * Full interactive login: opens the system browser to Discord's real
 * consent screen, waits for the loopback redirect, then exchanges the code
 * with our backend (which holds the client secret) for a Lumen session.
 *
 * `onStatus` receives short progress strings for the UI to display.
 */
export async function loginWithDiscord(onStatus) {
  onStatus?.('Abrindo o Discord…');
  const { code } = await window.pulso.auth.loginWithDiscord(DISCORD_CLIENT_ID);

  onStatus?.('Confirmando sua conta…');
  const hwid = await window.pulso.auth.getHwid();
  const res = await backend.exchangeDiscordCode(code, hwid);

  if (res.status === 'pending') {
    const err = new Error('Seu acesso ainda não foi aprovado. Fale com o administrador.');
    err.code = 'PENDING';
    throw err;
  }

  await window.pulso.auth.saveSession(res.sessionToken);
  return res.user;
}

export async function logout() {
  await window.pulso.auth.clearSession();
}
