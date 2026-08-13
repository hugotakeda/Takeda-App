import { renderHistory, initHistory } from './pages/History.js';

// Setup Window Controls
document.getElementById('btn-minimize').addEventListener('click', () => window.pulso.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.pulso.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.pulso.close());

const container = document.getElementById('page-container');
let lastDiagnostic = null;

function renderDashboard() {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1 class="page-title">Início</h1>
      <div class="live-indicator">
        <div class="dot"></div> Monitorando em tempo real
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- Left Column: Health -->
      <div class="card health-card">
        <div class="health-header">Saúde do Sistema</div>
        
        <div class="gauge-container">
          <svg class="gauge-svg" viewBox="0 0 100 100">
            <circle class="gauge-bg" cx="50" cy="50" r="40" />
            <circle class="gauge-fill" id="gauge-fill" cx="50" cy="50" r="40" stroke-dasharray="0 251.2" />
          </svg>
          <div class="gauge-text">
            <div class="gauge-score" id="health-score">--</div>
            <div class="gauge-label">de 100</div>
          </div>
        </div>

        <div class="health-status" id="health-status">Analisando...</div>
        <div class="health-desc" id="health-desc">Aguarde a primeira leitura</div>

        <button class="btn-primary" id="btn-run-diag">Executar análise</button>
        <button class="btn-secondary" id="btn-history" style="margin-bottom: 8px;">Ver histórico de análises</button>
        <button class="btn-secondary" id="btn-powerplan" style="margin-bottom: 8px;">Plano de Energia Takeda</button>
      </div>

      <!-- Right Column: Metrics -->
      <div class="metrics-right">
        <!-- CPU Card -->
        <div class="card metric-card">
          <div class="card-title">Uso de CPU</div>
          <div class="card-value" id="val-cpu">--<small>%</small></div>
          <div class="card-desc" id="desc-cpu">Coletando...</div>
          <div class="chart-container chart-cpu">
            <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <polygon class="sparkline-area" id="area-cpu" points="" />
              <polyline class="sparkline-line" id="line-cpu" points="" />
            </svg>
          </div>
        </div>

        <!-- GPU Card -->
        <div class="card metric-card">
          <div class="card-title">Uso de GPU</div>
          <div class="card-value" id="val-gpu">0<small>%</small></div>
          <div class="card-desc" id="desc-gpu">Coletando...</div>
          <div class="progress-bg">
            <div class="progress-fill" id="bar-gpu" style="width: 0%"></div>
            <div class="progress-thumb" id="thumb-gpu" style="left: 0%"></div>
          </div>
        </div>

        <!-- RAM Card -->
        <div class="card metric-card">
          <div class="card-title">Memória em Uso</div>
          <div class="card-value" id="val-ram">-- <small>GB</small></div>
          <div class="card-desc" id="desc-ram">Coletando...</div>
          <div class="chart-container chart-ram">
            <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <polygon class="sparkline-area" id="area-ram" points="" />
              <polyline class="sparkline-line" id="line-ram" points="" />
            </svg>
          </div>
        </div>

        <!-- Latency Card -->
        <div class="card metric-card">
          <div class="card-title">Latência de Rede</div>
          <div class="card-value" id="val-lat">-- <small>ms</small></div>
          <div class="card-desc" id="desc-lat">Coletando...</div>
          <div class="badge" id="badge-lat">
            <div class="dot" id="dot-lat"></div> <span id="text-lat">Aguardando</span>
          </div>
        </div>

        <!-- System Bar -->
        <div class="card system-bar">
          <span class="label">Sistema</span>
          <span><strong id="sys-os">--</strong></span>
          <span>·</span>
          <span><strong id="sys-cpu">--</strong></span>
          <span>·</span>
          <span><strong id="sys-gpu">--</strong></span>
          <span>·</span>
          <span><strong id="sys-ram">--</strong></span>
        </div>
      </div>
    </div>
  `;
}

function initDashboard() {
  window.pulso.getUsername().then(name => {
    const el = document.getElementById('username');
    if(el) el.textContent = name;
  });

  // Ready app after a short delay (e.g. 2000ms) to allow the native splash window to show
  setTimeout(() => {
    window.pulso.ready();
  }, 2000);

  // Start fast monitor loop
  window.pulso.startMonitor(1000);
  window.pulso.onMonitorData(updateMonitorData);

  // Run full diagnostic in background
  window.pulso.runDiagnostic().then(d => {
    lastDiagnostic = d;
    // Populate static fields
    document.getElementById('desc-cpu').textContent = `${d.cpuModel} · ${d.cpuCores} núcleos`;
    document.getElementById('desc-gpu').textContent = `${d.gpuName} · driver ${d.gpuVer}`;
    document.getElementById('sys-os').textContent = `Windows ${d.osBuild}`;
    let cleanCpu = d.cpuModel.replace(/Intel\(R\) Core\(TM\) /g, 'Intel ');
    cleanCpu = cleanCpu.replace(/AMD /g, '');
    cleanCpu = cleanCpu.replace(/ \d+-Core Processor/g, '');
    cleanCpu = cleanCpu.replace(/ Processor/g, '');
    cleanCpu = cleanCpu.replace(/ CPU @ .*/g, '');
    cleanCpu = cleanCpu.replace(/ with Radeon Graphics/g, '');
    document.getElementById('sys-cpu').textContent = cleanCpu;
    document.getElementById('sys-gpu').textContent = d.gpuName.replace('AMD ', '').replace('NVIDIA ', '');
    document.getElementById('sys-ram').textContent = `${d.ramTotalGB} GB ${d.ramType}`;
    
    updateHealthCard(d);
  });

  document.getElementById('btn-run-diag').addEventListener('click', openModal);

  document.getElementById('btn-history').addEventListener('click', () => {
    window.pulso.stopMonitor();
    window.pulso.removeMonitorListener();
    container.innerHTML = renderHistory();
    initHistory();
    
    document.getElementById('btn-back-dash').addEventListener('click', () => {
      renderDashboard();
      initDashboard();
    });
  });

  document.getElementById('btn-powerplan').addEventListener('click', openPowerPlanModal);
}

function updateHealthCard(d) {
  const score = d.score.value;
  document.getElementById('health-score').textContent = score;
  const dasharray = `${(score / 100) * 251.2} 251.2`;
  const gaugeFill = document.getElementById('gauge-fill');
  gaugeFill.style.strokeDasharray = dasharray;

  const status = document.getElementById('health-status');
  const desc = document.getElementById('health-desc');
  
  if (score >= 80) {
    status.textContent = 'Bom estado';
    gaugeFill.style.stroke = 'var(--accent-green)';
  } else if (score >= 50) {
    status.textContent = 'Atenção necessária';
    gaugeFill.style.stroke = '#facc15';
  } else {
    status.textContent = 'Estado Crítico';
    gaugeFill.style.stroke = '#f87171';
  }
  
  desc.textContent = `${d.score.warnings} avisos · ${d.score.criticals} crítico`;
}

function updateMonitorData(d) {
  document.getElementById('val-cpu').innerHTML = `${d.cpu}<small>%</small>`;
  document.getElementById('val-ram').innerHTML = `${d.ramUsed.toFixed(1)} <small>GB</small>`;
  document.getElementById('desc-ram').textContent = `de ${d.ramTotal} GB · ${d.ramPct}%`;

  if (d.ping > -1) {
    document.getElementById('val-lat').innerHTML = `${d.ping} <small>ms</small>`;
    document.getElementById('desc-lat').textContent = d.packetLoss === 0 ? 'Google DNS · sem perda de pacotes' : `Google DNS · ${d.packetLoss}% perda`;
    document.getElementById('text-lat').textContent = d.ping < 50 ? 'Estável' : 'Instável';
    document.getElementById('dot-lat').style.backgroundColor = d.ping < 50 ? 'var(--accent-green)' : '#facc15';
  } else {
    document.getElementById('val-lat').innerHTML = `-- <small>ms</small>`;
    document.getElementById('desc-lat').textContent = 'Sem conexão';
    document.getElementById('text-lat').textContent = 'Offline';
    document.getElementById('dot-lat').style.backgroundColor = '#f87171';
  }

  const drawSparkline = (idLine, idArea, data) => {
    if (!data || data.length === 0) return;
    const w = 100, h = 30, maxVal = 100;
    let points = data.map((val, i) => {
      const x = (i / 60) * w;
      const y = h - ((val / maxVal) * h);
      return `${x},${y}`;
    });
    document.getElementById(idLine).setAttribute('points', points.join(' '));
    if (points.length > 0) {
      document.getElementById(idArea).setAttribute('points', `0,${h} ${points.join(' ')} ${(data.length - 1)/60 * w},${h}`);
    }
  };

  drawSparkline('line-cpu', 'area-cpu', d.cpuHistory);
  drawSparkline('line-ram', 'area-ram', d.ramHistory);
}

/* ====================================================
   MODAL LOGIC 
==================================================== */

window.showConfirmModal = function(title, text, onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.add('active');
  content.style.width = '420px';

  content.innerHTML = `
    <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
      <div class="modal-title" style="font-size: 1.25rem;">${title}</div>
    </div>
    <div class="modal-body" style="padding-top: 16px; padding-bottom: 24px;">
      <p class="text-gray" style="line-height: 1.5; white-space: pre-wrap; font-size: 0.9rem;">${text}</p>
    </div>
    <div class="modal-footer" style="justify-content: flex-end; gap: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 16px;">
      <button class="btn-modal" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary);" onclick="closeModal()">Cancelar</button>
      <button class="btn-modal" id="btn-modal-confirm">Confirmar</button>
    </div>
  `;

  document.getElementById('btn-modal-confirm').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
};
let currentTab = 'diag';
let sizesCache = {};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function openPowerPlanModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.add('active');
  content.style.width = ''; // Usar largura padrao

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Plano de Energia Takeda</div>
      <div class="modal-subtitle">Configuração de desempenho do sistema</div>
    </div>
    <div class="modal-body" style="padding-top: 16px;">
      <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: var(--accent-green-dim); color: var(--accent-green); border-radius: 12px; display: flex; justify-content: center; align-items: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(74, 222, 128, 0.1);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5 2L3 13h8v9l9-11h-8V2z"/>
          </svg>
        </div>
        <p class="text-gray" style="line-height: 1.6; margin: 0; font-size: 0.95rem;">
          Este plano maximiza o desempenho mantendo a CPU em 100% e impedindo a suspensão do sistema. Ideal para jogos e aplicações que exigem muito do hardware.
        </p>
      </div>

      <div style="display: flex; gap: 14px; background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.15); border-radius: 8px; padding: 16px; align-items: flex-start; margin-bottom: 24px;">
        <div style="color: #f87171; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div>
          <div style="color: #f87171; font-weight: 600; margin-bottom: 4px; font-size: 0.9rem; letter-spacing: 0.3px; text-transform: uppercase;">Atenção</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.5;">
            O aquecimento do sistema pode aumentar e a vida útil da bateria pode ser reduzida. Recomendado o uso conectado à tomada.
          </div>
        </div>
      </div>
      <div class="diag-list" style="margin-bottom: 0;">
        <div class="diag-item" style="border-bottom: none;">
          <div class="diag-label">
            <div class="diag-dot ok"></div> Plano atual ativo no sistema
          </div>
          <div class="diag-value ok" id="current-plan-modal">Carregando...</div>
        </div>
      </div>
      <div id="plan-msg-container" style="display: none; margin-top: 20px; padding: 12px 16px; border-radius: 8px; font-size: 0.9rem; font-weight: 500; align-items: center; gap: 8px;">
        <span id="plan-msg"></span>
      </div>
    </div>
    <div class="modal-footer" id="modal-footer-plan" style="justify-content: flex-end; gap: 12px;">
      <button class="btn-modal" id="btn-cancel-plan" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary);" onclick="closeModal()">Cancelar</button>
      <button class="btn-modal" id="btn-apply-plan">Aplicar Plano Takeda</button>
    </div>
  `;

  try {
    const plan = await window.pulso.getCurrentPlan();
    document.getElementById('current-plan-modal').textContent = plan;
  } catch (e) {
    document.getElementById('current-plan-modal').textContent = 'Erro ao ler';
  }

  document.getElementById('btn-apply-plan').addEventListener('click', async () => {
    const btn = document.getElementById('btn-apply-plan');
    const btnCancel = document.getElementById('btn-cancel-plan');
    const msgContainer = document.getElementById('plan-msg-container');
    const msg = document.getElementById('plan-msg');
    const footer = document.getElementById('modal-footer-plan');
    
    btn.disabled = true;
    if(btnCancel) btnCancel.disabled = true;
    btn.textContent = 'Aplicando...';
    msgContainer.style.display = 'none';
    
    try {
      const res = await window.pulso.applyPowerPlan();
      
      if (res.status === 'OK') {
        footer.style.justifyContent = 'center';
        footer.innerHTML = `<button class="btn-modal" style="width: 100%; background: var(--accent-green-dim); color: var(--accent-green); border: 1px solid rgba(74, 222, 128, 0.2); cursor: default;"><strong style="margin-right: 6px; font-size: 1.1rem;">✓</strong> Plano aplicado com sucesso!</button>`;
        
        try {
          const newPlan = await window.pulso.getCurrentPlan();
          document.getElementById('current-plan-modal').textContent = newPlan;
        } catch (e) {}

        setTimeout(() => {
          closeModal();
        }, 3000);
      } else {
        msgContainer.style.display = 'flex';
        if (res.status === 'AVISO') {
          msg.innerHTML = '<strong style="font-size: 1.1rem; margin-right: 4px;">⚠</strong> ' + res.message;
          msgContainer.style.background = 'rgba(250, 204, 21, 0.1)';
          msgContainer.style.border = '1px solid rgba(250, 204, 21, 0.2)';
          msgContainer.style.color = '#facc15';
        } else {
          msg.innerHTML = '<strong style="font-size: 1.1rem; margin-right: 4px;">✗</strong> ' + res.message;
          msgContainer.style.background = 'rgba(248, 113, 113, 0.1)';
          msgContainer.style.border = '1px solid rgba(248, 113, 113, 0.2)';
          msgContainer.style.color = '#f87171';
        }
        btn.disabled = false;
        if(btnCancel) btnCancel.disabled = false;
        btn.textContent = 'Aplicar Plano Takeda';
      }
    } catch (e) {
      msgContainer.style.display = 'flex';
      msg.innerHTML = '<strong style="font-size: 1.1rem; margin-right: 4px;">✗</strong> Erro crítico ao aplicar plano.';
      msgContainer.style.background = 'rgba(248, 113, 113, 0.1)';
      msgContainer.style.border = '1px solid rgba(248, 113, 113, 0.2)';
      msgContainer.style.color = '#f87171';
      btn.disabled = false;
      if(btnCancel) btnCancel.disabled = false;
      btn.textContent = 'Aplicar Plano Takeda';
    }
  });
}

