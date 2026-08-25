import { loginWithDiscord } from '../auth.js';

export function renderLogin(container, session, onLoginSuccess) {
  if (window.pulso && window.pulso.resize) window.pulso.resize(512, 512);
  container.innerHTML = `

<style>

  /* ===== Reset ===== */
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
  body{min-height:100vh}
  button,input{font:inherit;color:inherit}
  a{color:inherit}

  /* ===== Tokens ===== */
  :root{
    --ink-950:#080B0F;
    --ink-900:#0B0F15;
    --ink-850:#10151D;
    --ink-800:#141B24;
    --ink-750:#1A222D;
    --ink-700:#212B38;
    --hairline:rgba(231,236,242,.09);
    --hairline-strong:rgba(231,236,242,.16);
    --mint:#54E7B3;
    --teal:#3FCFC4;
    --blue:#3F8CE8;
    --glow:#8FF6D2;
    --paper:#E7ECF2;
    --paper-dim:#8FA0AC;
    --danger:#F2795C;
    --font-display:'Outfit',-apple-system,sans-serif;
    --font-body:'Plus Jakarta Sans',-apple-system,sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,monospace;
  }

  body{
    background: #111111;
    font-family:var(--font-body);
  }

  button,input,a{outline:none}
  button:focus-visible,input:focus-visible,a:focus-visible{
    outline:2px solid var(--glow);outline-offset:2px;border-radius:6px;
  }
  @media (prefers-reduced-motion: reduce){
    *{animation-duration:.001s !important;animation-iteration-count:1 !important;transition-duration:.001s !important}
  }

  /* ===== Layout ===== */
  .screen{
    display:flex;
    align-items:center;
    justify-content:center;
    min-height:100vh;
    background: #111111;
  }

  .form-side{
    display:flex;align-items:center;justify-content:center;
    padding:clamp(28px,5vw,56px) 24px;
    background: transparent;
    width:100%;
  }
  .form-card{width:100%;max-width:400px}

  /* ===== Form card ===== */
  .lockup{display:flex;align-items:center;gap:10px;margin-bottom:44px;justify-content:center;}
  .lockup-mark{width:28px;height:28px}
  .lockup-word{font-family:var(--font-display);font-weight:600;font-size:17px;color:var(--paper)}

  .form-card h1{
    font-family:var(--font-display);font-weight:600;
    font-size:clamp(23px,2.6vw,28px);color:var(--paper);margin-bottom:8px;line-height:1.15;
    text-align:center;
  }
  .form-card .lede{font-size:14.5px;color:var(--paper-dim);margin-bottom:30px;line-height:1.5;text-align:center;}

  .btn-primary{
    width:100%;height:52px;border-radius:999px;cursor:pointer;
    background:#151515;
    border: 1px solid #262626;
    color:#f0f0f0;
    font-family:var(--font-body);font-size:15px;font-weight:600;
    display:inline-flex;align-items:center;justify-content:center;gap:8px;
    transition:transform .15s ease, background .15s ease, opacity .15s ease;
  }
  .btn-primary:hover{transform:translateY(-1px);background:#1a1a1a;}
  .btn-primary:active{transform:translateY(0) scale(.99)}
  .btn-primary:disabled{cursor:default;opacity:.92}

</style>
<div class="screen">
  <!-- Form panel -->
  <main class="form-side">
    <div class="form-card">
      <div class="lockup">
        <svg class="lockup-mark" viewBox="0 0 1024 1024" aria-hidden="true">
          <defs>
            <linearGradient id="ringLockup" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#54E7B3"/>
              <stop offset="45%" stop-color="#3FCFC4"/>
              <stop offset="100%" stop-color="#3F8CE8"/>
            </linearGradient>
            <linearGradient id="letterLockup" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFFFFF"/>
              <stop offset="100%" stop-color="#E7ECF2"/>
            </linearGradient>
          </defs>
          <circle cx="512" cy="512" r="336" fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="46"/>
          <path d="M 512 176 A 336 336 0 1 1 182.17 447.89" fill="none" stroke="url(#ringLockup)" stroke-width="46" stroke-linecap="round"/>
          <circle cx="182.17" cy="447.89" r="27" fill="#8FF6D2"/>
          <g>
            <rect x="362" y="342" width="300" height="76" rx="24" fill="url(#letterLockup)"/>
            <rect x="474" y="404" width="76" height="282" rx="20" fill="url(#letterLockup)"/>
          </g>
        </svg>
        <span class="lockup-word">Takeda</span>
      </div>

      <h1>Bem-vindo de volta</h1>
      <p class="lede">Entre para retomar sua sessão de foco.</p>

      <button type="button" class="btn-primary" id="btn-discord" style="margin-top: 16px;">
        <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="currentColor">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.2,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
        </svg>
        <span id="discord-btn-text">Entrar com Discord</span>
      </button>

    </div>
  </main>
</div>
`;

  const btnDiscord = document.getElementById('btn-discord');
  const discordBtnText = document.getElementById('discord-btn-text');
  
  if (btnDiscord) {
    if (session) {
      discordBtnText.textContent = `Continuar como @${session.user.username}`;
      btnDiscord.style.background = '#1a1a1a';
    }
  
    btnDiscord.addEventListener('click', async () => {
      try {
        btnDiscord.disabled = true;
        
        if (session) {
          discordBtnText.textContent = 'Entrando...';
          setTimeout(() => {
            if (onLoginSuccess) onLoginSuccess(session.user);
          }, 600);
          return;
        }

        discordBtnText.textContent = 'Autorizando...';
        
        const user = await loginWithDiscord((msg) => {
          discordBtnText.textContent = msg;
        });
        
        discordBtnText.textContent = `Concedido, ${user.username}!`;
        
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(user);
        }, 1000);

      } catch (err) {
        discordBtnText.textContent = `Erro no login`;
        setTimeout(() => {
          btnDiscord.disabled = false;
          discordBtnText.textContent = 'Entrar com Discord';
        }, 2000);
      }
    });
  }
}
