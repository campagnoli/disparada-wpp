-- =============================================================================
-- Migração: 202610200005_ocorrencias_operacionais_codigo_evento.sql
-- Descrição: Vincula a ocorrência operacional ao ID do evento tradicional.
-- =============================================================================

alter table public.ocorrencias_operacionais
  add column if not exists codigo_evento text;

create index if not exists ocorrencias_operacionais_codigo_evento_idx
  on public.ocorrencias_operacionais (codigo_evento);

comment on column public.ocorrencias_operacionais.codigo_evento is
  'ID do evento da ocorrência tradicional (public.ocorrencias.codigo_evento).';
