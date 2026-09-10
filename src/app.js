import { renderHistory, initHistory } from './pages/History.js';
import { initI18n, t } from './i18n.js';
import { renderLogin } from './pages/Login.js';
import { resumeSession, logout } from './auth.js';
import { renderApps, initApps } from './pages/Apps.js';
import { renderTools, initTools } from './pages/Tools.js';
import { escapeHtml, formatBytes, safeExternalUrl } from './ui.js';
import { bindModalInfrastructure, closeModal, openModalShell } from './modal.js';

// Setup Window Controls
document.getElementById('btn-minimize')?.addEventListener('click', () => window.pulso.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => window.pulso.maximize());
document.getElementById('btn-close')?.addEventListener('click', () => window.pulso.close());

const container = document.getElementById('page-container');
let lastDiagnostic = null;
let contentContainer = null; // Will be set after sidebar renders
let currentPage = 'dashboard';
let navigationTimer = null;
let navigationGeneration = 0;
let pageDisposer = null;
let dashboardGeneration = 0;
let dashboardMounted = false;
let updateListenersInitialized = false;
let updateBannerDismissTimer = null;
let modalGeneration = 0;
let cleanupGeneration = 0;

let currentUser = null;
let currentSysUsername = null;

const BRAND_ICON = '../assets/takeda-icon-256.png';

bindModalInfrastructure();
window.closeModal = closeModal;
window.addEventListener('takeda:modal-closed', () => {
  modalGeneration += 1;
  cleanupGeneration += 1;
  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === currentPage);
  });
});

// Sidebar SVG Icons
const SIDEBAR_ICONS = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  history: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  powerplan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  apps: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  tools: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

function renderAppLayout(user, sysUsername) {
  currentUser = user;
  currentSysUsername = sysUsername;
  const fallbackAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
  const avatarUrl = safeExternalUrl(user?.avatar, fallbackAvatar);
  const visibleUsername = escapeHtml(currentSysUsername || user?.username || 'usuário');

  container.className = 'app-layout';
  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-mark">
          <img src="${BRAND_ICON}" alt="">
        </div>
        <div class="sidebar-brand-copy">
          <span>Takeda</span>
          <small>System Suite</small>
        </div>
      </div>
      <div class="sidebar-nav-label">Workspace</div>
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
        <button class="sidebar-nav-item" data-page="tools">
          ${SIDEBAR_ICONS.tools}
          <span>Ferramentas</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-profile">
          <img class="sidebar-avatar" src="${escapeHtml(avatarUrl)}" alt="Avatar de ${escapeHtml(user?.username || 'usuário')}">
          <div class="sidebar-profile-copy">
            <span>@${visibleUsername}</span>
            <small><i></i> Conectado</small>
          </div>
          <button class="sidebar-logout" id="btn-sidebar-logout" title="Sair" aria-label="Sair">
            ${SIDEBAR_ICONS.logout}
          </button>
        </div>
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
    try {
      disposeCurrentPage();
      await logout();
      window.location.reload();
    } catch (error) {
      console.error('[Auth] Falha ao sair.', error);
      window.showAlertModal?.('Erro ao sair', 'Não foi possível encerrar a sessão agora. Tente novamente.');
    }
  });
}

function navigateTo(page) {
  // Power plan opens as modal
  if (page === 'powerplan') {
    document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === 'powerplan');
    });
    void openPowerPlanModal();
    return;
  }

  if (page === currentPage) return;

  disposeCurrentPage();

  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  currentPage = page;

  switch (page) {
    case 'dashboard':
      swapContent(page, () => { renderDashboard(); initDashboard(); });
      break;
    case 'history':
      swapContent(page, () => { contentContainer.innerHTML = renderHistory(); void initHistory(); });
      break;
    case 'apps':
      swapContent(page, () => { contentContainer.innerHTML = renderApps(); pageDisposer = initApps(); });
      break;
    case 'tools':
      swapContent(page, () => { contentContainer.innerHTML = renderTools(); pageDisposer = initTools(); });
      break;
    default:
      currentPage = 'dashboard';
      swapContent('dashboard', () => { renderDashboard(); initDashboard(); });
  }
}

function disposeCurrentPage() {
  if (currentPage === 'dashboard') stopDashboard();
  const dispose = pageDisposer;
  pageDisposer = null;
  if (typeof dispose === 'function') {
    try { dispose(); } catch (error) { console.warn('[Navigation] Falha ao desmontar a página.', error); }
  }
}

function stopDashboard() {
  dashboardMounted = false;
  dashboardGeneration += 1;
  try {
    window.pulso.removeMonitorListener();
    Promise.resolve(window.pulso.stopMonitor()).catch((error) => {
      console.warn('[Monitor] Falha ao interromper o monitor.', error);
    });
  } catch (error) {
    console.warn('[Monitor] Falha ao desmontar o monitor.', error);
  }
}

// Smoothly swaps the page content: fades the current content out, runs
// `renderFn` (which repaints #content-area), then fades the new content in.
function swapContent(page, renderFn) {
  if (!contentContainer) { renderFn(); return; }
  if (navigationTimer) clearTimeout(navigationTimer);
  const generation = ++navigationGeneration;
  contentContainer.classList.remove('content-transition-in');
  contentContainer.classList.add('content-transition-out');
  navigationTimer = setTimeout(() => {
    navigationTimer = null;
    if (generation !== navigationGeneration || currentPage !== page) return;
    renderFn();
    contentContainer.classList.remove('content-transition-out');
    void contentContainer.offsetWidth; // force reflow so the entrance animation restarts
    contentContainer.classList.add('content-transition-in');
  }, 110);
}

