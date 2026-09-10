let previouslyFocused = null;
let afterClose = null;
let infrastructureBound = false;

function getParts() {
  return {
    overlay: document.getElementById('modal-overlay'),
    content: document.getElementById('modal-content'),
  };
}

function focusableElements(content) {
  return Array.from(content.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

export function openModalShell({ labelledBy, describedBy, onClose } = {}) {
  const { overlay, content } = getParts();
  if (!overlay || !content) return null;

  if (!overlay.classList.contains('active')) {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  afterClose = typeof onClose === 'function' ? onClose : null;
  content.setAttribute('role', 'dialog');
  content.setAttribute('aria-modal', 'true');
  if (labelledBy) content.setAttribute('aria-labelledby', labelledBy);
  else content.removeAttribute('aria-labelledby');
  if (describedBy) content.setAttribute('aria-describedby', describedBy);
  else content.removeAttribute('aria-describedby');
  content.setAttribute('tabindex', '-1');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => {
    const first = focusableElements(content)[0];
    (first || content).focus({ preventScroll: true });
  });

  return content;
}

export function closeModal(reason = 'dismiss') {
  const { overlay, content } = getParts();
  if (!overlay?.classList.contains('active')) return;

  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  const callback = afterClose;
  afterClose = null;

  if (content) {
    content.removeAttribute('aria-labelledby');
    content.removeAttribute('aria-describedby');
  }

  const focusTarget = previouslyFocused;
  previouslyFocused = null;
  if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });

  window.dispatchEvent(new CustomEvent('takeda:modal-closed', { detail: { reason } }));
  if (callback) {
    Promise.resolve()
      .then(() => callback(reason))
      .catch((error) => console.error('[Modal] Falha no callback de fechamento.', error));
  }
}

export function bindModalInfrastructure() {
  if (infrastructureBound) return;
  infrastructureBound = true;

  const { overlay } = getParts();
  overlay?.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-modal-close]');
    if (closeButton) closeModal('button');
  });

  document.addEventListener('keydown', (event) => {
    const { overlay, content } = getParts();
    if (!overlay?.classList.contains('active') || !content) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal('escape');
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = focusableElements(content);
    if (focusable.length === 0) {
      event.preventDefault();
      content.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
