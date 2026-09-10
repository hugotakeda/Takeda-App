import { escapeHtml, formatBytes } from '../ui.js';

let scanEpoch = 0;
let viewEpoch = 0;

export function renderDiskAnalyzer() {
  return `
    <div class="page-header tool-page-header">
      <div class="tool-page-header--split">
        <div>
          <h1 class="page-title">Analisador de Disco</h1>
          <p class="tool-page-subtitle">Veja o que está ocupando espaço no seu disco.</p>
        </div>
        <button class="btn-secondary tool-header-action" id="disk-pick-folder" type="button">Escolher pasta...</button>
      </div>
      <div class="disk-shortcuts" id="disk-shortcuts" aria-label="Atalhos de pastas" aria-live="polite"></div>
    </div>
    <div class="page-content tool-page-content tool-page-content--disk" id="disk-content" aria-live="polite">
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <div class="empty-state-title">Escolha uma pasta para começar</div>
        <div class="empty-state-desc">Use um dos atalhos acima ou clique em "Escolher pasta..." para ver o que está ocupando espaço.</div>
      </div>
    </div>
  `;
}

function renderBreakdown(data, epoch, lifecycle) {
  if (epoch !== scanEpoch || lifecycle !== viewEpoch) return;
  const content = document.getElementById('disk-content');
  if (!content) return;
  const children = Array.isArray(data.children) ? data.children : [];
  const topFiles = Array.isArray(data.topFiles) ? data.topFiles : [];
  const byExtension = Array.isArray(data.byExtension) ? data.byExtension : [];
  const maxSize = Math.max(1, ...children.map((child) => Number(child.size) || 0));

  const childrenHtml = children.slice(0, 30).map((child) => {
    const percentage = Math.max(2, ((Number(child.size) || 0) / maxSize) * 100);
    return `
      <div class="disk-breakdown-row">
        <div class="disk-breakdown-meta">
          <span class="disk-breakdown-name">${child.isDir ? '📁' : '📄'} ${escapeHtml(child.name)}</span>
          <strong>${formatBytes(child.size)}</strong>
        </div>
        <div class="progress-bg disk-progress-track">
          <div class="progress-fill disk-progress-fill" data-target-width="${percentage}%"></div>
        </div>
      </div>
    `;
  }).join('');

  const topFilesHtml = topFiles.slice(0, 15).map((file) => `
    <div class="clean-item">
      <div class="clean-info clean-info--grow">
        <div class="clean-name clean-desc--path">${escapeHtml(file.name)}</div>
        <div class="clean-desc clean-desc--path">${escapeHtml(file.path)}</div>
      </div>
      <div class="clean-size">${formatBytes(file.size)}</div>
    </div>
  `).join('');

  const extensionHtml = byExtension.slice(0, 12).map((entry) => `
    <div class="disk-extension-row">
      <span class="disk-extension-label">${escapeHtml(entry.ext)} <span class="disk-extension-count">(${Number(entry.count) || 0})</span></span>
      <strong>${formatBytes(entry.size)}</strong>
    </div>
  `).join('');

  content.innerHTML = `
    <section class="card tool-card disk-summary-card">
      <div class="card-desc clean-desc--path">${escapeHtml(data.root)}</div>
      <div class="card-value disk-total-value">${formatBytes(data.totalSize)}</div>
    </section>
    <section class="card tool-card">
      <h2 class="card-title tool-card-title tool-card-title--spacious">Maiores itens diretos</h2>
      ${childrenHtml || '<div class="tool-inline-empty">Pasta vazia.</div>'}
    </section>
    <section class="card tool-card">
      <h2 class="card-title tool-card-title">Distribuição por tipo de arquivo</h2>
      <div class="disk-extension-grid">${extensionHtml || '<div class="tool-inline-empty">Sem dados.</div>'}</div>
    </section>
    <section class="card tool-card">
      <h2 class="card-title tool-card-title">Maiores arquivos (recursivo)</h2>
      <div class="clean-list">${topFilesHtml || '<div class="tool-inline-empty tool-inline-empty--padded">Sem dados.</div>'}</div>
    </section>
  `;
  content.removeAttribute('aria-busy');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (epoch !== scanEpoch || lifecycle !== viewEpoch) return;
      content.querySelectorAll('.disk-progress-fill[data-target-width]').forEach((element) => {
        element.style.width = element.dataset.targetWidth;
      });
    });
  });
}

