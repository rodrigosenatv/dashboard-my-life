-- Impeça relações entre usuários diferentes sem alterar os registros atuais.
-- Antes da aplicação, consultar os relacionamentos já existentes; a trigger
-- bloqueia novas relações inválidas, mas não modifica ou apaga dados históricos.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- SECURITY DEFINER é necessário para verificar propriedade sem depender da
-- política SELECT RLS do registro pai. Função fora do schema exposto da API.
create or replace function app_private.verificar_dono_referencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  valor text;
  permitido boolean;
begin
  valor := pg_catalog.to_jsonb(new) ->> tg_argv[1];
  if valor is null or valor = '' then return new; end if;

  execute pg_catalog.format(
    'select exists (select 1 from public.%I where id = $1 and user_id = $2)',
    tg_argv[0]
  ) into permitido using valor::uuid, new.user_id;

  if not permitido then
    raise exception 'Relação inválida ou não autorizada' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function app_private.verificar_dono_referencia()
  from public, anon, authenticated;

drop trigger if exists verificar_dono_parent_id_projects on public.projects;
create trigger verificar_dono_parent_id_projects
  before insert or update of parent_id, user_id on public.projects
  for each row execute function app_private.verificar_dono_referencia('projects', 'parent_id');

drop trigger if exists verificar_dono_area_id_areas on public.projects;
create trigger verificar_dono_area_id_areas
  before insert or update of area_id, user_id on public.projects
  for each row execute function app_private.verificar_dono_referencia('areas', 'area_id');

drop trigger if exists verificar_dono_area_id_areas on public.captures;
create trigger verificar_dono_area_id_areas
  before insert or update of area_id, user_id on public.captures
  for each row execute function app_private.verificar_dono_referencia('areas', 'area_id');

drop trigger if exists verificar_dono_capture_id_captures on public.capture_projects;
create trigger verificar_dono_capture_id_captures
  before insert or update of capture_id, user_id on public.capture_projects
  for each row execute function app_private.verificar_dono_referencia('captures', 'capture_id');

drop trigger if exists verificar_dono_project_id_projects on public.capture_projects;
create trigger verificar_dono_project_id_projects
  before insert or update of project_id, user_id on public.capture_projects
  for each row execute function app_private.verificar_dono_referencia('projects', 'project_id');

drop trigger if exists verificar_dono_habit_id_habits on public.habit_logs;
create trigger verificar_dono_habit_id_habits
  before insert or update of habit_id, user_id on public.habit_logs
  for each row execute function app_private.verificar_dono_referencia('habits', 'habit_id');

drop trigger if exists verificar_dono_goal_id_goals on public.goal_months;
create trigger verificar_dono_goal_id_goals
  before insert or update of goal_id, user_id on public.goal_months
  for each row execute function app_private.verificar_dono_referencia('goals', 'goal_id');

drop trigger if exists verificar_dono_project_id_projects on public.tasks;
create trigger verificar_dono_project_id_projects
  before insert or update of project_id, user_id on public.tasks
  for each row execute function app_private.verificar_dono_referencia('projects', 'project_id');

drop trigger if exists verificar_dono_subject_id_exam_subjects on public.exam_topics;
create trigger verificar_dono_subject_id_exam_subjects
  before insert or update of subject_id, user_id on public.exam_topics
  for each row execute function app_private.verificar_dono_referencia('exam_subjects', 'subject_id');

drop trigger if exists verificar_dono_parent_id_exam_topics on public.exam_topics;
create trigger verificar_dono_parent_id_exam_topics
  before insert or update of parent_id, user_id on public.exam_topics
  for each row execute function app_private.verificar_dono_referencia('exam_topics', 'parent_id');

drop trigger if exists verificar_dono_subject_id_exam_subjects on public.study_sessions;
create trigger verificar_dono_subject_id_exam_subjects
  before insert or update of subject_id, user_id on public.study_sessions
  for each row execute function app_private.verificar_dono_referencia('exam_subjects', 'subject_id');

drop trigger if exists verificar_dono_topic_id_exam_topics on public.study_sessions;
create trigger verificar_dono_topic_id_exam_topics
  before insert or update of topic_id, user_id on public.study_sessions
  for each row execute function app_private.verificar_dono_referencia('exam_topics', 'topic_id');

drop trigger if exists verificar_dono_book_id_books on public.insights;
create trigger verificar_dono_book_id_books
  before insert or update of book_id, user_id on public.insights
  for each row execute function app_private.verificar_dono_referencia('books', 'book_id');

drop trigger if exists verificar_dono_experiment_id_experiments on public.insights;
create trigger verificar_dono_experiment_id_experiments
  before insert or update of experiment_id, user_id on public.insights
  for each row execute function app_private.verificar_dono_referencia('experiments', 'experiment_id');

drop trigger if exists verificar_dono_editorial_line_id_editorial_lines on public.content_items;
create trigger verificar_dono_editorial_line_id_editorial_lines
  before insert or update of editorial_line_id, user_id on public.content_items
  for each row execute function app_private.verificar_dono_referencia('editorial_lines', 'editorial_line_id');

drop trigger if exists verificar_dono_parent_id_pages on public.pages;
create trigger verificar_dono_parent_id_pages
  before insert or update of parent_id, user_id on public.pages
  for each row execute function app_private.verificar_dono_referencia('pages', 'parent_id');

drop trigger if exists verificar_dono_collection_id_collections on public.collection_items;
create trigger verificar_dono_collection_id_collections
  before insert or update of collection_id, user_id on public.collection_items
  for each row execute function app_private.verificar_dono_referencia('collections', 'collection_id');
