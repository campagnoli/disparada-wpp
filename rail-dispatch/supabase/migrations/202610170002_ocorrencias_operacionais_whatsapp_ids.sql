-- =============================================================================
-- Migração: 202610170002_ocorrencias_operacionais_whatsapp_ids.sql
-- Descrição: Adiciona campos de identificação da mensagem WhatsApp (Evolution API)
-- para permitir futuras exclusões/atualizações via API.
-- =============================================================================

alter table public.ocorrencias_operacionais
  add column if not exists whatsapp_message_id text,
  add column if not exists whatsapp_remote_jid text;

create index if not exists ocorrencias_operacionais_whatsapp_message_id_idx
  on public.ocorrencias_operacionais (whatsapp_message_id)
  where whatsapp_message_id is not null;