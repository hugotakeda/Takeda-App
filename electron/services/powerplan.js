const { execFile } = require('child_process');

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

async function apply(powFile) {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    if (-not (Test-Path -LiteralPath '${powFile}')) {
      Write-Output "ERRO|Arquivo .pow nao encontrado"
      exit
    }
    
    $importOut = powercfg /import '${powFile}' 2>&1 | Out-String
    $guid = [regex]::Match($importOut, '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})').Value
    
    if ([string]::IsNullOrWhiteSpace($guid)) {
      Write-Output "ERRO|Falha ao importar: $($importOut.Trim())"
      exit
    }
    
    powercfg /changename $guid "Takeda" "Plano de energia otimizado Takeda" 2>&1 | Out-Null
    
    $setOut = powercfg /setactive $guid 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
      Write-Output "AVISO|Importado mas nao ativado|$guid"
      exit
    }
    
    $activeRaw = powercfg /getactivescheme 2>&1 | Out-String
    $activeName = [regex]::Match($activeRaw, '\\(([^)]+)\\)').Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($activeName)) { $activeName = "Desconhecido" }
    
    Write-Output "OK|$activeName|$guid"
  `;
  const out = await runPS(script);
  const parts = out.split('|');
  return {
    status: parts[0],
    message: parts[1] || '',
    guid: parts[2] || ''
  };
}

async function getCurrent() {
  const script = `
    $activeRaw = powercfg /getactivescheme 2>&1 | Out-String
    $activeName = [regex]::Match($activeRaw, '\\(([^)]+)\\)').Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($activeName)) { $activeName = "Desconhecido" }
    Write-Output $activeName
  `;
  return await runPS(script);
}

module.exports = { apply, getCurrent };
