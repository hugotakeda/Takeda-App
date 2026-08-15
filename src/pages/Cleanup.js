export function renderCleanup() {
  return `
    <div class="page-section active" id="sec-cleanup">
      <div class="dashboard-header">
        <h1 class="page-title">Limpeza do Sistema</h1>
      </div>
      
      <div class="health-section" style="flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h2 class="health-title">Itens de Limpeza</h2>
            <p class="health-desc">Selecione os itens que deseja remover para liberar espaço.</p>
          </div>
          <button class="btn-secondary" id="btn-calc-sizes">Recalcular Tamanhos</button>
        </div>

        <div id="cleanup-list">
          <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
            <div class="loading-spinner" style="margin-bottom: 16px;"></div>
            <p>Calculando espaço ocupado...</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color);">
          <div>
            <span class="text-gray">Total selecionado: </span>
            <strong style="font-size: 1.2rem; color: var(--text-primary);" id="cleanup-total-sel">0 B</strong>
          </div>
          <button class="btn-primary" id="btn-exec-cleanup" disabled>Executar Limpeza</button>
        </div>
      </div>
    </div>
  `;
}

let sizesCache = {};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const itemsDef = [
  { id: 'TempUser', key: 'tempUser', name: 'Arquivos temporários (Usuário)', desc: 'Cache de instaladores e apps.' },
  { id: 'TempWindows', key: 'tempWin', name: 'Arquivos temporários (Windows)', desc: 'C:\\Windows\\Temp' },
  { id: 'Prefetch', key: 'prefetch', name: 'Prefetch', desc: 'Cache de inicialização (seguro remover).' },
  { id: 'CrashDumps', key: 'crashDumps', name: 'Crash Dumps', desc: 'Arquivos de memória de programas que travaram.' },
  { id: 'Thumbcache', key: 'thumbcache', name: 'Cache de miniaturas', desc: 'Banco de dados de thumbnails do Explorer.' },
  { id: 'RecycleBin', key: 'recycleBin', name: 'Lixeira', desc: 'Tudo que está na lixeira.' }
];

export function initCleanup() {
  document.getElementById('btn-calc-sizes').addEventListener('click', loadSizes);
  document.getElementById('btn-exec-cleanup').addEventListener('click', executeCleanup);
  loadSizes();
}

async function loadSizes() {
  const list = document.getElementById('cleanup-list');
  list.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
      <div class="loading-spinner" style="margin-bottom: 16px;"></div>
      <p>Calculando espaço ocupado...</p>
    </div>
  `;
  document.getElementById('btn-exec-cleanup').disabled = true;

  try {
    sizesCache = await window.pulso.getCleanupSizes();
    renderList();
  } catch (e) {
    list.innerHTML = `<div style="color: var(--accent-red); padding: 20px;">Erro ao calcular tamanhos.</div>`;
  }
}

function renderList() {
  const list = document.getElementById('cleanup-list');
  list.innerHTML = '';
  
  itemsDef.forEach(item => {
    const size = sizesCache[item.key] || 0;
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <label class="checkbox-container">
        <input type="checkbox" class="chk-cleanup" data-id="${item.id}" data-size="${size}" ${size > 0 ? 'checked' : 'disabled'}>
        <div>
          <strong style="display: block; margin-bottom: 2px;">${item.name}</strong>
          <span class="text-xs text-gray">${item.desc}</span>
        </div>
      </label>
      <div style="font-weight: 600; color: ${size > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'};">
        ${formatBytes(size)}
      </div>
    `;
    list.appendChild(div);
  });

  const checkboxes = document.querySelectorAll('.chk-cleanup');
  checkboxes.forEach(chk => {
    chk.addEventListener('change', updateTotal);
  });
  
  updateTotal();
}

function updateTotal() {
  const checkboxes = document.querySelectorAll('.chk-cleanup:checked');
  let total = 0;
  checkboxes.forEach(chk => {
    total += parseInt(chk.dataset.size);
  });
  document.getElementById('cleanup-total-sel').textContent = formatBytes(total);
  document.getElementById('btn-exec-cleanup').disabled = total === 0;
}

async function executeCleanup() {
  const checkboxes = document.querySelectorAll('.chk-cleanup:checked');
  const items = Array.from(checkboxes).map(c => c.dataset.id);
  
  if (items.length === 0) return;

  const btn = document.getElementById('btn-exec-cleanup');
  btn.disabled = true;
  btn.textContent = 'Limpando...';

  try {
    const res = await window.pulso.executeCleanup(items);
    alert(`Limpeza concluída!\nEspaço liberado: ${formatBytes(res.totalFreed)}\n\nNota: Alguns arquivos não puderam ser removidos pois estão em uso pelo sistema.`);
    loadSizes();
  } catch (e) {
    alert('Erro ao executar limpeza.');
  } finally {
    btn.textContent = 'Executar Limpeza';
  }
}
