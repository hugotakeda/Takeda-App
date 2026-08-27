import { t } from '../i18n.js';

const appsCategories = [
  {
    id: "sistema",
    name: "Sistemas",
    apps: [
      { id: '7zip.7zip', name: '7-Zip', desc: 'Compactador de arquivos', logo: '7-zip.org' },
      { id: 'Microsoft.Sysinternals.Autoruns', name: 'Autorun', desc: 'Gerenciador de inicialização', logo: 'sysinternals.com' },
      { id: 'voidtools.Everything', name: 'Everything', desc: 'Busca rápida de arquivos', logo: 'voidtools.com' },
      { id: 'GeekUninstaller.GeekUninstaller', name: 'Geek Uninstaller', desc: 'Desinstalador avançado', logo: 'geekuninstaller.com' },
      { id: 'Notepad++.Notepad++', name: 'Notepad++', desc: 'Editor de texto avançado', logo: 'notepad-plus-plus.org' },
      { id: 'Open-Shell.Open-Shell-Menu', name: 'Open Shell', desc: 'Menu iniciar clássico', logo: 'github.com' },
      { id: 'Microsoft.Sysinternals.ProcessExplorer', name: 'Process Explorer', desc: 'Gerenciador de tarefas avançado', logo: 'sysinternals.com' },
      { id: 'RevoUninstaller.RevoUninstaller', name: 'Revo Uninstaller', desc: 'Desinstalador completo', logo: 'revouninstaller.com' },
      { id: 'https://startallback.com/download.php', name: 'StartAllBack', desc: 'Personalização do Windows 11', logo: 'startallback.com' },
      { id: 'IObit.Unlocker', name: 'Unlocker', desc: 'Desbloqueio de arquivos', logo: 'iobit.com' }
    ]
  },
  {
    id: "drivers",
    name: "Drivers",
    apps: [
      { id: 'https://www.amd.com/en/support', name: 'AMD Chipset', desc: 'Drivers do chipset AMD', logo: 'amd.com' },
      { id: 'https://www.intel.com/content/www/us/en/download-center/home.html', name: 'Intel Drivers', desc: 'Drivers Intel', logo: 'intel.com' },
      { id: 'Wagnardsoft.DisplayDriverUninstaller', name: 'DDU', desc: 'Desinstalador de Drivers', logo: 'wagnardsoft.com' },
      { id: 'Microsoft.DirectX', name: 'DirectX', desc: 'Bibliotecas de mídia', logo: 'microsoft.com' },
      { id: 'https://github.com/massgravel/Microsoft-Activation-Scripts', name: 'KMS Activator', desc: 'Scripts de ativação', logo: 'github.com' },
      { id: 'Microsoft.VCRedist.2015+.x64', name: 'VC++ Redist', desc: 'Runtimes C++', logo: 'microsoft.com' },
      { id: 'TechPowerUp.NVCleanstall', name: 'NVCleanstall', desc: 'Instalador NVIDIA', logo: 'techpowerup.com' },
      { id: 'https://github.com/GSDragoon/RadeonSlimmer/releases', name: 'Radeon Slimmer', desc: 'Instalador AMD', logo: 'github.com' }
    ]
  },
  {
    id: "plataformas",
    name: "Plataformas",
    apps: [
      { id: 'ElectronicArts.EADesktop', name: 'EA App', desc: 'Plataforma de jogos EA', logo: 'ea.com' },
      { id: 'EpicGames.EpicGamesLauncher', name: 'Epic Games', desc: 'Plataforma Epic Games', logo: 'epicgames.com' },
      { id: 'Cfx.re.FiveM', name: 'FiveM', desc: 'Mod multijogador GTA V', logo: 'fivem.net' },
      { id: 'RockstarGames.Launcher', name: 'Rockstar', desc: 'Rockstar Games Launcher', logo: 'rockstargames.com' },
      { id: 'Valve.Steam', name: 'Steam', desc: 'Plataforma da Valve', logo: 'steampowered.com' },
      { id: 'Ubisoft.Connect', name: 'Ubisoft Connect', desc: 'Plataforma da Ubisoft', logo: 'ubisoft.com' },
      { id: 'FACEIT.FACEIT', name: 'Faceit', desc: 'Plataforma Anti-Cheat', logo: 'faceit.com' },
      { id: 'https://gamersclub.com.br/', name: 'GamersClub', desc: 'Plataforma CS2', logo: 'gamersclub.com.br' }
    ]
  },
  {
    id: "jogos",
    name: "Jogos",
    apps: [
      { id: 'RiotGames.LeagueOfLegends.BR', name: 'League of Legends', desc: 'MOBA da Riot Games', logo: 'leagueoflegends.com' },
      { id: 'RiotGames.Valorant', name: 'Valorant', desc: 'FPS Tático da Riot Games', logo: 'playvalorant.com' },
      { id: 'Mojang.MinecraftLauncher', name: 'Minecraft', desc: 'Minecraft Launcher', logo: 'minecraft.net' }
    ]
  },
  {
    id: "monitoramento",
    name: "Monitoramento",
    apps: [
      { id: 'CapFrameX.CapFrameX', name: 'CapFrameX', desc: 'Análise de frametime', logo: 'capframex.com' },
      { id: 'CPUID.CPU-Z', name: 'CPU-Z', desc: 'Informações do processador', logo: 'cpuid.com' },
      { id: 'TechPowerUp.GPU-Z', name: 'GPU-Z', desc: 'Informações de vídeo', logo: 'techpowerup.com' },
      { id: 'REALiX.HWiNFO', name: 'HWINFO', desc: 'Diagnóstico de hardware', logo: 'hwinfo.com' },
      { id: 'CPUID.HWMonitor', name: 'HWMonitor', desc: 'Monitoramento de sensores', logo: 'cpuid.com' },
      { id: 'Resplendence.LatencyMon', name: 'LatencyMon', desc: 'Monitor de latência', logo: 'resplendence.com' },
      { id: 'Guru3D.Afterburner', name: 'MSI Afterburner', desc: 'Overclock e monitoramento', logo: 'msi.com' },
      { id: 'https://github.com/GPUOpen-Tools/OCAT', name: 'OCAT', desc: 'Monitor de captura', logo: 'github.com' },
      { id: 'OCBASE.OCCT', name: 'OCCT', desc: 'Teste de estresse', logo: 'ocbase.com' },
      { id: 'https://www.mersenne.org/download/', name: 'Prime95', desc: 'Teste de CPU', logo: 'mersenne.org' },
      { id: 'https://www.testmem.tz.ru/testmem5.htm', name: 'TestMem5', desc: 'Teste de estabilidade', logo: 'tz.ru' },
      { id: 'https://zentimings.protonrom.com/', name: 'ZenTimings', desc: 'Leitura de timings RAM', logo: 'protonrom.com' }
    ]
  },
  {
    id: "web",
    name: "Web",
    apps: [
      { id: 'Brave.Brave', name: 'Brave', desc: 'Navegador privado', logo: 'brave.com' },
      { id: 'Google.Chrome', name: 'Google Chrome', desc: 'Navegador da Google', logo: 'google.com' },
      { id: 'Microsoft.Edge', name: 'Microsoft Edge', desc: 'Navegador da Microsoft', logo: 'microsoft.com' },
      { id: 'Discord.Discord', name: 'Discord', desc: 'Comunicação por voz', logo: 'discord.com' },
      { id: 'Medal.Medal', name: 'Medal.tv', desc: 'Gravador de clipes', logo: 'medal.tv' },
      { id: 'TeamSpeakSystems.TeamSpeakClient', name: 'TeamSpeak', desc: 'Comunicação de voz', logo: 'teamspeak.com' }
    ]
  },
  {
    id: "dev",
    name: "Desenvolvimento",
    apps: [
      { id: 'OBSProject.OBSStudio', name: 'OBS Studio', desc: 'Gravação e streaming', logo: 'obsproject.com' },
      { id: 'qBittorrent.qBittorrent', name: 'qBittorrent', desc: 'Cliente torrent', logo: 'qbittorrent.org' },
      { id: 'Spotify.Spotify', name: 'Spotify', desc: 'Streaming de música', logo: 'spotify.com' },
      { id: 'VideoLAN.VLC', name: 'VLC Player', desc: 'Reprodutor de mídia', logo: 'videolan.org' },
      { id: 'Microsoft.VisualStudio.2022.Community', name: 'Visual Studio', desc: 'IDE da Microsoft', logo: 'visualstudio.microsoft.com' },
      { id: 'Microsoft.VisualStudioCode', name: 'VS Code', desc: 'Editor de código', logo: 'code.visualstudio.com' }
    ]
  },
  {
    id: "perifericos",
    name: "Periféricos",
    apps: [
      { id: 'Logitech.GHUB', name: 'Logitech G HUB', desc: 'Software Logitech', logo: 'logitechg.com' },
      { id: 'RazerInc.RazerInstaller.Synapse3', name: 'Razer Synapse', desc: 'Software Razer', logo: 'razer.com' },
      { id: '9P1TBXR6QDCX', name: 'HyperX NGENUITY', desc: 'Software HyperX', logo: 'hyperx.com' }
    ]
  }
];

