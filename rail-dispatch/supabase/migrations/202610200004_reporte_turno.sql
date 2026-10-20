-- =============================================================================
-- Migração: 202610200004_reporte_turno.sql
-- Descrição: Reporte Operacional Periódico (09h/21h), frota por linha,
--            histórico de envios e visão de compatibilidade do histórico.
-- =============================================================================

create table if not exists public.configuracao_frota_linhas (
  id uuid primary key default gen_random_uuid(),
  numero_linha integer not null unique check (numero_linha in (11, 12, 13)),
  nome_linha text not null,
  trens_operacionais integer not null check (trens_operacionais >= 0),
  trens_reserva integer not null default 0 check (trens_reserva >= 0),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

insert into public.configuracao_frota_linhas
  (numero_linha, nome_linha, trens_operacionais, trens_reserva, ativo)
values
  (11, 'Linha 11-Coral', 31, 1, true),
  (12, 'Linha 12-Safira', 22, 1, true),
  (13, 'Linha 13-Jade', 5, 1, true)
on conflict (numero_linha) do nothing;

create table if not exists public.historico_reportes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno text not null check (turno in ('09h', '21h')),
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null,
  texto text not null,
  sco text,
  frota jsonb not null default '[]'::jsonb,
  resumos jsonb,
  grupos jsonb not null default '[]'::jsonb,
  resultados jsonb not null default '[]'::jsonb,
  status text not null default 'erro' check (status in ('sucesso', 'parcial', 'erro')),
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);

create index if not exists historico_reportes_data_turno_idx
  on public.historico_reportes (data desc, turno);

create index if not exists historico_reportes_criado_em_idx
  on public.historico_reportes (criado_em desc);

-- Mantém compatibilidade com o nome usado pelo Reporte para consultar os
-- despachos tradicionais. A tabela operacional da aplicação é public.ocorrencias.
do $$
begin
  if to_regclass('public.historico_despachos') is null then
    execute $view$
      create view public.historico_despachos
      with (security_invoker = true)
      as
      select
        id,
        codigo_evento,
        created_at,
        linha,
        via,
        localidade,
        falha,
        hora_inicio,
        hora_fim,
        status,
        impacto,
        msg_operacao
      from public.ocorrencias
    $view$;
  end if;
end $$;

comment on table public.configuracao_frota_linhas is
  'Frota nominal operacional e reserva por linha usada no Reporte de Turno.';

comment on table public.historico_reportes is
  'Auditoria dos Reportes Operacionais Periódicos compilados e enviados.';

alter table public.configuracao_frota_linhas enable row level security;
alter table public.historico_reportes enable row level security;

drop policy if exists "service_role_configuracao_frota_linhas" on public.configuracao_frota_linhas;
create policy "service_role_configuracao_frota_linhas"
  on public.configuracao_frota_linhas
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_historico_reportes" on public.historico_reportes;
create policy "service_role_historico_reportes"
  on public.historico_reportes
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.configuracao_frota_linhas from anon, authenticated;
revoke all on public.historico_reportes from anon, authenticated;

grant all on public.configuracao_frota_linhas to service_role;
grant all on public.historico_reportes to service_role;
grant select on public.historico_despachos to service_role;