function renderDashboard(user = currentUser, sysUsername = currentSysUsername) {
  currentUser = user;
  currentSysUsername = sysUsername;

  const target = contentContainer || container;
  const visibleUsername = escapeHtml(currentSysUsername || currentUser?.username || 'Usuário');

  target.innerHTML = `
    <div class="dashboard-header">
      <div class="page-heading">
        <div class="page-eyebrow">Visão geral</div>
        <h1 class="page-title">Olá, <span class="page-title-accent">@${visibleUsername}</span></h1>
        <p class="page-subtitle">Sua máquina em tempo real, sem ruído.</p>
      </div>
      <div class="live-indicator">
        <div class="dot" id="header-live-dot"></div>
        <span id="header-live-text">${t('loading')}</span>
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
        <div class="card metric-card metric-card--cpu">
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
        <div class="card metric-card metric-card--gpu">
          <div class="card-title">Driver da GPU</div>
          <div class="card-value" id="val-gpu">--</div>
          <div class="card-desc" id="desc-gpu">${t('loading')}</div>
          <div class="progress-bg">
            <div class="progress-fill progress-fill--zero" id="bar-gpu"></div>
            <div class="progress-thumb progress-thumb--zero" id="thumb-gpu"></div>
          </div>
        </div>

        <!-- RAM Card -->
        <div class="card metric-card metric-card--ram">
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
        <div class="card metric-card metric-card--network">
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
          <span class="system-spec"><strong id="sys-cpu">--</strong></span>
          <span>·</span>
          <span class="system-spec"><strong id="sys-gpu">--</strong></span>
          <span>·</span>
          <span class="system-spec system-spec--fixed"><strong id="sys-ram">--</strong></span>
        </div>
      </div>
    </div>
  `;
}

function initDashboard() {
  dashboardMounted = true;
  const generation = ++dashboardGeneration;
  const isCurrent = () => dashboardMounted && currentPage === 'dashboard' && generation === dashboardGeneration;

  try {
    Promise.resolve(window.pulso.startMonitor(1000)).catch((error) => {
      console.warn('[Monitor] Não foi possível iniciar o monitor.', error);
    });
    window.pulso.onMonitorData((data) => {
      if (isCurrent()) updateMonitorData(data);
    });
  } catch (error) {
    console.warn('[Monitor] Bridge indisponível.', error);
  }

  Promise.resolve(window.pulso.runDiagnostic())
    .then((d) => {
      if (!isCurrent() || !d) return;
      lastDiagnostic = d;

      const descCpu = document.getElementById('desc-cpu');
      const descGpu = document.getElementById('desc-gpu');
      const valueGpu = document.getElementById('val-gpu');
      const barGpu = document.getElementById('bar-gpu');
      const thumbGpu = document.getElementById('thumb-gpu');
      const sysOs = document.getElementById('sys-os');
      const sysCpu = document.getElementById('sys-cpu');
      const sysGpu = document.getElementById('sys-gpu');
      const sysRam = document.getElementById('sys-ram');
      if (!descCpu || !descGpu || !valueGpu || !sysOs || !sysCpu || !sysGpu || !sysRam) return;

      descCpu.textContent = `${d.cpuModel || 'Processador'} · ${d.cpuCores ?? 'N/D'} núcleos`;
      descGpu.textContent = `${d.gpuName || 'GPU não identificada'} · driver ${d.gpuVer || 'N/D'}`;
      const gpuDays = Number(d.gpuDays);
      valueGpu.innerHTML = Number.isFinite(gpuDays) && gpuDays >= 0 ? `${gpuDays}<small> dias</small>` : 'N/D';
      const gpuHealth = !Number.isFinite(gpuDays) || gpuDays < 0 ? 0 : gpuDays > 365 ? 24 : gpuDays > 180 ? 55 : 100;
      if (barGpu) barGpu.style.width = `${gpuHealth}%`;
      if (thumbGpu) thumbGpu.style.left = `${gpuHealth}%`;

      sysOs.textContent = `Windows ${d.osBuild || 'N/D'}`;
      let cleanCpu = String(d.cpuModel || 'N/D').replace(/Intel\(R\) Core\(TM\) /g, 'Intel ');
      cleanCpu = cleanCpu.replace(/AMD /g, '').replace(/ \d+-Core Processor/g, '').replace(/ Processor/g, '').replace(/ CPU @ .*/g, '').replace(/ with Radeon Graphics/g, '');
      sysCpu.textContent = cleanCpu;
      sysGpu.textContent = String(d.gpuName || 'N/D').replace('AMD ', '').replace('NVIDIA ', '');
      sysRam.textContent = `${d.ramTotalGB ?? 'N/D'} GB ${d.ramType || ''}`.trim();
      updateHealthCard(d);
    })
    .catch((error) => {
      if (!isCurrent()) return;
      console.error('[Diagnostic] Falha no diagnóstico inicial.', error);
      const healthStatus = document.getElementById('health-status');
      const healthDesc = document.getElementById('health-desc');
      if (healthStatus) healthStatus.textContent = 'Não foi possível analisar';
      if (healthDesc) healthDesc.textContent = 'Tente executar uma nova análise.';
    });

  document.getElementById('btn-run-diag')?.addEventListener('click', () => void openModal());

  initUpdateListeners();
}

