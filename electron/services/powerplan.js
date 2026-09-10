const { execFile } = require('child_process');
const path = require('path');

function runPS(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 30000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stderr: String(stderr || '').trim() }));
          return;
        }
        resolve(String(stdout || '').trim());
      }
    );
  });
}

function parseResult(output) {
  const [status = 'ERRO', message = '', guid = ''] = String(output || '').split('|', 3);
  if (!['OK', 'AVISO', 'ERRO'].includes(status)) {
    return { status: 'ERRO', message: 'Resposta inesperada do Windows ao aplicar o plano.', guid: '' };
  }
  return { status, message, guid };
}

async function apply(powFile) {
  if (typeof powFile !== 'string' || powFile.length > 4096 || !path.isAbsolute(powFile) || path.extname(powFile).toLowerCase() !== '.pow') {
    return { status: 'ERRO', message: 'Arquivo de plano de energia inválido.', guid: '' };
  }

  const safePath = powFile.replace(/'/g, "''");
  const script = `
    $ErrorActionPreference = 'Stop'
    try {
      $powFile = '${safePath}'
      if (-not (Test-Path -LiteralPath $powFile -PathType Leaf)) {
        throw 'Arquivo .pow não encontrado.'
      }

      $importOut = (& powercfg.exe /import $powFile 2>&1 | Out-String)
      if ($LASTEXITCODE -ne 0) { throw "Falha ao importar o plano: $($importOut.Trim())" }

      $guid = [regex]::Match($importOut, '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})').Value
      if ([string]::IsNullOrWhiteSpace($guid)) { throw 'O Windows não retornou o identificador do plano importado.' }

      & powercfg.exe /changename $guid 'Takeda' 'Plano de energia otimizado Takeda' 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'O plano foi importado, mas não pôde ser renomeado.' }

      $setOut = (& powercfg.exe /setactive $guid 2>&1 | Out-String)
      if ($LASTEXITCODE -ne 0) {
        Write-Output "AVISO|O plano foi importado, mas não pôde ser ativado.|$guid"
        return
      }

      $activeRaw = (& powercfg.exe /getactivescheme 2>&1 | Out-String)
      if ($LASTEXITCODE -ne 0) { throw 'Não foi possível confirmar o plano de energia ativo.' }
      $activeGuid = [regex]::Match($activeRaw, '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})').Value
      if ($activeGuid -ne $guid) { throw 'O Windows não confirmou a ativação do plano Takeda.' }

      $activeName = [regex]::Match($activeRaw, '\\(([^)]+)\\)').Groups[1].Value
      if ([string]::IsNullOrWhiteSpace($activeName)) { $activeName = 'Takeda' }
      Write-Output "OK|$activeName|$guid"
    } catch {
      $message = $_.Exception.Message -replace '\\|', '/'
      Write-Output "ERRO|$message|"
    }
  `;

  try {
    return parseResult(await runPS(script));
  } catch (error) {
    return {
      status: 'ERRO',
      message: error.stderr || error.message || 'Falha ao executar o PowerShell.',
      guid: '',
    };
  }
}

async function getCurrent() {
  const script = `
    $ErrorActionPreference = 'Stop'
    $activeRaw = (& powercfg.exe /getactivescheme 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível consultar o plano de energia ativo.' }
    $activeName = [regex]::Match($activeRaw, '\\(([^)]+)\\)').Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($activeName)) { $activeName = 'Desconhecido' }
    Write-Output $activeName
  `;
  return runPS(script);
}

module.exports = { apply, getCurrent };
