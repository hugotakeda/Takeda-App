import { escapeHtml } from '../ui.js';

let appsCache = [];
let loadEpoch = 0;
let removalInFlight = false;

export function renderDebloat() {
  return `
    <div class="page-header tool-page-header tool-page-header--split">
      <div>
        <h1 class="page-title">Debloat do Windows</h1>
        <p class="tool-page-subtitle">Remova apps opcionais que vêm pré-instalados. Nada essencial do sistema aparece aqui.</p>
      </div>
      <button class="btn-secondary tool-header-action" id="debloat-refresh" type="button">Atualizar Lista</button>
    </div>
    <div class="page-content tool-page-content" id="debloat-list" aria-live="polite">
      <div class="tool-state tool-state--loading" role="status"><div class="loading-spinner"></div><span class="sr-only">Carregando aplicativos</span></div>
    </div>
  `;
}

function loadingState() {
  return `<div class="tool-state tool-state--loading" role="status"><div class="loading-spinner"></div><span class="sr-only">Carregando aplicativos</span></div>`;
}

async function loadList() {
  const epoch = ++loadEpoch;
  const container = document.getElementById('debloat-list');
  const refresh = document.getElementById('debloat-refresh');
  if (!container) return;
  if (refresh) refresh.disabled = true;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = loadingState();

  try {
    const nextApps = await window.pulso.listDebloatApps();
    if (epoch !== loadEpoch || !document.getElementById('debloat-list')) return;
    appsCache = Array.isArray(nextApps) ? nextApps : [];
  } catch (e) {
    if (epoch !== loadEpoch) return;
    container.innerHTML = `<div class="tool-state tool-state--error" role="alert">Erro ao carregar a lista de apps. <button class="btn-secondary tool-state-action" id="debloat-retry" type="button">Tentar novamente</button></div>`;
    document.getElementById('debloat-retry')?.addEventListener('click', loadList);
    return;
  } finally {
    if (epoch === loadEpoch) {
      container.removeAttribute('aria-busy');
      if (refresh) refresh.disabled = removalInFlight;
    }
  }

  if (appsCache.length === 0) {
    container.innerHTML = `<div class="tool-state tool-state--empty" role="status">Nenhum app opcional foi encontrado.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="clean-list">${appsCache.map((app) => `
      <label class="clean-item clean-item--selectable">
        <input type="checkbox" class="clean-check debloat-check" data-id="${escapeHtml(app.id)}" ${app.installed ? '' : 'disabled'}>
        <span class="clean-info">
          <span class="clean-name">${escapeHtml(app.name)} ${!app.installed ? '<span class="badge badge--inline">Não instalado</span>' : ''}</span>
          <span class="clean-desc">${escapeHtml(app.desc)}</span>
        </span>
      </label>
    `).join('')}</div>
    <div class="tool-action-row">
      <span class="tool-action-summary" id="debloat-selected-count">0 selecionado(s)</span>
      <button class="btn-primary tool-action-button" id="debloat-remove-btn" type="button" disabled>Remover Selecionados</button>
    </div>
  `;

  container.querySelectorAll('.debloat-check').forEach((checkbox) => checkbox.addEventListener('change', updateSelection));
  updateSelection();
}

function updateSelection() {
  const checked = document.querySelectorAll('.debloat-check:checked');
  const count = document.getElementById('debloat-selected-count');
  const button = document.getElementById('debloat-remove-btn');
  if (count) count.textContent = `${checked.length} selecionado(s)`;
  if (button) button.disabled = removalInFlight || checked.length === 0;
}

function setRemovalLock(locked, button) {
  removalInFlight = locked;
  const refresh = document.getElementById('debloat-refresh');
  if (refresh) refresh.disabled = locked;
  document.querySelectorAll('.debloat-check').forEach((checkbox) => {
    checkbox.disabled = locked || !appsCache.find((app) => app.id === checkbox.dataset.id)?.installed;
  });
  if (button) {
    button.disabled = locked;
    button.textContent = locked ? 'Removendo...' : 'Remover Selecionados';
  }
}

export function initDebloat() {
  document.getElementById('debloat-refresh')?.addEventListener('click', loadList);

  document.getElementById('debloat-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('#debloat-remove-btn');
    if (!button || button.disabled || removalInFlight) return;

    const ids = Array.from(document.querySelectorAll('.debloat-check:checked'), (checkbox) => checkbox.dataset.id);
    if (ids.length === 0) return;

    window.showConfirmModal(
      'Remover aplicativos',
      `Isso vai remover ${ids.length} app(s) pré-instalado(s) do Windows para sua conta e para novas contas neste PC (o Windows pode pedir permissão de administrador). Você pode reinstalá-los depois pela Microsoft Store, se quiser. Continuar?`,
      async () => {
        if (removalInFlight) return;
        setRemovalLock(true, button);
        try {
          const result = await window.pulso.removeDebloatApps(ids);
          const removed = Array.isArray(result?.removed) ? result.removed.length : 0;
          if (!result?.ok || removed === 0) throw new Error(result?.error || 'Nenhum app foi removido');
          const suffix = removed === 1 ? 'aplicativo removido' : 'aplicativos removidos';
          window.showAlertModal('Concluído', `${removed} ${suffix} com sucesso.`, () => loadList());
        } catch (e) {
          window.showAlertModal('Erro', 'Não foi possível remover os apps selecionados. Nenhuma conclusão foi presumida.');
        } finally {
          setRemovalLock(false, button);
          updateSelection();
        }
      }
    );
  });

  void loadList();

  return () => {
    loadEpoch += 1;
  };
}
