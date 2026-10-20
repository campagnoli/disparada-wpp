import type { PeriodoReporte, TurnoReporte } from '@/lib/reporte-turno/tipos';

const FUSO_BRASILIA = '-03:00';
const TIMEZONE_BRASIL = 'America/Sao_Paulo';

export function dataReporteValida(data: unknown): data is string {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;

  const [ano, mes, dia] = data.split('-').map(Number);
  const referencia = new Date(Date.UTC(ano, mes - 1, dia));

  return referencia.getUTCFullYear() === ano
    && referencia.getUTCMonth() === mes - 1
    && referencia.getUTCDate() === dia;
}

export function obterDataHojeSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_BRASIL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const ano = partes.find((parte) => parte.type === 'year')?.value ?? '1970';
  const mes = partes.find((parte) => parte.type === 'month')?.value ?? '01';
  const dia = partes.find((parte) => parte.type === 'day')?.value ?? '01';

  return `${ano}-${mes}-${dia}`;
}

function diaAnterior(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const referencia = new Date(Date.UTC(ano, mes - 1, dia));
  referencia.setUTCDate(referencia.getUTCDate() - 1);

  const anoAnterior = referencia.getUTCFullYear();
  const mesAnterior = String(referencia.getUTCMonth() + 1).padStart(2, '0');
  const diaAnteriorFormatado = String(referencia.getUTCDate()).padStart(2, '0');

  return `${anoAnterior}-${mesAnterior}-${diaAnteriorFormatado}`;
}

export function formatarDataBR(data: string): string {
  return data.split('-').reverse().join('/');
}

export function formatarDataHoraSaoPaulo(iso: string): string {
  const data = new Date(iso);

  if (Number.isNaN(data.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_BRASIL,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

export function calcularPeriodoReporte(data: string, turno: TurnoReporte): PeriodoReporte {
  if (!dataReporteValida(data)) {
    throw new Error('Informe uma data válida no formato AAAA-MM-DD.');
  }

  const ehTurnoManha = turno === '09h';
  const dataInicio = ehTurnoManha ? diaAnterior(data) : data;
  const horaInicio = ehTurnoManha ? '21:01:00' : '09:01:00';
  const horaFim = ehTurnoManha ? '09:00:59.999' : '21:00:59.999';

  const inicioIso = new Date(`${dataInicio}T${horaInicio}${FUSO_BRASILIA}`).toISOString();
  const fimIso = new Date(`${data}T${horaFim}${FUSO_BRASILIA}`).toISOString();
  const inicioLabel = formatarDataHoraSaoPaulo(inicioIso);
  const fimLabel = formatarDataHoraSaoPaulo(fimIso);

  return {
    data,
    dataLabel: formatarDataBR(data),
    turno,
    turnoHorario: turno,
    turnoLabel: ehTurnoManha ? '09h - Reporte da Manhã' : '21h - Reporte da Noite',
    inicioIso,
    fimIso,
    inicioLabel,
    fimLabel,
    periodoLabel: `${inicioLabel} a ${fimLabel}`,
  };
}
