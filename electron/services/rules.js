// Catálogo de regras de limpeza avançada (por app/categoria), inspirado no
// motor de regras JSON do Kudu (https://github.com/AdventDevInc/kudu), mas
// adaptado ao Takeda App: aqui as regras vivem em JS (sem dependências novas)
// e só apontam para pastas de CACHE/TEMP — nunca documentos, configs, senhas
// ou sessões salvas do usuário.

const path = require('path');
const fs = require('fs');

// ── Resolução de variáveis de ambiente (estilo ${VAR}) ──────────────────
function resolveVars(str) {
  const vars = {
    TEMP: process.env.TEMP || process.env.TMP,
    APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    USERPROFILE: process.env.USERPROFILE,
    PROGRAMDATA: process.env.PROGRAMDATA,
    WINDIR: process.env.WINDIR,
    SYSTEMDRIVE: process.env.SYSTEMDRIVE || 'C:',
    PROGRAMFILES: process.env['ProgramFiles'],
    PROGRAMFILES_X86: process.env['ProgramFiles(x86)'],
  };
  return str.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] || '');
}

// Expande um "rule.paths" (array de strings com variáveis) em caminhos
// absolutos concretos. Regras com `globProfile` são expandidas percorrendo
// as subpastas de `root` (ex.: perfis do Firefox) e anexando `sub` a cada uma.
function resolveRulePaths(rule) {
  const out = [];

  if (rule.paths) {
    for (const p of rule.paths) {
      const resolved = resolveVars(p);
      if (resolved) out.push(resolved);
    }
  }

  if (rule.globProfile) {
    const root = resolveVars(rule.globProfile.root);
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          out.push(path.join(root, entry.name, rule.globProfile.sub));
        }
      }
    } catch (e) {
      // pasta raiz não existe (app não instalado) — ignora
    }
  }

  return out;
}

