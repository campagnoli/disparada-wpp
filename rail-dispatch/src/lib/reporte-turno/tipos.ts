export type NumeroLinha = 11 | 12 | 13;

export type TurnoReporte = '09h' | '21h';

export type GrupoReporte = 'comunicacao' | 'operacao' | 'gerencia';

export interface LinhaReporte {
  numero: NumeroLinha;
  nome: string;
  cor: string;
}

export const LINHAS_REPORTE: readonly LinhaReporte[] = [
  { numero: 11, nome: 'Linha 11-Coral', cor: 'Coral' },
  { numero: 12, nome: 'Linha 12-Safira', cor: 'Safira' },
  { numero: 13, nome: 'Linha 13-Jade', cor: 'Jade' },
] as const;

export const TURNOS_REPORTE: readonly TurnoReporte[] = ['09h', '21h'] as const;

export const GRUPOS_REPORTE: readonly GrupoReporte[] = [
  'comunicacao',
  'operacao',
  'gerencia',
] as const;

export const NOMES_GRUPOS_REPORTE: Record<GrupoReporte, string> = {
  comunicacao: 'Comunicação / Imprensa',
  operacao: 'Operação CCO / Executivo',
  gerencia: 'Gerência / Órgão Regulador',
};

export function isTurnoReporte(valor: unknown): valor is TurnoReporte {
  return valor === '09h' || valor === '21h';
}

export function isGrupoReporte(valor: unknown): valor is GrupoReporte {
  return valor === 'comunicacao' || valor === 'operacao' || valor === 'gerencia';
}

export function isNumeroLinha(valor: unknown): valor is NumeroLinha {
  return valor === 11 || valor === 12 || valor === 13;
}

export function extrairNumeroLinha(linha: unknown): NumeroLinha | null {
  const texto = typeof linha === 'string' ? linha : '';
  const correspondencia = texto.match(/\b(?:linha|l)?\s*(11|12|13)\b/i);
  if (!correspondencia) return null;

  const numero = Number(correspondencia[1]);
  return isNumeroLinha(numero) ? numero : null;
}

export interface ConfiguracaoFrotaLinha {
  id?: string;
  numero_linha: NumeroLinha;
  nome_linha: string;
  trens_operacionais: number;
  trens_reserva: number;
  ativo: boolean;
  atualizado_em?: string;
}

export interface EstadoFrotaLinha {
  numeroLinha: NumeroLinha;
  nomeLinha: string;
  trensOperacionais: number;
  trensReserva: number;
  circulouCompleta: boolean;
  trensCirculando: number | null;
  justificativa: string;
}

export interface ResumoLinhaReporte {
  ocorrencias: string;
  impacto: string;
  totalEventos: number;
}

export type ResumosReporte = Record<NumeroLinha, ResumoLinhaReporte>;

export interface PeriodoReporte {
  data: string;
  dataLabel: string;
  turno: TurnoReporte;
  turnoHorario: string;
  turnoLabel: string;
  inicioIso: string;
  fimIso: string;
  inicioLabel: string;
  fimLabel: string;
  periodoLabel: string;
}

export interface EventoReporte {
  origem: 'tradicional' | 'operacional';
  registro: string;
  local: string;
  falha: string;
  inicio: string;
  fim: string;
  status: string;
  cronologia: string;
  impactoRegistrado: string;
}

export type EventosPorLinha = Record<NumeroLinha, EventoReporte[]>;

export interface PayloadCompilarReporte {
  data: string;
  turno: TurnoReporte;
  frota: EstadoFrotaLinha[];
  sco: string;
}

export interface RespostaCompilarReporte {
  sucesso: true;
  periodo: PeriodoReporte;
  resumos: ResumosReporte;
  statusFrota: Record<NumeroLinha, string>;
  mensagem: string;
  template: string;
  totalEventos: number;
  eventosPorLinha: Record<NumeroLinha, number>;
  aviso?: string;
}

export interface ResultadoGrupoReporte {
  grupo: GrupoReporte;
  nome: string;
  sucesso: boolean;
  messageId?: string;
  erro?: string;
}

export type StatusEnvioReporte = 'sucesso' | 'parcial' | 'erro';

export interface RespostaDispararReporte {
  sucesso: boolean;
  status: StatusEnvioReporte;
  resultados: ResultadoGrupoReporte[];
  historicoId?: string;
  aviso?: string;
}

export interface HistoricoReporte {
  id: string;
  data: string;
  turno: TurnoReporte;
  periodo_inicio: string;
  periodo_fim: string;
  texto: string;
  sco: string | null;
  frota: EstadoFrotaLinha[];
  resumos: ResumosReporte | null;
  grupos: GrupoReporte[];
  resultados: ResultadoGrupoReporte[];
  status: StatusEnvioReporte;
  erro: string | null;
  criado_em: string;
  enviado_em: string | null;
}

export interface ConfiguracaoReporteAPI {
  frota: ConfiguracaoFrotaLinha[];
  template: string;
  templatePadrao: string;
  isCustom: boolean;
  updatedAt: string | null;
  grupos: Record<GrupoReporte, { configurado: boolean }>;
  aviso?: string;
}
