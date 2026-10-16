alter table public.ocorrencias
  add column if not exists entregue_com_restricao boolean not null default false,
  add column if not exists descricao_restricao text,
  add column if not exists relatar_atuacao boolean not null default false,
  add column if not exists descricao_atuacao text;
