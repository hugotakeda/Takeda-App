import { escapeHtml } from '../ui.js';

let startupCache = [];
let orphanedCache = [];
let requestEpoch = 0;
let removalInFlight = false;

export function renderRegistry() {
  return `
    <div class="page-header tool-page-header">
      <div>
        <h1 class="page-title">Registro & Inicialização</h1>
        <p class="tool-page-subtitle">Gerencie o que abre com o Windows e limpe entradas de registro órfãs.</p>
      </div>
      <div class="tab-bar tool-tabs" id="reg-tabs" role="tablist" aria-label="Seções de registro">
        <button class="app-tab-btn active" data-tab="startup" type="button" role="tab" aria-selected="true">Inicialização</button>
        <button class="app-tab-btn" data-tab="cleaner" type="button" role="tab" aria-selected="false">Limpador de Registro</button>
      </div>
    </div>
    <div class="page-content tool-page-content" id="reg-content" role="tabpanel" aria-live="polite"></div>
  `;
}

function loadingState(label) {
  return `<div class="tool-state tool-state--loading" role="status"><div class="loading-spinner"></div><p>${escapeHtml(label)}</p></div>`;
}

function itemRow({ id, name, subtitle, enabled, badge }) {
  return `
    <div class="clean-item" data-item-id="${escapeHtml(id)}">
      <div class="clean-info clean-info--grow">
        <div class="clean-name">${escapeHtml(name)} ${badge ? `<span class="badge badge--inline">${escapeHtml(badge)}</span>` : ''}</div>
        <div class="clean-desc clean-desc--path">${escapeHtml(subtitle)}</div>
      </div>
      <label class="toggle-switch" aria-label="Abrir ${escapeHtml(name)} com o Windows">
        <input type="checkbox" class="reg-toggle" data-id="${escapeHtml(id)}" ${enabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
}

async function renderStartupTab() {
  const epoch = ++requestEpoch;
  const content = document.getElementById('reg-content');
  if (!content) return;
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = loadingState('Carregando itens de inicialização...');

  try {
    const nextItems = await window.pulso.listStartup();
    if (epoch !== requestEpoch || !document.getElementById('reg-content')) return;
    startupCache = Array.isArray(nextItems) ? nextItems : [];
  } catch (e) {
    if (epoch !== requestEpoch) return;
    content.innerHTML = `<div class="tool-state tool-state--error" role="alert">Erro ao carregar itens de inicialização. <button class="btn-secondary tool-state-action" id="reg-startup-retry" type="button">Tentar novamente</button></div>`;
    document.getElementById('reg-startup-retry')?.addEventListener('click', renderStartupTab);
    return;
  } finally {
    if (epoch === requestEpoch) content.removeAttribute('aria-busy');
  }

  if (startupCache.length === 0) {
    content.innerHTML = `<div class="tool-state tool-state--empty" role="status">Nenhum item de inicialização encontrado.</div>`;
    return;
  }

  const rows = startupCache.map((item) => itemRow({
    id: item.id,
    name: item.name,
    subtitle: item.command || '',
    enabled: item.enabled,
    badge: item.source === 'folder' ? 'Atalho' : (item.hive === 'HKLM' ? 'Todo o sistema' : ''),
  })).join('');

  content.innerHTML = `<div class="clean-list">${rows}</div>`;
  content.querySelectorAll('.reg-toggle').forEach((toggle) => {
    toggle.addEventListener('change', async (event) => {
      const item = startupCache.find((candidate) => candidate.id === toggle.dataset.id);
      if (!item || toggle.disabled) return;
      toggle.disabled = true;
      try {
        const result = event.target.checked
          ? await window.pulso.enableStartup(item)
          : await window.pulso.disableStartup(item);
        if (!result?.ok) throw new Error('Alteração não confirmada');
        item.enabled = event.target.checked;
      } catch (error) {
        event.target.checked = !event.target.checked;
        window.showAlertModal('Erro', 'Não foi possível alterar este item. Pode ser necessário executar o Takeda App como administrador.');
      } finally {
        toggle.disabled = false;
      }
    });
  });
}

function renderCleanerTab() {
  ++requestEpoch;
  const content = document.getElementById('reg-content');
  if (!content) return;
  content.innerHTML = `
    <div class="tool-state tool-state--intro">
      <p class="tool-state-copy">Procura por entradas de "Programas e Recursos" e atalhos de aplicativos (App Paths) que apontam para arquivos que não existem mais. Antes de remover qualquer entrada, um backup <strong>.reg</strong> é criado automaticamente.</p>
      <button class="btn-primary tool-action-button" id="reg-scan-btn" type="button">Escanear Registro</button>
    </div>
  `;
  document.getElementById('reg-scan-btn')?.addEventListener('click', runOrphanedScan);
}

async function runOrphanedScan() {
  const epoch = ++requestEpoch;
  const content = document.getElementById('reg-content');
  if (!content) return;
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = loadingState('Escaneando entradas de registro...');

  try {
    const result = await window.pulso.scanOrphanedRegistry();
    if (epoch !== requestEpoch || !document.getElementById('reg-content')) return;
    if (!Array.isArray(result)) throw new Error('Resposta inválida');
    orphanedCache = result;
  } catch (e) {
    if (epoch !== requestEpoch) return;
    content.innerHTML = `<div class="tool-state tool-state--error" role="alert">Não foi possível escanear o registro. <button class="btn-secondary tool-state-action" id="reg-scan-retry" type="button">Tentar novamente</button></div>`;
    document.getElementById('reg-scan-retry')?.addEventListener('click', runOrphanedScan);
    return;
  } finally {
    if (epoch === requestEpoch) content.removeAttribute('aria-busy');
  }

  if (orphanedCache.length === 0) {
    content.innerHTML = `
      <div class="tool-state tool-state--empty" role="status">
        <p>Nenhuma entrada órfã encontrada. Seu registro está limpo nas categorias verificadas.</p>
        <button class="btn-secondary tool-state-action" id="reg-scan-again" type="button">Escanear Novamente</button>
      </div>
    `;
    document.getElementById('reg-scan-again')?.addEventListener('click', runOrphanedScan);
    return;
  }

  const rows = orphanedCache.map((entry) => `
    <label class="clean-item clean-item--selectable">
      <input type="checkbox" class="clean-check orphan-check" data-id="${escapeHtml(entry.id)}" checked>
      <span class="clean-info">
        <span class="clean-name">${escapeHtml(entry.displayName)} <span class="badge badge--inline">${entry.category === 'uninstall' ? 'Programa' : 'App Path'}</span></span>
        <span class="clean-desc clean-desc--path">Caminho não encontrado: ${escapeHtml(entry.checkedPath)}</span>
      </span>
    </label>
  `).join('');

  content.innerHTML = `
    <div class="clean-list">${rows}</div>
    <div class="tool-action-row">
      <span class="tool-action-summary" id="reg-selected-count">${orphanedCache.length} de ${orphanedCache.length} entradas selecionadas · backup .reg será criado</span>
      <button class="btn-primary tool-action-button" id="reg-remove-btn" type="button">Remover Selecionadas</button>
    </div>
  `;

  content.querySelectorAll('.orphan-check').forEach((checkbox) => checkbox.addEventListener('change', updateOrphanSelection));
  document.getElementById('reg-remove-btn')?.addEventListener('click', confirmOrphanRemoval);
  updateOrphanSelection();
}

function updateOrphanSelection() {
  const selected = document.querySelectorAll('.orphan-check:checked').length;
  const summary = document.getElementById('reg-selected-count');
  const button = document.getElementById('reg-remove-btn');
  if (summary) summary.textContent = `${selected} de ${orphanedCache.length} entradas selecionadas · backup .reg será criado`;
  if (button) button.disabled = removalInFlight || selected === 0;
}

function setRemovalLock(locked, button) {
  removalInFlight = locked;
  document.querySelectorAll('.orphan-check, #reg-tabs .app-tab-btn').forEach((control) => {
    control.disabled = locked;
  });
  if (button) {
    button.disabled = locked;
    button.textContent = locked ? 'Removendo...' : 'Remover Selecionadas';
  }
}

function confirmOrphanRemoval() {
  const button = document.getElementById('reg-remove-btn');
  if (!button || button.disabled || removalInFlight) return;
  const ids = Array.from(document.querySelectorAll('.orphan-check:checked'), (checkbox) => checkbox.dataset.id);
  if (ids.length === 0) return;

  window.showConfirmModal(
    'Remover entradas de registro',
    `Isso vai remover ${ids.length} entrada(s) do registro (com backup .reg salvo antes). Continuar?`,
    async () => {
      if (removalInFlight) return;
      setRemovalLock(true, button);
      const selected = orphanedCache.filter((entry) => ids.includes(entry.id));
      try {
        const results = await window.pulso.removeOrphanedRegistry(selected);
        if (!Array.isArray(results)) throw new Error('Resposta inválida');
        const removed = results.filter((result) => result.status === 'OK').length;
        const failed = results.length - removed;
        if (removed === 0) throw new Error('Nenhuma entrada removida');
        const detail = failed > 0
          ? `${removed} entrada(s) removida(s); ${failed} falharam. Os backups disponíveis foram salvos na pasta de dados do Takeda App.`
          : `${removed} entrada(s) removida(s). Os backups .reg ficam salvos na pasta de dados do Takeda App.`;
        window.showAlertModal(failed > 0 ? 'Concluído com ressalvas' : 'Concluído', detail, () => runOrphanedScan());
      } catch (e) {
        window.showAlertModal('Erro', 'Não foi possível confirmar a remoção das entradas selecionadas.');
      } finally {
        setRemovalLock(false, button);
        updateOrphanSelection();
      }
    }
  );
}

export function initRegistry() {
  document.querySelectorAll('#reg-tabs .app-tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      if (removalInFlight) return;
      document.querySelectorAll('#reg-tabs .app-tab-btn').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('active', active);
        candidate.setAttribute('aria-selected', String(active));
      });
      if (button.dataset.tab === 'startup') void renderStartupTab();
      else renderCleanerTab();
    });
  });

  void renderStartupTab();

  return () => {
    requestEpoch += 1;
  };
}
