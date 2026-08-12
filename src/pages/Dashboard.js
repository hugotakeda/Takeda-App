export function renderDashboard() {
  return `
    <div class="page-section active" id="sec-dashboard">
      <div class="dashboard-header">
        <h1 class="page-title">PULSO Dashboard</h1>
        <div class="live-indicator">
          <div class="dot"></div> Monitorando em tempo real
        </div>
      </div>

      <div class="health-section">
        <div class="gauge-container" id="health-gauge">
          <svg class="gauge-svg" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="grad-health" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--accent-red)" />
                <stop offset="50%" stop-color="var(--accent-yellow)" />
                <stop offset="100%" stop-color="var(--accent-green)" />
              </linearGradient>
            </defs>
            <circle class="gauge-bg" cx="50" cy="50" r="40" />
            <circle class="gauge-fill" cx="50" cy="50" r="40" stroke="url(#grad-health)" stroke-dasharray="0 251.2" />
          </svg>
          <div class="gauge-text">
            <div class="gauge-score" id="score-val">--</div>
            <div class="gauge-label">de 100</div>
          </div>
        </div>
        <div class="health-details">
          <h2 class="health-title" id="score-title">Analisando Sistema...</h2>
          <p class="health-desc" id="score-desc">Aguarde enquanto coletamos dados do seu hardware e software.</p>
          <div class="action-buttons">
            <button class="btn-primary" id="btn-run-diag">Executar Análise Completa</button>
          </div>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card card-cpu">
          <div class="metric-header">
            <span class="metric-title">Uso de CPU</span>
          </div>
          <div class="metric-value" id="val-cpu">--%</div>
          <div class="metric-sub" id="sub-cpu">Coletando...</div>
          <div class="chart-container">
            <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <defs>
                <linearGradient id="grad-cpu" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--accent-green)" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="var(--accent-green)" stop-opacity="0" />
                </linearGradient>
              </defs>
              <polygon class="sparkline-area" points="" />
              <polyline class="sparkline-line" points="" />
            </svg>
          </div>
        </div>

        <div class="metric-card card-ram">
          <div class="metric-header">
            <span class="metric-title">Uso de Memória</span>
          </div>
          <div class="metric-value" id="val-ram">--%</div>
          <div class="metric-sub" id="sub-ram">Coletando...</div>
          <div class="chart-container">
            <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <defs>
                <linearGradient id="grad-ram" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--accent-blue)" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="var(--accent-blue)" stop-opacity="0" />
                </linearGradient>
              </defs>
              <polygon class="sparkline-area" points="" />
              <polyline class="sparkline-line" points="" />
            </svg>
          </div>
        </div>

        <div class="metric-card card-gpu">
          <div class="metric-header">
            <span class="metric-title">Status da GPU</span>
          </div>
          <div class="metric-value" id="val-gpu">--</div>
          <div class="metric-sub" id="sub-gpu">Coletando...</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="bar-gpu" style="width: 0%"></div>
          </div>
        </div>

        <div class="metric-card card-lat">
          <div class="metric-header">
            <span class="metric-title">Latência Internet</span>
          </div>
          <div class="metric-value" id="val-lat">-- ms</div>
          <div class="metric-sub" id="sub-lat">Coletando...</div>
          <div class="chart-container" style="display:flex; align-items:flex-end; height:34px;">
             <!-- Placeholder for future latency chart -->
          </div>
        </div>
      </div>

      <div class="system-bar" id="system-bar" style="opacity: 0.5">
        <div class="sys-item">
          <div class="sys-text"><strong id="sys-os">--</strong>Sistema Operacional</div>
        </div>
        <div class="sys-item">
          <div class="sys-text"><strong id="sys-plan">--</strong>Plano de Energia</div>
        </div>
        <div class="sys-item">
          <div class="sys-text"><strong id="sys-def">--</strong>Windows Defender</div>
        </div>
      </div>
    </div>
  `;
}

