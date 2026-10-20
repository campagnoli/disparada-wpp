import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizarCronologia } from '@/lib/ocorrencias-operacionais/normalizar';
import { erroEstruturaReporte, mensagemErroEstruturaReporte } from '@/lib/reporte-turno/frota';
import { formatarDataHoraSaoPaulo } from '@/lib/reporte-turno/periodo';
import {
  extrairNumeroLinha,
  type EstadoFrotaLinha,
  type EventoReporte,
  type EventosPorLinha,
  type GrupoReporte,
  type PeriodoReporte,
  type ResultadoGrupoReporte,
  type ResumosReporte,
  type StatusEnvioReporte,
} from '@/lib/reporte-turno/tipos';

const TABELA_HISTORICO_TRADICIONAL = 'historico_despachos';
const TABELA_TRADICIONAL_FALLBACK = 'ocorrencias';
const TABELA_OPERACIONAL = 'ocorrencias_operacionais';
const TABELA_HISTORICO_REPORTES = 'historico_reportes';

const COLUNAS_TRADICIONAIS = [
  'id',
  'codigo_evento',
  'created_at',
  'linha',
  'via',
  'localidade',
  'falha',
  'hora_inicio',
  'hora_fim',
  'status',
  'impacto',
  'msg_operacao',
].join(', ');

const COLUNAS_OPERACIONAIS = [
  'id',
  'linha',
  'tipo_ocorrencia',
  'local',
  'horario',
  'descritivo',
  'status',
  'horario_fim',
  'cronologia',
  'aas_asl',
  'cps',
  'criado_em',
  'entregue_com_restricao',
  'descricao_restricao',
  'relatar_atuacao',
  'descricao_atuacao',
].join(', ');

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function eventosVazios(): EventosPorLinha {
  return { 11: [], 12: [], 13: [] };
}

function mapearTradicional(row: Record<string, unknown>): EventoReporte | null {
  const numeroLinha = extrairNumeroLinha(row.linha);
  if (!numeroLinha) return null;

  const criadoEm = texto(row.created_at);
  const localidade = texto(row.localidade);
  const via = texto(row.via);

  return {
    origem: 'tradicional',
    registro: criadoEm ? formatarDataHoraSaoPaulo(criadoEm) : '',
    local: via ? `${localidade} - ${via}` : localidade,
    falha: texto(row.falha),
    inicio: texto(row.hora_inicio),
    fim: texto(row.hora_fim),
    status: texto(row.status),
    cronologia: '',
    impactoRegistrado: texto(row.impacto) || texto(row.msg_operacao),
  };
}

function mapearOperacional(row: Record<string, unknown>): EventoReporte | null {
  const numeroLinha = extrairNumeroLinha(row.linha);
  if (!numeroLinha) return null;

  const criadoEm = texto(row.criado_em);
  const cronologia = normalizarCronologia(row.cronologia)
    .map((item) => `${item.horario} - ${item.texto}`)
    .join(' | ');

  const extras: string[] = [];
  if (texto(row.aas_asl)) extras.push(`AAS/ASL: ${texto(row.aas_asl)}`);
  if (texto(row.cps)) extras.push(`CPS: ${texto(row.cps)}`);
  if (row.entregue_com_restricao && texto(row.descricao_restricao)) {
    extras.push(`Restrição: ${texto(row.descricao_restricao)}`);
  }
  if (row.relatar_atuacao && texto(row.descricao_atuacao)) {
    extras.push(`Atuação: ${texto(row.descricao_atuacao)}`);
  }

  const status = row.status === 'encerrada' ? 'encerrada' : 'em andamento';

  return {
    origem: 'operacional',
    registro: criadoEm ? formatarDataHoraSaoPaulo(criadoEm) : '',
    local: texto(row.local),
    falha: [texto(row.tipo_ocorrencia), texto(row.descritivo)].filter(Boolean).join(': '),
    inicio: texto(row.horario),
    fim: texto(row.horario_fim),
    status,
    cronologia: [cronologia, ...extras].filter(Boolean).join(' | '),
    impactoRegistrado: '',
  };
}

async function buscarTradicionais(periodo: PeriodoReporte) {
  const admin = createSupabaseAdminClient();
  const consultar = (tabela: string) => admin
    .from(tabela)
    .select(COLUNAS_TRADICIONAIS)
    .gte('created_at', periodo.inicioIso)
    .lte('created_at', periodo.fimIso)
    .order('created_at', { ascending: true })
    .limit(300);

  let { data, error } = await consultar(TABELA_HISTORICO_TRADICIONAL);

  if (error && erroEstruturaReporte(error)) {
    const fallback = await consultar(TABELA_TRADICIONAL_FALLBACK);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(
      erroEstruturaReporte(error)
        ? mensagemErroEstruturaReporte()
        : error.message || 'Falha ao consultar o histórico de despachos.',
    );
  }

  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function buscarOperacionais(periodo: PeriodoReporte) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(TABELA_OPERACIONAL)
    .select(COLUNAS_OPERACIONAIS)
    .gte('criado_em', periodo.inicioIso)
    .lte('criado_em', periodo.fimIso)
    .order('criado_em', { ascending: true })
    .limit(300);

  if (error) {
    throw new Error(
      erroEstruturaReporte(error)
        ? 'Estrutura do banco desatualizada para as Ocorrências Operacionais. Aplique as migrations operacionais no Supabase.'
        : error.message || 'Falha ao consultar as ocorrências operacionais.',
    );
  }

  return (data ?? []) as unknown as Record<string, unknown>[];
}

export async function buscarEventosDoPeriodo(
  periodo: PeriodoReporte,
): Promise<EventosPorLinha> {
  const [tradicionais, operacionais] = await Promise.all([
    buscarTradicionais(periodo),
    buscarOperacionais(periodo),
  ]);

  const eventos = eventosVazios();

  for (const row of tradicionais) {
    const evento = mapearTradicional(row);
    if (!evento) continue;
    const numero = extrairNumeroLinha(row.linha);
    if (numero) eventos[numero].push(evento);
  }

  for (const row of operacionais) {
    const evento = mapearOperacional(row);
    if (!evento) continue;
    const numero = extrairNumeroLinha(row.linha);
    if (numero) eventos[numero].push(evento);
  }

  return eventos;
}

export interface DadosHistoricoReporte {
  periodo: PeriodoReporte;
  texto: string;
  sco: string;
  frota: EstadoFrotaLinha[];
  resumos: ResumosReporte | null;
  grupos: GrupoReporte[];
  resultados: ResultadoGrupoReporte[];
  status: StatusEnvioReporte;
  erro?: string | null;
}

export async function registrarHistoricoReporte(
  dados: DadosHistoricoReporte,
): Promise<string | undefined> {
  const admin = createSupabaseAdminClient();
  const agora = new Date().toISOString();

  const { data, error } = await admin
    .from(TABELA_HISTORICO_REPORTES)
    .insert({
      data: dados.periodo.data,
      turno: dados.periodo.turno,
      periodo_inicio: dados.periodo.inicioIso,
      periodo_fim: dados.periodo.fimIso,
      texto: dados.texto,
      sco: dados.sco || null,
      frota: dados.frota,
      resumos: dados.resumos,
      grupos: dados.grupos,
      resultados: dados.resultados,
      status: dados.status,
      erro: dados.erro ?? null,
      criado_em: agora,
      enviado_em: agora,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(
      erroEstruturaReporte(error)
        ? mensagemErroEstruturaReporte()
        : error.message || 'Falha ao registrar o histórico do reporte.',
    );
  }

  return typeof data?.id === 'string' ? data.id : undefined;
}
