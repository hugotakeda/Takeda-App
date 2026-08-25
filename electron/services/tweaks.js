const { exec } = require('child_process');

const tweaksDef = {
  telemetry: {
    apply: `Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Value 0 -Type DWord -Force`,
    revert: `Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Value 3 -Type DWord -Force`
  },
  gamebar: {
    apply: `Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Type DWord -Force; Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Value 0 -Type DWord -Force`,
    revert: `Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 1 -Type DWord -Force; Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Value 1 -Type DWord -Force`
  },
  backgroundApps: {
    apply: `Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" -Name "GlobalUserDisabled" -Value 1 -Type DWord -Force`,
    revert: `Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" -Name "GlobalUserDisabled" -Value 0 -Type DWord -Force`
  },
  network: {
    apply: `Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\MSMQ\\Parameters" -Name "TCPNoDelay" -Value 1 -Type DWord -Force`,
    revert: `Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\MSMQ\\Parameters" -Name "TCPNoDelay" -Force -ErrorAction SilentlyContinue`
  }
};

async function runPowerShell(cmd) {
  return new Promise((resolve) => {
    // We add a try/catch in powershell to avoid failing completely if one key isn't accessible
    const p = exec(`powershell -NoProfile -Command "try { ${cmd} } catch { exit 1 }"`, (err) => {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function applyTweak(tweakId, enable) {
  if (!tweaksDef[tweakId]) return false;
  
  const cmd = enable ? tweaksDef[tweakId].apply : tweaksDef[tweakId].revert;
  const success = await runPowerShell(cmd);
  
  return success;
}

// In a real scenario we could check registry values. For now, we assume false.
async function getTweaksStatus() {
  return {
    telemetry: false,
    gamebar: false,
    backgroundApps: false,
    network: false
  };
}

module.exports = {
  apply: applyTweak,
  getStatus: getTweaksStatus
};
