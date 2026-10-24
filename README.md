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

## Leitor de livros

Em **Estudos > Leitura**, cada livro pode ter um arquivo (PDF, EPUB, MOBI, AZW3 ou FB2) para ler dentro do app, com o texto se reorganizando na tela: tamanho e tipo de letra, espaço entre linhas, margens, temas (claro, sépia, escuro, preto), páginas ou rolagem, sumário, busca, trechos guardados nos insights e a tela acesa enquanto se lê.

- **PDF vira EPUB no próprio aparelho.** O conversor (`src/features/leitor/conversor`) lê o PDF com o pdf.js, tira cabeçalhos, rodapés, números de página e sumário com pontilhado, remonta os parágrafos, junta palavras partidas no fim da linha, acha os capítulos e as partes (pelos marcadores do PDF ou pela aparência), põe as notas de rodapé depois do parágrafo e guarda tabelas e figuras. Para decidir onde termina um parágrafo, usa o vocabulário do próprio livro (palavras com hífen, nomes como "Mecânica Quântica" partidos entre linhas). Cada parágrafo leva a página de origem, então o leitor mostra "página 12 de 64" do PDF. PDF digitalizado (só imagem) precisa passar por OCR antes.
- **Onde fica cada coisa.** O livro fica no IndexedDB do aparelho (abre sem internet). A cópia na nuvem é opcional: `arquivos/<usuário>/livros/<livro>/livro.epub`, registrada na tabela `files` com `entity_type = 'livro'`. A posição de leitura vai para `settings.prefs.leitor.posicoes` e a página lida atualiza `books.pages_read`. Não precisa de migração no banco.
- **Sem internet.** O service worker guarda a tela do leitor depois de aberta e os arquivos estáticos do app.
- **Motor de leitura.** [foliate-js](https://github.com/johnfactotum/foliate-js) (MIT), copiado em `src/vendor/foliate-js`. Os arquivos do pdf.js que o navegador busca à parte são copiados para `public/pdfjs` por `scripts/copiar-pdfjs.mjs`, que roda sozinho depois do `npm install` e antes do `dev` e do `build`.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev
```

Estrutura principal:
- `src/app/(app)` rotas do app; `src/features/*` cada módulo; `src/components` interface compartilhada.
- `src/features/importar` leitura do .zip do Notion e gravação no Supabase.
- `src/features/leitor` leitor de livros e conversor de PDF; a tela de leitura é `src/app/ler/[id]`.
- `supabase/migrations` esquema do banco.