async function scan(rootPath, lifecycle) {
  const epoch = ++scanEpoch;
  const content = document.getElementById('disk-content');
  if (!content || lifecycle !== viewEpoch) return;
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = `<div class="tool-state tool-state--loading tool-state--roomy" role="status"><div class="loading-spinner"></div><p>Analisando ${escapeHtml(rootPath)}...<br><span class="tool-state-detail">Isso pode levar alguns segundos em pastas grandes.</span></p></div>`;
  try {
    const data = await window.pulso.scanDisk(rootPath);
    if (epoch !== scanEpoch || lifecycle !== viewEpoch || !document.getElementById('disk-content')) return;
    if (!data || typeof data !== 'object') throw new Error('Resposta inválida');
    renderBreakdown(data, epoch, lifecycle);
  } catch (e) {
    if (epoch !== scanEpoch || lifecycle !== viewEpoch) return;
    content.removeAttribute('aria-busy');
    content.innerHTML = `<div class="tool-state tool-state--error" role="alert">Erro ao analisar esta pasta. <button class="btn-secondary tool-state-action" id="disk-scan-retry" type="button">Tentar novamente</button></div>`;
    document.getElementById('disk-scan-retry')?.addEventListener('click', () => scan(rootPath, lifecycle));
  }
}

async function loadShortcuts(container, lifecycle) {
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `<span class="skeleton-pill"></span><span class="skeleton-pill"></span><span class="skeleton-pill"></span>`;
  try {
    const shortcuts = await window.pulso.getDiskShortcuts();
    if (lifecycle !== viewEpoch || !document.getElementById('disk-shortcuts')) return;
    if (!Array.isArray(shortcuts)) throw new Error('Resposta inválida');
    container.innerHTML = shortcuts.map((shortcut) => `
      <button class="btn-outline disk-shortcut-btn" data-path="${encodeURIComponent(shortcut.path)}" type="button">${escapeHtml(shortcut.name)}</button>
    `).join('');
    container.querySelectorAll('.disk-shortcut-btn').forEach((button) => {
      button.addEventListener('click', () => void scan(decodeURIComponent(button.dataset.path), lifecycle));
    });
  } catch (e) {
    if (lifecycle !== viewEpoch) return;
    container.innerHTML = `<span class="disk-shortcuts-error">Atalhos indisponíveis.</span><button class="btn-outline disk-shortcut-btn" id="disk-shortcuts-retry" type="button">Tentar novamente</button>`;
    document.getElementById('disk-shortcuts-retry')?.addEventListener('click', () => loadShortcuts(container, lifecycle));
  } finally {
    if (lifecycle === viewEpoch) container.removeAttribute('aria-busy');
  }
}

export function initDiskAnalyzer({ signal } = {}) {
  const lifecycle = ++viewEpoch;
  const shortcutsContainer = document.getElementById('disk-shortcuts');
  if (shortcutsContainer) void loadShortcuts(shortcutsContainer, lifecycle);

  document.getElementById('disk-pick-folder')?.addEventListener('click', async () => {
    try {
      const folder = await window.pulso.pickDiskFolder();
      if (folder && lifecycle === viewEpoch && !signal?.aborted) void scan(folder, lifecycle);
    } catch (e) {
      if (lifecycle === viewEpoch && !signal?.aborted) window.showAlertModal('Erro', 'Não foi possível abrir o seletor de pastas.');
    }
  });

  return () => {
    if (lifecycle === viewEpoch) ++viewEpoch;
    ++scanEpoch;
    Promise.resolve(window.pulso.cancelDiskScan?.()).catch(() => {});
  };
}
