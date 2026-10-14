alter table public.falhas_predefinidas
  add column if not exists impacto text not null default '';

update public.falhas_predefinidas
set impacto = case lower(descricao)
  when 'alagamento' then 'Devido ao alagamento, os trens estão circulando com velocidade reduzida.'
  when 'trilho partido' then 'Devido ao trilho partido, a circulação dos trens está impactada no trecho afetado.'
  when 'falha de tração' then 'Devido à falha de tração, o trem afetado está com a circulação comprometida.'
  else impacto
end
where impacto = '';

update public.falhas_predefinidas
set impacto = 'Impacto operacional a ser informado.'
where trim(impacto) = '';

insert into public.falhas_predefinidas (descricao, impacto, ordem)
select seed.descricao, seed.impacto, seed.ordem
from (values
  ('Alagamento', 'Devido ao alagamento, os trens estão circulando com velocidade reduzida.', 1),
  ('Trilho partido', 'Devido ao trilho partido, a circulação dos trens está impactada no trecho afetado.', 2),
  ('Falha de tração', 'Devido à falha de tração, o trem afetado está com a circulação comprometida.', 3)
) as seed(descricao, impacto, ordem)
where not exists (
  select 1
  from public.falhas_predefinidas existing
  where lower(existing.descricao) = lower(seed.descricao)
);

alter table public.falhas_predefinidas
  drop constraint if exists falhas_predefinidas_impacto_check,
  add constraint falhas_predefinidas_impacto_check
    check (char_length(trim(impacto)) between 1 and 500);
