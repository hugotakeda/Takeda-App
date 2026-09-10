import { renderAdvancedCleanup, initAdvancedCleanup } from './AdvancedCleanup.js';
import { renderRegistry, initRegistry } from './Registry.js';
import { renderDiskAnalyzer, initDiskAnalyzer } from './DiskAnalyzer.js';
import { renderPrivacy, initPrivacy } from './Privacy.js';
import { renderShredder, initShredder } from './Shredder.js';
import { renderMalware, initMalware } from './Malware.js';
import { renderDebloat, initDebloat } from './Debloat.js';

const SUBVIEWS = [
  { id: 'cleanup', name: 'Limpeza Avançada', tabName: 'Limpeza', render: renderAdvancedCleanup, init: initAdvancedCleanup },
  { id: 'registry', name: 'Registro & Inicialização', tabName: 'Registro', render: renderRegistry, init: initRegistry },
  { id: 'disk', name: 'Analisador de Disco', tabName: 'Disco', render: renderDiskAnalyzer, init: initDiskAnalyzer },
  { id: 'privacy', name: 'Central de Privacidade', tabName: 'Privacidade', render: renderPrivacy, init: initPrivacy },
  { id: 'shredder', name: 'Exclusão Segura', tabName: 'Exclusão', render: renderShredder, init: initShredder },
  { id: 'security', name: 'Segurança', tabName: 'Segurança', render: renderMalware, init: initMalware },
  { id: 'debloat', name: 'Debloat do Windows', tabName: 'Debloat', render: renderDebloat, init: initDebloat },
];

let activeSub = SUBVIEWS[0].id;
let mountEpoch = 0;
let activeController = null;
let disposeActiveSubview = null;

export function renderTools() {
  const tabsHtml = SUBVIEWS.map((v) => `
    <button class="app-tab-btn ${v.id === activeSub ? 'active' : ''}" id="tools-tab-${v.id}" type="button" role="tab" aria-controls="tools-subview" aria-label="${v.name}" title="${v.name}" aria-selected="${v.id === activeSub}" tabindex="${v.id === activeSub ? '0' : '-1'}" data-sub="${v.id}">${v.tabName}</button>
  `).join('');

  return `
    <div class="tab-bar" id="tools-subtabs" role="tablist" aria-label="Ferramentas do sistema">
      ${tabsHtml}
    </div>
    <div id="tools-subview" role="tabpanel" aria-labelledby="tools-tab-${activeSub}"></div>
  `;
}

async function mountSubview(id) {
  const epoch = ++mountEpoch;
  activeController?.abort();
  if (typeof disposeActiveSubview === 'function') disposeActiveSubview();
  disposeActiveSubview = null;
  const controller = new AbortController();
  activeController = controller;

  activeSub = id;
  const view = SUBVIEWS.find((v) => v.id === id) || SUBVIEWS[0];
  const container = document.getElementById('tools-subview');
  if (!container) return;

  container.classList.remove('subview-transition-in');
  container.innerHTML = view.render();
  void container.offsetWidth; // force reflow so the entrance animation restarts
  container.classList.add('subview-transition-in');
  container.setAttribute('aria-busy', 'true');

  document.querySelectorAll('#tools-subtabs .app-tab-btn').forEach((btn) => {
    const selected = btn.dataset.sub === view.id;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', String(selected));
    btn.tabIndex = selected ? 0 : -1;
    if (selected) {
      container.setAttribute('aria-labelledby', btn.id);
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });

  try {
    const cleanup = await Promise.resolve(view.init({ signal: controller.signal }));
    if (epoch !== mountEpoch || controller.signal.aborted) {
      if (typeof cleanup === 'function') cleanup();
      return;
    }
    disposeActiveSubview = typeof cleanup === 'function' ? cleanup : null;
    const scrollRegion = container.querySelector('.tool-page-content');
    if (scrollRegion) {
      scrollRegion.tabIndex = 0;
      scrollRegion.setAttribute('aria-label', `Opções de ${view.name}`);
    }
  } catch (error) {
    if (epoch === mountEpoch && !controller.signal.aborted) {
      console.error('[Tools] Falha ao montar subview:', error);
      container.innerHTML = '<div class="tool-state tool-state--error" role="alert">Não foi possível abrir esta ferramenta.</div>';
    }
  } finally {
    if (epoch === mountEpoch) container.removeAttribute('aria-busy');
  }
}

export function initTools() {
  const tabs = Array.from(document.querySelectorAll('#tools-subtabs .app-tab-btn'));
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => void mountSubview(btn.dataset.sub));
  });
  document.getElementById('tools-subtabs')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const currentIndex = tabs.indexOf(event.target.closest('.app-tab-btn'));
    if (currentIndex < 0) return;
    event.preventDefault();
    let nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    tabs[nextIndex].focus();
    void mountSubview(tabs[nextIndex].dataset.sub);
  });
  void mountSubview(activeSub);

  return () => {
    mountEpoch += 1;
    activeController?.abort();
    activeController = null;
    if (typeof disposeActiveSubview === 'function') disposeActiveSubview();
    disposeActiveSubview = null;
  };
}
