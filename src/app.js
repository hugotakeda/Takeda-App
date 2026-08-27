import { renderHistory, initHistory } from './pages/History.js';
import { initI18n, t } from './i18n.js';
import { renderLogin } from './pages/Login.js';
import { resumeSession, logout } from './auth.js';
import { renderApps, initApps } from './pages/Apps.js';

// Setup Window Controls
document.getElementById('btn-minimize').addEventListener('click', () => window.pulso.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.pulso.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.pulso.close());

const container = document.getElementById('page-container');
let lastDiagnostic = null;
let contentContainer = null; // Will be set after sidebar renders
let currentPage = 'dashboard';

let currentUser = null;
let currentSysUsername = null;

// Sidebar SVG Icons
const SIDEBAR_ICONS = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  history: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  powerplan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  apps: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

function renderAppLayout(user, sysUsername) {
  currentUser = user;
  currentSysUsername = sysUsername;

  container.className = 'app-layout';
  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-user">
        <img class="sidebar-avatar" src="${user?.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="Avatar">
      </div>
      <nav class="sidebar-nav">
        <button class="sidebar-nav-item active" data-page="dashboard">
          ${SIDEBAR_ICONS.dashboard}
          <span>Dashboard</span>
        </button>
        <button class="sidebar-nav-item" data-page="history">
          ${SIDEBAR_ICONS.history}
          <span>Histórico</span>
        </button>
        <button class="sidebar-nav-item" data-page="powerplan">
          ${SIDEBAR_ICONS.powerplan}
          <span>Plano de Energia</span>
        </button>
        <button class="sidebar-nav-item" data-page="apps">
          ${SIDEBAR_ICONS.apps}
          <span>Instaladores</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-nav-item" id="btn-sidebar-logout">
          ${SIDEBAR_ICONS.logout}
          <span>Sair</span>
        </button>
      </div>
    </aside>
    <div class="content" id="content-area"></div>
  `;

  contentContainer = document.getElementById('content-area');

  // Bind sidebar navigation
  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Bind logout
  document.getElementById('btn-sidebar-logout').addEventListener('click', async () => {
    await logout();
    window.location.reload();
  });
}

function navigateTo(page) {
  if (page === currentPage && page !== 'powerplan') return;

  // Stop monitor when leaving dashboard
  if (currentPage === 'dashboard') {
    window.pulso.stopMonitor();
    window.pulso.removeMonitorListener();
  }

  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Power plan opens as modal
  if (page === 'powerplan') {
    document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === 'powerplan');
    });
    openPowerPlanModal();
    return;
  }

  currentPage = page;

  switch (page) {
    case 'dashboard':
      renderDashboard();
      initDashboard();
      break;
    case 'history':
      contentContainer.innerHTML = renderHistory();
      initHistory();
      break;
    case 'apps':
      contentContainer.innerHTML = renderApps();
      initApps();
      break;
  }
}

function renderDashboard(user = currentUser, sysUsername = currentSysUsername) {
  currentUser = user;
  currentSysUsername = sysUsername;

  const target = contentContainer || container;

  target.innerHTML = `
    <div class="dashboard-header">
      <div style="display:flex; align-items:center; gap: 12px;">
        <h1 class="page-title">Bem-vindo, <span style="color:var(--accent-blue)">@${currentSysUsername || currentUser?.username || 'Usuário'}</span>!</h1>
      </div>
      <div style="display:flex; gap:12px; align-items:center;">
        <div class="live-indicator">
          <div class="dot" id="header-live-dot"></div> <span id="header-live-text">${t('loading')}</span>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- Left Column: Health -->
      <div class="card health-card">
        <div class="health-header">${t('diag_ok')}</div>
        
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

        <div class="health-status" id="health-status">${t('btn_analyzing')}</div>
        <div class="health-desc" id="health-desc">${t('loading')}</div>

        <button class="btn-primary" id="btn-run-diag">${t('btn_analyze')}</button>
      </div>

      <!-- Right Column: Metrics -->
      <div class="metrics-right">
        <!-- CPU Card -->
        <div class="card metric-card">
          <div class="card-title">${t('system_cpu')}</div>
          <div class="card-value" id="val-cpu">--<small>%</small></div>
          <div class="card-desc" id="desc-cpu">${t('loading')}</div>
          <div class="chart-container chart-cpu">
            <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <polygon class="sparkline-area" id="area-cpu" points="" />
              <polyline class="sparkline-line" id="line-cpu" points="" />
            </svg>
          </div>
        </div>

        <!-- GPU Card -->
        <div class="card metric-card">
          <div class="card-title">${t('system_info')} (GPU)</div>
          <div class="card-value" id="val-gpu">0<small>%</small></div>
          <div class="card-desc" id="desc-gpu">${t('loading')}</div>
          <div class="progress-bg">
            <div class="progress-fill" id="bar-gpu" style="width: 0%"></div>
            <div class="progress-thumb" id="thumb-gpu" style="left: 0%"></div>
          </div>
        </div>

        <!-- RAM Card -->
        <div class="card metric-card">
          <div class="card-title">${t('system_mem')}</div>
          <div class="card-value" id="val-ram">-- <small>GB</small></div>
          <div class="card-desc" id="desc-ram">${t('loading')}</div>
          <div class="chart-container chart-ram">
            <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <polygon class="sparkline-area" id="area-ram" points="" />
              <polyline class="sparkline-line" id="line-ram" points="" />
            </svg>
          </div>
        </div>

        <!-- Latency Card -->
        <div class="card metric-card">
          <div class="card-title">Ping / Network</div>
          <div class="card-value" id="val-lat">-- <small>ms</small></div>
          <div class="card-desc" id="desc-lat">${t('loading')}</div>
          <div class="badge" id="badge-lat">
            <div class="dot" id="dot-lat"></div> <span id="text-lat">${t('loading')}</span>
          </div>
        </div>

        <!-- System Bar -->
        <div class="card system-bar">
          <span class="label">Sistema</span>
          <span><strong id="sys-os">--</strong></span>
          <span>·</span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><strong id="sys-cpu">--</strong></span>
          <span>·</span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><strong id="sys-gpu">--</strong></span>
          <span>·</span>
          <span style="flex-shrink: 0;"><strong id="sys-ram">--</strong></span>
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

  // ── OTA Update Listeners ──
  initUpdateListeners();
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
  const liveText = document.getElementById('header-live-text');
  if (liveText && liveText.textContent !== 'Ao vivo') {
    liveText.textContent = 'Ao vivo';
    document.getElementById('header-live-dot').style.backgroundColor = 'var(--accent-green)';
  }

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
   OTA UPDATE BANNER LOGIC
==================================================== */

const UPDATE_ICONS = {
  available: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  downloading: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="19 15 12 22 5 15"/></svg>`,
  ready: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

function removeUpdateBanner() {
  const existing = document.getElementById('update-banner');
  if (existing) {
    existing.classList.add('update-banner-dismiss');
    setTimeout(() => existing.remove(), 300);
  }
}

function showUpdateBanner(state, info = {}) {
  removeUpdateBanner();

  // Small delay so dismiss animation finishes if there was a previous banner
  setTimeout(() => {
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'update-banner';

    if (state === 'available') {
      banner.innerHTML = `
        <div class="update-banner-header">
          <div class="update-banner-icon available">${UPDATE_ICONS.available}</div>
          <div class="update-banner-text">
            <div class="update-banner-title">Nova versão disponível</div>
            <div class="update-banner-desc">v${info.version || '?'} está pronta para download</div>
          </div>
          <button class="update-banner-close" id="btn-update-dismiss">✕</button>
        </div>
        <div class="update-banner-actions">
          <button class="btn-update-secondary" id="btn-update-later">Depois</button>
          <button class="btn-update-primary" id="btn-update-download">Baixar agora</button>
        </div>
      `;
    } else if (state === 'downloading') {
      banner.innerHTML = `
        <div class="update-banner-header">
          <div class="update-banner-icon downloading">${UPDATE_ICONS.downloading}</div>
          <div class="update-banner-text">
            <div class="update-banner-title">Baixando atualização...</div>
            <div class="update-banner-desc" id="update-progress-text">${info.percent || 0}%</div>
          </div>
        </div>
        <div class="update-banner-progress">
          <div class="update-banner-progress-fill" id="update-progress-bar" style="width: ${info.percent || 0}%"></div>
        </div>
      `;
    } else if (state === 'ready') {
      banner.innerHTML = `
        <div class="update-banner-header">
          <div class="update-banner-icon ready">${UPDATE_ICONS.ready}</div>
          <div class="update-banner-text">
            <div class="update-banner-title">Atualização pronta!</div>
            <div class="update-banner-desc">Reinicie para aplicar v${info.version || '?'}</div>
          </div>
          <button class="update-banner-close" id="btn-update-dismiss">✕</button>
        </div>
        <div class="update-banner-actions">
          <button class="btn-update-secondary" id="btn-update-later">Depois</button>
          <button class="btn-update-primary green" id="btn-update-install">Reiniciar agora</button>
        </div>
      `;
    }

    document.body.appendChild(banner);

    // Bind actions using querySelector on the banner to avoid ID collisions if multiple banners exist
    const dismissBtn = banner.querySelector('#btn-update-dismiss');
    if (dismissBtn) dismissBtn.addEventListener('click', removeUpdateBanner);

    const laterBtn = banner.querySelector('#btn-update-later');
    if (laterBtn) laterBtn.addEventListener('click', removeUpdateBanner);

    const downloadBtn = banner.querySelector('#btn-update-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        showUpdateBanner('downloading', { percent: 0 });
        window.pulso.downloadUpdate();
      });
    }

    const installBtn = banner.querySelector('#btn-update-install');
    if (installBtn) {
      installBtn.addEventListener('click', () => {
        window.pulso.installUpdate();
      });
    }
  }, 350);
}

function initUpdateListeners() {
  window.pulso.onUpdateAvailable((info) => {
    showUpdateBanner('available', info);
  });

  window.pulso.onDownloadProgress((progress) => {
    const bar = document.getElementById('update-progress-bar');
    const text = document.getElementById('update-progress-text');
    if (bar) bar.style.width = `${progress.percent}%`;
    if (text) text.textContent = `${progress.percent}%`;
  });

  window.pulso.onUpdateDownloaded((info) => {
    showUpdateBanner('ready', info);
  });

  window.pulso.onUpdateError((err) => {
    console.error('[Updater]', err.message);
  });
}

/* ====================================================
   MODAL LOGIC 
==================================================== */

window.showConfirmModal = function(title, text, onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.style.width = '480px';
  content.style.height = 'auto';
  overlay.classList.add('active');

  content.innerHTML = `
    <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
      <div class="modal-title" style="font-size: 1.25rem;">${title}</div>
    </div>
    <div class="modal-body" style="padding-top: 16px; padding-bottom: 24px; display: flex; flex-direction: column; justify-content: center;">
      <p class="text-gray" style="line-height: 1.5; white-space: pre-wrap; font-size: 0.9rem;">${text}</p>
    </div>
    <div class="modal-footer" style="justify-content: flex-end; gap: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 16px;">
      <button class="btn-modal" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary);" onclick="closeModal()">${t('btn_cancel')}</button>
      <button class="btn-modal" id="btn-modal-confirm">${t('modal_confirm')}</button>
    </div>
  `;

  document.getElementById('btn-modal-confirm').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
};

window.showAlertModal = function(title, text, onClose) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.style.width = '400px';
  content.style.height = 'auto';
  overlay.classList.add('active');

  content.innerHTML = `
    <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
      <div class="modal-title" style="font-size: 1.15rem;">${title}</div>
    </div>
    <div class="modal-body" style="padding-top: 12px; padding-bottom: 12px; overflow-y: hidden; display: flex; flex-direction: column; justify-content: center;">
      <p style="color: var(--text-secondary); line-height: 1.4; white-space: pre-wrap; font-size: 0.9rem; margin: 0;">${text}</p>
    </div>
    <div class="modal-footer" style="justify-content: flex-end; border-top: none; padding-top: 0; padding-bottom: 16px;">
      <button class="btn-modal" id="btn-modal-ok" style="padding: 8px 20px;">OK</button>
    </div>
  `;

  document.getElementById('btn-modal-ok').addEventListener('click', () => {
    closeModal();
    if (onClose) onClose();
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
  content.style.width = '520px';
  content.style.height = 'auto';
  overlay.classList.add('active');

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${t('power_title')}</div>
      <div class="modal-subtitle">${t('power_desc')}</div>
    </div>
    <div class="modal-body" style="padding-top: 16px;">
      <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: var(--accent-green-dim); color: var(--accent-green); border-radius: 12px; display: flex; justify-content: center; align-items: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(74, 222, 128, 0.1);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5 2L3 13h8v9l9-11h-8V2z"/>
          </svg>
        </div>
        <p class="text-gray" style="line-height: 1.6; margin: 0; font-size: 0.95rem;">
          ${t('power_desc_full')}
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
          <div style="color: #f87171; font-weight: 600; margin-bottom: 4px; font-size: 0.9rem; letter-spacing: 0.3px; text-transform: uppercase;">${t('power_warn_title')}</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.5;">
            ${t('power_warn_desc')}
          </div>
        </div>
      </div>
      <div class="diag-list" style="margin-bottom: 0;">
        <div class="diag-item" style="border-bottom: none;">
          <div class="diag-label">
            <div class="diag-dot ok"></div> ${t('power_current')}
          </div>
          <div class="diag-value ok" id="current-plan-modal">${t('loading')}</div>
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
    const content = document.getElementById('modal-content');
    
    // Travar a altura atual para evitar que o modal mude de tamanho
    const currentHeight = content.offsetHeight;
    content.style.height = currentHeight + 'px';
    
    // Inject animation (com os pontinhos pulando igual ao lixo)
    content.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px 20px; text-align: center;">
        <div class="power-anim-container">
          <svg class="power-anim-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <div class="power-anim-text" style="margin-bottom: 16px;">Injetando Takeda Power</div>
        <div class="clean-anim-dots">
          <div class="clean-dot" style="background: #FFD700;"></div>
          <div class="clean-dot" style="background: #FFD700;"></div>
          <div class="clean-dot" style="background: #FFD700;"></div>
        </div>
      </div>
    `;

    try {
      const animPromise = new Promise(resolve => setTimeout(resolve, 3000));
      const applyPromise = window.pulso.applyPowerPlan();
      
      const [_, res] = await Promise.all([animPromise, applyPromise]);
      
      if (res.status === 'OK') {
        content.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px 20px; text-align: center;">
            <div class="clean-success-check" style="background: rgba(255, 215, 0, 0.15); box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);">
              <svg viewBox="0 0 24 24" style="width: 36px; height: 36px; fill: none; stroke: #FFD700; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;">
                <polyline class="clean-check-path" points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div style="font-size: 1.4rem; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: #FFD700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);">Plano Ativado!</div>
            <div style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5;">
              O sistema foi otimizado para máxima performance.
            </div>
          </div>
        `;
        
        setTimeout(() => {
          content.style.height = 'auto'; // Restaurar altura
          closeModal();
          // Atualiza o texto do dashboard se existir
          window.pulso.getCurrentPlan().then(p => {
             const dashboardEl = document.getElementById('current-plan');
             if(dashboardEl) dashboardEl.textContent = p;
          }).catch(()=>{});
        }, 2000);

      } else {
         content.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px 20px; text-align: center;">
            <div style="font-size: 2rem; color: #f87171; margin-bottom: 16px;">✗</div>
            <div style="font-size: 1.1rem; color: #f87171; font-weight: 600;">Falha ao aplicar</div>
            <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 8px;">${res.message}</div>
            <button class="btn-primary" onclick="closeModal()" style="margin-top: 24px; width: auto; padding: 10px 40px;">Fechar</button>
          </div>
         `;
      }
    } catch (e) {
      content.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px 20px; text-align: center;">
          <div style="font-size: 2rem; color: #f87171; margin-bottom: 16px;">✗</div>
          <div style="font-size: 1.1rem; color: #f87171; font-weight: 600;">Erro Inesperado</div>
          <button class="btn-primary" onclick="closeModal()" style="margin-top: 24px; width: auto; padding: 10px 40px;">Fechar</button>
        </div>
       `;
    }
  });
}

async function openModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.style.width = '600px';
  content.style.height = '540px';
  overlay.classList.add('active');

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
  
  // Restore sidebar active state to current page
  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === currentPage);
  });
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
    document.getElementById('clean-footer-text').style.display = 'none';

    // Show cleaning animation
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; gap: 20px;">
        <div class="clean-anim-container">
          <svg class="clean-anim-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;" class="clean-anim-text">Limpando arquivos...</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">${items.length} ${items.length === 1 ? 'categoria selecionada' : 'categorias selecionadas'}</div>
        </div>
        <div class="clean-anim-dots">
          <span class="clean-dot"></span>
          <span class="clean-dot"></span>
          <span class="clean-dot"></span>
        </div>
      </div>
    `;
    footer.innerHTML = '';

    try {
      const animPromise = new Promise(r => setTimeout(r, 3500));
      const [res] = await Promise.all([
        window.pulso.executeCleanup(items),
        animPromise
      ]);
      
      // Show success with animated checkmark
      body.innerHTML = `
        <div style="text-align:center; padding: 10px 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;">
          <div class="clean-success-check">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline class="clean-check-path" points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style="color: var(--text-primary); font-size: 1.25rem; margin: 16px 0 8px 0;">Limpeza concluída!</h2>
          <p style="color: var(--text-secondary); font-size: 1rem; margin-bottom: 16px;">Espaço liberado: <strong style="color: var(--text-primary);">${formatBytes(res.totalFreed)}</strong></p>
          <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 6px; font-size: 0.85rem; color: var(--text-secondary); text-align: left; line-height: 1.4; width: 100%;">
            <strong>Nota:</strong> Alguns arquivos em uso pelo sistema não puderam ser removidos.
          </div>
        </div>
      `;
      footer.innerHTML = `<button class="btn-modal" onclick="closeModal()">Fechar</button>`;
    } catch(e) {
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; gap: 12px;">
          <div style="color: #f87171; font-size: 2.5rem;">✗</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">Erro ao executar limpeza</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">Tente novamente em alguns instantes.</div>
        </div>
      `;
      footer.innerHTML = `<button class="btn-modal" id="btn-back-clean">Voltar</button>`;
      document.getElementById('btn-back-clean').addEventListener('click', () => {
        renderCleanTab(body, footer);
      });
    }
  });
}

function showSplashOverlay(username, callback) {
  if (window.pulso && window.pulso.resize) window.pulso.resize(256, 256);
  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:var(--bg-main);z-index:99999;display:flex;flex-direction:column;justify-content:center;align-items:center;animation:fadeIn 0.3s ease-out;">
      <div class="loading-spinner"></div>
      <p style="color:var(--text-secondary);margin-top:16px;font-size:0.95rem;">
        Olá, <strong style="color:var(--accent-blue);">@${username}</strong>
      </p>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Carrega o dashboard por trás da splash screen para evitar que o usuário veja a tela carregando
  callback();
  
  setTimeout(() => {
    if (window.pulso && window.pulso.resize) window.pulso.resize(970, 545);
    
    // Pequeno delay para garantir que a janela redimensione antes de sumir a splash
    setTimeout(() => {
      overlay.style.animation = 'fadeOut 0.3s ease-in forwards';
      setTimeout(() => {
        overlay.remove();
      }, 280);
    }, 50);
  }, 2000);
}

// Initial render
(async () => {
  const style = document.createElement('style');
  style.innerHTML = '@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
  document.head.appendChild(style);

  await initI18n();

  setTimeout(() => {
    if (window.pulso && window.pulso.ready) window.pulso.ready();
  }, 1000);

  const session = await resumeSession();
  renderLogin(container, session, async (user) => {
    let sysUsername = user.username;
    if (window.pulso && window.pulso.getUsername) {
      sysUsername = await window.pulso.getUsername();
    }
    showSplashOverlay(sysUsername, () => {
      renderAppLayout(user, sysUsername);
      renderDashboard(user, sysUsername);
      initDashboard();
    });
  });
})();

