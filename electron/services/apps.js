const { spawn } = require('child_process');

async function installApps(appIds, onProgress) {
  if (!appIds || appIds.length === 0) return;

  for (let i = 0; i < appIds.length; i++) {
    const appId = appIds[i];
    
    // Send progress start for this app
    if (onProgress) {
      onProgress({
        appId,
        index: i + 1,
        total: appIds.length,
        status: 'Instalando...'
      });
    }

    try {
      await installSingleApp(appId);
      if (onProgress) {
        onProgress({
          appId,
          index: i + 1,
          total: appIds.length,
          status: 'Concluído'
        });
      }
    } catch (err) {
      if (onProgress) {
        onProgress({
          appId,
          index: i + 1,
          total: appIds.length,
          status: 'Erro'
        });
      }
    }
  }
}

function installSingleApp(appId) {
  return new Promise((resolve, reject) => {
    // Some apps might be custom URLs instead of winget IDs
    if (appId.startsWith('http')) {
      const { shell } = require('electron');
      shell.openExternal(appId);
      setTimeout(resolve, 2000); // just resolve after opening browser
      return;
    }

    // Executa o winget em uma nova janela visível para garantir que o UAC (prompt de administrador) seja exibido e o usuário veja o progresso real.
    const { exec } = require('child_process');
    const psCmd = `Start-Process -FilePath "winget" -ArgumentList "install", "--id", "${appId}", "--exact", "--accept-package-agreements", "--accept-source-agreements" -Wait`;
    
    exec(`powershell -NoProfile -Command "${psCmd}"`, (err, stdout, stderr) => {
      resolve(0);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  installApps
};
