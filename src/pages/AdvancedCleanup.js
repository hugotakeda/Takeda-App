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
let loadEpoch = 0;
let cleanupInFlight = false;

export function renderAdvancedCleanup() {
  const tabsHtml = CATEGORIES.map((cat, i) => `
    <button class="app-tab-btn ${i === 0 ? 'active' : ''}" data-tab="${cat.id}" type="button" role="tab" aria-selected="${i === 0}">${CATEGORY_LABELS[cat.id]}</button>
  `).join('');

  return `
    <div class="page-header tool-page-header">
      <div class="tool-page-header--split">
        <div>
          <h1 class="page-title">Limpeza Avançada</h1>
          <p class="tool-page-subtitle">Cache de navegadores, apps e jogos — baseado em regras, como no Kudu.</p>
        </div>
        <button class="btn-secondary tool-header-action" id="adv-clean-recalc" type="button">Recalcular</button>
      </div>
      <div class="tab-bar tool-tabs" id="adv-clean-tabs" role="tablist" aria-label="Categorias de limpeza">
        ${tabsHtml}
      </div>
    </div>
    <div class="page-content tool-page-content tool-page-content--compact" id="adv-clean-list" aria-live="polite"></div>
  `;
}

function renderCategoryList(catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  const container = document.getElementById('adv-clean-list');
  if (!cat || !container) return;
  container.innerHTML = `
    <div class="clean-list"></div>
    <div class="tool-action-row">
      <div class="tool-action-summary">Selecionado: <strong id="adv-clean-total">0 B</strong></div>
      <button class="btn-primary tool-action-button" id="adv-clean-exec" type="button" disabled>Executar Limpeza</button>
    </div>
  `;
  const list = container.querySelector('.clean-list');

  cat.rules.forEach((rule) => {
    const size = sizesCache[rule.id] || 0;
    const row = document.createElement('label');
    row.className = 'clean-item clean-item--selectable';
    row.innerHTML = `
      <input type="checkbox" class="clean-check adv-clean-check" data-id="${rule.id}" data-size="${size}" data-big="${!!rule.big}" ${size > 0 ? '' : 'disabled'}>
      <span class="clean-info">
        <span class="clean-name">${rule.name}${rule.big ? ' <span class="badge badge--inline badge--danger">Requer atenção</span>' : ''}</span>
        <span class="clean-desc">${rule.desc}</span>
      </span>
      <span class="clean-size ${size > 0 ? '' : 'is-empty'}">${size > 0 ? formatBytes(size) : 'Vazio/Não encontrado'}</span>
    `;
    list.appendChild(row);
  });

  document.querySelectorAll('.adv-clean-check').forEach((chk) => chk.addEventListener('change', updateSelection));
  updateSelection();
}

function updateSelection() {
  const checked = document.querySelectorAll('.adv-clean-check:checked');
  let total = 0;
  checked.forEach((c) => (total += parseInt(c.dataset.size)));
  const totalLabel = document.getElementById('adv-clean-total');
  const button = document.getElementById('adv-clean-exec');
  if (totalLabel) totalLabel.textContent = formatBytes(total);
  if (button) button.disabled = cleanupInFlight || total === 0;
}

async function loadSizes() {
  const epoch = ++loadEpoch;
  const container = document.getElementById('adv-clean-list');
  const recalc = document.getElementById('adv-clean-recalc');
  if (!container) return;
  if (recalc) recalc.disabled = true;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `<div class="tool-state tool-state--loading" role="status"><div class="loading-spinner"></div><p>Calculando espaço ocupado...</p></div>`;
  try {
    const result = await window.pulso.getRuleSizes();
    if (epoch !== loadEpoch || !document.getElementById('adv-clean-list')) return;
    sizesCache = result && typeof result === 'object' ? result : {};
  } catch (e) {
    if (epoch !== loadEpoch) return;
    container.innerHTML = `<div class="tool-state tool-state--error" role="alert">Não foi possível calcular o espaço ocupado. <button class="btn-secondary tool-state-action" id="adv-clean-retry" type="button">Tentar novamente</button></div>`;
    document.getElementById('adv-clean-retry')?.addEventListener('click', loadSizes);
    return;
  } finally {
    if (epoch === loadEpoch) {
      container.removeAttribute('aria-busy');
      if (recalc) recalc.disabled = cleanupInFlight;
    }
  }
  const activeTab = document.querySelector('#adv-clean-tabs .app-tab-btn.active');
  renderCategoryList(activeTab ? activeTab.dataset.tab : CATEGORIES[0].id);
}

export function initAdvancedCleanup() {
  document.querySelectorAll('#adv-clean-tabs .app-tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      if (cleanupInFlight) return;
      document.querySelectorAll('#adv-clean-tabs .app-tab-btn').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('active', active);
        candidate.setAttribute('aria-selected', String(active));
      });
      renderCategoryList(button.dataset.tab);
    });
  });

  document.getElementById('adv-clean-recalc')?.addEventListener('click', loadSizes);

  // Delegated: #adv-clean-exec is recreated by renderCategoryList() on every tab
  // switch, so a direct listener bound once at init would go stale after that.
  document.getElementById('adv-clean-list').addEventListener('click', (e) => {
    const btn = e.target.closest('#adv-clean-exec');
    if (!btn || btn.disabled || cleanupInFlight) return;

    const checked = document.querySelectorAll('.adv-clean-check:checked');
    const ids = Array.from(checked).map((c) => c.dataset.id);
    const hasBig = Array.from(checked).some((c) => c.dataset.big === 'true');
    if (ids.length === 0) return;

    const run = async () => {
      if (cleanupInFlight) return;
      cleanupInFlight = true;
      btn.disabled = true;
      btn.textContent = 'Limpando...';
      document.querySelectorAll('.adv-clean-check, #adv-clean-tabs .app-tab-btn, #adv-clean-recalc').forEach((control) => {
        control.disabled = true;
      });
      try {
        const res = await window.pulso.executeRules(ids);
        if (!res || !Array.isArray(res.results)) throw new Error('Resposta inválida');
        const partial = res.ok === false || Number(res.failed) > 0;
        const detail = partial
          ? `Espaço confirmado como liberado: ${formatBytes(res.totalFreed)}. Alguns itens estavam em uso ou exigem privilégios adicionais.`
          : `Espaço liberado: ${formatBytes(res.totalFreed)}`;
        window.showAlertModal(partial ? 'Concluído com ressalvas' : 'Limpeza concluída!', detail, () => loadSizes());
      } catch (e) {
        window.showAlertModal('Erro', 'Não foi possível concluir a limpeza avançada.');
      } finally {
        cleanupInFlight = false;
        btn.textContent = 'Executar Limpeza';
        document.querySelectorAll('#adv-clean-tabs .app-tab-btn, #adv-clean-recalc').forEach((control) => {
          control.disabled = false;
        });
        document.querySelectorAll('.adv-clean-check').forEach((checkbox) => {
          checkbox.disabled = Number(checkbox.dataset.size) <= 0;
        });
        updateSelection();
      }
    };

    if (hasBig) {
      window.showConfirmModal(
        'Confirmar limpeza do Windows.old',
        'Você selecionou a pasta Windows.old, que guarda a instalação anterior do Windows. Depois de apagada, não será mais possível reverter a atualização recente. Deseja continuar mesmo assim?',
        run
      );
    } else {
      void run();
    }
  });

  void loadSizes();

  return () => {
    loadEpoch += 1;
  };
}
import { formatBytes } from '../ui.js';