function updateHealthCard(d) {
  const scoreElement = document.getElementById('health-score');
  const gaugeFill = document.getElementById('gauge-fill');
  const status = document.getElementById('health-status');
  const desc = document.getElementById('health-desc');
  if (!scoreElement || !gaugeFill || !status || !desc) return;

  const rawScore = Number(d?.score?.value);
  if (!Number.isFinite(rawScore)) {
    scoreElement.textContent = '--';
    gaugeFill.style.strokeDasharray = '0 251.2';
    status.textContent = 'Dados indisponíveis';
    desc.textContent = 'Execute uma nova análise.';
    return;
  }
  const score = Math.max(0, Math.min(100, rawScore));

  scoreElement.textContent = score;
  const dasharray = `${(score / 100) * 251.2} 251.2`;
  gaugeFill.style.strokeDasharray = dasharray;
  
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
  
  desc.textContent = `${d?.score?.warnings ?? 0} avisos · ${d?.score?.criticals ?? 0} crítico`;
}

function updateMonitorData(d) {
  const liveText = document.getElementById('header-live-text');
  if (liveText && liveText.textContent !== 'Ao vivo') {
    liveText.textContent = 'Ao vivo';
    const liveDot = document.getElementById('header-live-dot');
    if (liveDot) liveDot.style.backgroundColor = 'var(--accent-green)';
  }

  const cpuValue = document.getElementById('val-cpu');
  const ramValue = document.getElementById('val-ram');
  const ramDesc = document.getElementById('desc-ram');
  if (!cpuValue || !ramValue || !ramDesc) return;

  const cpu = Number(d?.cpu);
  const ramUsed = Number(d?.ramUsed);
  cpuValue.innerHTML = `${Number.isFinite(cpu) ? cpu : '--'}<small>%</small>`;
  ramValue.innerHTML = `${Number.isFinite(ramUsed) ? ramUsed.toFixed(1) : '--'} <small>GB</small>`;
  ramDesc.textContent = `de ${d?.ramTotal ?? '--'} GB · ${d?.ramPct ?? '--'}%`;

  if (Number(d?.ping) > -1) {
    const latencyValue = document.getElementById('val-lat');
    const latencyDesc = document.getElementById('desc-lat');
    const latencyText = document.getElementById('text-lat');
    const latencyDot = document.getElementById('dot-lat');
    if (latencyValue) latencyValue.innerHTML = `${d.ping} <small>ms</small>`;
    if (latencyDesc) latencyDesc.textContent = d.packetLoss === 0 ? 'Google DNS · sem perda de pacotes' : `Google DNS · ${d.packetLoss}% perda`;
    if (latencyText) latencyText.textContent = d.ping < 50 ? 'Estável' : 'Instável';
    if (latencyDot) latencyDot.style.backgroundColor = d.ping < 50 ? 'var(--accent-green)' : '#facc15';
  } else {
    const latencyValue = document.getElementById('val-lat');
    const latencyDesc = document.getElementById('desc-lat');
    const latencyText = document.getElementById('text-lat');
    const latencyDot = document.getElementById('dot-lat');
    if (latencyValue) latencyValue.innerHTML = `-- <small>ms</small>`;
    if (latencyDesc) latencyDesc.textContent = 'Sem conexão';
    if (latencyText) latencyText.textContent = 'Offline';
    if (latencyDot) latencyDot.style.backgroundColor = '#f87171';
  }

  const drawSparkline = (idLine, idArea, data) => {
    if (!data || data.length === 0) return;
    const w = 100, h = 30, maxVal = 100;
    let points = data.map((val, i) => {
      const x = (i / 60) * w;
      const y = h - ((val / maxVal) * h);
      return `${x},${y}`;
    });
    const line = document.getElementById(idLine);
    const area = document.getElementById(idArea);
    if (!line || !area) return;
    line.setAttribute('points', points.join(' '));
    if (points.length > 0) {
      area.setAttribute('points', `0,${h} ${points.join(' ')} ${(data.length - 1)/60 * w},${h}`);
    }
  };

  drawSparkline('line-cpu', 'area-cpu', d?.cpuHistory);
  drawSparkline('line-ram', 'area-ram', d?.ramHistory);
}

/* ====================================================
   OTA UPDATE BANNER LOGIC
==================================================== */

