import { DISCORD_CLIENT_ID } from './config.js';
import { backend } from './api.js';

/**
 * Tries to resume a session from the encrypted local store. Called once on
 * app boot, before deciding whether to render the login screen or the
 * dashboard. Always re-checks with the backend (never trusts a stale local
 * token) so a revoke from the admin panel takes effect on next launch.
 */
export async function resumeSession() {
  let token = null;
  try {
    token = await window.pulso.auth.loadSession();
  } catch (error) {
    console.warn('[Auth] Não foi possível ler a sessão local.', error);
    return null;
  }
  if (!token) return null;

  try {
    const hwid = await window.pulso.auth.getHwid();
    const res = await backend.verifySession(token, hwid);
    if (!res?.user) throw Object.assign(new Error('Resposta de sessão inválida.'), { code: 'INVALID_RESPONSE' });
    return { token, user: res.user };
  } catch (error) {
    const terminalStatus = error?.status === 401 || error?.status === 403;
    const terminalCodes = new Set(['INVALID_SESSION', 'SESSION_REVOKED', 'REVOKED', 'UNAUTHORIZED']);
    if (terminalStatus || terminalCodes.has(error?.code)) {
      try {
        await window.pulso.auth.clearSession();
      } catch (clearError) {
        console.warn('[Auth] Não foi possível limpar a sessão revogada.', clearError);
      }
    } else {
      // Keep the encrypted token for the next launch. Offline/timeouts and
      // backend outages must not silently log the user out.
      console.warn('[Auth] Sessão não verificada por falha transitória.', error);
    }
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

  if (res?.status === 'pending') {
    const err = new Error('Seu acesso ainda não foi aprovado. Fale com o administrador.');
    err.code = 'PENDING';
    throw err;
  }

  if (!res?.sessionToken || !res?.user) {
    const err = new Error('O servidor retornou uma resposta de login inválida.');
    err.code = 'INVALID_RESPONSE';
    throw err;
  }

  await window.pulso.auth.saveSession(res.sessionToken);
  return res.user;
}

export async function logout() {
  await window.pulso.auth.clearSession();
}
