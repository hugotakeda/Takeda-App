function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[Math.min(i, sizes.length - 1)];
}

export function renderDiskAnalyzer() {
  return `
    <div class="page-header" style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h1 class="page-title">Analisador de Disco</h1>
          <p style="color: var(--text-secondary); margin-top:4px; font-size:0.9rem;">Veja o que está ocupando espaço no seu disco.</p>
        </div>
        <button class="btn-secondary" id="disk-pick-folder" style="width:auto; padding:9px 18px; flex-shrink:0;">Escolher pasta...</button>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;" id="disk-shortcuts"></div>
    </div>
    <div class="page-content" style="max-height: calc(100vh - 260px); overflow-y:auto; padding-right:8px; margin-top:16px;" id="disk-content">
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <div class="empty-state-title">Escolha uma pasta para começar</div>
        <div class="empty-state-desc">Use um dos atalhos acima ou clique em "Escolher pasta..." para ver o que está ocupando espaço.</div>
      </div>
    </div>
  `;
}

function renderBreakdown(data) {
  const content = document.getElementById('disk-content');
  const maxSize = Math.max(1, ...data.children.map((c) => c.size));

  const childrenHtml = data.children.slice(0, 30).map((c) => {
    const pct = Math.max(2, (c.size / maxSize) * 100);
    return `
    <div style="margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
        <span style="color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${c.isDir ? '📁' : '📄'} ${c.name}</span>
        <strong>${formatBytes(c.size)}</strong>
      </div>
      <div class="progress-bg" style="height:6px; border-radius:3px; background:rgba(255,255,255,0.06);">
        <div class="progress-fill" data-target-width="${pct}%" style="height:100%; border-radius:3px; width:0%; background:var(--accent-blue);"></div>
      </div>
    </div>
  `;
  }).join('');

  const topFilesHtml = data.topFiles.slice(0, 15).map((f) => `
    <div class="clean-item">
      <div class="clean-info" style="flex:1;">
        <div class="clean-name" style="word-break: break-all;">${f.name}</div>
        <div class="clean-desc" style="word-break: break-all;">${f.path}</div>
      </div>
      <div class="clean-size">${formatBytes(f.size)}</div>
    </div>
  `).join('');

  const extHtml = data.byExtension.slice(0, 12).map((e) => `
    <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; font-size:0.85rem;">
      <span style="color:var(--text-secondary);">${e.ext} <span style="opacity:0.6;">(${e.count})</span></span>
      <strong>${formatBytes(e.size)}</strong>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="card" style="margin-bottom:20px; padding:20px;">
      <div class="card-desc" style="word-break: break-all;">${data.root}</div>
      <div class="card-value" style="font-size:1.8rem; margin-top:6px;">${formatBytes(data.totalSize)}</div>
    </div>

    <div class="card" style="margin-bottom:20px; padding:20px;">
      <div class="card-title" style="margin-bottom:16px;">Maiores itens diretos</div>
      ${childrenHtml || '<div style="color:var(--text-secondary);">Pasta vazia.</div>'}
    </div>

    <div class="card" style="margin-bottom:20px; padding:20px;">
      <div class="card-title" style="margin-bottom:12px;">Distribuição por tipo de arquivo</div>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:8px;">
        ${extHtml || '<div style="color:var(--text-secondary);">Sem dados.</div>'}
      </div>
    </div>

    <div class="card" style="padding:20px;">
      <div class="card-title" style="margin-bottom:12px;">Maiores arquivos (recursivo)</div>
      <div class="clean-list">${topFilesHtml || '<div style="color:var(--text-secondary); padding:12px;">Sem dados.</div>'}</div>
    </div>
  `;

  // Bars start at width:0 in the markup above so the CSS `transition: width`
  // on .progress-fill actually has something to animate — trigger the real
  // width on the next frame (double rAF so the 0% state is guaranteed to paint first).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      content.querySelectorAll('.progress-fill[data-target-width]').forEach((el) => {
        el.style.width = el.dataset.targetWidth;
      });
    });
  });
}

async function scan(rootPath) {
  const content = document.getElementById('disk-content');
  content.innerHTML = `<div style="text-align:center; padding:60px 20px; color:var(--text-secondary);"><div class="loading-spinner" style="margin-bottom:16px;"></div><p>Analisando ${rootPath}...<br><span style="font-size:0.8rem;">Isso pode levar alguns segundos em pastas grandes.</span></p></div>`;
  try {
    const data = await window.pulso.scanDisk(rootPath);
    renderBreakdown(data);
  } catch (e) {
    content.innerHTML = `<div style="color:#f87171; padding:20px; text-align:center;">Erro ao analisar esta pasta.</div>`;
  }
}

export async function initDiskAnalyzer() {
  const shortcutsContainer = document.getElementById('disk-shortcuts');
  try {
    const shortcuts = await window.pulso.getDiskShortcuts();
    shortcutsContainer.innerHTML = shortcuts.map((s) => `
      <button class="btn-outline disk-shortcut-btn" data-path="${encodeURIComponent(s.path)}" style="padding:6px 14px; font-size:0.8rem; border-radius:20px;">${s.name}</button>
    `).join('');
    shortcutsContainer.querySelectorAll('.disk-shortcut-btn').forEach((btn) => {
      btn.addEventListener('click', () => scan(decodeURIComponent(btn.dataset.path)));
    });
  } catch (e) {}

  document.getElementById('disk-pick-folder').addEventListener('click', async () => {
    const folder = await window.pulso.pickDiskFolder();
    if (folder) scan(folder);
  });
}
