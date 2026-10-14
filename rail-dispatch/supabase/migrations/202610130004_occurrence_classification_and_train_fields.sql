alter table public.ocorrencias
  add column if not exists id_trem text,
  add column if not exists prefixo_viagem text,
  add column if not exists classificacoes text[] not null default '{}',
  add column if not exists tipo_in text;

update public.ocorrencias
set id_trem = trem
where id_trem is null and trem is not null;

drop function if exists public.registrar_ocorrencia(
  text, text, text, text, text, text, text, text, text[], text, text, text, text
);

drop function if exists public.registrar_ocorrencia(
  text, text, text, text, text, text, text, text, text, text
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
  p_msg_gerencia text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := clock_timestamp();
  v_hora_local timestamp := v_agora at time zone 'America/Sao_Paulo';
  v_numero_linha text := substring(p_linha from '[0-9]+');
  v_inicio_mes timestamptz;
  v_inicio_proximo_mes timestamptz;
  v_numero_evento integer;
  v_codigo_evento text;
  v_ocorrencia public.ocorrencias%rowtype;
begin
  if v_numero_linha is null then
    raise exception 'A linha precisa conter seu número.';
  end if;

  if exists (
      select 1
      from unnest(coalesce(p_classificacoes, '{}'::text[])) as item(classificacao)
      where item.classificacao is null
        or item.classificacao not in ('IN', 'COPESE', 'Desembarque')
    )
    or cardinality(coalesce(p_classificacoes, '{}'::text[])) <> (
      select count(distinct item.classificacao)
      from unnest(coalesce(p_classificacoes, '{}'::text[])) as item(classificacao)
    )
  then
    raise exception 'Selecione classificações válidas para a ocorrência.';
  end if;

  if 'IN' = any(coalesce(p_classificacoes, '{}'::text[])) then
    if p_tipo_in is null or p_tipo_in not in ('A', 'B', 'C', 'D', 'E') then
      raise exception 'Informe um tipo de IN válido entre A e E.';
    end if;
  elsif p_tipo_in is not null then
    raise exception 'O tipo de IN só pode ser informado quando IN estiver selecionada.';
  end if;

  v_inicio_mes := date_trunc('month', v_hora_local) at time zone 'America/Sao_Paulo';
  v_inicio_proximo_mes := (date_trunc('month', v_hora_local) + interval '1 month')
    at time zone 'America/Sao_Paulo';

  perform pg_advisory_xact_lock(
    hashtextextended(p_linha || to_char(v_hora_local, 'YYYYMM'), 0)
  );

  select coalesce(
    max(substring(codigo_evento from (9 + char_length(v_numero_linha))::integer)::integer),
    0
  ) + 1
  into v_numero_evento
  from public.ocorrencias
  where linha = p_linha
    and created_at >= v_inicio_mes
    and created_at < v_inicio_proximo_mes
    and codigo_evento is not null;

  v_codigo_evento := to_char(v_hora_local, 'DDMMYYYY')
    || v_numero_linha
    || lpad(v_numero_evento::text, greatest(3, char_length(v_numero_evento::text)), '0');

  insert into public.ocorrencias (
    codigo_evento,
    created_at,
    linha,
    via,
    localidade,
    id_trem,
    prefixo_viagem,
    classificacoes,
    tipo_in,
    trem,
    falha,
    hora_inicio,
    impacto,
    msg_comunicacao,
    msg_operacao,
    msg_gerencia
  ) values (
    v_codigo_evento,
    v_agora,
    p_linha,
    p_via,
    p_localidade,
    p_id_trem,
    p_prefixo_viagem,
    coalesce(p_classificacoes, '{}'::text[]),
    p_tipo_in,
    p_id_trem,
    p_falha,
    p_hora_inicio,
    p_impacto,
    p_msg_comunicacao,
    p_msg_operacao,
    p_msg_gerencia
  )
  returning * into v_ocorrencia;

  return jsonb_build_object(
    'id', v_ocorrencia.id,
    'codigo_evento', v_ocorrencia.codigo_evento,
    'created_at', v_ocorrencia.created_at,
    'status', v_ocorrencia.status
  );
end;
$$;

revoke all on function public.registrar_ocorrencia(
  text, text, text, text, text, text, text, text, text[], text, text, text, text
) from public;
grant execute on function public.registrar_ocorrencia(
  text, text, text, text, text, text, text, text, text[], text, text, text, text
) to anon, authenticated;
