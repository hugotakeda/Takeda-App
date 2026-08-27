<div align="center">
  <img src="assets/takeda-icon-1024.png?v=2" alt="Takeda App Icon" width="140" />
  <h1>Takeda App</h1>
  <p><strong>Análise, Limpeza, Otimização e Controle — Tudo em um só lugar.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/plataforma-Windows-0078D4?style=flat-square&logo=windows&logoColor=white" />
    <img src="https://img.shields.io/badge/electron-v32-47848F?style=flat-square&logo=electron&logoColor=white" />
    <img src="https://img.shields.io/badge/versão-1.0.2-4ade80?style=flat-square" />
    <img src="https://img.shields.io/badge/licença-MIT-blue?style=flat-square" />
    <img src="https://img.shields.io/badge/auth-Discord%20OAuth2-5865F2?style=flat-square&logo=discord&logoColor=white" />
  </p>

  <p>
    <a href="https://github.com/hugotakeda/Takeda-App/releases/latest">
      <img src="https://img.shields.io/badge/⬇_Download_Instalador-EXE-4ade80?style=for-the-badge" alt="Download" />
    </a>
  </p>
</div>

---

## 📋 Sobre

O **Takeda App** é um aplicativo desktop para Windows que oferece um painel completo de monitoramento, diagnóstico, limpeza e otimização do seu sistema operacional. Desenvolvido com **Electron**, ele combina uma interface moderna e elegante (dark mode com layout em sidebar) com ferramentas poderosas de nível nativo via PowerShell e WMI.

O aplicativo agora conta com o sistema inteligente de **Atualizações OTA (On-The-Air)**, garantindo que o seu sistema sempre receba novas versões automaticamente em segundo plano de forma contínua e sem necessidade de downloads manuais.

O acesso é protegido por **autenticação via Discord OAuth2**, com verificação de licença baseada em **HWID** (Hardware ID), garantindo segurança e controle de acesso.

---

## ✨ Funcionalidades Principais

### 🩺 Saúde Dinâmica & Diagnóstico Completo
> Análise detalhada de 8 pontos do sistema com novo algoritmo orgânico de cálculo (curva proporcional) de 0–100.

- Uso de CPU e RAM em tempo real com gráficos sparkline
- Verificação do plano de energia ativo
- Status e idade do driver da GPU
- Detecção de aplicativos pesados operando em segundo plano
- Monitoramento do Windows Defender
- Teste de latência de rede (ping) e velocidade do adaptador de rede

### 🧹 Limpeza Inteligente e Profunda
> Remoção segura de arquivos desnecessários com pré-cálculo e seleção de categorias.

| Categoria | Descrição |
|---|---|
| Temporários (Usuário) | `%TEMP%` — cache de instaladores e lixo de aplicativos |
| Temporários (Windows) | `C:\Windows\Temp` |
| Prefetch | Cache de inicialização do Windows |
| Crash Dumps | Memory dumps de programas que travaram |
| Cache de Miniaturas | `thumbcache_*.db` do Explorer |
| Lixeira | Todo o conteúdo aguardando na lixeira |

### ⚡ Perfil de Energia Takeda
> Libere a força do "Ultimate Performance" oculto do Windows.

Aba dedicada que previne "bottlenecks" de energia importando e aplicando automaticamente o perfil customizado `takeda.pow`. Ele otimiza os "timers" de sistema e evita que o disco ou as portas USB sejam desligadas para economizar luz, entregando 100% de estabilidade para gamers exigentes.

### ⬇️ Instalador de Apps e Atualizador
> Instalação automatizada do essencial e atualizações constantes.

- **Central de Apps:** Lista inteligente para instalação rápida de softwares cruciais sem precisar abrir o navegador (Steam, Discord, navegadores, drivers). 
- **Atualizações (OTA):** Mecanismo de download contínuo de atualizações do aplicativo diretamente do GitHub Releases, alertando o usuário via painel banner (com progresso) quando a atualização for baixada.

### 📊 Painel de Histórico
> Acompanhe a evolução da sua máquina

Armazenamento local persistente que salva dados de relatórios e limpezas anteriores, te dando a visibilidade clara sobre quando o sistema foi otimizado e qual era seu score antes dos ajustes.

---

## 📸 Demonstração

<div align="center">
  <video src="assets/demonstrativo.mp4" width="700" controls></video>
</div>

---

## 🏗️ Arquitetura

O projeto utiliza um frontend em HTML/CSS Puro focado em **alta performance**, se conectando aos recursos de sistema através da bridge IPC do Electron.

```
Takeda App/
├── electron/                 # Processo principal (Node.js)
│   ├── main.js               # Entry point — janela, IPC handlers e Auto Updater
│   ├── preload.js            # Bridge segura (contextBridge)
│   ├── auth/                 # Autenticação Discord OAuth2
│   └── services/             # Serviços nativos (PowerShell/WMI)
│       ├── apps.js           # Gerenciador de downloads de terceiros
│       ├── cleanup.js        # Limpeza de diretórios temporários
│       ├── diagnostic.js     # Avaliação do Score de saúde
│       ├── history.js        # Banco de dados local via fs
│       ├── monitor.js        # Coleta contínua em loop
│       ├── powerplan.js      # Integração com powercfg
│       └── updater.js        # Integração electron-updater
├── src/                      # Processo renderer (UI)
│   ├── index.html            # Estrutura base da aplicação e Sidebar
│   ├── index.css             # Estilos (Dark mode, Flex grids)
│   ├── app.js                # Roteamento e orquestração visual
│   └── pages/                # Estruturas da injeção de navegação
└── assets/                   # Recursos estáticos
    ├── takeda.pow            # Perfil do Powerplan
    └── *.png/ico             # Logos e Ícones
```

---

## 💻 Rodando Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- Windows 10/11
- Conta ativa no Discord

### Instalação
```bash
# Clone e entre no projeto
git clone https://github.com/hugotakeda/Takeda-App.git
cd Takeda-App

# Instale os pacotes Node
npm install

# Inicie no modo desenvolvedor
npm run dev
```

### Build & Release
```bash
# Para gerar instalador de distribuição
npm run build

# Para gerar o release oficial OTA via Github (necessita GH_TOKEN)
npm run release
```

---

## 🛠️ Tecnologias Principais

| Tecnologia | Função no App |
|---|---|
| **[Electron](https://www.electronjs.org/)** | Motor do aplicativo desktop (Main + Renderer) |
| **Vanilla JS & CSS3** | Construção da Interface sem bloat de frameworks (extrema leveza) |
| **PowerShell Core / WMI** | Motores utilizados pelo Main Process para extrair dados físicos do hardware |
| **electron-updater** | Orquestração da comunicação OTA com as releases do Github |
| **electron-builder** | Geração e assinatura do instalador automático (NSIS) |

---

<div align="center">
Feito com ❤️ pela HonestTech e Hugo Takeda.
</div>