async function openModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  overlay.classList.add('active');
  content.style.width = ''; // Restaurar largura padrao (600px via css)

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Análise do sistema</div>
      <div class="modal-subtitle" id="modal-subtitle-text">Avaliando componentes...</div>
    </div>
    <div class="modal-tabs">
      <div class="modal-tab active" id="tab-diag">Diagnóstico</div>
      <div class="modal-tab" id="tab-clean">Limpeza</div>
    </div>
    <div class="modal-body" id="modal-body"></div>
    <div class="modal-footer" id="modal-footer"></div>
  `;

  document.getElementById('tab-diag').addEventListener('click', () => switchTab('diag', lastDiagnostic));
  document.getElementById('tab-clean').addEventListener('click', () => switchTab('clean', lastDiagnostic));

  const body = document.getElementById('modal-body');
  const footer = document.getElementById('modal-footer');

  // Draw skeleton
  const placeholders = [
    'Uso de CPU', 'RAM livre', 'Plano de energia', 'Driver da GPU',
    'Apps em segundo plano', 'Defender em tempo real', 'Latência internet', 'Adaptador de rede'
  ];
  
  let html = '<div class="diag-list">';
  placeholders.forEach((p, i) => {
    html += `
      <div class="diag-item" id="diag-item-${i}">
        <div class="diag-label">
          <div class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: -4px;"></div> <span style="margin-left:8px;">${p}</span>
        </div>
        <div class="diag-value" style="color: var(--text-secondary);">Analisando...</div>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;
  footer.innerHTML = `<button class="btn-modal" disabled>Analisando...</button>`;

  // Run the fresh diagnostic
  const d = await window.pulso.runDiagnostic();
  lastDiagnostic = d;
  updateHealthCard(d); // Update main dashboard behind the modal
  
  // Save diagnostic to history so it appears in the history page
  await window.pulso.saveHistory(d);
  
  // Reveal items one by one
  const items = getDiagItems(d);
  for (let i = 0; i < items.length; i++) {
    // Only update if we are still on the diag tab
    const el = document.getElementById(`diag-item-${i}`);
    if (el) {
      el.innerHTML = `
        <div class="diag-label">
          <div class="diag-dot ${items[i].dot}"></div> ${items[i].label}
        </div>
        <div class="diag-value ${items[i].dot}">${items[i].val}</div>
      `;
    }
    // progressive delay
    await new Promise(r => setTimeout(r, 100));
  }

  // Update subtitle and footer after all loaded
  const subtitle = document.getElementById('modal-subtitle-text');
  if (subtitle) {
    subtitle.textContent = `${d.score.ok} ok · ${d.score.warnings} aviso · ${d.score.criticals} crítico.`;
  }
  
  // If we are still on diag tab, update footer
  if (document.getElementById('tab-diag').classList.contains('active')) {
    footer.innerHTML = `<button class="btn-modal" onclick="closeModal()">Fechar</button>`;
  }
}

