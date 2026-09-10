const http = require('http');
const crypto = require('crypto');
const { OAUTH_LOOPBACK_PORT } = require('./shared-config');

const PAGE_STYLE =
  ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;' +
  'place-items:center;background:#080b12;color:#f5f7ff;font-family:Inter,Segoe UI,sans-serif}' +
  '.card{width:min(360px,calc(100% - 32px));padding:32px;text-align:center;border-radius:28px;' +
  'background:linear-gradient(145deg,#151927,#0d1019);border:1px solid #ffffff18;' +
  'box-shadow:0 24px 70px #0009}.mark{width:72px;height:72px;margin:0 auto 20px}' +
  'h1{margin:0 0 10px;font-size:22px}p{margin:0;color:#aeb6cb;line-height:1.5;font-size:14px}';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function page(title, message, success) {
  const accent = success ? '#55e6b1' : '#ff6b82';
  const symbol = success
    ? '<path d="M22 37l10 10 20-23" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M25 25l22 22m0-22L25 47" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/>';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Takeda</title>' +
    '<style>' + PAGE_STYLE + '</style></head><body><main class="card">' +
    '<svg class="mark" viewBox="0 0 72 72" role="img" aria-label="Takeda">' +
    '<rect width="72" height="72" rx="22" fill="' + accent + '"/>' +
    '<path d="M19 17h34L42 31l11 6-22 18 4-16-16-7z" fill="#0b0e16" opacity=".32"/>' +
    symbol + '</svg><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(message) +
    '</p></main></body></html>';
}

const SUCCESS_PAGE = page('Login concluído', 'Você já pode fechar esta janela e voltar ao Takeda.', true);
const ERROR_PAGE = (message) => page('Não foi possível entrar', message, false);
let activeAttempt = null;

function sendPage(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    'X-Content-Type-Options': 'nosniff',
    'Connection': 'close'
  });
  res.end(html);
}

function finishAttempt(attempt, error, value) {
  if (!attempt || attempt.settled) return;
  attempt.settled = true;
  clearTimeout(attempt.timer);
  if (activeAttempt === attempt) activeAttempt = null;
  try { attempt.server.close(); } catch { /* already closed */ }
  if (error) attempt.reject(error instanceof Error ? error : new Error(String(error)));
  else attempt.resolve(value);
}

function cancelDiscordRedirect(reason = 'cancelled') {
  if (activeAttempt) finishAttempt(activeAttempt, new Error(reason));
}

function waitForDiscordRedirect(expectedState) {
  if (typeof expectedState !== 'string' || !/^[a-f0-9]{32}$/.test(expectedState)) {
    return Promise.reject(new TypeError('Estado OAuth inválido'));
  }
  cancelDiscordRedirect('superseded');

  return new Promise((resolve, reject) => {
    const attempt = { server: null, timer: null, resolve, reject, settled: false };
    const server = http.createServer((req, res) => {
      let requestUrl;
      try {
        requestUrl = new URL(req.url, 'http://127.0.0.1:' + OAUTH_LOOPBACK_PORT);
      } catch {
        sendPage(res, 400, ERROR_PAGE('Requisição inválida.'));
        return;
      }

      if (req.method !== 'GET' || requestUrl.pathname !== '/callback') {
        res.writeHead(404, { 'Cache-Control': 'no-store', 'Connection': 'close' });
        res.end();
        return;
      }

      const state = requestUrl.searchParams.get('state');
      if (state !== expectedState) {
        sendPage(res, 400, ERROR_PAGE('Resposta de login inválida. Tente novamente no aplicativo.'));
        return;
      }

      const oauthError = requestUrl.searchParams.get('error');
      const code = requestUrl.searchParams.get('code');
      if (oauthError) {
        sendPage(res, 400, ERROR_PAGE('O Discord recusou a autorização.'));
        finishAttempt(attempt, new Error('O Discord recusou a autorização.'));
        return;
      }
      if (!code || code.length > 4096) {
        sendPage(res, 400, ERROR_PAGE('O código de autorização recebido é inválido.'));
        return;
      }

      sendPage(res, 200, SUCCESS_PAGE);
      finishAttempt(attempt, null, code);
    });

    attempt.server = server;
    attempt.timer = setTimeout(() => finishAttempt(attempt, new Error('timeout')), 5 * 60 * 1000);
    attempt.timer.unref?.();
    activeAttempt = attempt;
    server.once('error', (error) => finishAttempt(attempt, error));
    server.listen(OAUTH_LOOPBACK_PORT, '127.0.0.1');
  });
}

function newState() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { waitForDiscordRedirect, cancelDiscordRedirect, newState };
