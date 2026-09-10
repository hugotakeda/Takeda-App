import { formatBytes } from '../ui.js';

let selectedPath = null;

export function renderShredder() {
  return `
    <div class="page-header tool-page-header">
      <h1 class="page-title">Exclusão Segura</h1>
      <p class="tool-page-subtitle">Apaga arquivos ou pastas sobrescrevendo o conteúdo antes de excluir — não vão para a Lixeira.</p>
    </div>
    <div class="page-content tool-page-content">
      <div class="destructive-warning" role="note">
        <div class="destructive-warning-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="destructive-warning-copy"><strong>Isso é irreversível.</strong> Os arquivos não vão para a Lixeira. Em SSDs modernos, a sobrescrita não é 100% garantida por causa do wear-leveling — para máxima segurança em SSD, prefira criptografia de disco.</div>
      </div>

      <section class="card tool-card">
        <h2 class="card-title tool-card-title">O que apagar</h2>
        <div class="tool-button-row">
          <button class="btn-outline tool-button-fill" id="shred-pick-file" type="button">Escolher arquivo...</button>
          <button class="btn-outline tool-button-fill" id="shred-pick-folder" type="button">Escolher pasta...</button>
        </div>
        <div class="selected-path" id="shred-selected-path" aria-live="polite">Nada selecionado.</div>
      </section>

      <section class="card tool-card">
        <h2 class="card-title tool-card-title">Passes de sobrescrita</h2>
        <label class="sr-only" for="shred-passes">Quantidade de passes de sobrescrita</label>
        <div class="slider-container">
          <input type="range" class="range-slider" id="shred-passes" min="1" max="7" value="3" aria-describedby="shred-passes-value">
          <span class="slider-value" id="shred-passes-value">3</span>
        </div>
      </section>

      <div class="shred-progress" id="shred-progress" role="status" aria-live="polite"></div>
      <button class="btn-primary tool-button-wide" id="shred-execute" type="button" disabled>Apagar com Segurança</button>
    </div>
  `;
}

export function initShredder({ signal } = {}) {
  selectedPath = null;
  let inFlight = false;
  let disposed = false;

  const passesInput = document.getElementById('shred-passes');
  const passesValue = document.getElementById('shred-passes-value');
  const pathLabel = document.getElementById('shred-selected-path');
  const executeButton = document.getElementById('shred-execute');
  passesInput?.addEventListener('input', () => {
    passesValue.textContent = passesInput.value;
  });

  const setPath = (path) => {
    selectedPath = path;
    pathLabel.textContent = path || 'Nada selecionado.';
    executeButton.disabled = inFlight || !path;
  };

  const pick = async (picker) => {
    try {
      const path = await picker();
      if (!disposed && !signal?.aborted && path) setPath(path);
    } catch (error) {
      if (!disposed && !signal?.aborted) window.showAlertModal('Erro', 'Não foi possível abrir o seletor agora.');
    }
  };

  document.getElementById('shred-pick-file')?.addEventListener('click', () => void pick(window.pulso.shredPickFile));
  document.getElementById('shred-pick-folder')?.addEventListener('click', () => void pick(window.pulso.shredPickFolder));

  executeButton?.addEventListener('click', () => {
    if (!selectedPath || inFlight) return;
    window.showConfirmModal(
      'Confirmar exclusão segura',
      `Isso vai apagar permanentemente:\n${selectedPath}\n\nEssa ação não pode ser desfeita. Continuar?`,
      runShred
    );
  });

  async function runShred() {
    if (inFlight || !selectedPath) return;
    inFlight = true;
    const targetPath = selectedPath;
    const progress = document.getElementById('shred-progress');
    progress?.classList.add('is-visible');
    if (progress) progress.textContent = 'Iniciando...';
    executeButton.disabled = true;
    executeButton.textContent = 'Apagando...';

    window.pulso.onShredProgress((data) => {
      if (disposed || signal?.aborted || !progress) return;
      progress.textContent = `${data.totalCount} arquivo(s) apagados · ${formatBytes(data.totalFreed)} sobrescritos`;
    });

    try {
      const passes = parseInt(passesInput.value, 10);
      const result = await window.pulso.shredExecute(targetPath, passes);
      if (disposed || signal?.aborted) return;
      if (result?.ok) {
        window.showAlertModal('Concluído', `${result.count} arquivo(s) apagados com segurança.\nEspaço sobrescrito: ${formatBytes(result.freed)}`, () => {
          setPath(null);
          progress?.classList.remove('is-visible');
        });
      } else {
        window.showAlertModal('Erro', result?.error || 'Não foi possível apagar este item.');
      }
    } catch (e) {
      if (!disposed && !signal?.aborted) window.showAlertModal('Erro', 'Não foi possível apagar este item.');
    } finally {
      window.pulso.removeShredProgressListener();
      inFlight = false;
      if (!disposed && executeButton) {
        executeButton.textContent = 'Apagar com Segurança';
        executeButton.disabled = !selectedPath;
      }
    }
  }

  return () => {
    disposed = true;
    window.pulso.removeShredProgressListener();
  };
}
