let appsCache = [];

export function renderDebloat() {
  return `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h1 class="page-title">Debloat do Windows</h1>
        <p style="color: var(--text-secondary); margin-top:4px; font-size:0.9rem;">Remova apps opcionais que vêm pré-instalados. Nada essencial do sistema aparece aqui.</p>
      </div>
      <button class="btn-secondary" id="debloat-refresh" style="width:auto; padding:9px 18px; flex-shrink:0;">Atualizar Lista</button>
    </div>
    <div class="page-content" style="max-height: calc(100vh - 220px); overflow-y:auto; padding-right:8px; margin-top:16px;" id="debloat-list">
      <div style="text-align:center; padding:40px; color:var(--text-secondary);"><div class="loading-spinner"></div></div>
    </div>
  `;
}

async function loadList() {
  const container = document.getElementById('debloat-list');
  container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);"><div class="loading-spinner"></div></div>`;

  try {
    appsCache = await window.pulso.listDebloatApps();
  } catch (e) {
    container.innerHTML = `<div style="color:#f87171; padding:20px;">Erro ao carregar a lista de apps.</div>`;
    return;
  }

  // The summary/action bar lives inside this same scrollable container (not as a
  // separate sibling below it) so it's always reachable via scroll no matter how
  // tall the header/tabs above end up being.
  container.innerHTML = `
    <div class="clean-list">${appsCache.map((app) => `
      <div class="clean-item">
        <input type="checkbox" class="clean-check debloat-check" data-id="${app.id}" ${app.installed ? '' : 'disabled'}>
        <div class="clean-info">
          <div class="clean-name">${app.name} ${!app.installed ? '<span class="badge" style="margin:0 0 0 6px;">Não instalado</span>' : ''}</div>
          <div class="clean-desc">${app.desc}</div>
        </div>
      </div>
    `).join('')}</div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-color);">
      <span id="debloat-selected-count" style="color:var(--text-secondary); font-size:0.85rem;">0 selecionado(s)</span>
      <button class="btn-primary" id="debloat-remove-btn" disabled style="width:auto; padding:10px 24px;">Remover Selecionados</button>
    </div>
  `;

  container.querySelectorAll('.debloat-check').forEach((chk) => chk.addEventListener('change', updateSelection));
  updateSelection();
}

function updateSelection() {
  const checked = document.querySelectorAll('.debloat-check:checked');
  document.getElementById('debloat-selected-count').textContent = `${checked.length} selecionado(s)`;
  document.getElementById('debloat-remove-btn').disabled = checked.length === 0;
}

export function initDebloat() {
  document.getElementById('debloat-refresh').addEventListener('click', loadList);

  // Delegated: #debloat-remove-btn is recreated by loadList() every time (refresh
  // included), so a direct listener bound once at init would go stale after a refresh.
  document.getElementById('debloat-list').addEventListener('click', (e) => {
    const btn = e.target.closest('#debloat-remove-btn');
    if (!btn || btn.disabled) return;

    const checked = document.querySelectorAll('.debloat-check:checked');
    const ids = Array.from(checked).map((c) => c.dataset.id);
    if (ids.length === 0) return;

    window.showConfirmModal(
      'Remover aplicativos',
      `Isso vai remover ${ids.length} app(s) pré-instalado(s) do Windows para sua conta e para novas contas neste PC (o Windows pode pedir permissão de administrador). Você pode reinstalá-los depois pela Microsoft Store, se quiser. Continuar?`,
      async () => {
        btn.disabled = true;
        btn.textContent = 'Removendo...';
        try {
          await window.pulso.removeDebloatApps(ids);
          window.showAlertModal('Concluído', 'Apps removidos com sucesso.', () => loadList());
        } catch (e) {
          window.showAlertModal('Erro', 'Não foi possível remover os apps selecionados.');
        } finally {
          btn.textContent = 'Remover Selecionados';
        }
      }
    );
  });

  loadList();
}
