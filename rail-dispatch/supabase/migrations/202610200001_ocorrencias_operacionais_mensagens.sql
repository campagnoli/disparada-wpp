-- =============================================================================
-- Migração: 202610200001_ocorrencias_operacionais_mensagens.sql
-- Descrição: Histórico de mensagens enviadas para o grupo Ocorrências
--            Operacionais. Cada atualização de cronologia gera um novo
--            registro, preservando a ordem cronológica dos envios.
-- =============================================================================

create table if not exists public.ocorrencias_operacionais_mensagens (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias_operacionais (id) on delete cascade,
  tipo text not null default 'atualizacao_cronologia'
    check (tipo in ('criacao', 'atualizacao_cronologia', 'encerramento')),
  mensagem text not null,
  cronologia jsonb not null default '[]'::jsonb,
  whatsapp_message_id text,
  whatsapp_remote_jid text,
  sucesso boolean not null default false,
  erro text,
  criado_em timestamptz not null default now()
);

create index if not exists ocorrencias_operacionais_mensagens_ocorrencia_idx
  on public.ocorrencias_operacionais_mensagens (ocorrencia_id, criado_em desc);

create index if not exists ocorrencias_operacionais_mensagens_whatsapp_idx
  on public.ocorrencias_operacionais_mensagens (whatsapp_message_id)
  where whatsapp_message_id is not null;

alter table public.ocorrencias_operacionais_mensagens enable row level security;

drop policy if exists "Leitura de mensagens operacionais" on public.ocorrencias_operacionais_mensagens;
create policy "Leitura de mensagens operacionais"
  on public.ocorrencias_operacionais_mensagens
  for select
  using (true);

drop policy if exists "Modificacao restrita a service_role" on public.ocorrencias_operacionais_mensagens;
create policy "Modificacao restrita a service_role"
  on public.ocorrencias_operacionais_mensagens
  for all
  using (auth.role() = 'service_role');

revoke all on public.ocorrencias_operacionais_mensagens from anon, authenticated;
grant select, insert, update, delete on public.ocorrencias_operacionais_mensagens to service_role;
