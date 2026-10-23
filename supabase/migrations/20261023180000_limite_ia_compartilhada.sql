-- Controle atômico de quota para a chave compartilhada da IA.
-- Esta migration DEVE ser aplicada antes de habilitar SUPABASE_SERVICE_ROLE_KEY na Vercel.
-- Nenhuma tabela de domínio existente é alterada.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;

create table if not exists app_private.ia_compartilhada_quotas (
  escopo text not null,
  janela timestamptz not null,
  quantidade integer not null check (quantidade >= 0),
  primary key (escopo, janela)
);
create table if not exists app_private.ia_compartilhada_ativas (
  ticket uuid primary key,
  usuario uuid not null,
  expira_em timestamptz not null
);
create index if not exists ia_compartilhada_ativas_usuario_idx
  on app_private.ia_compartilhada_ativas (usuario, expira_em);

alter table app_private.ia_compartilhada_quotas enable row level security;
alter table app_private.ia_compartilhada_ativas enable row level security;
revoke all on app_private.ia_compartilhada_quotas, app_private.ia_compartilhada_ativas
  from public, anon, authenticated;
grant select, insert, update, delete
  on app_private.ia_compartilhada_quotas, app_private.ia_compartilhada_ativas
  to service_role;

-- Invoker: somente a service_role tem EXECUTE. Clientes autenticados não podem
-- reservar tickets diretamente para esgotar a quota global de outras pessoas.
create or replace function public.reservar_ia_compartilhada(
  p_usuario uuid,
  p_ticket uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  instante timestamptz := clock_timestamp();
  hora_utc timestamptz;
  dia_utc timestamptz;
  uso_usuario integer;
  uso_global integer;
  ocupacao_usuario integer;
  ocupacao_global integer;
  escopo_usuario text;
begin
  if p_usuario is null or p_ticket is null then
    raise exception 'identificador inválido';
  end if;

  -- Serializa a verificação + reserva entre instâncias e requisições simultâneas.
  perform pg_catalog.pg_advisory_xact_lock(7620261023001::bigint);
  delete from app_private.ia_compartilhada_ativas where expira_em <= instante;
  delete from app_private.ia_compartilhada_quotas
    where janela < instante - interval '2 days';

  hora_utc := pg_catalog.date_trunc('hour', instante at time zone 'UTC') at time zone 'UTC';
  dia_utc := pg_catalog.date_trunc('day', instante at time zone 'UTC') at time zone 'UTC';
  escopo_usuario := 'usuario:' || p_usuario::text;

  select quantidade into uso_usuario from app_private.ia_compartilhada_quotas
    where escopo = escopo_usuario and janela = hora_utc;
  select quantidade into uso_global from app_private.ia_compartilhada_quotas
    where escopo = 'global' and janela = dia_utc;

  if coalesce(uso_usuario, 0) >= 8 then
    return pg_catalog.jsonb_build_object(
      'permitido', false, 'motivo', 'usuario_hora',
      'retryAfter', greatest(1, ceil(extract(epoch from (hora_utc + interval '1 hour' - instante)))::integer)
    );
  end if;
  if coalesce(uso_global, 0) >= 60 then
    return pg_catalog.jsonb_build_object(
      'permitido', false, 'motivo', 'global_dia',
      'retryAfter', greatest(1, ceil(extract(epoch from (dia_utc + interval '1 day' - instante)))::integer)
    );
  end if;

  select count(*) into ocupacao_usuario from app_private.ia_compartilhada_ativas
    where usuario = p_usuario;
  select count(*) into ocupacao_global from app_private.ia_compartilhada_ativas;

  if ocupacao_usuario >= 1 or ocupacao_global >= 4 then
    return pg_catalog.jsonb_build_object(
      'permitido', false, 'motivo', 'concorrencia', 'retryAfter', 15
    );
  end if;

  insert into app_private.ia_compartilhada_quotas (escopo, janela, quantidade)
    values (escopo_usuario, hora_utc, 1)
    on conflict (escopo, janela) do update
      set quantidade = app_private.ia_compartilhada_quotas.quantidade + 1;
  insert into app_private.ia_compartilhada_quotas (escopo, janela, quantidade)
    values ('global', dia_utc, 1)
    on conflict (escopo, janela) do update
      set quantidade = app_private.ia_compartilhada_quotas.quantidade + 1;
  insert into app_private.ia_compartilhada_ativas (ticket, usuario, expira_em)
    values (p_ticket, p_usuario, instante + interval '8 minutes');

  return pg_catalog.jsonb_build_object('permitido', true);
end;
$$;

revoke all on function public.reservar_ia_compartilhada(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reservar_ia_compartilhada(uuid, uuid) to service_role;

create or replace function public.liberar_ia_compartilhada(
  p_usuario uuid,
  p_ticket uuid
) returns void
language sql
security invoker
set search_path = ''
as $$
  delete from app_private.ia_compartilhada_ativas
  where ticket = p_ticket and usuario = p_usuario;
$$;

revoke all on function public.liberar_ia_compartilhada(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.liberar_ia_compartilhada(uuid, uuid) to service_role;
