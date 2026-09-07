const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function runPS(script, timeout = 20000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, maxBuffer: 1024 * 1024 * 8 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve((stdout || '').trim());
      }
    );
  });
}

function runPSElevated(script, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `takeda-priv-${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, script, 'utf-8');
    const wrapper = `
      $ErrorActionPreference = 'SilentlyContinue'
      Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @(
        '-NoProfile','-ExecutionPolicy','Bypass','-File','${tmpFile.replace(/'/g, "''")}'
      )
      Write-Output "DONE"
    `;
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', wrapper], { timeout }, (err, stdout) => {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      if (err) reject(err);
      else resolve((stdout || '').trim());
    });
  });
}

// Todas as chaves abaixo são bem documentadas publicamente (Configurações >
// Privacidade do próprio Windows usa a maioria delas) e reversíveis a
// qualquer momento. Nenhuma toca em senhas, documentos, favoritos ou
// histórico de navegação.
const TOGGLES = [
  {
    id: 'telemetry',
    name: 'Telemetria do Windows',
    desc: 'Reduz a telemetria enviada à Microsoft ao mínimo permitido pela edição do Windows. Pode exigir reiniciar o PC.',
    requiresAdmin: true,
    targets: [{ key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection', value: 'AllowTelemetry', type: 'DWord' }],
    enableData: 0,
    disableData: null, // null = remove o valor (volta ao padrão gerenciado pela edição)
  },
  {
    id: 'adId',
    name: 'ID de publicidade',
    desc: 'Impede que apps usem seu ID de publicidade para anúncios personalizados.',
    requiresAdmin: false,
    targets: [{ key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', value: 'Enabled', type: 'DWord' }],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'tailoredExperiences',
    name: 'Experiências personalizadas com diagnóstico',
    desc: 'Impede que a Microsoft use seus dados de diagnóstico para sugerir conteúdo personalizado.',
    requiresAdmin: false,
    targets: [{ key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Privacy', value: 'TailoredExperiencesWithDiagnosticDataEnabled', type: 'DWord' }],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'startSuggestions',
    name: 'Sugestões e anúncios no Menu Iniciar',
    desc: 'Remove apps sugeridos e conteúdo patrocinado no Menu Iniciar.',
    requiresAdmin: false,
    targets: [{ key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', value: 'SubscribedContent-338388Enabled', type: 'DWord' }],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'lockscreenTips',
    name: 'Dicas na tela de bloqueio',
    desc: 'Remove dicas e sugestões exibidas na tela de bloqueio.',
    requiresAdmin: false,
    targets: [{ key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', value: 'SubscribedContent-338389Enabled', type: 'DWord' }],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'tipsAndTricks',
    name: '"Sugestões do Windows" nas Configurações',
    desc: 'Desativa dicas promocionais dentro do app Configurações.',
    requiresAdmin: false,
    targets: [{ key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', value: 'SoftLandingEnabled', type: 'DWord' }],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'activityHistory',
    name: 'Histórico de Atividades',
    desc: 'Impede que o Windows grave e envie seu histórico de atividades (Timeline).',
    requiresAdmin: false,
    targets: [
      { key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer', value: 'EnableActivityFeed', type: 'DWord' },
      { key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer', value: 'PublishUserActivities', type: 'DWord' },
      { key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer', value: 'UploadUserActivities', type: 'DWord' },
    ],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'bingSearch',
    name: 'Busca na web pelo Menu Iniciar',
    desc: 'Impede que buscas no Menu Iniciar/Cortana incluam resultados da web (Bing).',
    requiresAdmin: false,
    targets: [
      { key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search', value: 'BingSearchEnabled', type: 'DWord' },
      { key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search', value: 'CortanaConsent', type: 'DWord' },
    ],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'feedbackFrequency',
    name: 'Pedidos de feedback do Windows',
    desc: 'Configura a frequência de solicitações de feedback para "Nunca".',
    requiresAdmin: false,
    targets: [{ key: 'HKCU:\\SOFTWARE\\Microsoft\\Siuf\\Rules', value: 'NumberOfSIUFInPeriod', type: 'DWord' }],
    enableData: 0,
    disableData: null,
  },
  {
    id: 'startTracking',
    name: 'Rastreamento de apps abertos',
    desc: 'Impede que o Windows rastreie os apps que você abre para gerar sugestões no Menu Iniciar/Busca.',
    requiresAdmin: false,
    targets: [{ key: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search', value: 'Start_TrackProgs', type: 'DWord' }],
    enableData: 0,
    disableData: 1,
  },
  {
    id: 'location',
    name: 'Localização (todo o sistema)',
    desc: 'Bloqueia o acesso de qualquer app à sua localização geográfica, em todo o Windows.',
    requiresAdmin: true,
    targets: [{ key: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location', value: 'Value', type: 'String' }],
    enableData: 'Deny',
    disableData: 'Allow',
  },
];

function findToggle(id) {
  return TOGGLES.find((t) => t.id === id) || null;
}

async function getStatus() {
  const checks = TOGGLES.map((t) => {
    const target = t.targets[0];
    const safeKey = target.key.replace(/'/g, "''");
    const safeVal = target.value.replace(/'/g, "''");
    return `
      $r = $null
      try { $r = (Get-ItemProperty -Path '${safeKey}' -Name '${safeVal}' -ErrorAction SilentlyContinue).'${safeVal}' } catch {}
      $out['${t.id}'] = $r
    `;
  }).join('\n');

  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $out = @{}
    ${checks}
    $out | ConvertTo-Json -Compress
  `;

  let raw = {};
  try {
    const out = await runPS(script);
    raw = out ? JSON.parse(out) : {};
  } catch (e) {
    raw = {};
  }

  const status = {};
  for (const t of TOGGLES) {
    const current = raw[t.id];
    const isProtected = current !== null && current !== undefined && String(current) === String(t.enableData);
    status[t.id] = { enabled: isProtected, requiresAdmin: t.requiresAdmin };
  }
  return status;
}

function buildWriteScript(toggle, protect) {
  const data = protect ? toggle.enableData : toggle.disableData;
  return toggle.targets.map((target) => {
    const safeKey = target.key.replace(/'/g, "''");
    const safeVal = target.value.replace(/'/g, "''");
    if (data === null) {
      return `Remove-ItemProperty -Path '${safeKey}' -Name '${safeVal}' -Force -ErrorAction SilentlyContinue`;
    }
    const propType = target.type === 'String' ? 'String' : 'DWord';
    const dataLiteral = target.type === 'String' ? `'${String(data).replace(/'/g, "''")}'` : Number(data);
    return `
      if (-not (Test-Path '${safeKey}')) { New-Item -Path '${safeKey}' -Force | Out-Null }
      New-ItemProperty -Path '${safeKey}' -Name '${safeVal}' -PropertyType ${propType} -Value ${dataLiteral} -Force | Out-Null
    `;
  }).join('\n');
}

async function setToggle(id, protect) {
  const toggle = findToggle(id);
  if (!toggle) throw new Error('Toggle desconhecido: ' + id);

  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    ${buildWriteScript(toggle, protect)}
    Write-Output "OK"
  `;

  const runner = toggle.requiresAdmin ? runPSElevated : runPS;
  await runner(script);
  return { ok: true };
}

function list() {
  return TOGGLES.map(({ id, name, desc, requiresAdmin }) => ({ id, name, desc, requiresAdmin }));
}

module.exports = { list, getStatus, setToggle };