const UPDATE_ICONS = {
  available: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  downloading: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="19 15 12 22 5 15"/></svg>`,
  ready: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

function removeUpdateBanner(immediate = false) {
  if (updateBannerDismissTimer) {
    clearTimeout(updateBannerDismissTimer);
    updateBannerDismissTimer = null;
  }

  const existing = document.getElementById('update-banner');
  if (!existing) return;
  if (immediate) {
    existing.remove();
    return;
  }

  existing.classList.add('update-banner-dismiss');
  updateBannerDismissTimer = setTimeout(() => {
    existing.remove();
    updateBannerDismissTimer = null;
  }, 300);
}

function showUpdateBanner(state, info = {}) {
  if (!['available', 'downloading', 'ready'].includes(state)) return;
  removeUpdateBanner(true);

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  const version = escapeHtml(info?.version || '?');
  const percent = Math.max(0, Math.min(100, Number(info?.percent) || 0));

  if (state === 'available') {
    banner.innerHTML = `
        <div class="update-banner-header">
          <div class="update-banner-icon available">${UPDATE_ICONS.available}</div>
          <div class="update-banner-text">
            <div class="update-banner-title">Nova versão disponível</div>
            <div class="update-banner-desc">v${version} está pronta para download</div>
          </div>
          <button class="update-banner-close" id="btn-update-dismiss" aria-label="Dispensar atualização">✕</button>
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
            <div class="update-banner-desc" id="update-progress-text">${percent}%</div>
          </div>
        </div>
        <div class="update-banner-progress">
          <div class="update-banner-progress-fill" id="update-progress-bar"></div>
        </div>
      `;
  } else {
    banner.innerHTML = `
        <div class="update-banner-header">
          <div class="update-banner-icon ready">${UPDATE_ICONS.ready}</div>
          <div class="update-banner-text">
            <div class="update-banner-title">Atualização pronta!</div>
            <div class="update-banner-desc">Reinicie para aplicar v${version}</div>
          </div>
          <button class="update-banner-close" id="btn-update-dismiss" aria-label="Dispensar atualização">✕</button>
        </div>
        <div class="update-banner-actions">
          <button class="btn-update-secondary" id="btn-update-later">Depois</button>
          <button class="btn-update-primary green" id="btn-update-install">Reiniciar agora</button>
        </div>
      `;
  }

  document.body.appendChild(banner);
  const initialProgress = banner.querySelector('#update-progress-bar');
  if (initialProgress) initialProgress.style.width = `${percent}%`;

  const dismissBtn = banner.querySelector('#btn-update-dismiss');
  if (dismissBtn) dismissBtn.addEventListener('click', () => removeUpdateBanner());

  const laterBtn = banner.querySelector('#btn-update-later');
  if (laterBtn) laterBtn.addEventListener('click', () => removeUpdateBanner());

  const downloadBtn = banner.querySelector('#btn-update-download');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      showUpdateBanner('downloading', { percent: 0 });
      try {
        const result = await window.pulso.downloadUpdate();
        if (result?.error) throw new Error(result.error);
      } catch (error) {
        console.error('[Updater]', error);
        removeUpdateBanner(true);
        window.showAlertModal?.('Atualização indisponível', 'Não foi possível baixar a atualização agora. Tente novamente mais tarde.');
      }
    });
  }

  const installBtn = banner.querySelector('#btn-update-install');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      Promise.resolve(window.pulso.installUpdate()).catch((error) => console.error('[Updater]', error));
    });
  }
}

function initUpdateListeners() {
  if (updateListenersInitialized) return;
  updateListenersInitialized = true;

  window.pulso.onUpdateAvailable((info) => {
    showUpdateBanner('available', info);
  });

  window.pulso.onDownloadProgress((progress) => {
    const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
    const bar = document.getElementById('update-progress-bar');
    const text = document.getElementById('update-progress-text');
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}%`;
  });

  window.pulso.onUpdateDownloaded((info) => {
    showUpdateBanner('ready', info);
  });

  window.pulso.onUpdateError((err) => {
    console.error('[Updater]', err?.message || err);
  });
}

/* ====================================================
   MODAL LOGIC 
==================================================== */

function setModalVariant(content, variant) {
  content.className = `modal-content modal-content--${variant}`;
  content.style.height = '';
}

window.showConfirmModal = function(title, text, onConfirm) {
  const content = document.getElementById('modal-content');
  if (!content) return;
  modalGeneration += 1;
  cleanupGeneration += 1;
  setModalVariant(content, 'confirm');

  content.innerHTML = `
    <div class="modal-header modal-header--compact">
      <div class="modal-title modal-title--confirm" id="confirm-modal-title">${escapeHtml(title)}</div>
    </div>
    <div class="modal-body modal-body--message">
      <p class="modal-message" id="confirm-modal-description">${escapeHtml(text)}</p>
    </div>
    <div class="modal-footer modal-footer--actions">
      <button class="btn-modal btn-modal--secondary" type="button" data-modal-close>${escapeHtml(t('btn_cancel'))}</button>
      <button class="btn-modal" id="btn-modal-confirm" type="button">${escapeHtml(t('modal_confirm'))}</button>
    </div>
  `;

  openModalShell({ labelledBy: 'confirm-modal-title', describedBy: 'confirm-modal-description' });

  document.getElementById('btn-modal-confirm').addEventListener('click', () => {
    closeModal();
    Promise.resolve().then(() => onConfirm?.()).catch((error) => {
      console.error('[Modal] Ação confirmada falhou.', error);
      window.showAlertModal?.('Erro', 'Não foi possível concluir esta ação.');
    });
  });
};

