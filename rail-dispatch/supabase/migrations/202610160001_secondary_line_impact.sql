alter table public.ocorrencias
  add column if not exists tem_impacto_outra_linha boolean not null default false,
  add column if not exists linhas_impactadas_secundarias text[] not null default '{}',
  add column if not exists descricao_impacto_secundario text;

drop function if exists public.registrar_ocorrencia(
  text, text, text, text, text, text, text, text, text[], text,
  text, text, text, boolean, text[], text
);

create function public.registrar_ocorrencia(
  p_linha text,
  p_via text,
  p_localidade text,
  p_id_trem text,
  p_prefixo_viagem text,
  p_falha text,
  p_hora_inicio text,
  p_impacto text,
  p_classificacoes text[],
  p_tipo_in text,
  p_msg_comunicacao text,
  p_msg_operacao text,
  p_msg_gerencia text,
  p_paese_acionado boolean,
  p_paese_modalidades text[],
  p_paese_trecho text,
  p_tem_impacto_outra_linha boolean,
  p_linhas_impactadas_secundarias text[],
  p_descricao_impacto_secundario text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ocorrencia jsonb;
  v_codigo_evento text;
  v_modalidades text[] := coalesce(p_paese_modalidades, '{}'::text[]);
  v_trecho text := nullif(btrim(p_paese_trecho), '');
  v_linhas_secundarias text[] := coalesce(p_linhas_impactadas_secundarias, '{}'::text[]);
  v_descricao_secundaria text := nullif(btrim(p_descricao_impacto_secundario), '');
begin
  if p_paese_acionado then
    if cardinality(v_modalidades) = 0
      or exists (
        select 1
        from unnest(v_modalidades) as item(modalidade)
        where item.modalidade not in ('SPTrans', 'ARTESP', 'Trilhos')
      )
      or cardinality(v_modalidades) <> (
        select count(distinct item.modalidade)
        from unnest(v_modalidades) as item(modalidade)
      )
      or v_trecho is null
      or char_length(v_trecho) > 200
    then
      raise exception 'Informe o trecho e ao menos um tipo válido de PAESE (SPTrans, ARTESP ou Trilhos).';
    end if;
  else
    v_modalidades := '{}'::text[];
    v_trecho := null;
  end if;

  if coalesce(p_tem_impacto_outra_linha, false) then
    if cardinality(v_linhas_secundarias) = 0
      or exists (
        select 1
        from unnest(v_linhas_secundarias) as item(linha)
        where item.linha is null
          or item.linha not in ('Linha 11-Coral', 'Linha 12-Safira', 'Linha 13-Jade')
          or item.linha = p_linha
      )
      or cardinality(v_linhas_secundarias) <> (
        select count(distinct item.linha)
        from unnest(v_linhas_secundarias) as item(linha)
      )
      or v_descricao_secundaria is null
      or char_length(v_descricao_secundaria) > 5000
    then
      raise exception 'Informe ao menos uma linha secundária diferente da principal e descreva o impacto (até 5000 caracteres).';
    end if;
  else
    v_linhas_secundarias := '{}'::text[];
    v_descricao_secundaria := null;
  end if;

  v_ocorrencia := public.registrar_ocorrencia(
    p_linha,
    p_via,
    p_localidade,
    p_id_trem,
    p_prefixo_viagem,
    p_falha,
    p_hora_inicio,
    p_impacto,
    p_classificacoes,
    p_tipo_in,
    p_msg_comunicacao,
    p_msg_operacao,
    p_msg_gerencia
  );
  v_codigo_evento := v_ocorrencia ->> 'codigo_evento';

  update public.ocorrencias
  set
    paese_acionado = coalesce(p_paese_acionado, false),
    paese_modalidades = v_modalidades,
    paese_trecho = v_trecho,
    tem_impacto_outra_linha = coalesce(p_tem_impacto_outra_linha, false),
    linhas_impactadas_secundarias = v_linhas_secundarias,
    descricao_impacto_secundario = v_descricao_secundaria
  where codigo_evento = v_codigo_evento;

  return v_ocorrencia;
end;
$$;

revoke all on function public.registrar_ocorrencia(
  text, text, text, text, text, text, text, text, text[], text,
  text, text, text, boolean, text[], text, boolean, text[], text
) from public;

grant execute on function public.registrar_ocorrencia(
  text, text, text, text, text, text, text, text, text[], text,
  text, text, text, boolean, text[], text, boolean, text[], text
) to anon, authenticated;