export function initDashboard() {
  document.getElementById('btn-run-diag').addEventListener('click', async () => {
    const btn = document.getElementById('btn-run-diag');
    btn.disabled = true;
    btn.textContent = 'Analisando...';
    
    try {
      const data = await window.pulso.runDiagnostic();
      updateDiagnosticData(data);
      await window.pulso.saveHistory(data);
    } catch (e) {
      console.error(e);
      alert('Erro ao executar diagnóstico.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Executar Análise Completa';
    }
  });

  // Run a silent diagnostic on load to populate static fields
  window.pulso.runDiagnostic().then(updateDiagnosticData);
}

function updateDiagnosticData(d) {
  // Update Health Gauge
  const score = d.score.value;
  document.getElementById('score-val').textContent = score;
  const dasharray = `${(score / 100) * 251.2} 251.2`;
  document.querySelector('.gauge-fill').style.strokeDasharray = dasharray;

  const title = document.getElementById('score-title');
  const desc = document.getElementById('score-desc');
  if (score >= 80) {
    title.textContent = 'Bom estado';
    title.style.color = 'var(--accent-green)';
    desc.textContent = 'Seu sistema está otimizado e rodando sem gargalos críticos.';
  } else if (score >= 50) {
    title.textContent = 'Atenção necessária';
    title.style.color = 'var(--accent-yellow)';
    desc.textContent = `Encontramos ${d.score.warnings} avisos e ${d.score.criticals} itens críticos.`;
  } else {
    title.textContent = 'Estado Crítico';
    title.style.color = 'var(--accent-red)';
    desc.textContent = `O sistema precisa de manutenção. ${d.score.criticals} itens estão prejudicando o desempenho.`;
  }

  // Update Static Cards
  document.getElementById('val-gpu').textContent = d.gpuDays > -1 ? `${d.gpuDays} dias` : 'N/D';
  document.getElementById('sub-gpu').textContent = `${d.gpuName} (${d.gpuVer})`;
  let gpuHealth = 100;
  if (d.gpuDays > 365) gpuHealth = 20;
  else if (d.gpuDays > 180) gpuHealth = 50;
  const gpuBar = document.getElementById('bar-gpu');
  gpuBar.style.width = `${gpuHealth}%`;
  gpuBar.style.background = gpuHealth > 50 ? 'var(--accent-green)' : (gpuHealth > 20 ? 'var(--accent-yellow)' : 'var(--accent-red)');

  document.getElementById('val-lat').textContent = d.ping > -1 ? `${d.ping} ms` : 'Erro';
  document.getElementById('sub-lat').textContent = `${d.adapterName} (${d.adapterType})`;

  // Update System Bar
  document.getElementById('sys-os').textContent = d.osCaption;
  document.getElementById('sys-plan').textContent = d.plan;
  document.getElementById('sys-def').textContent = d.defender;
  document.getElementById('system-bar').style.opacity = '1';
}

export function updateMonitorData(d) {
  document.getElementById('val-cpu').textContent = `${d.cpu}%`;
  document.getElementById('val-ram').textContent = `${d.ramPct}%`;
  document.getElementById('sub-ram').textContent = `${d.ramUsed} GB de ${d.ramTotal} GB em uso`;

  // Update Sparklines
  const drawSparkline = (selector, data) => {
    if (!data || data.length === 0) return;
    const maxVal = 100;
    const w = 100, h = 30;
    let points = data.map((val, i) => {
      const x = (i / 60) * w;
      const y = h - ((val / maxVal) * h);
      return `${x},${y}`;
    });
    
    document.querySelector(`${selector} .sparkline-line`).setAttribute('points', points.join(' '));
    if (points.length > 0) {
      const areaPoints = `0,${h} ${points.join(' ')} ${(data.length - 1)/60 * w},${h}`;
      document.querySelector(`${selector} .sparkline-area`).setAttribute('points', areaPoints);
    }
  };

  drawSparkline('.card-cpu', d.cpuHistory);
  drawSparkline('.card-ram', d.ramHistory);
}
