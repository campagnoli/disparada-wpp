alter table public.ocorrencias
  add column if not exists codigo_evento text,
  add column if not exists hora_fim text;

with registros_numerados as (
  select
    id,
    coalesce(created_at, now()) at time zone 'America/Sao_Paulo' as criado_local,
    substring(linha from '[0-9]+') as numero_linha,
    row_number() over (
      partition by linha, date_trunc(
        'month',
        coalesce(created_at, now()) at time zone 'America/Sao_Paulo'
      )
      order by created_at nulls last, id
    ) as numero_evento
  from public.ocorrencias
  where codigo_evento is null
)
update public.ocorrencias as ocorrencia
set codigo_evento = to_char(registro.criado_local, 'DDMMYYYY')
  || registro.numero_linha
  || lpad(registro.numero_evento::text, greatest(3, char_length(registro.numero_evento::text)), '0')
from registros_numerados as registro
where ocorrencia.id = registro.id
  and registro.numero_linha is not null;

create unique index if not exists ocorrencias_codigo_evento_unique
  on public.ocorrencias (codigo_evento)
  where codigo_evento is not null;

drop policy if exists "Permitir atualização de ocorrencias" on public.ocorrencias;
create policy "Permitir atualização de ocorrencias"
  on public.ocorrencias for update using (true) with check (true);

create or replace function public.registrar_ocorrencia(
  p_linha text,
  p_via text,
  p_localidade text,
  p_trem text,
  p_falha text,
  p_hora_inicio text,
  p_impacto text,
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
    p_trem,
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

revoke all on function public.registrar_ocorrencia(text, text, text, text, text, text, text, text, text, text)
  from public;
grant execute on function public.registrar_ocorrencia(text, text, text, text, text, text, text, text, text, text)
  to anon, authenticated;