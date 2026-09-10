export function renderPrivacy() {
  return `
    <div class="page-header tool-page-header">
      <h1 class="page-title">Central de Privacidade</h1>
      <p class="tool-page-subtitle">Ajustes reversíveis de privacidade do Windows. Nada aqui mexe em senhas, favoritos ou histórico de navegação.</p>
    </div>
    <div class="page-content tool-page-content">
      <div class="card config-block privacy-card" id="privacy-list" aria-live="polite">
        <div class="tool-state tool-state--loading" role="status"><div class="loading-spinner"></div><span class="sr-only">Carregando configurações de privacidade</span></div>
      </div>
    </div>
  `;
}

export async function initPrivacy({ signal } = {}) {
  const container = document.getElementById('privacy-list');
  if (!container) return;
  container.setAttribute('aria-busy', 'true');

  let toggles;
  let status;
  try {
    [toggles, status] = await Promise.all([
      window.pulso.listPrivacyToggles(),
      window.pulso.getPrivacyStatus(),
    ]);
    if (signal?.aborted || !document.getElementById('privacy-list')) return;
    if (!Array.isArray(toggles) || !status || typeof status !== 'object') throw new Error('Resposta inválida');
  } catch (e) {
    if (signal?.aborted) return;
    container.innerHTML = `<div class="tool-state tool-state--error" role="alert">Erro ao carregar as configurações de privacidade.</div>`;
    return;
  } finally {
    container.removeAttribute('aria-busy');
  }

  if (toggles.length === 0) {
    container.innerHTML = `<div class="tool-state tool-state--empty" role="status">Nenhuma configuração de privacidade disponível.</div>`;
    return;
  }

  container.innerHTML = toggles.map((toggle) => {
    const enabled = status[toggle.id] ? status[toggle.id].enabled : false;
    return `
      <div class="config-group">
        <div class="config-info">
          <div class="config-label">${escapeHtml(toggle.name)} ${toggle.requiresAdmin ? '<span class="badge badge--inline">Requer admin</span>' : ''}</div>
          <div class="config-desc">${escapeHtml(toggle.desc)}</div>
        </div>
        <label class="toggle-switch" aria-label="Ativar proteção: ${escapeHtml(toggle.name)}">
          <input type="checkbox" class="privacy-toggle" data-id="${escapeHtml(toggle.id)}" ${enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.privacy-toggle').forEach((toggle) => {
    toggle.addEventListener('change', async (event) => {
      const protect = event.target.checked;
      toggle.disabled = true;
      try {
        const result = await window.pulso.setPrivacyToggle(toggle.dataset.id, protect);
        if (!result?.ok || result.enabled !== protect) throw new Error('Alteração não confirmada');
      } catch (error) {
        event.target.checked = !protect;
        window.showAlertModal('Erro', 'Não foi possível aplicar esta configuração agora.');
      } finally {
        toggle.disabled = false;
      }
    });
  });
}
import { escapeHtml } from '../ui.js';
