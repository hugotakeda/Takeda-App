import { renderAdvancedCleanup, initAdvancedCleanup } from './AdvancedCleanup.js';
import { renderRegistry, initRegistry } from './Registry.js';
import { renderDiskAnalyzer, initDiskAnalyzer } from './DiskAnalyzer.js';
import { renderPrivacy, initPrivacy } from './Privacy.js';
import { renderShredder, initShredder } from './Shredder.js';
import { renderMalware, initMalware } from './Malware.js';
import { renderDebloat, initDebloat } from './Debloat.js';

const SUBVIEWS = [
  { id: 'cleanup', name: 'Limpeza Avançada', render: renderAdvancedCleanup, init: initAdvancedCleanup },
  { id: 'registry', name: 'Registro & Inicialização', render: renderRegistry, init: initRegistry },
  { id: 'disk', name: 'Disco', render: renderDiskAnalyzer, init: initDiskAnalyzer },
  { id: 'privacy', name: 'Privacidade', render: renderPrivacy, init: initPrivacy },
  { id: 'shredder', name: 'Exclusão Segura', render: renderShredder, init: initShredder },
  { id: 'security', name: 'Segurança', render: renderMalware, init: initMalware },
  { id: 'debloat', name: 'Debloat', render: renderDebloat, init: initDebloat },
];

let activeSub = SUBVIEWS[0].id;

export function renderTools() {
  const tabsHtml = SUBVIEWS.map((v) => `
    <button class="app-tab-btn ${v.id === activeSub ? 'active' : ''}" data-sub="${v.id}">${v.name}</button>
  `).join('');

  return `
    <div class="tab-bar" id="tools-subtabs" style="margin-bottom:16px;">
      ${tabsHtml}
    </div>
    <div id="tools-subview"></div>
  `;
}

function mountSubview(id) {
  activeSub = id;
  const view = SUBVIEWS.find((v) => v.id === id) || SUBVIEWS[0];
  const container = document.getElementById('tools-subview');
  container.classList.remove('subview-transition-in');
  container.innerHTML = view.render();
  view.init();
  void container.offsetWidth; // force reflow so the entrance animation restarts
  container.classList.add('subview-transition-in');

  document.querySelectorAll('#tools-subtabs .app-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sub === view.id);
  });
}

export function initTools() {
  document.querySelectorAll('#tools-subtabs .app-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => mountSubview(btn.dataset.sub));
  });
  mountSubview(activeSub);
}
