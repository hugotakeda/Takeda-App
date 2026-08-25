import { t } from '../i18n.js';

export function renderTweaks() {
  return `
    <div class="page-section active" id="sec-tweaks" style="display: flex; flex-direction: column; height: 100%;">
      <div class="dashboard-header" style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <button id="btn-back-dash" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; padding: 4px; display: flex; align-items: center; gap: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 class="page-title" style="margin: 0;">Tweaks do Sistema</h1>
        </div>
      </div>

      <div class="health-section custom-scrollbar" style="flex: 1; overflow-y: auto; flex-direction: column; align-items: stretch; gap: 24px; padding-right: 12px;">
        
        <div style="display: flex; gap: 12px; align-items: center; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 12px 16px; margin-bottom: 32px;">
          <div style="color: var(--accent-blue, #3b82f6); flex-shrink: 0; display: flex;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <p class="text-gray" style="line-height: 1.5; margin: 0; font-size: 0.85rem;">
            Selecione as otimizações que deseja aplicar. Alterações no registro podem exigir privilégios de administrador. Recomendamos aplicar apenas os tweaks dos quais você tem conhecimento.
          </p>
        </div>

        <div class="tweaks-grid" id="tweaks-list" style="position: relative;">
          <div style="text-align: center; padding: 40px; color: var(--text-secondary); width: 100%;">
            <div class="loading-spinner" style="margin-bottom: 16px;"></div>
            <p>Carregando status dos tweaks...</p>
          </div>
        </div>

      </div>
      <div id="toast-container" style="position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 10px; z-index: 9999;"></div>
    </div>
  `;
}

function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.style.background = isError ? 'var(--accent-red, #f87171)' : 'var(--accent-green, #4ade80)';
  toast.style.color = isError ? '#fff' : '#000';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  toast.style.fontWeight = '500';
  toast.style.fontSize = '0.9rem';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(20px)';
  toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  toast.textContent = message;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Animate out after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const tweaksDef = [
  { id: 'telemetry', name: 'Desativar Telemetria', desc: 'Impede o envio de dados de uso do Windows para a Microsoft. Melhora a privacidade e reduz uso de disco/rede.' },
  { id: 'gamebar', name: 'Desativar Xbox Game Bar', desc: 'Desabilita os recursos de gravação em segundo plano do Windows, liberando recursos e melhorando o FPS em jogos.' },
  { id: 'backgroundApps', name: 'Aplicativos em Segundo Plano', desc: 'Desativa a permissão global para aplicativos UWP rodarem em segundo plano consumindo memória.' },
  { id: 'network', name: 'Otimizar Rede (TCP NoDelay)', desc: 'Desativa o Algoritmo de Nagle. Pode reduzir latência (ping) em jogos online às custas de mais tráfego de pacotes pequenos.' }
];

export async function initTweaks() {
  const list = document.getElementById('tweaks-list');
  
  try {
    const status = await window.pulso.getTweaksStatus();
    renderTweaksList(status);
  } catch (e) {
    list.innerHTML = `<div style="color: var(--accent-red); padding: 20px;">Erro ao carregar status dos tweaks.</div>`;
  }
}

function renderTweaksList(status) {
  const list = document.getElementById('tweaks-list');
  list.innerHTML = '';
  
  tweaksDef.forEach(tweak => {
    // Assuming status[tweak.id] is boolean (true if tweak is ON/Applied, false if reverted/disabled)
    const isActive = status[tweak.id] || false; 
    
    const div = document.createElement('div');
    div.className = 'card tweak-card';
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    div.style.padding = '20px';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '12px';
    div.style.background = 'var(--bg-card, rgba(255, 255, 255, 0.02))';
    div.style.marginBottom = '16px';
    div.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';

    div.innerHTML = `
      <div style="flex: 1; padding-right: 24px;">
        <strong style="display: block; margin-bottom: 8px; font-size: 1.1rem; color: var(--text-primary);">${tweak.name}</strong>
        <span style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; display: block;">${tweak.desc}</span>
      </div>
      <div style="display: flex; flex-direction: row; align-items: center; justify-content: flex-end; gap: 8px; min-width: 180px;">
        <button class="btn-primary" id="btn-apply-${tweak.id}" style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; border-radius: 8px; transition: all 0.2s; background: var(--accent-green, #4ade80); color: #000;">
          Aplicar
        </button>
        <button class="btn-secondary" id="btn-revert-${tweak.id}" style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; border-radius: 8px; transition: all 0.2s; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary);">
          Reverter
        </button>
      </div>
    `;
    list.appendChild(div);

    const btnApply = document.getElementById(`btn-apply-${tweak.id}`);
    const btnRevert = document.getElementById(`btn-revert-${tweak.id}`);

    const handleAction = async (btn, isEnable) => {
      btnApply.disabled = true;
      btnRevert.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '...';
      
      try {
        const success = await window.pulso.applyTweak(tweak.id, isEnable);
        if (success) {
          showToast(`Tweak '${tweak.name}' foi ${isEnable ? 'aplicado' : 'revertido'}!`);
        } else {
          throw new Error('Falha na execução');
        }
      } catch (e) {
        showToast('Erro. Execute o Takeda como Administrador.', true);
      } finally {
        btn.textContent = originalText;
        btnApply.disabled = false;
        btnRevert.disabled = false;
      }
    };

    btnApply.addEventListener('click', () => handleAction(btnApply, true));
    btnRevert.addEventListener('click', () => handleAction(btnRevert, false));
  });
}
