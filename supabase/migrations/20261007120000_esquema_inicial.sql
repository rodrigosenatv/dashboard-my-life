-- =====================================================================
-- Dashboard My Life — esquema inicial
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run",
-- ou rode `supabase db push` se usar a Supabase CLI.
-- Cada usuário só enxerga os próprios dados (Row Level Security).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

-- Atualiza a coluna updated_at a cada alteração.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Normaliza texto para busca sem acentos e sem diferenciar maiúsculas.
create or replace function public.normalizar(t text)
returns text
language sql
immutable
as $$
  select translate(
    lower(coalesce(t, '')),
    'áàâãäåéèêëíìîïóòôõöúùûüçñ',
    'aaaaaaeeeeiiiiooooouuuucn'
  );
$$;

-- ---------------------------------------------------------------------
-- Preferências do usuário
-- ---------------------------------------------------------------------
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Segundo Cérebro: áreas, projetos e capturas
-- ---------------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  icon text,
  status text not null default 'ativa'
    check (status in ('nao_iniciada', 'ativa', 'arquivada')),
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  icon text,
  parent_id uuid references public.projects (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  description text,
  deadline date,
  publish_date date,
  done boolean not null default false,
  done_at timestamptz,
  archived boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index projects_parent_idx on public.projects (parent_id);
create index projects_user_idx on public.projects (user_id, archived, done);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  title text not null default '',
  kind text,
  category text,
  tags text[] not null default '{}',
  url text,
  content text,
  area_id uuid references public.areas (id) on delete set null,
  archived boolean not null default false,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index captures_user_idx on public.captures (user_id, archived, captured_at desc);

create table public.capture_projects (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  capture_id uuid not null references public.captures (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (capture_id, project_id)
);
create index capture_projects_project_idx on public.capture_projects (project_id);

-- ---------------------------------------------------------------------
-- Rotina: hábitos, metas, tarefas e agenda
-- ---------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  icon text,
  color text,
  active boolean not null default true,
  -- dias da semana em que o hábito vale (0 = domingo ... 6 = sábado)
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id),
  unique (user_id, name)
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, day)
);
create index habit_logs_user_day_idx on public.habit_logs (user_id, day);

create table public.day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  note text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  tags text[] not null default '{}',
  year integer,
  target numeric,
  progress numeric not null default 0,
  unit text,
  reward text,
  deadline date,
  description text,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.goal_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  goal_id uuid references public.goals (id) on delete cascade,
  year integer not null,
  month smallint not null check (month between 1 and 12),
  target numeric,
  progress numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index goal_months_goal_idx on public.goal_months (goal_id, year, month);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text check (priority in ('urgente', 'necessario', 'bom_fazer')),
  kind text not null default 'tarefa' check (kind in ('tarefa', 'rotina')),
  due_date date,
  due_time time,
  project_id uuid references public.projects (id) on delete set null,
  description text,
  done_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index tasks_user_idx on public.tasks (user_id, status, due_date);
