const { execFile } = require('child_process');

function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function runElevated(script, timeout = 5 * 60 * 1000) {
  if (typeof script !== 'string' || script.length === 0 || script.length > 1024 * 1024) {
    return Promise.reject(new TypeError('Script elevado inválido'));
  }

  const childScript =
    "$ErrorActionPreference = 'Stop'\n" +
    "try {\n" + script + "\nexit 0\n" +
    "} catch {\n[Console]::Error.WriteLine($_.Exception.Message)\nexit 1\n}";
  const childEncoded = encodePowerShell(childScript);
  const wrapper =
    "$ErrorActionPreference = 'Stop'\n" +
    "$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru " +
    "-ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','" +
    childEncoded + "')\n" +
    "if ($null -eq $process) { throw 'Falha ao iniciar processo elevado' }\n" +
    "if ($process.ExitCode -ne 0) { exit $process.ExitCode }\n";

  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', encodePowerShell(wrapper)
    ], {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr: (stderr || '').trim() }));
      else resolve({ ok: true });
    });
  });
}

module.exports = { runElevated, encodePowerShell };
