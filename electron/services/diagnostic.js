const { execFile } = require('child_process');
const path = require('path');

function runPS(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script
    ], { timeout: 30000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

const os = require('os');
const monitor = require('./monitor');

async function run() {
  const cpus = os.cpus();
  const cpuModel = cpus[0].model;
  const cpuCores = cpus.length;
  
  // Calculate CPU load over 100ms
  const startMeasure = getCpuLoad(cpus);
  await new Promise(r => setTimeout(r, 100));
  const endMeasure = getCpuLoad(os.cpus());
  const idleDiff = endMeasure.idle - startMeasure.idle;
  const totalDiff = endMeasure.total - startMeasure.total;
  const cpuPct = Math.round(100 - (100 * idleDiff / totalDiff));
  
  const ramTotalGB = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10;
  const ramFreeGB = Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10;
  const ramUsedGB = Math.round((ramTotalGB - ramFreeGB) * 10) / 10;
  const ramPct = Math.round((ramUsedGB / ramTotalGB) * 100);

  // Fast PowerShell for the rest (WMI only, no Ping, fast Defender check)
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'

    # Power Plan
    $planRaw = powercfg /getactivescheme
    $plan = [regex]::Match($planRaw, '\\(([^)]+)\\)').Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($plan)) { $plan = "Desconhecido" }

    # GPU
    $gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 0 } | Select-Object -First 1
    if (-not $gpu) { $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1 }
    $gpuName = "N/D"
    $gpuVer = "N/D"
    $gpuDays = -1
    if ($gpu) {
      $gpuName = $gpu.Name
      if ($gpu.DriverVersion) { $gpuVer = $gpu.DriverVersion }
      if ($gpu.DriverDate) { $gpuDays = (New-TimeSpan -Start $gpu.DriverDate -End (Get-Date)).Days }
    }

    # RAM Type
    $ramType = "DDR"
    try {
      $smType = (Get-CimInstance Win32_PhysicalMemory | Select-Object -First 1).SMBIOSMemoryType
      if ($smType -eq 34) { $ramType = "DDR5" }
      elseif ($smType -eq 26) { $ramType = "DDR4" }
      elseif ($smType -eq 24) { $ramType = "DDR3" }
    } catch {}

    # Heavy processes (Quick)
    $heavy = (Get-Process | Where-Object { $_.WorkingSet64 -gt 100MB }).Count

    # Defender (Fast Service Check)
    $defender = "Desligado"
    $svc = Get-Service WinDefend -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq 'Running') { $defender = "Ativo" }

    # Network Adapter
    $adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.PhysicalMediaType -notmatch '802\\.11' } | Select-Object -First 1
    if (-not $adapter) { $adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1 }
    $adapterName = "Sem conexao"
    $adapterType = "N/D"
    $adapterSpeed = 0
    if ($adapter) {
      $adapterName = $adapter.Name
      $adapterType = "Ethernet"
      if ($adapter.PhysicalMediaType -match '802\\.11' -or $adapter.Name -match 'Wi-?Fi|Wireless|WLAN') { $adapterType = "Wi-Fi" }
      $adapterSpeed = $adapter.LinkSpeed
      # Extract number from "1 Gbps"
      if ($adapterSpeed -match '^\\d+') { $adapterSpeed = [long]$matches[0] * 1000000000 }
    }

    # OS Info
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $osBuild = $osInfo.BuildNumber

    @{
      plan = $plan
      gpuName = $gpuName
      gpuVer = $gpuVer
      gpuDays = $gpuDays
      ramType = $ramType
      heavy = $heavy
      defender = $defender
      adapterName = $adapterName
      adapterType = $adapterType
      adapterSpeed = $adapterSpeed
      osBuild = $osBuild
    } | ConvertTo-Json -Compress
  `;

  let psData = {};
  try {
    const output = await runPS(script);
    psData = JSON.parse(output);
  } catch(e) {
    console.error("PS Diag error:", e);
  }

  // Use monitor for ping
  const net = monitor.getCurrentPing() || { ping: -1, packetLoss: 100 };

  const data = {
    cpu: cpuPct,
    cpuModel,
    cpuCores,
    ramUsedGB,
    ramFreeGB,
    ramTotalGB,
    ramPct,
    ramSpeed: 0,
    ramType: psData.ramType || "DDR",
    plan: psData.plan || "Desconhecido",
    gpuName: psData.gpuName || "N/D",
    gpuVer: psData.gpuVer || "N/D",
    gpuDays: psData.gpuDays || -1,
    gpuUsage: 0,
    heavy: psData.heavy || 0,
    defender: psData.defender || "N/D",
    ping: net.ping,
    packetLoss: net.packetLoss,
    adapterName: psData.adapterName || "Sem conexao",
    adapterType: psData.adapterType || "N/D",
    adapterSpeed: psData.adapterSpeed || 0,
    osCaption: "Windows 11", // generic fallback if needed
    osBuild: psData.osBuild || "",
    osVersion: ""
  };

  data.score = calculateScore(data);
  data.timestamp = Date.now();
  return data;
}

function getCpuLoad(cpus) {
  let total = 0;
  let idle = 0;
  for (let cpu of cpus) {
    for (let type in cpu.times) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  return { total, idle };
}

function calculateScore(d) {
  let totalScore = 0;
  let warnings = 0;
  let criticals = 0;

  // ── CPU (weight: 25) ──
  // Curve: lenient at low usage, steep at high usage
  // 21% → 24.5 | 50% → 20.6 | 70% → 14.7 | 90% → 5.8
  const cpuScore = 25 * (1 - Math.pow(d.cpu / 100, 2.5));
  if (d.cpu >= 85) criticals++;
  else if (d.cpu >= 60) warnings++;
  totalScore += cpuScore;

  // ── RAM (weight: 20) ──
  // Curve: very lenient up to ~60%, then drops faster
  // 45% → 18.2 | 70% → 13.1 | 85% → 7.7 | 95% → 2.9
  const ramScore = 20 * (1 - Math.pow(d.ramPct / 100, 3));
  if (d.ramPct >= 90) criticals++;
  else if (d.ramPct >= 75) warnings++;
  totalScore += ramScore;

  // ── Ping (weight: 20) ──
  // Piecewise: ≤10ms = perfect, smooth drop after
  let pingScore = 0;
  if (d.ping === -1) {
    pingScore = 0;
    criticals++;
  } else if (d.ping <= 10) {
    pingScore = 20;
  } else if (d.ping <= 50) {
    // 10ms → 20 | 50ms → 15
    pingScore = 20 - ((d.ping - 10) / 40) * 5;
  } else if (d.ping <= 100) {
    // 50ms → 15 | 100ms → 5
    pingScore = 15 - ((d.ping - 50) / 50) * 10;
    if (d.ping < 80) warnings++;
    else criticals++;
  } else {
    // 100ms+ → 5 → 0
    pingScore = Math.max(0, 5 - ((d.ping - 100) / 100) * 5);
    criticals++;
  }
  if (d.ping >= 30 && d.ping < 50) warnings++;
  totalScore += pingScore;

  // ── GPU Driver Age (weight: 10) ──
  // Fresh drivers = full score, degrades over time
  let gpuScore = 10;
  if (d.gpuDays === -1) {
    gpuScore = 5;
    warnings++;
  } else if (d.gpuDays <= 90) {
    gpuScore = 10;
  } else if (d.gpuDays <= 365) {
    // 90d → 10 | 365d → 3
    gpuScore = 10 - ((d.gpuDays - 90) / 275) * 7;
    if (d.gpuDays > 180) warnings++;
  } else {
    // 365d+ → 3 → 0
    gpuScore = Math.max(0, 3 - ((d.gpuDays - 365) / 365) * 3);
    criticals++;
  }
  totalScore += gpuScore;

  // ── Heavy Background Apps (weight: 10) ──
  // Scales smoothly based on count
  let appsScore = 10;
  if (d.heavy <= 15) {
    appsScore = 10;
  } else if (d.heavy <= 50) {
    // 15 → 10 | 50 → 5
    appsScore = 10 - ((d.heavy - 15) / 35) * 5;
  } else {
    // 50+ → 5 → 0
    appsScore = Math.max(0, 5 - ((d.heavy - 50) / 50) * 5);
  }
  if (d.heavy >= 60) criticals++;
  else if (d.heavy >= 40) warnings++;
  totalScore += appsScore;

  // ── Power Plan (weight: 5) ──
  // Performance/custom plans = full, balanced = partial, economy = low
  let planScore = 5;
  const planLower = d.plan.toLowerCase();
  if (planLower.includes('saving') || planLower.includes('economy') || planLower.includes('economia')) {
    planScore = 1;
    warnings++;
  } else if (planLower.includes('balanced') || planLower.includes('equilibrado')) {
    planScore = 3;
  }
  // Custom/performance/takeda → full 5
  totalScore += planScore;

  // ── Defender (weight: 5) ──
  // Reduced weight — disabling Defender is a conscious user choice
  let defScore = 5;
  if (d.defender === 'Desligado') {
    defScore = 2;
  } else if (d.defender === 'N/D') {
    defScore = 3;
    warnings++;
  }
  totalScore += defScore;

  // ── Network (weight: 5) ──
  let netScore = 5;
  if (d.adapterName === 'Sem conexao') {
    netScore = 0;
    criticals++;
  }
  totalScore += netScore;

  const finalScore = Math.round(Math.max(0, Math.min(100, totalScore)));

  console.log('[Score Breakdown]', JSON.stringify({
    cpu: `${d.cpu}% → ${cpuScore.toFixed(1)}/25`,
    ram: `${d.ramPct}% → ${ramScore.toFixed(1)}/20`,
    ping: `${d.ping}ms → ${pingScore.toFixed(1)}/20`,
    gpu: `${d.gpuDays}d → ${gpuScore.toFixed ? gpuScore.toFixed(1) : gpuScore}/10`,
    apps: `${d.heavy} → ${appsScore.toFixed ? appsScore.toFixed(1) : appsScore}/10`,
    plan: `${d.plan} → ${planScore}/5`,
    defender: `${d.defender} → ${defScore}/5`,
    net: `${d.adapterName} → ${netScore}/5`,
    total: finalScore
  }, null, 0));

  return { value: finalScore, warnings, criticals, ok: 8 - warnings - criticals };
}

module.exports = { run };
