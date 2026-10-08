# My Life

Webapp pessoal que substitui o template **Dashboard My Life** do Notion: rotina (hábitos, tarefas, agenda, metas), projetos (segundo cérebro, capturas, notas), estudos (leitura, cursos, concursos, laboratório) e conteúdo com IA (biblioteca de prompts, planner, assistente).

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
   - `ANTHROPIC_API_KEY` (opcional: as chaves de IA do Claude, ChatGPT e Gemini também podem ser cadastradas em Configurações, guardadas só no navegador)
3. Clique em **Deploy**.

### 3. Login
1. No Supabase, **Authentication > URL Configuration**: em *Site URL* coloque o endereço da Vercel (ex.: `https://dashboard-my-life.vercel.app`) e em *Redirect URLs* adicione `https://SEU-ENDERECO/auth/callback`.
2. Abra o app, crie sua conta e confirme pelo e-mail.
3. Depois de criar a sua conta, desligue novos cadastros em **Authentication > Sign In / Providers > Allow new users to sign up**.

### 4. Importar o Notion
1. No Notion: **Configurações > Geral > Exportar todo o conteúdo**, formato *Markdown & CSV*, incluindo arquivos e subpáginas.
2. No app: **Configurações > Importar do Notion**, escolha o .zip, confira o resumo e importe.
3. A página *Senhas* e os campos de senha dos cursos não são importados. Importar de novo substitui só o que veio do Notion.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev
```

Estrutura principal:
- `src/app/(app)` rotas do app; `src/features/*` cada módulo; `src/components` interface compartilhada.
- `src/features/importar` leitura do .zip do Notion e gravação no Supabase.
- `supabase/migrations` esquema do banco.
