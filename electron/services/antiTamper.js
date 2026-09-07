const { execFile } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────
// Proteção básica contra engenharia reversa / adulteração.
//
// IMPORTANTE — leia antes de ativar a varredura de processos:
// O público do Takeda App é bem técnico (usa CapFrameX, HWiNFO, Process
// Hacker, OCCT, Wireshark etc. para tunar o próprio PC — veja src/pages/
// Apps.js). Várias dessas ferramentas TAMBÉM aparecem em listas genéricas
// de "ferramentas de engenharia reversa". Se a varredura for agressiva
// demais, ela vai fechar o app na cara de clientes legítimos.
//
// Por isso este módulo separa dois mecanismos:
//   1) DEVTOOLS_GUARD (ativado por padrão): fecha o app se o DevTools do
//      Electron/Chromium for aberto na janela principal. É a forma mais
//      comum e prática de inspecionar um app Electron (ver o JS do
//      renderer, interceptar as chamadas à sua API de licença), tem
//      praticamente zero falso-positivo (usuário comum nunca abre DevTools
//      sem querer) e por isso é a proteção mais custo-benefício.
//   2) PROCESS_SCAN (desativado por padrão): varre processos rodando atrás
//      de debuggers/desmontadores/editores de memória "puros" — ferramentas
//      que não têm uso legítimo para quem só está otimizando o próprio PC.
//      Ative com cuidado e teste bastante antes de distribuir.
// ─────────────────────────────────────────────────────────────────────────

const CONFIG = {
  devtoolsGuard: true,
  processScan: false,
  processScanIntervalMs: 8000,
};

// Lista "alta confiança": praticamente só usada para debugar/crackear
// binários ou apps .NET/Electron. Nomes de processo sem ".exe".
const HIGH_CONFIDENCE_PROCESSES = [
  'x32dbg', 'x64dbg', 'ollydbg', 'ida', 'ida64', 'idaq', 'idaq64', 'idafree',
  'dnspy', 'dnspyex', 'ilspy', 'de4dot', 'megadumper', 'scylla', 'scylla_x64',
  'cheatengine-x86_64', 'cheatengine-x86_64-sse4-avx2', 'cheatengine-i386',
];

// Lista "estendida": ferramentas de propósito geral que também aparecem em
// tutoriais de engenharia reversa, mas que gamers/power users usam para
// coisas totalmente legítimas (monitorar rede, processos, drivers...).
// Fica de fora por padrão — só inclua se você tiver certeza do seu público.
const EXTENDED_PROCESSES = [
  // 'processhacker', 'procexp', 'procexp64', 'procmon', 'procmon64',
  // 'wireshark', 'fiddler', 'httpdebuggerui', 'apimonitor-x64', 'frida',
];

function activeProcessList() {
  return CONFIG.processScan ? [...HIGH_CONFIDENCE_PROCESSES, ...EXTENDED_PROCESSES] : [];
}

function listRunningProcessNames() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FO', 'CSV', '/NH'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const names = stdout
        .split('\n')
        .map((line) => {
          const match = line.match(/^"([^"]+)"/);
          return match ? match[1].replace(/\.exe$/i, '').toLowerCase() : null;
        })
        .filter(Boolean);
      resolve(names);
    });
  });
}

async function detectSuspiciousProcess() {
  const watchList = activeProcessList();
  if (watchList.length === 0) return null;

  const running = await listRunningProcessNames();
  const runningSet = new Set(running);
  return watchList.find((name) => runningSet.has(name)) || null;
}

// Instala os dois mecanismos. `onTamperDetected(reason)` é chamado uma vez,
// quando algo suspeito é detectado; quem chamou decide o que fazer (o main.js
// usa isso para dar app.exit(0) imediatamente).
function watch(mainWindow, onTamperDetected) {
  let triggered = false;
  const trigger = (reason) => {
    if (triggered) return;
    triggered = true;
    onTamperDetected(reason);
  };

  if (CONFIG.devtoolsGuard && mainWindow && mainWindow.webContents) {
    mainWindow.webContents.on('devtools-opened', () => trigger('devtools-opened'));

    // Bloqueia os atalhos mais comuns de abrir o DevTools como camada extra
    // (não é 100% à prova de falhas, mas reduz o caminho mais fácil).
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const key = (input.key || '').toLowerCase();
      const blockF12 = key === 'f12';
      const blockCtrlShiftI = input.control && input.shift && (key === 'i' || key === 'j' || key === 'c');
      if (blockF12 || blockCtrlShiftI) {
        event.preventDefault();
        trigger('devtools-shortcut');
      }
    });
  }

  let intervalId = null;
  if (CONFIG.processScan) {
    intervalId = setInterval(async () => {
      const found = await detectSuspiciousProcess();
      if (found) trigger(`process:${found}`);
    }, CONFIG.processScanIntervalMs);
  }

  return {
    stop() {
      if (intervalId) clearInterval(intervalId);
    },
  };
}

module.exports = { watch, CONFIG };
