create table if not exists public.falhas_predefinidas (
  id bigint generated always as identity primary key,
  descricao text not null check (char_length(trim(descricao)) between 1 and 120),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists falhas_predefinidas_descricao_unique
  on public.falhas_predefinidas (lower(descricao));

alter table public.falhas_predefinidas enable row level security;

grant select, insert, update, delete on public.falhas_predefinidas to service_role;
grant usage, select on sequence public.falhas_predefinidas_id_seq to service_role;

insert into public.falhas_predefinidas (descricao, ordem)
select seed.descricao, seed.ordem
from (values
  ('Alagamento', 1),
  ('Trilho partido', 2),
  ('Falha de tração', 3)
) as seed(descricao, ordem)
where not exists (
  select 1
  from public.falhas_predefinidas existing
  where lower(existing.descricao) = lower(seed.descricao)
);