create index tasks_project_idx on public.tasks (project_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  category text,
  done boolean not null default false,
  location text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index events_user_idx on public.events (user_id, starts_at);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  title text not null,
  url text,
  collection text not null default 'favoritos'
    check (collection in ('ferramentas', 'favoritos', 'links')),
  tags text[] not null default '{}',
  kind text,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

-- ---------------------------------------------------------------------
-- Estudos: leitura, cursos, concursos e laboratório
-- ---------------------------------------------------------------------
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  title text not null,
  author text,
  category text,
  status text not null default 'desejo'
    check (status in ('lendo', 'finalizado', 'desejo', 'pausado')),
  pages_total integer,
  pages_read integer not null default 0,
  rating smallint check (rating between 1 and 5),
  started_at date,
  finished_at date,
  read_years integer[] not null default '{}',
  favorite boolean not null default false,
  summary text,
  cover_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  categories text[] not null default '{}',
  status text not null default 'nao_comecou'
    check (status in ('nao_comecou', 'em_andamento', 'pausado', 'concluido')),
  url text,
  access_email text,
  progress smallint check (progress between 0 and 100),
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  color text,
  exam text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  subject_id uuid references public.exam_subjects (id) on delete cascade,
  parent_id uuid references public.exam_topics (id) on delete cascade,
  name text not null,
  stage text,
  questions integer not null default 0,
  correct integer not null default 0,
  last_review date,
  next_review date,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index exam_topics_subject_idx on public.exam_topics (subject_id);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid references public.exam_subjects (id) on delete cascade,
  topic_id uuid references public.exam_topics (id) on delete cascade,
  day date not null default current_date,
  minutes integer not null default 0,
  questions integer not null default 0,
  correct integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index study_sessions_user_idx on public.study_sessions (user_id, day);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  kind text,
  status text not null default 'a_iniciar'
    check (status in ('a_iniciar', 'em_teste', 'pausado', 'concluido', 'abandonado')),
  result text check (result in ('indefinido', 'funcionou', 'parcial', 'nao_funcionou')),
  starts_on date,
  ends_on date,
  hypothesis text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  text text not null,
  source text not null default 'pessoal' check (source in ('livro', 'laboratorio', 'pessoal')),
  book_id uuid references public.books (id) on delete cascade,
  experiment_id uuid references public.experiments (id) on delete cascade,
  kind text,
  potential text,
  noted_on date,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index insights_book_idx on public.insights (book_id);
create index insights_experiment_idx on public.insights (experiment_id);

-- ---------------------------------------------------------------------
-- Conteúdo: linhas editoriais e planner
-- ---------------------------------------------------------------------
create table public.editorial_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  description text,
  color text,
  tags text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  title text not null,
  status text not null default 'ideia'
    check (status in ('ideia', 'idealizando', 'gravando', 'editando', 'finalizado', 'publicado')),
  format text,
  editorial_line_id uuid references public.editorial_lines (id) on delete set null,
  platforms text[] not null default '{}',
  publish_date date,
  media_url text,
  reference_url text,
  published_url text,
  views integer,
  likes integer,
  comments integer,
  shares integer,
  idea_type text,
  script text,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index content_items_user_idx on public.content_items (user_id, status, publish_date);

-- ---------------------------------------------------------------------
-- Páginas (biblioteca, wiki, anotações) e coleções genéricas
-- ---------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  title text not null default 'Sem título',
  icon text,
  cover_path text,
  parent_id uuid references public.pages (id) on delete cascade,
  section text not null default 'geral',
  content text not null default '',
  favorite boolean not null default false,
  position integer not null default 0,
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index pages_parent_idx on public.pages (user_id, parent_id, position);
create index pages_section_idx on public.pages (user_id, section);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  name text not null,
  icon text,
  section text not null default 'outros',
  description text,
  -- lista de propriedades: [{ "name": "...", "type": "text|number|date|select|multi_select|checkbox|url|email" , "options": [...] }]
  schema jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id text,
  collection_id uuid not null references public.collections (id) on delete cascade,
  title text not null default '',
  props jsonb not null default '{}'::jsonb,
  content text,
  cover_path text,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notion_id)
);
create index collection_items_collection_idx on public.collection_items (collection_id, position);

