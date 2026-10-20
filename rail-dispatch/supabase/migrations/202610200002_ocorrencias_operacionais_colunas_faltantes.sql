-- =============================================================================
-- Migração: 202610200002_ocorrencias_operacionais_colunas_faltantes.sql
-- Descrição: Garante que a tabela ocorrencias_operacionais tenha as colunas
--            previstas pela migração 202610170001. Em alguns ambientes a
--            tabela foi criada sem group_id_whatsapp, mensagem_formatada e
--            disparado_whatsapp, o que fazia o INSERT falhar e impedia o
--            envio das mensagens ao grupo Ocorrências Operacionais.
-- =============================================================================

alter table public.ocorrencias_operacionais
  add column if not exists group_id_whatsapp text not null default '',
  add column if not exists mensagem_formatada text,
  add column if not exists disparado_whatsapp boolean not null default false;

create index if not exists ocorrencias_operacionais_grupo_idx
  on public.ocorrencias_operacionais (group_id_whatsapp);
