# Changelog

## [1.1.1] - 2026-09-09

### Correções de interface
- Reorganizada a navegação de Ferramentas para manter as sete categorias inteiramente visíveis e com espaçamento uniforme.
- Adicionada rolagem vertical real às listas de todas as ferramentas, incluindo Privacidade, Debloat e categorias da Limpeza Avançada.
- Barras de ação agora permanecem acessíveis no rodapé das listas longas; botões de cabeçalho voltaram ao formato compacto.
- Adicionada navegação entre abas com setas, Home e End, além de foco explícito na região rolável.
- O QA de interface agora usa catálogos extensos para impedir que listas curtas mascarem regressões de overflow.

## [1.1.0] - 2026-09-09

### Nova identidade visual
- Interface redesenhada em obsidiana, marfim e lavanda para acompanhar o novo ícone Takeda.
- Dashboard, autenticação, loja de aplicativos, histórico e todas as ferramentas receberam uma linguagem visual unificada, responsiva e mais acessível.
- Novo fluxo de inicialização, modais com navegação por teclado e estados de carregamento, erro e conclusão consistentes.

### Desempenho e estabilidade
- Analisador de disco refeito para calcular pastas, extensões e maiores arquivos em uma única varredura cancelável.
- Limpeza com concorrência limitada, medição dos bytes realmente removidos e resultados parciais explícitos.
- Navegação rápida agora encerra monitores, timers, listeners e processos de páginas anteriores.

### Segurança e correções
- IPC validado e recursos sensíveis protegidos por permissões temporárias emitidas pelo processo principal.
- Inicialização, Registro, Exclusão Segura, Debloat e Privacidade agora validam alvos e confirmam o resultado real antes de informar sucesso.
- Scripts administrativos executados de forma codificada, sem arquivos temporários vulneráveis, e com propagação correta do código de saída.
- Conteúdo dinâmico escapado, navegação externa restrita a HTTPS e Electron atualizado com fuses de produção reforçados.

## [1.0.8] - 2026-09-07

### ✨ Nova aba "Ferramentas"
- **Limpeza Avançada**: motor de limpeza por regras cobrindo navegadores (Chrome, Edge, Brave, Firefox), apps de comunicação, ferramentas de desenvolvimento, jogos e itens do sistema.
- **Registro & Inicialização**: gerenciador de itens de inicialização e limpador de registro para entradas órfãs (com backup automátio).
- **Analisador de Disco**: visualização das maiores pastas/arquivos e distribuição por tipo de arquivo.
- **Central de Privacidade**: 11 ajustes reversíveis de privacidade do Windows (telemetria, etc).
- **Exclusão Segura**: apaga arquivos/pastas sobrescrevendo o conteúdo (1 a 7 passes) antes de excluir.
- **Segurança**: verificação rápida/completa via Windows Defender, com status e histórico.
- **Debloat do Windows**: remoção de 23 apps opcionais pré-instalados sem tocar no essencial.

### 🎨 Redesign das páginas de Ferramentas
- **Listas com cara de card**: itens aparecem como cartões com fundo, borda e hover.
- **Abas em formato de pílula**: novo estilo consistente (fundo destacado no item ativo) para Limpeza Avançada, Registro & Inicialização, etc.
- **Estado vazio do Analisador de Disco**: melhoria visual e atalhos rápidos de pastas (Downloads, Documentos).
- Títulos de seção visíveis e checkboxes ajustadas ao novo layout.

### 🎬 Animações e transições
- **Troca de página e sub-abas mais suave**: transições de fade/slide em toda a navegação (Dashboard, Histórico, Ferramentas, etc.).
- **Listas com entrada escalonada**: itens surgem em sequência (stagger) de forma fluida.
- **Modais e barras de progresso**: entrada animada nos modais e barras do Analisador de Disco animando de 0% até o tamanho real.

### 🐛 Correções e Layout
- Corrigido um bug de idioma onde o app não reconhecia variantes `pt-br` no Windows.
- Corrigido botão "Remover Selecionados" em Debloat e "Executar Limpeza" que ficavam fora da área com rolagem.
- Removido espaço preto vazio em "Exclusão Segura" e "Segurança".
- Ajustados botões grandes demais que ocupavam a tela inteira em "Recalcular", "Atualizar Lista", etc.
- **Exclusão Segura** agora possui scroll adequado caso a lista passe do tamanho da tela.
- DevTools bloqueado automaticamente por padrão (proteção).

## [1.0.5] - 2026-08-27

### ✨ Melhorias e Otimizações Visuais
- **Nova Animação de Energia**: O painel de Plano de Energia recebeu uma animação imersiva exclusiva! Ao aplicar o Plano Takeda, o aplicativo exibirá uma animação com um raio de energia dourado pulsante e a mensagem "Injetando Takeda Power", dando um feedback claro de que o sistema está sendo otimizado.
- **Fechamento Automático Inteligente**: Após a ativação do plano, o painel de energia agora se fecha automaticamente de forma suave, otimizando seu tempo.
- **Tamanho Fixo do Modal**: A tela de confirmação agora "trava" suas dimensões durante as animações, garantindo que a janela permaneça perfeitamente centralizada e não pisque na tela.

## [1.0.4] - 2026-08-27

### ✨ O que há de novo no Instalador
- **Novo Assistente de Instalação**: Abandonamos a instalação de "1 clique" que ocorria de forma invisível. Agora, o aplicativo conta com um instalador tradicional passo-a-passo (com telas de Avançar e opção para mudar a pasta).
- **Atalho na Área de Trabalho**: Durante a instalação, agora existe uma opção nativa e ativada por padrão para criar o atalho do aplicativo diretamente na sua Área de Trabalho (Desktop), facilitando muito o acesso ao app no dia a dia.
- **Menu Iniciar**: A criação do atalho no Menu Iniciar do Windows foi otimizada para garantir que o app sempre apareça nas suas buscas nativas.

## [1.0.3] - 2026-08-27

### ✨ Melhorias e Otimizações Visuais
- **Painel de Energia**: O tamanho do modal do plano de energia foi ajustado para um visual mais enxuto. Após o plano Takeda ser aplicado, um botão "Fechar" agora se mantém presente e bem posicionado.
- **Animação de Limpeza Ajustada**: A animação na execução de limpeza foi estabilizada. Ela agora é exibida no tempo exato (3,5 segundos) antes de apresentar a tela de conclusão, melhorando drasticamente o feedback visual.
- **Menu Lateral Mais Minimalista**: O nome de usuário (@) foi removido da barra lateral, mantendo um design muito mais limpo. O avatar do Discord também foi perfeitamente centralizado e ganhou um leve aumento de tamanho (61px).

### 🐛 Correções de Bugs
- **Correção de "Glitch" na Splash Screen**: Resolvido o glitch visual em que partes de telas não renderizadas apareciam por uma fração de segundo após a tela de carregamento sumir. O dashboard principal agora é renderizado de forma transparente em segundo plano, resultando em uma transição suave.
