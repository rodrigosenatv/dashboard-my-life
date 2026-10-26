# My Life

Webapp pessoal que substitui o template **Dashboard My Life** do Notion: rotina (hábitos, tarefas, agenda, metas), projetos (segundo cérebro, capturas, notas), estudos (leitura, cursos, laboratório) e conteúdo com IA (biblioteca de prompts, planner, assistente).

Feito com Next.js 16, Supabase (banco, login e arquivos) e hospedado na Vercel.

## Colocar no ar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito serve).
2. Em **SQL Editor**, cole e rode o conteúdo de `supabase/migrations/20261007120000_esquema_inicial.sql`. Isso cria as tabelas, as regras de acesso (cada pessoa só vê os próprios dados), a busca e o bucket privado `arquivos`.
3. Em **Project Settings > API**, copie a *Project URL* e a *Publishable key*. Nunca use a *secret key* no app.

### 2. Vercel
1. Em [vercel.com](https://vercel.com), **Add New > Project** e importe este repositório.
2. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Não configure chave de IA compartilhada na Vercel. Cada usuário cadastra a própria chave do Claude, OpenAI ou Gemini em **Configurações → Inteligência artificial** e é responsável pelo consumo dessa API.
3. Clique em **Deploy**.

### 3. Login
1. No Supabase, **Authentication > URL Configuration**: em *Site URL* coloque o endereço da Vercel (ex.: `https://dashboard-my-life.vercel.app`) e em *Redirect URLs* adicione `https://SEU-ENDERECO/auth/callback`.
2. Abra o app, crie sua conta e confirme pelo e-mail.
3. Depois de criar a sua conta, desligue novos cadastros em **Authentication > Sign In / Providers > Allow new users to sign up**.

### 4. Importar o Notion
1. No Notion: **Configurações > Geral > Exportar todo o conteúdo**, formato *Markdown & CSV*, incluindo arquivos e subpáginas.
2. No app: **Configurações > Importar do Notion**, escolha o .zip, confira o resumo e importe.
3. A página *Senhas* e os campos de senha dos cursos não são importados. Importar de novo substitui só o que veio do Notion.

## A cabine (moldura do app)

A barra lateral (no computador), o topo, as abas da área e a barra de baixo (no celular) formam a cabine: o azul petróleo da capa do caderno no escuro, com a luz ciano da biblioteca. Fica sempre escura, no tema claro ou escuro.

- **Barra lateral.** A assinatura "My life" acesa, o botão Novo em luz ciano, a busca de vidro, os grupos com rótulo de HUD (o ponto aceso na cor da área e um fio que some) e o item da página aberta aceso na cor da área: Rotina verde, Segundo Cérebro violeta, Estudos âmbar, Conteúdo rosa; Hoje, Vida pessoal e o resto, ciano. Recolhida (Ctrl+B), fica só com os ícones. Ao abrir uma tela de um grupo mais abaixo (Conteúdo e IA, Vida pessoal), a lista rola sozinha até o item dela. A página aparece como uma tela acesa, com um fio de luz na borda.
- **Celular.** O topo de vidro escuro com um fio de luz embaixo; colada nele, a faixa de abas da área (a aberta com o ícone e um traço de luz); a barra de baixo com a aba aberta acesa. A janela "Mais áreas", os menus Novo e Conta e a busca (Ctrl+K) abrem com as mesmas cores.
- A barra do sistema no celular (`theme-color`) tem a cor da cabine, `#03131a`.
- Código: o bloco "A cabine" do `src/app/globals.css` (a classe `.cabine` com as cores; `data-area` escolhe a luz) e `src/components/shell` (`barra-lateral.tsx`, `celular.tsx`, `novo.tsx` e `busca-painel.tsx`).

## Hoje (a ponte de comando do dia)

A página inicial é a ponte de comando do dia: o azul petróleo da capa do caderno no escuro, com o quadriculado do Notion virado em grade de luz e cada painel aceso na cor da sua área (rituais, tarefas e metas em verde, leitura em âmbar, projetos em violeta). Fica sempre escura, no tema claro ou escuro.

- **Capa do dia.** O número do dia em luz, o dia da semana, o mês, a saudação e a hora; a frase da capa escrita à mão (e a imagem de fundo, se escolhida em Configurações). Quando a capa tem largura para os dois, a frase vai para o lado da data; no tablet e no celular, fica embaixo.
- **Linha do dia.** Das 6h (ou antes, de madrugada) à meia-noite: o que já passou em luz, o agora pulsando e os compromissos com hora marcados na cor do tipo (reunião em violeta, aniversário em rosa, viagem em âmbar). Embaixo, o que está acontecendo ("Agora: … · até 11:00") ou o próximo ("Próximo: 10:00 Reunião · em 1 h 25").
- **Captura rápida e resumo.** O campo "›" guarda a ideia ou o link sem tipo, na Caixa de Entrada do Segundo Cérebro. As pílulas resumem o dia (rituais feitos, tarefas para hoje, atrasadas, compromissos de hoje, capturas na caixa) e levam ao painel de cada uma; no celular, rolam para o lado.
- **Rituais.** O anel verde com quanto já foi feito e os hábitos do dia por ritual (matutino, noturno…), com a contagem de cada ritual e os dias seguidos; um toque marca.
- **Para hoje e Agenda.** As tarefas que vencem hoje ou já venceram (as atrasadas primeiro, depois pela hora) e as em andamento sem data, com "Adicionar tarefa para hoje". A agenda dos próximos 7 dias, por dia, com o que já passou apagado; "Agendar" e o toque num compromisso abrem a janela ali mesmo, sem sair do dia.
- **Atalhos e resumos.** Os atalhos com o ícone aceso na cor da área do destino (no celular, os nomes longos quebram em duas linhas); as metas do ano, os livros em leitura e os projetos em andamento, com o anel, as etapas e o prazo.
- Código: `src/features/hoje` (`ponte.tsx` a página; `logica.ts` as contas de tarefas, agenda e linha do dia, testada em `tests/hoje.test.cjs`) e o bloco "Hoje: a ponte de comando do dia" do `src/app/globals.css`.

## Biblioteca (Estudos > Leitura)

A página de leitura é uma biblioteca do futuro: livros em 3D, prateleiras com luz e um painel com a meta do ano, os dias seguidos de leitura e o acervo em números.

- **Lendo agora.** O livro aberto fica no pedestal de luz, com o progresso, as páginas que faltam e, pelo seu ritmo, quando você termina. "Atualizar página" marca onde parou; com o arquivo do livro, "Continuar lendo" abre o leitor.
- **Capas e dados automáticos.** Ao adicionar um livro, a busca no Google Books (e no Open Library, se o Google não responder) preenche título, autor, páginas, editora e capa. A capa fica em `books.cover_path`: um link de endereço permitido ou um arquivo enviado ao bucket. Sem capa, o app desenha uma com as cores do título.
- **Diário de leitura.** Cada mudança de página (na biblioteca, na página do livro ou lendo no app) vira o registro do dia na coleção "Diário de leitura", criada sozinha em Coleções. Dele saem a sequência de dias, a semana e a previsão de término. Um salto grande no leitor (sumário, busca) é navegação e não entra no diário.
- **Meta do ano.** Guardada em `settings.prefs.leitura.metas`, uma por ano.
- Não precisa de migração no banco: tudo usa tabelas que já existem.

## Cursos (Estudos > Cursos)

A plataforma de cursos, com cara futurista da mesma família da biblioteca: o curso em andamento numa tela de luz, fileiras que deslizam como num streaming, a trilha das aulas e o que colocar em prática.

- **Estudando agora.** O curso em andamento com a capa, onde parou (a última aula anotada), as aulas e ações, o progresso e os botões "Continuar no Telegram" (ou na Hotmart, no Google Drive…: a plataforma sai do link), "Anotar aula" e "Trilha". Com mais de um curso em andamento, os cartões deslizam para o lado.
- **Anotar aula.** O título já vem com o número da próxima aula, seguindo a numeração das anteriores ("#F09 08 - "); escolhe o módulo, escreve o que aprendeu e o que vai praticar. A aula entra nas anotações do curso, no lugar certo da trilha.
- **Para praticar.** As caixas "- [ ]" das anotações dos cursos em andamento (como a "Modelagem (Passo a Passo)" do Notion), para marcar com um toque, com desfazer.
- **Fileiras e catálogo.** Pausados, Na fila e Concluídos; "Todos os cursos" filtra por situação e área, e a busca procura também nas anotações. "Suas competências" mostra as áreas dos cursos concluídos e em andamento.
- **Tela do curso** (`/estudos/cursos/[id]`): a capa (gerada com as iniciais e a cor da área, ou uma foto enviada), a situação, o progresso em passos de 5%, a trilha (módulos, a aula onde parou pulsando; cada aula abre com as anotações e pode ser editada), as ações, o acesso (link e e-mail, com copiar) e o caderno com todas as anotações.
- **Foco.** O botão de foco usa o timer do Flow: o tempo segue no canto da tela em qualquer página.
- Dados: tabela `courses`. As aulas e as ações saem do texto das anotações (`notes`): títulos de módulo e de aula (sem títulos, as linhas só em negrito) e caixas "- [ ]"; o app só acrescenta ou troca as linhas daquela aula ou ação. A foto da capa fica no bucket `arquivos`, registrada em `files` com `entity_type = 'curso_capa'`. Não precisa de migração no banco.

## Laboratório (Estudos > Laboratório)

O laboratório do futuro, da mesma família da biblioteca e dos cursos: vidro escuro, luz verde-menta e uma colmeia ao fundo. Serve para testar uma técnica, um hábito ou uma ferramenta por alguns dias e descobrir o que funciona.

- **Bancada.** Cada experimento em teste fica numa bancada de vidro: o dia do teste no anel de luz ("Dia 5 de 7"), a hipótese, quantos dias faltam, a faixa de sensor com um quadrado por dia (aceso nos dias com registro) e o registro do dia ali mesmo. Quando o prazo acaba, a bancada avisa e oferece "Mais 7 dias" ou "Concluir".
- **Diário.** Cada registro é um insight com `source = 'laboratorio'`, `kind = 'observação'`, o experimento e o dia (`noted_on`). Na tela do experimento dá para registrar um dia que passou, editar e apagar (com desfazer).
- **Concluir.** Funcionou, parcial ou não funcionou, a nota de 0 a 10, o que aprendeu, a conclusão e o próximo passo (virar rotina, ajustar e testar de novo, deixar de lado). Tudo vai para o protocolo, nas seções Resultado, Aprendizados-chave e Conclusão final do modelo do Notion. "Ajustar e testar de novo" cria a 2ª rodada nas ideias.
- **Novo experimento.** O que testar (ou uma das sugestões), o tipo, a hipótese, quando começa (hoje, amanhã ou mais tarde) e por quantos dias.
- **Ideias, pausados e resultados.** As ideias (anotadas num campo só) esperam em "Ideias para testar" até você começar: por 3, 7, 14, 21 ou 30 dias, ou sem prazo. Os pausados voltam com "Retomar". Os concluídos viram fichas com o resultado, a nota e o primeiro aprendizado.
- **Descobertas.** Descobertas, reflexões e ideias soltas (insights do laboratório), com o experimento de onde vieram.
- **Tela do experimento** (`/estudos/laboratorio/[id]`): o anel (ou a nota, depois de concluído), a hipótese, as ações da situação, o diário dia a dia, o protocolo em markdown, o resultado e a ficha. Links antigos com `?abrir=` levam para ela.
- Dados: tabelas `experiments` e `insights`. Não precisa de migração no banco.

## Segundo Cérebro

As telas do Segundo Cérebro (o método PARA: Projetos, Áreas, Recursos e Arquivo, mais a Caixa de Entrada, as Anotações e as Páginas) viram uma rede neural: violeta de céu noturno, pontos de luz ligados por fios ao fundo (`public/rede-neural.svg`), painéis de vidro e rótulos de HUD. Ficam sempre escuras, no tema claro ou escuro.

- **Cabeçalho.** Cada tela diz o seu papel no PARA ("Captura e triagem", "Objetivos com prazo", "Responsabilidades contínuas"…) e mostra um resumo em números. Na Caixa de Entrada: quantas capturas esperam, quantas chegaram hoje e há quantos dias espera a mais antiga. Em Projetos: em andamento, atrasados, que vencem em 7 dias e concluídos.
- **Capturas** (Caixa de Entrada, Anotações, Recursos, Arquivo e a tela da área): cartões de vidro com o ícone do tipo aceso na cor dele (ideia em âmbar, citação em rosa, link em ciano…), busca, agrupar por tag, tipo, categoria ou mês, e "Organizar" (ligar a um projeto, mover para uma área ou arquivar). No celular, os filtros de tipo e categoria ficam atrás de "Filtros". Uma captura nova começa sem tipo: sem projeto nem área, ela espera na Caixa de Entrada (como a captura rápida da página Hoje).
- **Projetos.** Cartões com o anel de progresso, a área, o prazo (atrasado em rosa, perto em âmbar) e a próxima etapa. Na tela do projeto: o anel grande, o nome (toque para renomear), as etapas e subetapas, as anotações, a ficha (área, prazo e publicação), as tarefas e as capturas ligadas.
- **Áreas.** Cada área é um núcleo com a inicial num anel de luz (com um ponto em órbita quando ela está acontecendo), a situação, a descrição e quantos projetos e capturas tem.
- **Arquivo e Páginas.** O arquivo com "Restaurar"; a árvore de páginas com as favoritas em destaque. As páginas das seções do Segundo Cérebro (notas, recursos, wiki, outras e arquivo) abrem com o mesmo tema.
- **Janelas e menus.** `TemaDasJanelas` (`src/components/ui/tema-janelas.tsx`) passa a classe do tema da tela para as janelas e os menus abertos dela.
- Código: `src/features/segundo-cerebro` (`cabecalho.tsx` com a moldura e o cabeçalho, `ui.tsx`, `paginas.tsx` e `logica.ts`, testada em `tests/segundo-cerebro.test.cjs`), `src/features/projetos`, `src/features/capturas/lista-capturas.tsx` e `src/features/paginas`. O cabeçalho com rótulo de HUD e números é o mesmo do estúdio (`src/components/ui/cabecalho-hud.tsx`). O visual fica no bloco "Segundo Cérebro: a rede neural" do `src/app/globals.css`. Não precisa de migração no banco.

## Conteúdo e IA (o estúdio)

Biblioteca, Planner e Assistente viram um estúdio de criação à noite: ameixa quase preto, a luz rosa-neon da área, faíscas ciano e violeta, ondas de som ao fundo (`public/ondas.svg`) e linhas finas de tela. Ficam sempre escuras, no tema claro ou escuro. As páginas da Biblioteca, do Planner e as conversas do assistente abrem com o mesmo tema.

- **Biblioteca.** Um curso como "Dominando a IA" aparece em módulos, como no Notion: o app lê os callouts da página do curso (título com ícone, "MÓDULO 02 - …", e os links das aulas; dentro deles, títulos sem ícone viram grupos, como VÍDEOS e SHORTS) e mostra um cartão por módulo, com as primeiras aulas e "Ver as N aulas". Os destaques soltos do curso (como RECURSOS PREMIUMS) ficam em pílulas. As outras páginas e o Planner seguem na árvore; na busca, tudo volta para a árvore.
- **Prompts.** Cada prompt é uma tela de terminal com os campos a preencher acesos ([TÓPICO], {número}) e quantos são, o módulo de onde vem, "Copiar" e "Usar no assistente". O filtro por módulo usa os módulos do curso. Os campos também acendem nos blocos de prompt dentro das páginas.
- **Planner.** O resumo do topo (ideias no banco, em produção, prontos, nos próximos 7 dias, atrasados e publicados no mês). O quadro de produção tem uma coluna acesa por etapa (Idealizando violeta, Gravando com o ponto vermelho de gravação, Editando coral, Finalizado ciano, Publicado verde); os cartões mostram o formato, a linha editorial e a data (atrasado em coral, hoje em rosa) ou as visualizações. No computador, as cinco colunas cabem lado a lado; no celular, deslizam uma por vez. Banco de ideias com campo de console e "Produzir"; calendário com os conteúdos na cor da etapa (no celular, pontos no mês e a lista embaixo); desempenho com os totais, o engajamento médio, o mais visto e o ranking com barras de luz.
- **Assistente.** O núcleo da IA (uma esfera de luz com um anel que gira mais rápido enquanto ela pensa), "Como posso ajudar hoje?" com a IA conectada, sugestões e "Escolher um prompt da biblioteca". As respostas vêm ao lado do núcleo, com Copiar e Guardar na Caixa de Entrada; o console de envio fica preso embaixo, com os campos do prompt para preencher. No celular, o texto ocupa a linha de cima do console. Sem chave de IA, o núcleo apagado leva às Configurações.
- Código: `src/features/conteudo` (`moldura.tsx` com a moldura, o cabeçalho e o título de painel; `curso-biblioteca.tsx` com os cursos em módulos; `texto-prompt.tsx`; `logica.ts` com os prompts e seus campos, os módulos do curso e os números do Planner, testada em `tests/conteudo.test.cjs`), `src/features/paginas` (Biblioteca e prompts), `src/features/planner` e `src/features/assistente`. O visual fica no bloco "Conteúdo e IA: o estúdio" do `src/app/globals.css` (`.tema-estudio`, `.estudio`, `.coluna-etapa`, `.ponto-rec`, `.orbe-ia`, `.console-ia` e `.campo-prompt`). Não precisa de migração no banco.

## Leitor de livros

Em **Estudos > Leitura**, cada livro pode ter um arquivo (PDF, EPUB, MOBI, AZW3 ou FB2) para ler dentro do app, com o texto se reorganizando na tela: tamanho e tipo de letra, espaço entre linhas, margens, temas (claro, sépia, escuro, preto), páginas ou rolagem, sumário, busca, trechos guardados nos insights e a tela acesa enquanto se lê.

- **PDF vira EPUB no próprio aparelho.** O conversor (`src/features/leitor/conversor`) lê o PDF com o pdf.js, tira cabeçalhos, rodapés, números de página e sumário com pontilhado, remonta os parágrafos, junta palavras partidas no fim da linha, acha os capítulos e as partes (pelos marcadores do PDF ou pela aparência), põe as notas de rodapé depois do parágrafo e guarda tabelas e figuras. Para decidir onde termina um parágrafo, usa o vocabulário do próprio livro (palavras com hífen, nomes como "Mecânica Quântica" partidos entre linhas). Cada parágrafo leva a página de origem, então o leitor mostra "página 12 de 64" do PDF. PDF digitalizado (só imagem) precisa passar por OCR antes.
- **Onde fica cada coisa.** O livro fica no IndexedDB do aparelho (abre sem internet). A cópia na nuvem é opcional: `arquivos/<usuário>/livros/<livro>/livro.epub`, registrada na tabela `files` com `entity_type = 'livro'`. A posição de leitura vai para `settings.prefs.leitor.posicoes` e a página lida atualiza `books.pages_read`. Não precisa de migração no banco.
- **Folha que vira.** No modo de páginas, a página vira como uma folha de papel (Ajustes > Ao virar a página: Folha, Deslizar ou Nenhum). Tocar na borda, as setas e a roda do mouse viram a folha inteira; deslizando o dedo, a folha acompanha o dedo e, ao soltar, termina de virar ou volta para o lugar. Com duas páginas lado a lado, vira pela lombada no meio. Usa a transição de telas do navegador (View Transitions), com o 3D no fim do `src/app/globals.css` e o gesto em `src/features/leitor/folha.ts`. Sem suporte no navegador ou com "reduzir movimento" ligado no aparelho, a página desliza ou troca sem animação. Para o app cuidar do gesto, o paginador do foliate-js ganhou o atributo `sem-arrastar` (anotado em `src/vendor/foliate-js/LEIAME.md`).
- **Sem internet.** O service worker guarda a tela do leitor depois de aberta e os arquivos estáticos do app.
- **Motor de leitura.** [foliate-js](https://github.com/johnfactotum/foliate-js) (MIT), copiado em `src/vendor/foliate-js`. Os arquivos do pdf.js que o navegador busca à parte são copiados para `public/pdfjs` por `scripts/copiar-pdfjs.mjs`, que roda sozinho depois do `npm install` e antes do `dev` e do `build`.

## Desempenho

Depois das telas futuristas o app ficou pesado; a medição (Playwright, CPU 4x mais lenta) apontou três causas, já corrigidas:

- **Pré-carregamento do menu.** O Next pré-carrega todo link visível, e os ~30 destinos do menu (mais os links dos painéis) disparavam dezenas de pedidos e baixavam o código de várias telas em toda abertura. Todos os links do app usam `LinkIntencao` (`src/components/ui/link-intencao.tsx`), que só pré-carrega com mouse em cima, foco ou toque. Resultado: Hoje foi de 66 para 11 pedidos e de 2,7 MB para 1,1 MB de JS; Tarefas, de 31 para 4 pedidos.
- **Desfoque de vidro.** `.vidro`, `.vidro-vivo`, `.capa-hoje`, `.console-ia` e as pílulas do cabeçalho tinham `backdrop-filter`; o fundo atrás é liso, o efeito não aparecia e cada painel custava uma camada. O desfoque ficou só onde algo rola por baixo (cabeçalho, barra de baixo, janelas e capas de imagem). A imagem fica igual (menos de 0,05% dos pixels mudam).
- **Pulo de layout na Biblioteca.** A árvore aparecia e era trocada pelo mapa dos cursos quando o texto deles chegava; agora a lista espera os cursos (`useCursosDaBiblioteca` devolve `carregando`) e os números novos entram no fim da fileira.

Para medir de novo: `next build`, `next start`, e rodar o Playwright com `Emulation.setCPUThrottlingRate` e `document.getAnimations()`. Links novos devem usar `LinkIntencao` (importe como `Link`); `backdrop-filter` só em superfícies sobre conteúdo que rola.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev
```

Estrutura principal:
- `src/app/(app)` rotas do app; `src/features/*` cada módulo; `src/components` interface compartilhada.
- `src/features/importar` leitura do .zip do Notion e gravação no Supabase.
- `src/features/hoje` a página Hoje: capa do dia, linha do dia, rituais, tarefas, agenda e resumos (`logica.ts`, testada em `tests/hoje.test.cjs`).
- `src/features/leitura` biblioteca: prateleiras, capas, busca de livros, diário e meta de leitura.
- `src/features/cursos` plataforma de cursos: trilha de aulas e ações lidas das anotações (`logica.ts`, testada em `tests/cursos.test.cjs`).
- `src/features/laboratorio` laboratório de experimentos: andamento dos testes, diário e protocolo (`logica.ts`, testada em `tests/laboratorio.test.cjs`).
- `src/features/segundo-cerebro` telas do Segundo Cérebro: moldura, cabeçalho e as contas de progresso e prazo (`logica.ts`, testada em `tests/segundo-cerebro.test.cjs`).
- `src/features/conteudo` o estúdio de Conteúdo e IA: moldura, cursos em módulos e as contas de prompts e do Planner (`logica.ts`, testada em `tests/conteudo.test.cjs`).
- `src/features/leitor` leitor de livros e conversor de PDF; a tela de leitura é `src/app/ler/[id]`.
- `supabase/migrations` esquema do banco.