// ── Catálogo ──────────────────────────────────────────────────────────
const RULE_CATEGORIES = [
  {
    id: 'browsers',
    name: 'Navegadores',
    rules: [
      {
        id: 'chrome-cache',
        name: 'Google Chrome — Cache',
        desc: 'Cache de páginas e imagens do Chrome. Recriado automaticamente.',
        paths: [
          '${LOCALAPPDATA}\\Google\\Chrome\\User Data\\Default\\Cache',
          '${LOCALAPPDATA}\\Google\\Chrome\\User Data\\Default\\Code Cache',
        ],
      },
      {
        id: 'edge-cache',
        name: 'Microsoft Edge — Cache',
        desc: 'Cache de páginas e imagens do Edge. Recriado automaticamente.',
        paths: [
          '${LOCALAPPDATA}\\Microsoft\\Edge\\User Data\\Default\\Cache',
          '${LOCALAPPDATA}\\Microsoft\\Edge\\User Data\\Default\\Code Cache',
        ],
      },
      {
        id: 'brave-cache',
        name: 'Brave — Cache',
        desc: 'Cache de páginas e imagens do Brave.',
        paths: [
          '${LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache',
        ],
      },
      {
        id: 'firefox-cache',
        name: 'Mozilla Firefox — Cache',
        desc: 'Cache de todos os perfis do Firefox instalados.',
        globProfile: {
          root: '${APPDATA}\\Mozilla\\Firefox\\Profiles',
          sub: 'cache2',
        },
      },
    ],
  },
  {
    id: 'apps',
    name: 'Apps de Comunicação',
    rules: [
      {
        id: 'discord-cache',
        name: 'Discord — Cache',
        desc: 'Cache de imagens/GIFs e código do cliente Discord.',
        paths: [
          '${APPDATA}\\discord\\Cache',
          '${APPDATA}\\discord\\Code Cache',
          '${APPDATA}\\discord\\GPUCache',
        ],
      },
      {
        id: 'spotify-cache',
        name: 'Spotify — Cache de músicas',
        desc: 'Cache local de streaming do Spotify (não afeta playlists/conta).',
        paths: ['${LOCALAPPDATA}\\Spotify\\Storage', '${LOCALAPPDATA}\\Spotify\\Data'],
      },
      {
        id: 'teams-cache',
        name: 'Microsoft Teams — Cache',
        desc: 'Cache do cliente Teams (clássico).',
        paths: [
          '${APPDATA}\\Microsoft\\Teams\\Cache',
          '${APPDATA}\\Microsoft\\Teams\\GPUCache',
        ],
      },
      {
        id: 'slack-cache',
        name: 'Slack — Cache',
        desc: 'Cache de mídia e código do cliente Slack.',
        paths: ['${APPDATA}\\Slack\\Cache', '${APPDATA}\\Slack\\Code Cache'],
      },
    ],
  },
  {
    id: 'dev',
    name: 'Desenvolvimento',
    rules: [
      {
        id: 'vscode-cache',
        name: 'VS Code — Cache',
        desc: 'Cache interno do editor. Não afeta extensões nem configurações.',
        paths: ['${APPDATA}\\Code\\Cache', '${APPDATA}\\Code\\CachedData', '${APPDATA}\\Code\\Code Cache'],
      },
      {
        id: 'npm-cache',
        name: 'npm — Cache de pacotes',
        desc: 'Cache de download do npm. É baixado novamente quando necessário.',
        paths: ['${LOCALAPPDATA}\\npm-cache'],
      },
      {
        id: 'yarn-cache',
        name: 'Yarn — Cache de pacotes',
        desc: 'Cache de download do Yarn.',
        paths: ['${LOCALAPPDATA}\\Yarn\\Cache'],
      },
      {
        id: 'pip-cache',
        name: 'pip — Cache de pacotes Python',
        desc: 'Cache de download de pacotes Python.',
        paths: ['${LOCALAPPDATA}\\pip\\Cache'],
      },
    ],
  },
  {
    id: 'gaming',
    name: 'Jogos',
    rules: [
      {
        id: 'steam-htmlcache',
        name: 'Steam — Cache do cliente',
        desc: 'Cache de interface do Steam (loja, perfil). Não afeta jogos instalados.',
        paths: [
          '${PROGRAMFILES_X86}\\Steam\\htmlcache',
          '${PROGRAMFILES_X86}\\Steam\\appcache\\httpcache',
        ],
      },
      {
        id: 'epic-cache',
        name: 'Epic Games Launcher — Cache',
        desc: 'Cache web do launcher da Epic Games.',
        paths: ['${LOCALAPPDATA}\\EpicGamesLauncher\\Saved\\webcache'],
      },
      {
        id: 'nvidia-shader-cache',
        name: 'NVIDIA — Cache de shaders',
        desc: 'Cache de compilação de shaders da NVIDIA. Recompilado sob demanda (pode causar leve engasgo na 1ª execução do jogo após limpar).',
        paths: ['${LOCALAPPDATA}\\NVIDIA\\DXCache', '${LOCALAPPDATA}\\NVIDIA\\GLCache'],
      },
      {
        id: 'amd-shader-cache',
        name: 'AMD — Cache de shaders',
        desc: 'Cache de compilação de shaders da AMD.',
        paths: ['${LOCALAPPDATA}\\AMD\\DxCache', '${LOCALAPPDATA}\\AMD\\DxcCache'],
      },
      {
        id: 'directx-shader-cache',
        name: 'DirectX — Cache de shaders',
        desc: 'Cache global de shaders do DirectX 12.',
        paths: ['${LOCALAPPDATA}\\D3DSCache'],
      },
    ],
  },
  {
    id: 'system',
    name: 'Sistema',
    rules: [
      {
        id: 'windows-update-cache',
        name: 'Cache do Windows Update',
        desc: 'Instaladores já baixados de atualizações. Serão baixados novamente se precisos.',
        paths: ['${WINDIR}\\SoftwareDistribution\\Download'],
      },
      {
        id: 'delivery-optimization',
        name: 'Cache de Otimização de Entrega',
        desc: 'Cache usado para compartilhar atualizações entre PCs na rede local.',
        paths: ['${PROGRAMDATA}\\Microsoft\\Network\\Downloader\\qmgr'],
      },
      {
        id: 'error-reporting',
        name: 'Relatórios de Erro do Windows',
        desc: 'Dumps e relatórios de erro (WER) já enviados ou pendentes.',
        paths: [
          '${LOCALAPPDATA}\\Microsoft\\Windows\\WER\\ReportArchive',
          '${LOCALAPPDATA}\\Microsoft\\Windows\\WER\\ReportQueue',
        ],
      },
      {
        id: 'windows-old',
        name: 'Windows.old',
        desc: 'ATENÇÃO: pasta da instalação anterior do Windows, guardada para permitir reverter uma atualização recente. Depois de removida, não é mais possível voltar à versão anterior do Windows. Só limpe se tiver certeza que não vai precisar reverter.',
        big: true,
        paths: ['${SYSTEMDRIVE}\\Windows.old'],
      },
    ],
  },
];

module.exports = { RULE_CATEGORIES, resolveVars, resolveRulePaths };
