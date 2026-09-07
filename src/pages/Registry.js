export function renderRegistry() {
  return `
    <div class="page-header" style="display:flex; flex-direction:column; gap:16px;">
      <div>
        <h1 class="page-title">Registro & Inicialização</h1>
        <p style="color: var(--text-secondary); margin-top:4px; font-size:0.9rem;">Gerencie o que abre com o Windows e limpe entradas de registro órfãs.</p>
      </div>
      <div class="tab-bar" id="reg-tabs">
        <button class="app-tab-btn active" data-tab="startup">Inicialização</button>
        <button class="app-tab-btn" data-tab="cleaner">Limpador de Registro</button>
      </div>
    </div>
    <div class="page-content" style="max-height: calc(100vh - 230px); overflow-y:auto; padding-right:8px; margin-top:16px;" id="reg-content"></div>
  `;
}

function itemRow({ id, name, subtitle, enabled, badge }) {
  return `
    <div class="clean-item" data-item-id="${id}">
      <div class="clean-info" style="flex:1;">
        <div class="clean-name">${name} ${badge ? `<span class="badge" style="margin:0 0 0 6px;">${badge}</span>` : ''}</div>
        <div class="clean-desc" style="word-break: break-all;">${subtitle}</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" class="reg-toggle" data-id="${id}" ${enabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
}

let startupCache = [];

async function renderStartupTab() {
  const content = document.getElementById('reg-content');
  content.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);"><div class="loading-spinner"></div></div>`;

  try {
    startupCache = await window.pulso.listStartup();
  } catch (e) {
    content.innerHTML = `<div style="color:#f87171; padding:20px;">Erro ao carregar itens de inicialização.</div>`;
    return;
  }

  if (startupCache.length === 0) {
    content.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Nenhum item de inicialização encontrado.</div>`;
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
    toggle.addEventListener('change', async (e) => {
      const item = startupCache.find((i) => i.id === toggle.dataset.id);
      if (!item) return;
      toggle.disabled = true;
      try {
        if (e.target.checked) {
          await window.pulso.enableStartup(item);
        } else {
          await window.pulso.disableStartup(item);
        }
      } catch (err) {
        e.target.checked = !e.target.checked;
        window.showAlertModal('Erro', 'Não foi possível alterar este item. Pode ser necessário executar o Takeda App como administrador.');
      } finally {
        toggle.disabled = false;
      }
    });
  });
}

let orphanedCache = [];

function renderCleanerTab() {
  const content = document.getElementById('reg-content');
  content.innerHTML = `
    <div style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
      <p style="margin-bottom:20px; max-width:480px; margin-left:auto; margin-right:auto; line-height:1.5;">
        Procura por entradas de "Programas e Recursos" e atalhos de aplicativos (App Paths) que apontam para arquivos que não existem mais.
        Antes de remover qualquer entrada, um backup <strong>.reg</strong> é criado automaticamente.
      </p>
      <button class="btn-primary" id="reg-scan-btn" style="width:auto; padding:10px 28px;">Escanear Registro</button>
    </div>
  `;
  document.getElementById('reg-scan-btn').addEventListener('click', runOrphanedScan);
}

async function runOrphanedScan() {
  const content = document.getElementById('reg-content');
  content.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);"><div class="loading-spinner" style="margin-bottom:16px;"></div><p>Escaneando entradas de registro...</p></div>`;

  try {
    orphanedCache = await window.pulso.scanOrphanedRegistry();
  } catch (e) {
    orphanedCache = [];
  }

  if (orphanedCache.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-secondary);">
        <p style="margin-bottom:20px;">Nenhuma entrada órfã encontrada. Seu registro está limpo nas categorias verificadas.</p>
        <button class="btn-secondary" id="reg-scan-again" style="width:auto; padding:9px 18px;">Escanear Novamente</button>
      </div>
    `;
    document.getElementById('reg-scan-again').addEventListener('click', runOrphanedScan);
    return;
  }

  const rows = orphanedCache.map((entry) => `
    <div class="clean-item">
      <input type="checkbox" class="clean-check orphan-check" data-id="${entry.id}" checked>
      <div class="clean-info">
        <div class="clean-name">${entry.displayName} <span class="badge" style="margin:0 0 0 6px;">${entry.category === 'uninstall' ? 'Programa' : 'App Path'}</span></div>
        <div class="clean-desc" style="word-break: break-all;">Caminho não encontrado: ${entry.checkedPath}</div>
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="clean-list">${rows}</div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-color);">
      <span style="color:var(--text-secondary); font-size:0.85rem;">${orphanedCache.length} entradas encontradas · backup .reg será criado antes de remover</span>
      <button class="btn-primary" id="reg-remove-btn" style="width:auto; padding:10px 24px;">Remover Selecionadas</button>
    </div>
  `;

  document.getElementById('reg-remove-btn').addEventListener('click', () => {
    const checked = document.querySelectorAll('.orphan-check:checked');
    const ids = Array.from(checked).map((c) => c.dataset.id);
    if (ids.length === 0) return;

    window.showConfirmModal(
      'Remover entradas de registro',
      `Isso vai remover ${ids.length} entrada(s) do registro (com backup .reg salvo antes). Continuar?`,
      async () => {
        const selected = orphanedCache.filter((e) => ids.includes(e.id));
        try {
          await window.pulso.removeOrphanedRegistry(selected);
          window.showAlertModal('Concluído', 'Entradas removidas. Os backups .reg ficam salvos na pasta de dados do Takeda App.', () => runOrphanedScan());
        } catch (e) {
          window.showAlertModal('Erro', 'Não foi possível remover as entradas selecionadas.');
        }
      }
    );
  });
}

export function initRegistry() {
  document.querySelectorAll('#reg-tabs .app-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#reg-tabs .app-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.tab === 'startup') renderStartupTab();
      else renderCleanerTab();
    });
  });

  renderStartupTab();
}
