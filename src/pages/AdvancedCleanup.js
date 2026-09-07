const CATEGORY_LABELS = {
  browsers: 'Navegadores',
  apps: 'Apps de Comunicação',
  dev: 'Desenvolvimento',
  gaming: 'Jogos',
  system: 'Sistema',
};

// Espelha o catálogo de electron/services/rules.js (só os metadados de UI —
// os tamanhos/execução vêm sempre do processo principal).
const CATEGORIES = [
  { id: 'browsers', rules: [
    { id: 'chrome-cache', name: 'Google Chrome — Cache', desc: 'Cache de páginas e imagens. Recriado automaticamente.' },
    { id: 'edge-cache', name: 'Microsoft Edge — Cache', desc: 'Cache de páginas e imagens. Recriado automaticamente.' },
    { id: 'brave-cache', name: 'Brave — Cache', desc: 'Cache de páginas e imagens.' },
    { id: 'firefox-cache', name: 'Mozilla Firefox — Cache', desc: 'Cache de todos os perfis instalados.' },
  ]},
  { id: 'apps', rules: [
    { id: 'discord-cache', name: 'Discord — Cache', desc: 'Cache de imagens/GIFs e código do cliente.' },
    { id: 'spotify-cache', name: 'Spotify — Cache de músicas', desc: 'Cache local de streaming (não afeta playlists/conta).' },
    { id: 'teams-cache', name: 'Microsoft Teams — Cache', desc: 'Cache do cliente Teams clássico.' },
    { id: 'slack-cache', name: 'Slack — Cache', desc: 'Cache de mídia e código do cliente.' },
  ]},
  { id: 'dev', rules: [
    { id: 'vscode-cache', name: 'VS Code — Cache', desc: 'Não afeta extensões nem configurações.' },
    { id: 'npm-cache', name: 'npm — Cache de pacotes', desc: 'Baixado novamente quando necessário.' },
    { id: 'yarn-cache', name: 'Yarn — Cache de pacotes', desc: 'Cache de download do Yarn.' },
    { id: 'pip-cache', name: 'pip — Cache de pacotes Python', desc: 'Cache de download de pacotes Python.' },
  ]},
  { id: 'gaming', rules: [
    { id: 'steam-htmlcache', name: 'Steam — Cache do cliente', desc: 'Não afeta jogos instalados.' },
    { id: 'epic-cache', name: 'Epic Games Launcher — Cache', desc: 'Cache web do launcher.' },
    { id: 'nvidia-shader-cache', name: 'NVIDIA — Cache de shaders', desc: 'Recompilado sob demanda (leve engasgo na 1ª execução após limpar).' },
    { id: 'amd-shader-cache', name: 'AMD — Cache de shaders', desc: 'Cache de compilação de shaders da AMD.' },
    { id: 'directx-shader-cache', name: 'DirectX — Cache de shaders', desc: 'Cache global de shaders do DirectX 12.' },
  ]},
  { id: 'system', rules: [
    { id: 'windows-update-cache', name: 'Cache do Windows Update', desc: 'Instaladores já baixados, serão baixados de novo se precisos.' },
    { id: 'delivery-optimization', name: 'Cache de Otimização de Entrega', desc: 'Usado para compartilhar atualizações na rede local.' },
    { id: 'error-reporting', name: 'Relatórios de Erro do Windows', desc: 'Dumps e relatórios (WER) já enviados ou pendentes.' },
    { id: 'windows-old', name: 'Windows.old', desc: 'ATENÇÃO: pasta da instalação anterior. Depois de removida não dá mais para reverter a atualização.', big: true },
  ]},
];

let sizesCache = {};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function renderAdvancedCleanup() {
  const tabsHtml = CATEGORIES.map((cat, i) => `
    <button class="app-tab-btn ${i === 0 ? 'active' : ''}" data-tab="${cat.id}">${CATEGORY_LABELS[cat.id]}</button>
  `).join('');

  return `
    <div class="page-header" style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h1 class="page-title">Limpeza Avançada</h1>
          <p style="color: var(--text-secondary); margin-top:4px; font-size:0.9rem;">Cache de navegadores, apps e jogos — baseado em regras, como no Kudu.</p>
        </div>
        <button class="btn-secondary" id="adv-clean-recalc" style="width:auto; padding:9px 18px; flex-shrink:0;">Recalcular</button>
      </div>
      <div class="tab-bar" id="adv-clean-tabs">
        ${tabsHtml}
      </div>
    </div>
    <div class="page-content" style="max-height: calc(100vh - 210px); overflow-y:auto; padding-right:8px; margin-top:16px;" id="adv-clean-list"></div>
  `;
}

