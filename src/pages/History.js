export function renderHistory() {
  return `
    <div class="page-section active" id="sec-history">
      <div class="dashboard-header" style="display: flex; align-items: center; gap: 16px;">
        <button id="btn-back-dash" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; padding: 4px; display: flex; align-items: center; gap: 4px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar
        </button>
        <h1 class="page-title" style="margin: 0;">Histórico de Análises</h1>
      </div>
      <div class="history-grid" id="history-list">
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <div class="loading-spinner"></div>
        </div>
      </div>
    </div>
  `;
}

export async function initHistory() {
  const list = document.getElementById('history-list');
  try {
    const history = await window.pulso.getHistory();
    
    if (history.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary); background: var(--bg-panel); border-radius: 12px;">
          Nenhuma análise encontrada no histórico.<br>Execute uma análise na Dashboard primeiro.
        </div>
      `;
      return;
    }

    list.innerHTML = '';
    history.forEach(item => {
      const date = new Date(item.timestamp).toLocaleString('pt-BR');
      const scoreColor = item.score >= 80 ? 'var(--accent-green)' : (item.score >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)');
      
      const div = document.createElement('div');
      div.className = 'list-item';
      div.style.display = 'flex';
      div.style.flexDirection = 'column';
      div.style.gap = '16px';
      div.style.marginBottom = '16px';
      div.style.background = 'var(--bg-card)';
      div.style.border = '1px solid var(--border-color)';
      div.style.padding = '16px';
      div.style.borderRadius = '12px';
      
      const header = document.createElement('div');
      header.style.display = 'grid';
      header.style.gridTemplateColumns = '80px 1fr auto';
      header.style.gap = '20px';
      header.style.cursor = 'pointer';
      
      header.innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px;">
          <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Score</span>
          <strong style="font-size: 1.5rem; color: ${scoreColor};">${item.score}</strong>
        </div>
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">Análise do Sistema</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px;">${date}</div>
          <div style="display: flex; gap: 16px; font-size: 0.85rem; color: var(--text-secondary);">
            <span><strong style="color:var(--text-primary)">${item.ok}</strong> OK</span>
            <span><strong style="color:var(--accent-yellow)">${item.warnings}</strong> Avisos</span>
            <span><strong style="color:var(--accent-red)">${item.criticals}</strong> Críticos</span>
          </div>
        </div>
        <div style="display: flex; gap: 16px; align-items: center; font-size: 0.85rem;">
          <div style="text-align: right;">
            <div style="color: var(--text-secondary); font-size: 0.75rem;">CPU</div>
            <strong>${item.cpu}%</strong>
          </div>
          <div style="text-align: right;">
            <div style="color: var(--text-secondary); font-size: 0.75rem;">RAM</div>
            <strong>${item.ramPct}%</strong>
          </div>
          <div style="text-align: right;">
            <div style="color: var(--text-secondary); font-size: 0.75rem;">Ping</div>
            <strong>${item.ping > -1 ? item.ping + 'ms' : 'N/D'}</strong>
          </div>
          <div class="expand-icon" style="margin-left: 8px; color: var(--text-secondary); font-size: 0.75rem; width: 12px; text-align: center;">▼</div>
        </div>
      `;

      const details = document.createElement('div');
      details.style.display = 'none';
      details.style.gridTemplateColumns = '1fr 1fr';
      details.style.gap = '12px';
      details.style.paddingTop = '16px';
      details.style.borderTop = '1px solid var(--border-color)';
      details.style.fontSize = '0.85rem';

      const renderDetail = (label, value) => `
        <div style="display: flex; justify-content: space-between; padding: 12px; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <span style="color: var(--text-secondary);">${label}</span>
          <span style="font-weight: 500; color: var(--text-primary); text-align: right;">${value !== undefined ? value : 'N/D'}</span>
        </div>
      `;

      details.innerHTML = `
        ${renderDetail('Apps em Segundo Plano', item.heavy !== undefined ? item.heavy + ' processos pesados' : 'N/D')}
        ${renderDetail('Defender', item.defender)}
        ${renderDetail('Plano de Energia', item.plan)}
        ${renderDetail('Driver GPU', item.gpuDays !== undefined ? item.gpuDays + ' dias' : 'N/D')}
      `;

      header.addEventListener('click', () => {
        if (details.style.display === 'none') {
          details.style.display = 'grid';
          header.querySelector('.expand-icon').textContent = '▲';
        } else {
          details.style.display = 'none';
          header.querySelector('.expand-icon').textContent = '▼';
        }
      });

      div.appendChild(header);
      div.appendChild(details);
      list.appendChild(div);
    });

  } catch (e) {
    list.innerHTML = `<div style="color: var(--accent-red); padding: 20px;">Erro ao carregar histórico.</div>`;
  }
}