window.showAlertModal = function(title, text, onClose) {
  const content = document.getElementById('modal-content');
  if (!content) return;
  modalGeneration += 1;
  cleanupGeneration += 1;
  setModalVariant(content, 'alert');

  content.innerHTML = `
    <div class="modal-header modal-header--compact">
      <div class="modal-title modal-title--alert" id="alert-modal-title">${escapeHtml(title)}</div>
    </div>
    <div class="modal-body modal-body--alert">
      <p class="modal-message" id="alert-modal-description">${escapeHtml(text)}</p>
    </div>
    <div class="modal-footer modal-footer--alert">
      <button class="btn-modal btn-modal--compact" id="btn-modal-ok" type="button" data-modal-close>OK</button>
    </div>
  `;
  openModalShell({ labelledBy: 'alert-modal-title', describedBy: 'alert-modal-description', onClose });
};
let currentTab = 'diag';
let sizesCache = {};

async function openPowerPlanModal() {
  const content = document.getElementById('modal-content');
  if (!content) return;
  const generation = ++modalGeneration;
  cleanupGeneration += 1;
  const isCurrent = () => generation === modalGeneration && document.getElementById('modal-content') === content && document.getElementById('modal-overlay')?.classList.contains('active');
  setModalVariant(content, 'power');

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-title" id="power-modal-title">${t('power_title')}</div>
      <div class="modal-subtitle" id="power-modal-description">${t('power_desc')}</div>
    </div>
    <div class="modal-body modal-body--power">
      <div class="power-intro">
        <div class="power-intro-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5 2L3 13h8v9l9-11h-8V2z"/>
          </svg>
        </div>
        <p class="power-intro-copy">
          ${t('power_desc_full')}
        </p>
      </div>

      <div class="power-warning">
        <div class="power-warning-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div>
          <div class="power-warning-title">${escapeHtml(t('power_warn_title'))}</div>
          <div class="power-warning-copy">
            ${t('power_warn_desc')}
          </div>
        </div>
      </div>
      <div class="diag-list diag-list--flush">
        <div class="diag-item diag-item--borderless">
          <div class="diag-label">
            <div class="diag-dot ok"></div> ${t('power_current')}
          </div>
          <div class="diag-value ok" id="current-plan-modal">${t('loading')}</div>
        </div>
      </div>
    </div>
    <div class="modal-footer modal-footer--actions" id="modal-footer-plan">
      <button class="btn-modal btn-modal--secondary" id="btn-cancel-plan" type="button" data-modal-close>Cancelar</button>
      <button class="btn-modal" id="btn-apply-plan" disabled>Aplicar Plano Takeda</button>
    </div>
  `;

  openModalShell({ labelledBy: 'power-modal-title', describedBy: 'power-modal-description' });

  try {
    const plan = await window.pulso.getCurrentPlan();
    if (!isCurrent()) return;
    const planElement = document.getElementById('current-plan-modal');
    if (planElement) planElement.textContent = plan;
    const applyElement = document.getElementById('btn-apply-plan');
    if (applyElement) applyElement.disabled = false;
  } catch (e) {
    if (!isCurrent()) return;
    const planElement = document.getElementById('current-plan-modal');
    if (planElement) planElement.textContent = 'Erro ao ler';
    const applyElement = document.getElementById('btn-apply-plan');
    if (applyElement) applyElement.disabled = false;
  }

  const applyButton = document.getElementById('btn-apply-plan');
  if (!applyButton || !isCurrent()) return;
  applyButton.addEventListener('click', async () => {
    if (!isCurrent()) return;
    
    // Travar a altura atual para evitar que o modal mude de tamanho
    const currentHeight = content.offsetHeight;
    content.style.height = currentHeight + 'px';
    
    // Inject animation (com os pontinhos pulando igual ao lixo)
    content.innerHTML = `
      <div class="modal-state">
        <div class="power-anim-container">
          <svg class="power-anim-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <div class="power-anim-text power-anim-text--spaced">Aplicando Takeda Power</div>
        <div class="clean-anim-dots clean-anim-dots--power">
          <div class="clean-dot"></div>
          <div class="clean-dot"></div>
          <div class="clean-dot"></div>
        </div>
      </div>
    `;

    try {
      const animPromise = new Promise(resolve => setTimeout(resolve, 650));
      const applyPromise = window.pulso.applyPowerPlan();
      
      const [_, res] = await Promise.all([animPromise, applyPromise]);
      if (!isCurrent()) return;
      
      if (res.status === 'OK') {
        content.innerHTML = `
          <div class="modal-state">
            <div class="clean-success-check power-success-check">
              <svg class="power-success-icon" viewBox="0 0 24 24">
                <polyline class="clean-check-path" points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="modal-state-title modal-state-title--power">Plano ativado</div>
            <div class="modal-state-copy">
              O sistema foi otimizado para máxima performance.
            </div>
          </div>
        `;
        
          setTimeout(() => {
            if (!isCurrent()) return;
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
          <div class="modal-state modal-state--error">
            <div class="modal-state-symbol">✕</div>
            <div class="modal-state-title">Falha ao aplicar</div>
            <div class="modal-state-copy">${escapeHtml(res?.message || 'O plano não pôde ser aplicado.')}</div>
            <button class="btn-primary modal-state-action" type="button" data-modal-close>Fechar</button>
          </div>
         `;
      }
    } catch (e) {
      if (!isCurrent()) return;
      content.innerHTML = `
        <div class="modal-state modal-state--error">
          <div class="modal-state-symbol">✕</div>
          <div class="modal-state-title">Erro inesperado</div>
          <button class="btn-primary modal-state-action" type="button" data-modal-close>Fechar</button>
        </div>
       `;
    }
  });
}