function renderCategoryList(catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  const container = document.getElementById('adv-clean-list');
  // The selection summary/execute button lives inside this same scrollable
  // container (not as a separate sibling below it) so it's always reachable
  // via scroll no matter how tall the header/tabs above end up being.
  container.innerHTML = `
    <div class="clean-list"></div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-color);">
      <div><span style="color:var(--text-secondary);">Selecionado: </span><strong id="adv-clean-total">0 B</strong></div>
      <button class="btn-primary" id="adv-clean-exec" disabled style="width:auto; padding:10px 28px;">Executar Limpeza</button>
    </div>
  `;
  const list = container.querySelector('.clean-list');

  cat.rules.forEach((rule) => {
    const size = sizesCache[rule.id] || 0;
    const div = document.createElement('div');
    div.className = 'clean-item';
    div.innerHTML = `
      <input type="checkbox" class="clean-check adv-clean-check" data-id="${rule.id}" data-size="${size}" data-big="${!!rule.big}" ${size > 0 ? '' : 'disabled'}>
      <div class="clean-info">
        <div class="clean-name">${rule.name}${rule.big ? ' <span class="badge" style="color:#f87171; background:rgba(248,113,113,0.1); margin:0 0 0 6px;">Requer atenção</span>' : ''}</div>
        <div class="clean-desc">${rule.desc}</div>
      </div>
      <div class="clean-size" style="color:${size > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'}">${size > 0 ? formatBytes(size) : 'Vazio/Não encontrado'}</div>
    `;
    list.appendChild(div);
  });

  document.querySelectorAll('.adv-clean-check').forEach((chk) => chk.addEventListener('change', updateSelection));
  updateSelection();
}

function updateSelection() {
  const checked = document.querySelectorAll('.adv-clean-check:checked');
  let total = 0;
  checked.forEach((c) => (total += parseInt(c.dataset.size)));
  document.getElementById('adv-clean-total').textContent = formatBytes(total);
  document.getElementById('adv-clean-exec').disabled = total === 0;
}

async function loadSizes() {
  const container = document.getElementById('adv-clean-list');
  container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);"><div class="loading-spinner" style="margin-bottom:16px;"></div><p>Calculando espaço ocupado...</p></div>`;
  try {
    sizesCache = await window.pulso.getRuleSizes();
  } catch (e) {
    sizesCache = {};
  }
  const activeTab = document.querySelector('#adv-clean-tabs .app-tab-btn.active');
  renderCategoryList(activeTab ? activeTab.dataset.tab : CATEGORIES[0].id);
}

export function initAdvancedCleanup() {
  document.querySelectorAll('#adv-clean-tabs .app-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#adv-clean-tabs .app-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCategoryList(btn.dataset.tab);
    });
  });

  document.getElementById('adv-clean-recalc').addEventListener('click', loadSizes);

  // Delegated: #adv-clean-exec is recreated by renderCategoryList() on every tab
  // switch, so a direct listener bound once at init would go stale after that.
  document.getElementById('adv-clean-list').addEventListener('click', (e) => {
    const btn = e.target.closest('#adv-clean-exec');
    if (!btn || btn.disabled) return;

    const checked = document.querySelectorAll('.adv-clean-check:checked');
    const ids = Array.from(checked).map((c) => c.dataset.id);
    const hasBig = Array.from(checked).some((c) => c.dataset.big === 'true');
    if (ids.length === 0) return;

    const run = async () => {
      btn.disabled = true;
      btn.textContent = 'Limpando...';
      try {
        const res = await window.pulso.executeRules(ids);
        window.showAlertModal('Limpeza concluída!', `Espaço liberado: ${formatBytes(res.totalFreed)}`, () => loadSizes());
      } catch (e) {
        window.showAlertModal('Erro', 'Não foi possível concluir a limpeza avançada.');
      } finally {
        btn.textContent = 'Executar Limpeza';
      }
    };

    if (hasBig) {
      window.showConfirmModal(
        'Confirmar limpeza do Windows.old',
        'Você selecionou a pasta Windows.old, que guarda a instalação anterior do Windows. Depois de apagada, não será mais possível reverter a atualização recente. Deseja continuar mesmo assim?',
        run
      );
    } else {
      run();
    }
  });

  loadSizes();
}