export function renderApps() {
  const tabsHtml = [
    { id: 'todos', name: 'Todos' },
    ...appsCategories
  ].map(tab => `
    <button class="app-tab-btn ${tab.id === 'todos' ? 'active' : ''}" data-tab="${tab.id}" style="
      background: transparent;
      border: none;
      color: ${tab.id === 'todos' ? 'var(--accent-blue)' : 'var(--text-secondary)'};
      border-bottom: 2px solid ${tab.id === 'todos' ? 'var(--accent-blue)' : 'transparent'};
      padding: 6px 10px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    ">${tab.name}</button>
  `).join('');

  return `
    <div class="page-header" style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 class="page-title">App Store</h1>
          <p class="page-subtitle" style="color: var(--text-secondary); margin-top: 4px;">Instale seus programas favoritos com 1 clique.</p>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="position: relative;">
            <input type="text" id="app-search-input" placeholder="Buscar aplicativo..." style="
              background: var(--bg-card);
              border: 1px solid var(--border-color);
              border-radius: 8px;
              padding: 8px 12px 8px 36px;
              color: var(--text-primary);
              font-family: inherit;
              font-size: 0.9rem;
              width: 200px;
              transition: border-color 0.2s ease;
            ">
            <svg style="position: absolute; left: 10px; top: 9px; color: var(--text-secondary);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 2px; flex-wrap: wrap; border-bottom: 1px solid var(--border-color); padding-bottom: 0px;" id="apps-tabs-container">
        ${tabsHtml}
      </div>
    </div>
    
    <div class="page-content" style="max-height: calc(100vh - 190px); overflow-y: auto; padding-right: 8px;" id="apps-list-container">
      <!-- Apps will be injected here -->
    </div>
  `;
}

