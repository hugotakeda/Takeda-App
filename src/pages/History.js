import { t } from '../i18n.js';
import { escapeHtml } from '../ui.js';

let historyEpoch = 0;

export function renderHistory() {
  return `
    <section class="page-section active history-page" id="sec-history">
      <header class="dashboard-header history-header">
        <div class="page-heading">
          <div class="page-eyebrow">Atividade</div>
          <h1 class="page-title">${escapeHtml(t('history_title'))}</h1>
          <p class="page-subtitle">Compare diagnósticos e acompanhe a saúde da sua máquina.</p>
        </div>
        <button id="btn-clear-history" class="btn-secondary history-clear-button" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          ${escapeHtml(t('btn_clear_history'))}
        </button>
      </header>

      <div class="history-grid custom-scrollbar" id="history-list">
        <div class="history-loading" aria-label="Carregando">
          <div class="loading-spinner"></div>
        </div>
      </div>
    </section>
  `;
}

function scoreClass(score) {
  score = Number(score) || 0;
  if (score >= 80) return 'history-score--good';
  if (score >= 50) return 'history-score--warning';
  return 'history-score--critical';
}

function renderDetail(label, value) {
  return `
    <div class="history-detail">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value !== undefined && value !== null ? value : 'N/D')}</strong>
    </div>
  `;
}

export async function initHistory() {
  const epoch = ++historyEpoch;
  const list = document.getElementById('history-list');
  const btnClear = document.getElementById('btn-clear-history');
  const isCurrent = () => epoch === historyEpoch && list?.isConnected && btnClear?.isConnected;
  if (!list || !btnClear) return;

  try {
    const history = await window.pulso.getHistory();
    if (!isCurrent()) return;
    if (!Array.isArray(history)) throw new Error('Histórico inválido');

    if (history.length > 0) {
      btnClear.classList.add('is-visible');
      btnClear.onclick = () => {
        if (window.showConfirmModal) {
          window.showConfirmModal(
            t('modal_history_title'),
            t('modal_history_desc'),
            async () => {
              if (typeof window.pulso.clearHistory !== 'function') {
                window.showConfirmModal?.(
                  t('modal_restart_title'),
                  t('modal_restart_desc'),
                  () => {},
                );
                return;
              }

              try {
                await window.pulso.clearHistory();
                if (isCurrent()) void initHistory();
              } catch (error) {
                console.error('Erro ao limpar:', error);
              }
            },
          );
        } else {
          window.pulso.clearHistory().then(() => { if (isCurrent()) void initHistory(); });
        }
      };
    } else {
      btnClear.classList.remove('is-visible');
    }

    if (history.length === 0) {
      list.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
          <strong>Nenhuma análise ainda</strong>
          <span>${escapeHtml(t('history_empty'))}</span>
        </div>
      `;
      return;
    }

    list.innerHTML = '';

    history.forEach((item) => {
      const timestamp = Number(item?.timestamp);
      const dateObject = new Date(Number.isFinite(timestamp) ? timestamp : 0);
      const date = Number.isNaN(dateObject.getTime()) ? 'Data indisponível' : dateObject.toLocaleString('pt-BR');
      const score = Math.max(0, Math.min(100, Number(item?.score) || 0));
      const count = (value) => Math.max(0, Math.trunc(Number(value) || 0));
      const metric = (value, suffix) => Number.isFinite(Number(value)) ? `${Number(value)}${suffix}` : 'N/D';
      const card = document.createElement('article');
      card.className = 'history-card';

      const summary = document.createElement('button');
      summary.className = 'history-summary';
      summary.type = 'button';
      summary.setAttribute('aria-expanded', 'false');
      summary.innerHTML = `
        <div class="history-score ${scoreClass(score)}">
          <span>Score</span>
          <strong>${score}</strong>
        </div>

        <div class="history-main">
          <strong>Análise do sistema</strong>
          <time>${escapeHtml(date)}</time>
          <div class="history-counts">
            <span><strong>${count(item?.ok)}</strong> OK</span>
            <span class="is-warning"><strong>${count(item?.warnings)}</strong> Avisos</span>
            <span class="is-critical"><strong>${count(item?.criticals)}</strong> Críticos</span>
          </div>
        </div>

        <div class="history-metrics">
          <div><span>CPU</span><strong>${escapeHtml(metric(item?.cpu, '%'))}</strong></div>
          <div><span>RAM</span><strong>${escapeHtml(metric(item?.ramPct, '%'))}</strong></div>
          <div><span>Ping</span><strong>${Number(item?.ping) > -1 ? escapeHtml(metric(item.ping, 'ms')) : 'N/D'}</strong></div>
          <span class="history-expand-icon" aria-hidden="true">⌄</span>
        </div>
      `;

      const details = document.createElement('div');
      details.className = 'history-details';
      details.innerHTML = `
        ${renderDetail('Apps em segundo plano', item?.heavy !== undefined ? `${count(item.heavy)} processos pesados` : 'N/D')}
        ${renderDetail('Defender', item?.defender)}
        ${renderDetail('Plano de energia', item?.plan)}
        ${renderDetail('Driver GPU', item?.gpuDays !== undefined ? `${count(item.gpuDays)} dias` : 'N/D')}
      `;

      summary.addEventListener('click', () => {
        const open = card.classList.toggle('is-open');
        summary.setAttribute('aria-expanded', String(open));
      });

      card.append(summary, details);
      list.appendChild(card);
    });
  } catch (error) {
    if (isCurrent()) list.innerHTML = '<div class="history-error">Erro ao carregar histórico.</div>';
  }
}
