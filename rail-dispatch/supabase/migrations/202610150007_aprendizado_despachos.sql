create table if not exists public.aprendizado_despachos (
  id uuid primary key default gen_random_uuid(),
  linha text not null,
  tipo_evento text not null,
  dados_ocorrencia jsonb not null,
  mensagem_ia text not null,
  mensagem_final_sco text not null,
  tipo_grupo text not null check (tipo_grupo in ('comunicacao', 'operacao', 'gerencia')),
  houve_edicao boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists aprendizado_despachos_linha_edicao_criado_idx
  on public.aprendizado_despachos (linha, houve_edicao, criado_em desc);

create index if not exists aprendizado_despachos_edicao_criado_idx
  on public.aprendizado_despachos (criado_em desc)
  where houve_edicao = true;

alter table public.aprendizado_despachos enable row level security;

revoke all on public.aprendizado_despachos from anon, authenticated;
grant select, insert on public.aprendizado_despachos to service_role;
