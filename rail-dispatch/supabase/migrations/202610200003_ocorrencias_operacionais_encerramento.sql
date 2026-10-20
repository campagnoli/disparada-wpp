-- =============================================================================
-- Migração: 202610200003_ocorrencias_operacionais_encerramento.sql
-- Descrição: Campos de encerramento das ocorrências operacionais
-- =============================================================================

alter table public.ocorrencias_operacionais
  add column if not exists horario_fim text,
  add column if not exists entregue_com_restricao boolean not null default false,
  add column if not exists descricao_restricao text,
  add column if not exists relatar_atuacao boolean not null default false,
  add column if not exists descricao_atuacao text;

comment on column public.ocorrencias_operacionais.horario_fim is
  'Horário de encerramento da ocorrência (HH:MM).';
comment on column public.ocorrencias_operacionais.entregue_com_restricao is
  'Indica se a operação foi entregue com restrição.';
comment on column public.ocorrencias_operacionais.descricao_restricao is
  'Descrição da restrição mantida após o encerramento.';
comment on column public.ocorrencias_operacionais.relatar_atuacao is
  'Indica se a atuação deve ser relatada na mensagem de encerramento.';
comment on column public.ocorrencias_operacionais.descricao_atuacao is
  'Descrição da atuação realizada.';