-- Arquivos enviados ao storage (bucket "arquivos")
create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null,
  name text not null,
  mime text,
  size bigint,
  entity_type text,
  entity_id uuid,
  source_path text,
  created_at timestamptz not null default now(),
  unique (user_id, path)
);
create index files_entity_idx on public.files (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- Gatilhos de updated_at
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'areas', 'projects', 'captures', 'habits', 'day_notes', 'goals',
    'goal_months', 'tasks', 'events', 'bookmarks', 'books', 'courses',
    'exam_subjects', 'exam_topics', 'experiments', 'insights', 'editorial_lines',
    'content_items', 'pages', 'collections', 'collection_items'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Segurança: cada usuário acessa apenas os próprios registros
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'areas', 'projects', 'captures', 'capture_projects', 'habits',
    'habit_logs', 'day_notes', 'goals', 'goal_months', 'tasks', 'events',
    'bookmarks', 'books', 'courses', 'exam_subjects', 'exam_topics',
    'study_sessions', 'experiments', 'insights', 'editorial_lines',
    'content_items', 'pages', 'collections', 'collection_items', 'files'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      'acesso do dono', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Busca global (respeita a segurança acima: roda com as permissões de quem chama)
-- ---------------------------------------------------------------------
create or replace function public.search_all(q text, max_results integer default 40)
returns table (kind text, id uuid, title text, snippet text, rank integer)
language sql
stable
security invoker
set search_path = public
as $$
  with termo as (
    select '%' || public.normalizar(trim(q)) || '%' as t
  ),
  resultados as (
    select 'pagina'::text as kind, p.id, p.title,
           left(p.content, 180) as snippet,
           case when public.normalizar(p.title) like termo.t then 0 else 1 end as rank
      from public.pages p, termo
     where public.normalizar(p.title) like termo.t
        or public.normalizar(p.content) like termo.t
    union all
    select 'projeto', pr.id, pr.name, left(coalesce(pr.description, ''), 180),
           case when public.normalizar(pr.name) like termo.t then 0 else 1 end
      from public.projects pr, termo
     where public.normalizar(pr.name) like termo.t
        or public.normalizar(pr.description) like termo.t
    union all
    select 'tarefa', ta.id, ta.title, left(coalesce(ta.description, ''), 180),
           case when public.normalizar(ta.title) like termo.t then 0 else 1 end
      from public.tasks ta, termo
     where public.normalizar(ta.title) like termo.t
        or public.normalizar(ta.description) like termo.t
    union all
    select 'captura', c.id, c.title, left(coalesce(c.content, c.url, ''), 180),
           case when public.normalizar(c.title) like termo.t then 0 else 1 end
      from public.captures c, termo
     where public.normalizar(c.title) like termo.t
        or public.normalizar(c.content) like termo.t
    union all
    select 'livro', b.id, b.title, coalesce(b.author, ''),
           case when public.normalizar(b.title) like termo.t then 0 else 1 end
      from public.books b, termo
     where public.normalizar(b.title) like termo.t
        or public.normalizar(b.author) like termo.t
        or public.normalizar(b.notes) like termo.t
    union all
    select 'curso', co.id, co.name, array_to_string(co.categories, ', '), 0
      from public.courses co, termo
     where public.normalizar(co.name) like termo.t
    union all
    select 'conteudo', ci.id, ci.title, left(coalesce(ci.script, ''), 180),
           case when public.normalizar(ci.title) like termo.t then 0 else 1 end
      from public.content_items ci, termo
     where public.normalizar(ci.title) like termo.t
        or public.normalizar(ci.script) like termo.t
    union all
    select 'insight', i.id, left(i.text, 120), coalesce(i.details, ''), 1
      from public.insights i, termo
     where public.normalizar(i.text) like termo.t
    union all
    select 'experimento', e.id, e.name, left(coalesce(e.notes, ''), 180), 0
      from public.experiments e, termo
     where public.normalizar(e.name) like termo.t
        or public.normalizar(e.notes) like termo.t
    union all
    select 'item', it.id, it.title, left(coalesce(it.content, ''), 180),
           case when public.normalizar(it.title) like termo.t then 0 else 1 end
      from public.collection_items it, termo
     where public.normalizar(it.title) like termo.t
        or public.normalizar(it.content) like termo.t
    union all
    select 'evento', ev.id, ev.title, to_char(ev.starts_at, 'DD/MM/YYYY'), 0
      from public.events ev, termo
     where public.normalizar(ev.title) like termo.t
  )
  select kind, id, title, snippet, rank
    from resultados
   where length(trim(q)) >= 2
   order by rank, title
   limit greatest(1, least(max_results, 100));
$$;

grant execute on function public.search_all(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: bucket privado "arquivos"; cada usuário usa a pasta com o próprio id
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;

create policy "arquivos: ler os próprios"
  on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "arquivos: enviar para a própria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "arquivos: atualizar os próprios"
  on storage.objects for update to authenticated
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "arquivos: apagar os próprios"
  on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = (select auth.uid())::text);
