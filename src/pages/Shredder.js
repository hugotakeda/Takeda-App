function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

let selectedPath = null;

export function renderShredder() {
  return `
    <div class="page-header">
      <h1 class="page-title">Exclusão Segura</h1>
      <p style="color: var(--text-secondary); margin-top:4px; font-size:0.9rem;">Apaga arquivos ou pastas sobrescrevendo o conteúdo antes de excluir — não vão para a Lixeira.</p>
    </div>
    <div class="page-content" style="max-height: calc(100vh - 220px); overflow-y:auto; padding-right:8px; margin-top:16px;">
      <div style="display:flex; gap:14px; background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.15); border-radius: 8px; padding: 16px; align-items: flex-start; margin-bottom: 24px;">
        <div style="color: #f87171; flex-shrink: 0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div style="font-size:0.85rem; color: var(--text-secondary); line-height:1.5;">
          <strong style="color:#f87171;">Isso é irreversível.</strong> Os arquivos não vão para a Lixeira. Em SSDs modernos, a sobrescrita não é 100% garantida por causa do wear-leveling — para máxima segurança em SSD, prefira criptografia de disco.
        </div>
      </div>

      <div class="card" style="padding:20px; margin-bottom:20px;">
        <div class="card-title" style="margin-bottom:12px;">O que apagar</div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button class="btn-outline" id="shred-pick-file" style="flex:1;">Escolher arquivo...</button>
          <button class="btn-outline" id="shred-pick-folder" style="flex:1;">Escolher pasta...</button>
        </div>
        <div id="shred-selected-path" style="font-size:0.8rem; color:var(--text-secondary); word-break: break-all; min-height:1.2em;">Nada selecionado.</div>
      </div>

      <div class="card" style="padding:20px; margin-bottom:20px;">
        <div class="card-title" style="margin-bottom:8px;">Passes de sobrescrita</div>
        <div class="slider-container">
          <input type="range" class="range-slider" id="shred-passes" min="1" max="7" value="3">
          <span class="slider-value" id="shred-passes-value">3</span>
        </div>
      </div>

      <div id="shred-progress" style="display:none; margin-bottom:16px; font-size:0.85rem; color:var(--text-secondary);"></div>

      <button class="btn-primary" id="shred-execute" disabled style="width:100%; padding:12px;">Apagar com Segurança</button>
    </div>
  `;
}

export function initShredder() {
  selectedPath = null;

  const passesInput = document.getElementById('shred-passes');
  const passesValue = document.getElementById('shred-passes-value');
  passesInput.addEventListener('input', () => (passesValue.textContent = passesInput.value));

  const pathLabel = document.getElementById('shred-selected-path');
  const execBtn = document.getElementById('shred-execute');

  const setPath = (p) => {
    selectedPath = p;
    pathLabel.textContent = p || 'Nada selecionado.';
    execBtn.disabled = !p;
  };

  document.getElementById('shred-pick-file').addEventListener('click', async () => {
    const p = await window.pulso.shredPickFile();
    if (p) setPath(p);
  });

  document.getElementById('shred-pick-folder').addEventListener('click', async () => {
    const p = await window.pulso.shredPickFolder();
    if (p) setPath(p);
  });

  execBtn.addEventListener('click', () => {
    if (!selectedPath) return;
    window.showConfirmModal(
      'Confirmar exclusão segura',
      `Isso vai apagar permanentemente:\n${selectedPath}\n\nEssa ação não pode ser desfeita. Continuar?`,
      runShred
    );
  });

  async function runShred() {
    const progress = document.getElementById('shred-progress');
    progress.style.display = 'block';
    progress.textContent = 'Iniciando...';
    execBtn.disabled = true;
    execBtn.textContent = 'Apagando...';

    window.pulso.onShredProgress((data) => {
      progress.textContent = `${data.totalCount} arquivo(s) apagados · ${formatBytes(data.totalFreed)} sobrescritos`;
    });

    try {
      const passes = parseInt(passesInput.value);
      const res = await window.pulso.shredExecute(selectedPath, passes);
      window.pulso.removeShredProgressListener();
      if (res.ok) {
        window.showAlertModal('Concluído', `${res.count} arquivo(s) apagados com segurança.\nEspaço sobrescrito: ${formatBytes(res.freed)}`, () => {
          setPath(null);
          progress.style.display = 'none';
        });
      } else {
        window.showAlertModal('Erro', res.error || 'Não foi possível apagar este item.');
      }
    } catch (e) {
      window.pulso.removeShredProgressListener();
      window.showAlertModal('Erro', 'Não foi possível apagar este item.');
    } finally {
      execBtn.textContent = 'Apagar com Segurança';
      execBtn.disabled = !selectedPath;
    }
  }
}
