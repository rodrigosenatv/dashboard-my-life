\set ON_ERROR_STOP on
-- Banco PostgreSQL efêmero e isolado; nunca conectar na instância do usuário.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

do $$
declare nome text;
begin
  foreach nome in array array[
    'areas','projects','captures','capture_projects','habits','habit_logs',
    'goals','goal_months','tasks','exam_subjects','exam_topics',
    'study_sessions','books','experiments','insights','editorial_lines',
    'content_items','pages','collections','collection_items'
  ] loop
    execute format('create table public.%I (id uuid primary key, user_id uuid not null)', nome);
  end loop;
end $$;

alter table public.projects add column parent_id uuid, add column area_id uuid;
alter table public.captures add column area_id uuid;
alter table public.capture_projects add column capture_id uuid, add column project_id uuid;
alter table public.habit_logs add column habit_id uuid;
alter table public.goal_months add column goal_id uuid;
alter table public.tasks add column project_id uuid;
alter table public.exam_topics add column subject_id uuid, add column parent_id uuid;
alter table public.study_sessions add column subject_id uuid, add column topic_id uuid;
alter table public.insights add column book_id uuid, add column experiment_id uuid;
alter table public.content_items add column editorial_line_id uuid;
alter table public.pages add column parent_id uuid;
alter table public.collection_items add column collection_id uuid;

\ir ../supabase/migrations/20261023180000_limite_ia_compartilhada.sql
\ir ../supabase/migrations/20261023210000_propriedade_referencias.sql

insert into public.areas (id, user_id) values
  ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000000b');

do $$
begin
  insert into public.projects (id, user_id, area_id) values
    ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-000000000001');

  begin
    insert into public.projects (id, user_id, area_id) values
      ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-000000000001');
    raise exception 'Falha: usuário B referenciou área de A';
  exception when foreign_key_violation then null;
  end;

  begin
    update public.projects set area_id='00000000-0000-4000-8000-000000000002'
      where id='00000000-0000-4000-8000-000000000003';
    raise exception 'Falha: atualização cruzada permitida';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Testar permissão e quota como service_role, sem JWT pessoal.
set role service_role;
do $$
declare
  resposta jsonb;
  idx integer;
begin
  for idx in 1..8 loop
    select public.reservar_ia_compartilhada(
      '00000000-0000-4000-8000-00000000000a',
      ('00000000-0000-4000-8000-' || lpad(idx::text, 12, '0'))::uuid
    ) into resposta;
    if idx = 1 and resposta ->> 'permitido' <> 'true' then
      raise exception 'Primeira reserva deveria ser permitida: %', resposta;
    end if;
    perform public.liberar_ia_compartilhada(
      '00000000-0000-4000-8000-00000000000a',
      ('00000000-0000-4000-8000-' || lpad(idx::text, 12, '0'))::uuid
    );
  end loop;
  select public.reservar_ia_compartilhada(
    '00000000-0000-4000-8000-00000000000a',
    '00000000-0000-4000-8000-000000000099'
  ) into resposta;
  if resposta ->> 'motivo' <> 'usuario_hora' then
    raise exception 'Quota não bloqueou a 9ª chamada: %', resposta;
  end if;
end $$;
reset role;

set role authenticated;
do $$
begin
  begin
    perform public.reservar_ia_compartilhada(
      '00000000-0000-4000-8000-00000000000a',
      '00000000-0000-4000-8000-000000000099'
    );
    raise exception 'Cliente autenticado conseguiu reservar quota';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'Migrations de segurança validadas no PostgreSQL' as resultado;
