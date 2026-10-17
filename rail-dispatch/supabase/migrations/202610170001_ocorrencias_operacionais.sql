-- =============================================================================
-- Migração: 202610170001_ocorrencias_operacionais.sql
-- Descrição: Criação da tabela de ocorrências operacionais (4º grupo - WhatsApp)
-- =============================================================================

create table if not exists public.ocorrencias_operacionais (
  id uuid primary key default gen_random_uuid(),
  linha text not null,
  tipo_ocorrencia text not null,
  local text not null,
  horario text not null,
  descritivo text not null,
  cronologia jsonb not null default '[]'::jsonb,
  aas_asl text,
  cps text,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'encerrada')),
  group_id_whatsapp text not null,
  mensagem_formatada text,
  disparado_whatsapp boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ocorrencias_operacionais_status_idx
  on public.ocorrencias_operacionais (status);

create index if not exists ocorrencias_operacionais_criado_em_idx
  on public.ocorrencias_operacionais (criado_em desc);

create index if not exists ocorrencias_operacionais_grupo_idx
  on public.ocorrencias_operacionais (group_id_whatsapp);

-- Habilitar Row Level Security (RLS)
alter table public.ocorrencias_operacionais enable row level security;

-- Política de leitura: qualquer usuário pode ler
drop policy if exists "Leitura de ocorrencias operacionais" on public.ocorrencias_operacionais;
create policy "Leitura de ocorrencias operacionais"
  on public.ocorrencias_operacionais
  for select
  using (true);

-- Política de escrita: somente service_role (rotas de API do backend)
drop policy if exists "Modificacao restrita a service_role" on public.ocorrencias_operacionais;
create policy "Modificacao restrita a service_role"
  on public.ocorrencias_operacionais
  for all
  using (auth.role() = 'service_role');

-- Conceder permissões apenas ao service_role
revoke all on public.ocorrencias_operacionais from anon, authenticated;
grant select, insert, update, delete on public.ocorrencias_operacionais to service_role;
grant usage, select on sequence public.ocorrencias_operacionais_id_seq to service_role;