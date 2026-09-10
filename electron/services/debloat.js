const { execFile } = require('child_process');
const { runElevated } = require('./elevated');

function runPS(script, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, windowsHide: true, maxBuffer: 1024 * 1024 * 8 },
      (err, stdout, stderr) => {
        if (err) reject(Object.assign(err, { stderr: String(stderr || '').trim() }));
        else resolve((stdout || '').trim());
      }
    );
  });
}

// Lista curada e conservadora. Propositalmente NÃO inclui: Store, Segurança
// do Windows, Calculadora, Fotos, Câmera, Game Bar/Xbox Game Bar (o público
// do app é gamer) e qualquer componente de shell/sistema. São só apps UWP
// opcionais que vêm pré-instalados e a maioria dos usuários nunca abre.
const BLOAT_APPS = [
  { id: 'xboxApp', pattern: 'Microsoft.XboxApp', name: 'Xbox (app)', desc: 'App companion do Xbox. Não afeta o Xbox Game Bar nem jogos via Steam/Epic.' },
  { id: 'xboxIdentity', pattern: 'Microsoft.XboxIdentityProvider', name: 'Xbox Identity Provider', desc: 'Serviço de login do Xbox usado pelo app Xbox.' },
  { id: 'xboxSpeech', pattern: 'Microsoft.XboxSpeechToTextOverlay', name: 'Xbox Speech Overlay', desc: 'Overlay de legendas por voz do Xbox.' },
  { id: 'yourPhone', pattern: 'Microsoft.YourPhone', name: 'Vínculo ao Celular', desc: 'Espelhamento de smartphone Android/iOS.' },
  { id: 'solitaire', pattern: 'Microsoft.MicrosoftSolitaireCollection', name: 'Solitaire Collection', desc: 'Coleção de jogos de cartas da Microsoft.' },
  { id: 'bingWeather', pattern: 'Microsoft.BingWeather', name: 'Clima (MSN Weather)', desc: 'App de previsão do tempo.' },
  { id: 'bingNews', pattern: 'Microsoft.BingNews', name: 'Notícias (MSN News)', desc: 'App de notícias.' },
  { id: 'getStarted', pattern: 'Microsoft.Getstarted', name: 'Dicas / Introdução', desc: 'App de boas-vindas e dicas do Windows.' },
  { id: 'feedbackHub', pattern: 'Microsoft.WindowsFeedbackHub', name: 'Central de Feedback', desc: 'App para enviar feedback sobre o Windows para a Microsoft.' },
  { id: 'getHelp', pattern: 'Microsoft.GetHelp', name: 'Obter Ajuda', desc: 'App de suporte da Microsoft.' },
  { id: 'mixedReality', pattern: 'Microsoft.MixedReality.Portal', name: 'Portal de Realidade Misturada', desc: 'Só necessário para headsets Windows Mixed Reality.' },
  { id: '3dViewer', pattern: 'Microsoft.Microsoft3DViewer', name: 'Visualizador 3D', desc: 'App para abrir modelos 3D.' },
  { id: 'skype', pattern: 'Microsoft.SkypeApp', name: 'Skype', desc: 'Cliente do Skype pré-instalado (diferente do Skype baixado manualmente).' },
  { id: 'officeHub', pattern: 'Microsoft.MicrosoftOfficeHub', name: '"Meu Office" (teaser)', desc: 'Atalho promocional do Office 365, não é o Office instalado de verdade.' },
  { id: 'people', pattern: 'Microsoft.People', name: 'Pessoas', desc: 'App de contatos integrado.' },
  { id: 'maps', pattern: 'Microsoft.WindowsMaps', name: 'Mapas', desc: 'App de mapas offline da Microsoft.' },
  { id: 'zuneMusic', pattern: 'Microsoft.ZuneMusic', name: 'Música (Groove)', desc: 'Player de música padrão do Windows.' },
  { id: 'zuneVideo', pattern: 'Microsoft.ZuneVideo', name: 'Filmes e TV', desc: 'Player de vídeo padrão do Windows.' },
  { id: 'todos', pattern: 'Microsoft.Todos', name: 'Microsoft To Do', desc: 'App de listas de tarefas.' },
  { id: 'powerAutomate', pattern: 'Microsoft.PowerAutomateDesktop', name: 'Power Automate Desktop', desc: 'Automação de tarefas — raramente usado por usuário comum.' },
  { id: 'clipchamp', pattern: 'Clipchamp.Clipchamp', name: 'Clipchamp', desc: 'Editor de vídeo online pré-instalado.' },
  { id: 'consumerTeams', pattern: 'MicrosoftTeams', name: 'Teams (pessoal)', desc: 'Versão consumidor do Teams (não afeta o Teams corporativo instalado separadamente).' },
  { id: 'cortana', pattern: 'Microsoft.549981C3F5F10', name: 'Cortana (app)', desc: 'App da assistente Cortana, hoje praticamente descontinuado.' },
];

async function listStatus() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $names = @(${BLOAT_APPS.map((a) => `'${a.pattern}'`).join(',')})
    $result = @{}
    foreach ($n in $names) {
      $pkg = Get-AppxPackage -Name $n -ErrorAction SilentlyContinue | Select-Object -First 1
      $result[$n] = [bool]$pkg
    }
    $result | ConvertTo-Json -Compress
  `;
  const out = await runPS(script);
  const raw = out ? JSON.parse(out) : {};
  return BLOAT_APPS.map((a) => ({ ...a, installed: !!raw[a.pattern] }));
}

async function remove(ids) {
  const targets = BLOAT_APPS.filter((a) => ids.includes(a.id));
  if (targets.length === 0) return { ok: false, removed: [] };

  const commands = targets
    .map((a) => `
      $packages = @(Get-AppxPackage -AllUsers -Name '${a.pattern}' -ErrorAction SilentlyContinue)
      foreach ($package in $packages) {
        Remove-AppxPackage -Package $package.PackageFullName -AllUsers -ErrorAction Stop
      }
      $provisioned = @(Get-AppxProvisionedPackage -Online -ErrorAction Stop | Where-Object { $_.DisplayName -eq '${a.pattern}' })
      foreach ($package in $provisioned) {
        Remove-AppxProvisionedPackage -Online -PackageName $package.PackageName -ErrorAction Stop | Out-Null
      }
      $remaining = @(Get-AppxPackage -AllUsers -Name '${a.pattern}' -ErrorAction SilentlyContinue)
      $remainingProvisioned = @(Get-AppxProvisionedPackage -Online -ErrorAction Stop | Where-Object { $_.DisplayName -eq '${a.pattern}' })
      if ($remaining.Count -gt 0 -or $remainingProvisioned.Count -gt 0) {
        throw 'O aplicativo ${a.name.replace(/'/g, "''")} ainda está instalado.'
      }
    `)
    .join('\n');

  const script = `
    $ErrorActionPreference = 'Stop'
    ${commands}
  `;

  try {
    await runElevated(script, 5 * 60 * 1000);
    return { ok: true, removed: targets.map((t) => t.id) };
  } catch (e) {
    return { ok: false, removed: [], error: e.message };
  }
}

module.exports = { listStatus, remove, BLOAT_APPS };