// Export to window so inline onclick works
window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('active');
};

function switchTab(tab, d) {
  document.getElementById('tab-diag').classList.toggle('active', tab === 'diag');
  document.getElementById('tab-clean').classList.toggle('active', tab === 'clean');
  
  const body = document.getElementById('modal-body');
  const footer = document.getElementById('modal-footer');

  if (tab === 'diag') {
    renderDiagTab(body, footer, d);
  } else {
    renderCleanTab(body, footer);
  }
}

function getDiagItems(d) {
  let cpuSt = 'ok', cpuVal = `${d.cpu}% em uso · idle saudável`;
  if (d.cpu >= 85) { cpuSt = 'crit'; cpuVal = `${d.cpu}% em uso · uso crítico`; }
  else if (d.cpu >= 60) { cpuSt = 'warn'; cpuVal = `${d.cpu}% em uso · uso elevado`; }

  let ramSt = 'ok', ramVal = `${d.ramFreeGB} GB livres de ${d.ramTotalGB} GB`;
  if (d.ramPct >= 90) ramSt = 'crit';
  else if (d.ramPct >= 75) ramSt = 'warn';

  let pwrSt = 'ok', pwrVal = d.plan;
  if (d.plan.toLowerCase().includes('saving') || d.plan.toLowerCase().includes('economy')) {
    pwrSt = 'warn';
  }

  let gpuSt = 'ok', gpuVal = `${d.gpuVer} · atual · ${d.gpuDays > -1 ? d.gpuDays + 'd' : 'N/D'}`;
  if (d.gpuDays > 365) gpuSt = 'crit';
  else if (d.gpuDays > 180) gpuSt = 'warn';

  let appSt = 'ok', appVal = `${d.heavy} pesadas`;
  if (d.heavy >= 60) appSt = 'crit';
  else if (d.heavy >= 40) appSt = 'warn';

  let defSt = 'ok', defVal = d.defender;
  if (d.defender === 'Desligado') defSt = 'crit';
  else if (d.defender === 'N/D') defSt = 'warn';

  let pingSt = 'ok', pingVal = `${d.ping} ms (8.8.8.8)`;
  if (d.ping === -1) { pingSt = 'crit'; pingVal = 'Sem conexão'; }
  else if (d.ping >= 80) pingSt = 'crit';
  else if (d.ping >= 30) pingSt = 'warn';

  let netSt = 'ok', netVal = `${d.adapterType} · ${Math.round(d.adapterSpeed / 1e9)} Gbps`;
  if (d.adapterName === 'Sem conexao') netSt = 'crit';

  return [
    { label: 'Uso de CPU', dot: cpuSt, val: cpuVal },
    { label: 'RAM livre', dot: ramSt, val: ramVal },
    { label: 'Plano de energia', dot: pwrSt, val: pwrVal },
    { label: 'Driver da GPU', dot: gpuSt, val: gpuVal },
    { label: 'Apps em segundo plano', dot: appSt, val: appVal },
    { label: 'Defender em tempo real', dot: defSt, val: defVal },
    { label: 'Latência internet', dot: pingSt, val: pingVal },
    { label: 'Adaptador de rede', dot: netSt, val: netVal },
  ];
}

