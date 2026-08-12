export function renderPowerPlan() {
  return `
    <div class="page-section active" id="sec-power">
      <div class="dashboard-header">
        <h1 class="page-title">Plano de Energia</h1>
      </div>

      <div class="metrics-grid" style="grid-template-columns: 1fr;">
        <div class="metric-card" style="padding: 32px;">
          <div style="display: flex; gap: 24px; align-items: flex-start;">
            <div style="width: 48px; height: 48px; background: var(--accent-green-dim); color: var(--accent-green); border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 1.5rem;">
              ⚡
            </div>
            <div style="flex-grow: 1;">
              <h2 style="margin-bottom: 8px;">Plano Takeda</h2>
              <p class="text-gray" style="line-height: 1.6; margin-bottom: 24px;">
                Este plano foca em máximo desempenho, mantendo a CPU em 100% e impedindo a suspensão do monitor/sistema na tomada. Ideal para jogos e aplicações pesadas.
              </p>
              
              <div style="background: rgba(255, 60, 60, 0.1); border-left: 4px solid var(--accent-red); padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
                <span style="color: var(--accent-red); font-weight: 600; display: block; margin-bottom: 4px;">AVISO:</span>
                <span class="text-gray text-sm">Pode aumentar o aquecimento e reduzir a vida útil da bateria.</span>
              </div>
              
              <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <span class="text-gray text-sm">Plano atual ativo no sistema:</span>
                <div style="font-size: 1.25rem; font-weight: 600; margin-top: 4px; color: var(--accent-green);" id="current-plan">Carregando...</div>
              </div>

              <button class="btn-primary" id="btn-apply-plan">Aplicar Plano Takeda</button>
              <div id="plan-msg" style="margin-top: 16px; font-size: 0.9rem; font-weight: 500;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initPowerPlan() {
  updateCurrentPlan();

  document.getElementById('btn-apply-plan').addEventListener('click', () => {
    window.showConfirmModal(
      "Confirmar aplicação", 
      "Você deseja prosseguir e adicionar o plano de energia Takeda?\n\nLembre-se: O plano foca em desempenho máximo e pode aumentar o aquecimento e reduzir a vida útil da bateria.", 
      async () => {
        const btn = document.getElementById('btn-apply-plan');
        const msg = document.getElementById('plan-msg');
        
        btn.disabled = true;
        btn.textContent = 'Aplicando...';
        msg.textContent = '';
        
        try {
          const res = await window.pulso.applyPowerPlan();
          
          if (res.status === 'OK') {
            msg.textContent = '✓ Plano Takeda aplicado com sucesso!';
            msg.style.color = 'var(--accent-green)';
          } else if (res.status === 'AVISO') {
            msg.textContent = '⚠ ' + res.message;
            msg.style.color = 'var(--accent-yellow)';
          } else {
            msg.textContent = '✗ ' + res.message;
            msg.style.color = 'var(--accent-red)';
          }
          
          updateCurrentPlan();
        } catch (e) {
          msg.textContent = '✗ Erro crítico ao aplicar plano.';
          msg.style.color = 'var(--accent-red)';
        } finally {
          btn.disabled = false;
          btn.textContent = 'Aplicar Plano Takeda';
        }
      }
    );
  });
}

async function updateCurrentPlan() {
  try {
    const plan = await window.pulso.getCurrentPlan();
    document.getElementById('current-plan').textContent = plan;
  } catch (e) {
    document.getElementById('current-plan').textContent = 'Erro ao ler';
  }
}
