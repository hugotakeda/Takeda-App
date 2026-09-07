export function renderPrivacy() {
  return `
    <div class="page-header">
      <h1 class="page-title">Central de Privacidade</h1>
      <p style="color: var(--text-secondary); margin-top:4px; font-size:0.9rem;">Ajustes reversíveis de privacidade do Windows. Nada aqui mexe em senhas, favoritos ou histórico de navegação.</p>
    </div>
    <div class="page-content" style="max-height: calc(100vh - 230px); overflow-y:auto; padding-right:8px; margin-top:16px;">
      <div class="card config-block" style="padding:8px 20px;" id="privacy-list">
        <div style="text-align:center; padding:40px; color:var(--text-secondary);"><div class="loading-spinner"></div></div>
      </div>
    </div>
  `;
}

export async function initPrivacy() {
  const container = document.getElementById('privacy-list');

  let toggles = [];
  let status = {};
  try {
    [toggles, status] = await Promise.all([
      window.pulso.listPrivacyToggles(),
      window.pulso.getPrivacyStatus(),
    ]);
  } catch (e) {
    container.innerHTML = `<div style="color:#f87171; padding:20px;">Erro ao carregar as configurações de privacidade.</div>`;
    return;
  }

  container.innerHTML = toggles.map((t) => {
    const enabled = status[t.id] ? status[t.id].enabled : false;
    return `
      <div class="config-group">
        <div class="config-info">
          <div class="config-label">${t.name} ${t.requiresAdmin ? '<span class="badge" style="margin-left:6px;">Requer admin</span>' : ''}</div>
          <div class="config-desc">${t.desc}</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="privacy-toggle" data-id="${t.id}" ${enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.privacy-toggle').forEach((toggle) => {
    toggle.addEventListener('change', async (e) => {
      const id = toggle.dataset.id;
      const protect = e.target.checked;
      toggle.disabled = true;
      try {
        await window.pulso.setPrivacyToggle(id, protect);
      } catch (err) {
        e.target.checked = !protect;
        window.showAlertModal('Erro', 'Não foi possível aplicar esta configuração agora.');
      } finally {
        toggle.disabled = false;
      }
    });
  });
}