async function openModal() {
  const content = document.getElementById('modal-content');
  if (!content) return;
  const generation = ++modalGeneration;
  cleanupGeneration += 1;
  currentTab = 'diag';
  const isCurrent = () => generation === modalGeneration && document.getElementById('modal-overlay')?.classList.contains('active');
  setModalVariant(content, 'analysis');

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-title" id="analysis-modal-title">Análise do sistema</div>
      <div class="modal-subtitle" id="modal-subtitle-text">Avaliando componentes...</div>
    </div>
    <div class="modal-tabs" role="tablist" aria-label="Análise do sistema">
      <button type="button" role="tab" aria-selected="true" aria-controls="modal-body" class="modal-tab active" id="tab-diag">Diagnóstico</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="modal-body" class="modal-tab" id="tab-clean">Limpeza</button>
    </div>
    <div class="modal-body" id="modal-body" role="tabpanel" aria-live="polite"></div>
    <div class="modal-footer" id="modal-footer"></div>
  `;
  openModalShell({ labelledBy: 'analysis-modal-title' });

  document.getElementById('tab-diag')?.addEventListener('click', () => switchTab('diag', lastDiagnostic));
  document.getElementById('tab-clean')?.addEventListener('click', () => switchTab('clean', lastDiagnostic));

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
          <div class="loading-spinner loading-spinner--small"></div> <span class="diag-loading-label">${p}</span>
        </div>
        <div class="diag-value diag-value--muted">Analisando...</div>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;
  footer.innerHTML = `<button class="btn-modal" disabled>Analisando...</button>`;

  try {
    const d = await window.pulso.runDiagnostic();
    if (!isCurrent()) return;
    lastDiagnostic = d;
    if (dashboardMounted && currentPage === 'dashboard') updateHealthCard(d);
    Promise.resolve(window.pulso.saveHistory(d)).catch((error) => console.warn('[History] Não foi possível salvar o diagnóstico.', error));

    if (currentTab !== 'diag') return;
    const items = getDiagItems(d);
    for (let i = 0; i < items.length; i++) {
      if (!isCurrent() || currentTab !== 'diag') return;
      const el = document.getElementById(`diag-item-${i}`);
      if (el) {
        el.innerHTML = `
          <div class="diag-label">
            <div class="diag-dot ${items[i].dot}"></div> ${escapeHtml(items[i].label)}
          </div>
          <div class="diag-value ${items[i].dot}">${escapeHtml(items[i].val)}</div>
        `;
      }
      await new Promise((resolve) => setTimeout(resolve, 45));
    }

    if (!isCurrent() || currentTab !== 'diag') return;
    const subtitle = document.getElementById('modal-subtitle-text');
    if (subtitle) subtitle.textContent = `${d?.score?.ok ?? 0} ok · ${d?.score?.warnings ?? 0} aviso · ${d?.score?.criticals ?? 0} crítico.`;
    footer.innerHTML = `<button class="btn-modal" type="button" data-modal-close>Fechar</button>`;
  } catch (error) {
    if (!isCurrent() || currentTab !== 'diag') return;
    console.error('[Diagnostic] Falha na análise manual.', error);
    body.innerHTML = '<div class="modal-inline-state modal-inline-state--error">Não foi possível concluir a análise.</div>';
    footer.innerHTML = '<button class="btn-modal" type="button" data-modal-close>Fechar</button>';
  }
}

function switchTab(tab, d) {
  const diagTab = document.getElementById('tab-diag');
  const cleanTab = document.getElementById('tab-clean');
  const body = document.getElementById('modal-body');
  const footer = document.getElementById('modal-footer');
  if (!diagTab || !cleanTab || !body || !footer) return;

  currentTab = tab;
  cleanupGeneration += 1;
  diagTab.classList.toggle('active', tab === 'diag');
  cleanTab.classList.toggle('active', tab === 'clean');
  diagTab.setAttribute('aria-selected', String(tab === 'diag'));
  cleanTab.setAttribute('aria-selected', String(tab === 'clean'));

  if (tab === 'diag') {
    if (d) {
      renderDiagTab(body, footer, d);
    } else {
      body.innerHTML = '<div class="modal-inline-state"><div class="loading-spinner"></div><p>Analisando...</p></div>';
      footer.innerHTML = '<button class="btn-modal" disabled>Analisando...</button>';
    }
  } else {
    void renderCleanTab(body, footer, modalGeneration, cleanupGeneration);
  }
}

function getDiagItems(d) {
  d = d || {};
  let cpuSt = 'ok', cpuVal = `${d.cpu}% em uso · idle saudável`;
  if (d.cpu >= 85) { cpuSt = 'crit'; cpuVal = `${d.cpu}% em uso · uso crítico`; }
  else if (d.cpu >= 60) { cpuSt = 'warn'; cpuVal = `${d.cpu}% em uso · uso elevado`; }

  let ramSt = 'ok', ramVal = `${d.ramFreeGB} GB livres de ${d.ramTotalGB} GB`;
  if (d.ramPct >= 90) ramSt = 'crit';
  else if (d.ramPct >= 75) ramSt = 'warn';

  let pwrSt = 'ok', pwrVal = d.plan || 'N/D';
  const normalizedPlan = String(d.plan || '').toLowerCase();
  if (normalizedPlan.includes('saving') || normalizedPlan.includes('economy')) {
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
          <div class="diag-dot ${i.dot}"></div> ${escapeHtml(i.label)}
        </div>
        <div class="diag-value ${i.dot}">${escapeHtml(i.val)}</div>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;
  
  const subtitle = document.getElementById('modal-subtitle-text');
  if (subtitle) subtitle.textContent = `${d?.score?.ok ?? 0} ok · ${d?.score?.warnings ?? 0} aviso · ${d?.score?.criticals ?? 0} crítico.`;
  footer.innerHTML = `<button class="btn-modal" type="button" data-modal-close>Fechar</button>`;
}

async function renderCleanTab(body, footer, parentModalGeneration = modalGeneration, requestGeneration = ++cleanupGeneration) {
  const isCurrent = () => (
    parentModalGeneration === modalGeneration &&
    requestGeneration === cleanupGeneration &&
    currentTab === 'clean' &&
    body?.isConnected &&
    footer?.isConnected
  );
  body.innerHTML = '<div class="modal-inline-state">Calculando tamanhos...</div>';
  footer.innerHTML = `
    <div class="modal-footer-left" id="clean-footer-text">Selecionado: 0 B · 0 itens</div>
    <button class="btn-modal" id="btn-exec-clean" disabled>Executar limpeza</button>
  `;

  try {
    sizesCache = await window.pulso.getCleanupSizes();
  } catch(e) {
    if (!isCurrent()) return;
    body.innerHTML = 'Erro ao carregar tamanhos.';
    footer.innerHTML = '<button class="btn-modal" id="btn-retry-clean">Tentar novamente</button>';
    document.getElementById('btn-retry-clean')?.addEventListener('click', () => {
      const nextGeneration = ++cleanupGeneration;
      void renderCleanTab(body, footer, parentModalGeneration, nextGeneration);
    });
    return;
  }
  if (!isCurrent()) return;

  const itemsDef = [
    { id: 'TempUser', key: 'tempUser', name: 'Arquivos temporários (usuário)', desc: '%TEMP% · cache de instaladores e apps' },
    { id: 'TempWindows', key: 'tempWin', name: 'Arquivos temporários (Windows)', desc: 'C:\\Windows\\Temp · pode pedir admin' },
    { id: 'Prefetch', key: 'prefetch', name: 'Prefetch', desc: 'C:\\Windows\\Prefetch · cache de inicialização' },
    { id: 'CrashDumps', key: 'crashDumps', name: 'Crash dumps', desc: 'Memory dumps de programas que travaram' },
    { id: 'Thumbcache', key: 'thumbcache', name: 'Cache de miniaturas', desc: '%LOCALAPPDATA%\\...\\Explorer · thumbcache_*.db' },
    { id: 'RecycleBin', key: 'recycleBin', name: 'Lixeira', desc: 'Tudo que está na lixeira · requer confirmação', sensitive: true }
  ];

  let html = '<div class="clean-list">';
  itemsDef.forEach(item => {
    const size = sizesCache[item.key] || 0;
    html += `
      <div class="clean-item">
        <input type="checkbox" class="clean-check" aria-label="${escapeHtml(item.name)}" data-id="${item.id}" data-size="${size}" data-sensitive="${item.sensitive ? 'true' : 'false'}" ${size > 0 ? (item.sensitive ? '' : 'checked') : 'disabled'}>
        <div class="clean-info">
          <div class="clean-name">${item.name}</div>
          <div class="clean-desc">${item.desc}</div>
        </div>
        <div class="clean-size ${size > 0 ? '' : 'is-empty'}">${formatBytes(size)}</div>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;

  const updateSelection = () => {
    const checked = body.querySelectorAll('.clean-check:checked');
    let total = 0;
    checked.forEach(c => total += Number(c.dataset.size) || 0);
    const footerText = document.getElementById('clean-footer-text');
    const button = document.getElementById('btn-exec-clean');
    if (footerText) footerText.textContent = `Selecionado: ${formatBytes(total)} · ${checked.length} itens`;
    if (button) {
      button.disabled = total === 0;
      button.textContent = 'Executar limpeza';
      delete button.dataset.confirmSignature;
    }
  };

  body.querySelectorAll('.clean-check').forEach(c => c.addEventListener('change', updateSelection));
  updateSelection();

  document.getElementById('btn-exec-clean')?.addEventListener('click', async () => {
    if (!isCurrent()) return;
    const checked = body.querySelectorAll('.clean-check:checked');
    const items = Array.from(checked).map(c => c.dataset.id);
    if(items.length === 0) return;

    const btn = document.getElementById('btn-exec-clean');
    const footerText = document.getElementById('clean-footer-text');
    if (!btn || !footerText) return;
    const sensitive = Array.from(checked).filter((item) => item.dataset.sensitive === 'true');
    const signature = items.slice().sort().join('|');
    if (sensitive.length > 0 && btn.dataset.confirmSignature !== signature) {
      btn.dataset.confirmSignature = signature;
      btn.textContent = 'Confirmar e limpar';
      footerText.textContent = 'Confirme: a Lixeira será esvaziada e não poderá ser restaurada.';
      return;
    }

    btn.textContent = 'Limpando...';
    btn.disabled = true;
    footerText.style.display = 'none';

    // Show cleaning animation
    body.innerHTML = `
      <div class="modal-state modal-state--cleaning">
        <div class="clean-anim-container">
          <svg class="clean-anim-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <div class="modal-state-copy-wrap">
          <div class="clean-anim-text">Limpando arquivos...</div>
          <div class="modal-state-copy">${items.length} ${items.length === 1 ? 'categoria selecionada' : 'categorias selecionadas'}</div>
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
      const animPromise = new Promise(r => setTimeout(r, 650));
      const [res] = await Promise.all([
        window.pulso.executeCleanup(items),
        animPromise
      ]);
      if (!isCurrent()) return;
      if (!res || !Array.isArray(res.results)) throw new Error('Resposta de limpeza inválida');
      const partial = res.ok === false || Number(res.failed) > 0;
      const completionTitle = partial ? 'Limpeza concluída com ressalvas' : 'Limpeza concluída!';
      const completionNote = partial
        ? 'Alguns arquivos estavam em uso ou exigem privilégios adicionais. Apenas o espaço realmente removido foi contabilizado.'
        : 'O valor exibido considera somente arquivos cuja remoção foi confirmada.';
      
      // Show success with animated checkmark
      body.innerHTML = `
        <div class="modal-state modal-state--result">
          <div class="clean-success-check">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline class="clean-check-path" points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 class="modal-result-title">${completionTitle}</h2>
          <p class="modal-result-metric">Espaço liberado: <strong>${formatBytes(res.totalFreed)}</strong></p>
          <div class="modal-result-note">
            <strong>Nota:</strong> ${completionNote}
          </div>
        </div>
      `;
      footer.innerHTML = `<button class="btn-modal" type="button" data-modal-close>Fechar</button>`;
    } catch(e) {
      if (!isCurrent()) return;
      body.innerHTML = `
        <div class="modal-state modal-state--error">
          <div class="modal-state-symbol">✕</div>
          <div class="modal-state-title">Erro ao executar limpeza</div>
          <div class="modal-state-copy">Tente novamente em alguns instantes.</div>
        </div>
      `;
      footer.innerHTML = `<button class="btn-modal" id="btn-back-clean">Voltar</button>`;
      document.getElementById('btn-back-clean')?.addEventListener('click', () => {
        const nextGeneration = ++cleanupGeneration;
        void renderCleanTab(body, footer, parentModalGeneration, nextGeneration);
      });
    }
  });
}

function showSplashOverlay(username, callback) {
  if (window.pulso && window.pulso.resize) window.pulso.resize(256, 256);
  const overlay = document.createElement('div');
  overlay.className = 'splash-overlay';
  overlay.innerHTML = `
    <div class="splash-shell">
      <div class="splash-logo-wrap">
        <img class="splash-logo" src="${BRAND_ICON}" alt="Takeda">
      </div>
      <div class="splash-wordmark">Takeda</div>
      <p class="splash-greeting">Preparando tudo para <strong>@${escapeHtml(username || 'usuário')}</strong></p>
      <div class="splash-progress" aria-hidden="true"><span></span></div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Carrega o dashboard por trás da splash screen para evitar que o usuário veja a tela carregando
  callback?.();
  
  setTimeout(() => {
    if (window.pulso && window.pulso.resize) window.pulso.resize(970, 545);
    
    // Pequeno delay para garantir que a janela redimensione antes de sumir a splash
    setTimeout(() => {
      overlay.classList.add('is-leaving');
      setTimeout(() => {
        overlay.remove();
      }, 280);
    }, 50);
  }, 1100);
}

// Initial render
(async () => {
  if (window.pulso?.resize) window.pulso.resize(512, 512);
  container.className = 'content-full';
  container.innerHTML = `
    <section class="boot-screen" aria-label="Inicializando Takeda" aria-live="polite">
      <div class="boot-mark"><img src="${BRAND_ICON}" alt=""></div>
      <strong>Takeda</strong>
      <span>Preparando seu ambiente seguro…</span>
      <div class="boot-progress" aria-hidden="true"><i></i></div>
    </section>
  `;

  try { window.pulso?.ready?.(); } catch (error) { console.warn('[Boot] Não foi possível exibir a janela.', error); }

  try {
    await initI18n();
  } catch (error) {
    console.warn('[Boot] Falha ao inicializar traduções.', error);
  }

  let session = null;
  try {
    session = await resumeSession();
  } catch (error) {
    console.warn('[Boot] Não foi possível restaurar a sessão.', error);
  }
  renderLogin(container, session, async (user) => {
    if (!user) throw new Error('Usuário de login ausente.');
    let sysUsername = user.username || 'usuário';
    if (window.pulso && window.pulso.getUsername) {
      try {
        sysUsername = await window.pulso.getUsername() || sysUsername;
      } catch (error) {
        console.warn('[System] Não foi possível ler o nome de usuário.', error);
      }
    }
    showSplashOverlay(sysUsername, () => {
      renderAppLayout(user, sysUsername);
      renderDashboard(user, sysUsername);
      initDashboard();
    });
  });
})();