function renderAppsList(filterText = '', activeTab = 'todos') {
  let html = '';

  appsCategories.forEach(category => {
    // If tab is not 'todos' and doesn't match this category, skip
    if (activeTab !== 'todos' && category.id !== activeTab) return;

    // Filter apps by search text
    const filteredApps = category.apps.filter(app => 
      app.name.toLowerCase().includes(filterText) || 
      app.desc.toLowerCase().includes(filterText)
    );

    if (filteredApps.length === 0) return; // Skip empty categories after filter

    const appsHtml = filteredApps.map(app => `
      <div class="app-item" data-name="${app.name.toLowerCase()}" style="
        display: flex; flex-direction: column; align-items: center; text-align: center;
        background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color);
        border-radius: 12px; padding: 12px; transition: background 0.2s ease, transform 0.2s ease;
      " onmouseover="this.style.background='rgba(255,255,255,0.04)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='rgba(255,255,255,0.02)'; this.style.transform='translateY(0)';">
        <div style="
          width: 44px; height: 44px; border-radius: 10px; 
          background: #ffffff; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.12); overflow: hidden; padding: 6px; margin-bottom: 12px;
        ">
          <img src="https://www.google.com/s2/favicons?domain=${app.logo}&sz=128" onerror="this.src='https://www.google.com/s2/favicons?domain=microsoft.com&sz=128'" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; margin-bottom: 12px;">
          <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem; margin-bottom: 2px; line-height: 1.1;">${app.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.2;">${app.desc}</div>
        </div>
        <button class="btn-install-individual" data-id="${app.id}" style="
          width: 100%; background: rgba(63, 140, 232, 0.1); color: var(--accent-blue);
          border: 1px solid rgba(63, 140, 232, 0.2); border-radius: 8px;
          padding: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer;
          transition: all 0.2s ease;
        ">
          Baixar
        </button>
      </div>
    `).join('');

    html += `
      <div class="card app-category-card" style="margin-bottom: 24px;">
        <div class="card-title" style="margin-bottom: 16px; font-size: 1.1rem; padding: 0 4px;">${category.name}</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;">
          ${appsHtml}
        </div>
      </div>
    `;
  });

  if (html === '') {
    html = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Nenhum aplicativo encontrado.</div>`;
  }

  return html;
}

export function initApps() {
  const container = document.getElementById('apps-list-container');
  const searchInput = document.getElementById('app-search-input');
  const tabBtns = document.querySelectorAll('.app-tab-btn');
  
  let currentTab = 'todos';
  let currentSearch = '';

  const updateList = () => {
    container.innerHTML = renderAppsList(currentSearch, currentTab);
    attachInstallListeners();
  };

  // Search logic
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    updateList();
  });

  // Tabs logic
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => {
        b.style.color = 'var(--text-secondary)';
        b.style.borderBottomColor = 'transparent';
        b.classList.remove('active');
      });
      
      const target = e.target;
      target.style.color = 'var(--accent-blue)';
      target.style.borderBottomColor = 'var(--accent-blue)';
      target.classList.add('active');
      
      currentTab = target.dataset.tab;
      updateList();
    });
  });

  // Individual install logic
  const attachInstallListeners = () => {
    const installBtns = container.querySelectorAll('.btn-install-individual');
    installBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.id;
        
        // Prevent double clicks
        if (btn.disabled) return;
        
        btn.disabled = true;
        btn.textContent = 'Instalando...';
        btn.style.background = 'rgba(250, 204, 21, 0.1)';
        btn.style.color = '#facc15';
        btn.style.borderColor = 'rgba(250, 204, 21, 0.2)';

        // Listen for progress if needed, but since it's individual we can just wait for the promise
        try {
          await window.pulso.installApps([appId]);
          btn.textContent = 'Concluído';
          btn.style.background = 'rgba(74, 222, 128, 0.1)';
          btn.style.color = 'var(--accent-green)';
          btn.style.borderColor = 'rgba(74, 222, 128, 0.2)';
        } catch (err) {
          btn.textContent = 'Erro';
          btn.style.background = 'rgba(248, 113, 113, 0.1)';
          btn.style.color = '#f87171';
          btn.style.borderColor = 'rgba(248, 113, 113, 0.2)';
          
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Tentar Novamente';
          }, 3000);
        }
      });
    });
  };

  // Initial render
  updateList();
}