function renderDiagTab(body, footer, d) {
  if (!d) return;
  const items = getDiagItems(d);
  
  let html = '<div class="diag-list">';
  items.forEach(i => {
    html += `
      <div class="diag-item">
        <div class="diag-label">
          <div class="diag-dot ${i.dot}"></div> ${i.label}
        </div>
        <div class="diag-value ${i.dot}">${i.val}</div>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;
  
  document.getElementById('modal-subtitle-text').textContent = `${d.score.ok} ok · ${d.score.warnings} aviso · ${d.score.criticals} crítico.`;
  footer.innerHTML = `<button class="btn-modal" onclick="closeModal()">Fechar</button>`;
}

async function renderCleanTab(body, footer) {
  body.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-secondary);">Calculando tamanhos...</div>';
  footer.innerHTML = `
    <div class="modal-footer-left" id="clean-footer-text">Selecionado: 0 B · 0 itens</div>
    <button class="btn-modal" id="btn-exec-clean" disabled>Executar limpeza</button>
  `;

  try {
    sizesCache = await window.pulso.getCleanupSizes();
  } catch(e) {
    body.innerHTML = 'Erro ao carregar tamanhos.';
    return;
  }

  const itemsDef = [
    { id: 'TempUser', key: 'tempUser', name: 'Arquivos temporários (usuário)', desc: '%TEMP% · cache de instaladores e apps' },
    { id: 'TempWindows', key: 'tempWin', name: 'Arquivos temporários (Windows)', desc: 'C:\\Windows\\Temp · pode pedir admin' },
    { id: 'Prefetch', key: 'prefetch', name: 'Prefetch', desc: 'C:\\Windows\\Prefetch · cache de inicialização' },
    { id: 'CrashDumps', key: 'crashDumps', name: 'Crash dumps', desc: 'Memory dumps de programas que travaram' },
    { id: 'Thumbcache', key: 'thumbcache', name: 'Cache de miniaturas', desc: '%LOCALAPPDATA%\\...\\Explorer · thumbcache_*.db' },
    { id: 'RecycleBin', key: 'recycleBin', name: 'Lixeira', desc: 'Tudo que está na lixeira' }
  ];

  let html = '<div class="clean-list">';
  itemsDef.forEach(item => {
    const size = sizesCache[item.key] || 0;
    html += `
      <div class="clean-item">
        <input type="checkbox" class="clean-check" data-id="${item.id}" data-size="${size}" ${size > 0 ? 'checked' : 'disabled'}>
        <div class="clean-info">
          <div class="clean-name">${item.name}</div>
          <div class="clean-desc">${item.desc}</div>
        </div>
        <div class="clean-size" style="color: ${size > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'}">${formatBytes(size)}</div>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;

  const updateSelection = () => {
    const checked = body.querySelectorAll('.clean-check:checked');
    let total = 0;
    checked.forEach(c => total += parseInt(c.dataset.size));
    document.getElementById('clean-footer-text').textContent = `Selecionado: ${formatBytes(total)} · ${checked.length} itens`;
    document.getElementById('btn-exec-clean').disabled = total === 0;
  };

  body.querySelectorAll('.clean-check').forEach(c => c.addEventListener('change', updateSelection));
  updateSelection();

  document.getElementById('btn-exec-clean').addEventListener('click', async () => {
    const checked = body.querySelectorAll('.clean-check:checked');
    const items = Array.from(checked).map(c => c.dataset.id);
    if(items.length === 0) return;

    const btn = document.getElementById('btn-exec-clean');
    btn.textContent = 'Limpando...';
    btn.disabled = true;

    try {
      const res = await window.pulso.executeCleanup(items);
      btn.textContent = 'Limpeza concluída com sucesso!';
      setTimeout(() => {
        renderCleanTab(body, footer); // reload
      }, 2000);
    } catch(e) {
      btn.textContent = 'Erro ao executar limpeza';
      setTimeout(() => {
        btn.textContent = 'Executar limpeza';
        btn.disabled = false;
      }, 2000);
    }
  });
}

// Initial render
renderDashboard();
initDashboard();

