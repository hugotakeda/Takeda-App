import { t } from '../i18n.js';
import { escapeHtml } from '../ui.js';

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
      { id: 'TeamSpeakSystems.TeamSpeakClient', name: 'TeamSpeak', desc: 'Comunicação de voz', logo: 'teamspeak.com' },
      { id: 'qBittorrent.qBittorrent', name: 'qBittorrent', desc: 'Cliente torrent', logo: 'qbittorrent.org' }
    ]
  },
  {
    id: "dev",
    name: "Desenvolvimento",
    apps: [
      { id: 'Microsoft.VisualStudio.2022.Community', name: 'Visual Studio', desc: 'IDE da Microsoft', logo: 'visualstudio.microsoft.com' },
      { id: 'Microsoft.VisualStudioCode', name: 'VS Code', desc: 'Editor de código', logo: 'code.visualstudio.com' }
    ]
  },
  {
    id: "midia",
    name: "Mídia",
    apps: [
      { id: 'OBSProject.OBSStudio', name: 'OBS Studio', desc: 'Gravação e streaming', logo: 'obsproject.com' },
      { id: 'Spotify.Spotify', name: 'Spotify', desc: 'Streaming de música', logo: 'spotify.com' },
      { id: 'VideoLAN.VLC', name: 'VLC Player', desc: 'Reprodutor de mídia', logo: 'videolan.org' }
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
    <button class="app-tab-btn ${tab.id === 'todos' ? 'active' : ''}" type="button" role="tab" aria-selected="${tab.id === 'todos'}" tabindex="${tab.id === 'todos' ? '0' : '-1'}" data-tab="${tab.id}">${tab.name}</button>
  `).join('');

  return `
    <div class="page-header apps-header">
      <div class="apps-header-row">
        <div>
          <h1 class="page-title">App Store</h1>
          <p class="page-subtitle apps-subtitle">Instale seus programas favoritos com 1 clique.</p>
        </div>
        <div class="apps-header-actions">
          <div class="apps-search-shell">
            <label class="sr-only" for="app-search-input">Buscar aplicativo</label>
            <input class="apps-search-input" type="search" id="app-search-input" placeholder="Buscar aplicativo..." autocomplete="off">
            <svg class="apps-search-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="apps-tabs-shell" id="apps-tabs-shell">
        <button class="apps-tabs-scroll" id="apps-tabs-previous" type="button" aria-label="Mostrar categorias anteriores" aria-controls="apps-tabs-container" disabled>
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="tab-bar apps-tabs" id="apps-tabs-container" role="tablist" aria-label="Categorias de aplicativos">
          ${tabsHtml}
        </div>
        <button class="apps-tabs-scroll" id="apps-tabs-next" type="button" aria-label="Mostrar próximas categorias" aria-controls="apps-tabs-container">
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </div>
    
    <div class="page-content apps-list custom-scrollbar" id="apps-list-container" aria-live="polite">
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
      <div class="app-item apps-item" data-name="${escapeHtml(app.name.toLowerCase())}">
        <div class="apps-item-icon" data-fallback="${escapeHtml(app.name.slice(0, 1).toUpperCase())}">
          <img class="apps-item-logo" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(app.logo)}&amp;sz=128" alt="" width="21" height="21" loading="lazy" decoding="async" referrerpolicy="no-referrer" fetchpriority="low">
        </div>
        <div class="apps-item-copy">
          <div class="apps-item-name">${escapeHtml(app.name)}</div>
          <div class="apps-item-description">${escapeHtml(app.desc)}</div>
        </div>
        <button class="btn-install-individual apps-install-button" type="button" data-id="${escapeHtml(app.id)}">
          Baixar
        </button>
      </div>
    `).join('');

    html += `
      <section class="card app-category-card apps-category-card">
        <h2 class="card-title apps-category-title">${escapeHtml(category.name)}</h2>
        <div class="apps-grid">
          ${appsHtml}
        </div>
      </section>
    `;
  });

  if (html === '') {
    html = `<div class="apps-empty-state" role="status">Nenhum aplicativo encontrado.</div>`;
  }

  return html;
}

export function initApps() {
  const container = document.getElementById('apps-list-container');
  const searchInput = document.getElementById('app-search-input');
  const tabRail = document.getElementById('apps-tabs-container');
  const tabShell = document.getElementById('apps-tabs-shell');
  const previousButton = document.getElementById('apps-tabs-previous');
  const nextButton = document.getElementById('apps-tabs-next');
  const tabBtns = Array.from(tabRail?.querySelectorAll('.app-tab-btn') || []);
  
  if (!container || !searchInput || !tabRail) return () => {};

  let currentTab = 'todos';
  let currentSearch = '';
  let searchTimer = null;
  let alive = true;
  const feedbackTimers = new Set();
  let tabResizeObserver = null;

  const updateTabScrollState = () => {
    if (!alive || !tabRail.isConnected) return;
    const maximum = Math.max(0, tabRail.scrollWidth - tabRail.clientWidth);
    const overflowing = maximum > 1;
    tabShell?.classList.toggle('has-overflow', overflowing);
    if (previousButton) previousButton.disabled = !overflowing || tabRail.scrollLeft <= 1;
    if (nextButton) nextButton.disabled = !overflowing || tabRail.scrollLeft >= maximum - 1;
  };

  const scrollTabs = (direction) => {
    const distance = Math.max(180, Math.round(tabRail.clientWidth * 0.62));
    tabRail.scrollBy({ left: distance * direction, behavior: 'smooth' });
  };

  const revealTab = (target) => {
    const left = target.offsetLeft;
    const right = left + target.offsetWidth;
    const visibleLeft = tabRail.scrollLeft;
    const visibleRight = visibleLeft + tabRail.clientWidth;
    let destination = visibleLeft;

    if (left < visibleLeft + 4) destination = left - 4;
    if (right > visibleRight - 4) destination = right - tabRail.clientWidth + 4;
    if (Math.abs(destination - visibleLeft) > 1) {
      tabRail.scrollTo({ left: destination, behavior: 'smooth' });
    }
  };

  previousButton?.addEventListener('click', () => scrollTabs(-1));
  nextButton?.addEventListener('click', () => scrollTabs(1));
  tabRail.addEventListener('scroll', updateTabScrollState, { passive: true });
  tabRail.addEventListener('wheel', (event) => {
    if (tabRail.scrollWidth <= tabRail.clientWidth + 1 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    tabRail.scrollLeft += event.deltaY;
  }, { passive: false });

  const updateList = () => {
    if (!alive || !container.isConnected) return;
    container.innerHTML = renderAppsList(currentSearch, currentTab);
    attachInstallListeners();
    container.querySelectorAll('.apps-item-logo').forEach((image) => {
      image.addEventListener('error', () => {
        image.hidden = true;
        image.parentElement?.classList.add('apps-item-icon--fallback');
      }, { once: true });
    });
  };

  // Search logic
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(updateList, 160);
  });

  const selectTab = (target) => {
      if (!target) return;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabBtns.forEach(b => b.setAttribute('aria-selected', 'false'));
      tabBtns.forEach(b => { b.tabIndex = -1; });

      target.classList.add('active');
      target.setAttribute('aria-selected', 'true');
      target.tabIndex = 0;

      currentTab = target.dataset.tab;
      updateList();
      revealTab(target);
      window.requestAnimationFrame(updateTabScrollState);
  };

  // Tabs logic: click, keyboard and automatic reveal of the selected category.
  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', (event) => selectTab(event.currentTarget));
    btn.addEventListener('keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabBtns.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabBtns.length) % tabBtns.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabBtns.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      const nextTab = tabBtns[nextIndex];
      nextTab.focus();
      selectTab(nextTab);
    });
  });

  if (typeof ResizeObserver === 'function') {
    tabResizeObserver = new ResizeObserver(updateTabScrollState);
    tabResizeObserver.observe(tabRail);
  }
  window.requestAnimationFrame(updateTabScrollState);

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
        btn.classList.remove('is-success', 'is-error');
        btn.classList.add('is-installing');

        // Listen for progress if needed, but since it's individual we can just wait for the promise
        try {
          const response = await window.pulso.installApps([appId]);
          const result = response?.results?.[0];
          if (!response?.ok || !result?.ok) throw new Error(result?.error || 'A instalação não foi confirmada');
          if (!alive || !btn.isConnected) return;
          btn.textContent = result.action === 'opened-url' ? 'Aberto' : 'Concluído';
          btn.classList.remove('is-installing');
          btn.classList.add('is-success');
        } catch (err) {
          if (!alive || !btn.isConnected) return;
          btn.textContent = 'Erro';
          btn.classList.remove('is-installing');
          btn.classList.add('is-error');
          
          const timer = window.setTimeout(() => {
            feedbackTimers.delete(timer);
            if (!alive || !btn.isConnected) return;
            btn.disabled = false;
            btn.textContent = 'Tentar Novamente';
          }, 3000);
          feedbackTimers.add(timer);
        }
      });
    });
  };

  // Initial render
  updateList();

  return () => {
    alive = false;
    window.clearTimeout(searchTimer);
    feedbackTimers.forEach((timer) => window.clearTimeout(timer));
    feedbackTimers.clear();
    tabResizeObserver?.disconnect();
  };
}
