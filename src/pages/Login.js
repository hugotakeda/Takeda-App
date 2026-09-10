import { loginWithDiscord } from '../auth.js';

const BRAND_ICON = '../assets/takeda-icon-256.png';

export function renderLogin(container, session, onLoginSuccess) {
  window.pulso?.resize?.(512, 512);

  container.innerHTML = `
    <section class="takeda-login" aria-labelledby="login-title">
      <div class="login-ambient" aria-hidden="true"></div>
      <main class="login-panel">
        <div class="login-mark-wrap">
          <img class="login-mark" src="${BRAND_ICON}" alt="Ícone do Takeda">
        </div>
        <div class="login-brand">Takeda</div>
        <div class="login-brand-meta">System Suite</div>

        <div class="login-divider" aria-hidden="true"></div>
        <div class="login-kicker">PC care, simplificado</div>
        <h1 class="login-title" id="login-title">Seu PC, <span>sob controle.</span></h1>
        <p class="login-lede">Monitore, limpe e otimize sua máquina em um só lugar.</p>

        <div class="login-actions">
          <button type="button" class="login-button" id="btn-discord">
            <svg viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.2,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            <span id="discord-btn-text">Entrar com Discord</span>
          </button>
          <p class="login-trust" id="login-status" role="status" aria-live="polite">
            <i aria-hidden="true"></i><span>Autenticação segura via Discord</span>
          </p>
        </div>
      </main>
    </section>
  `;

  const button = document.getElementById('btn-discord');
  const buttonText = document.getElementById('discord-btn-text');
  const status = document.getElementById('login-status');
  const statusText = status?.querySelector('span');
  if (!button || !buttonText) return;

  const sessionUser = session?.user?.username ? session.user : null;
  if (sessionUser) buttonText.textContent = `Continuar como @${sessionUser.username}`;

  const setStatus = (message, isError = false) => {
    if (statusText) statusText.textContent = message;
    status?.classList.toggle('is-error', isError);
  };

  const setBusy = (busy) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  };

  const enterApp = async (user, delay) => {
    if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
    await onLoginSuccess?.(user);
  };

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    setBusy(true);

    try {
      if (sessionUser) {
        buttonText.textContent = 'Entrando…';
        setStatus('Preparando seu painel…');
        await enterApp(sessionUser, 280);
        return;
      }

      buttonText.textContent = 'Autorizando…';
      setStatus('Aguardando autorização no Discord…');
      const user = await loginWithDiscord((message) => {
        buttonText.textContent = message;
        setStatus(message);
      });
      buttonText.textContent = `Acesso liberado, ${user.username}!`;
      setStatus('Acesso confirmado. Preparando seu painel…');
      await enterApp(user, 420);
    } catch (error) {
      console.error('[Login] Falha ao entrar.', error);
      const pending = error?.code === 'PENDING';
      const transient = error?.code === 'NETWORK' || error?.code === 'TIMEOUT';
      buttonText.textContent = pending ? 'Acesso pendente' : 'Tentar novamente';
      setStatus(
        pending
          ? error.message
          : transient
            ? 'Servidor indisponível. Verifique sua conexão e tente novamente.'
            : 'Não foi possível concluir o login. Tente novamente.',
        true,
      );
      setBusy(false);
    }
  });
}
