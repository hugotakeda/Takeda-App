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
  let score = 100;
  let warnings = 0;
  let criticals = 0;

  // CPU (weight: 20)
  if (d.cpu >= 85) { score -= 20; criticals++; }
  else if (d.cpu >= 60) { score -= 10; warnings++; }

  // RAM (weight: 20)
  if (d.ramPct >= 90) { score -= 20; criticals++; }
  else if (d.ramPct >= 75) { score -= 10; warnings++; }

  // GPU driver age (weight: 10)
  if (d.gpuDays > 365) { score -= 10; criticals++; }
  else if (d.gpuDays > 180) { score -= 5; warnings++; }

  // Heavy apps (weight: 10)
  if (d.heavy >= 60) { score -= 10; criticals++; }
  else if (d.heavy >= 40) { score -= 5; warnings++; }

  // Defender (weight: 15)
  if (d.defender === 'Desligado') { score -= 15; criticals++; }
  else if (d.defender === 'N/D') { score -= 5; warnings++; }

  // Ping (weight: 15)
  if (d.ping === -1) { score -= 15; criticals++; }
  else if (d.ping >= 80) { score -= 15; criticals++; }
  else if (d.ping >= 30) { score -= 7; warnings++; }

  // Network (weight: 10)
  if (d.adapterName === 'Sem conexao') { score -= 10; criticals++; }

  score = Math.max(0, Math.min(100, score));

  return { value: score, warnings, criticals, ok: 8 - warnings - criticals };
}

module.exports = { run };
