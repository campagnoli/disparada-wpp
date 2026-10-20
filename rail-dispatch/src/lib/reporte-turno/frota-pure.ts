import {
  LINHAS_REPORTE,
  type ConfiguracaoFrotaLinha,
  type EstadoFrotaLinha,
  type NumeroLinha,
} from '@/lib/reporte-turno/tipos';

export const FROTA_PADRAO: ConfiguracaoFrotaLinha[] = [
  {
    numero_linha: 11,
    nome_linha: 'Linha 11-Coral',
    trens_operacionais: 31,
    trens_reserva: 1,
    ativo: true,
  },
  {
    numero_linha: 12,
    nome_linha: 'Linha 12-Safira',
    trens_operacionais: 22,
    trens_reserva: 1,
    ativo: true,
  },
  {
    numero_linha: 13,
    nome_linha: 'Linha 13-Jade',
    trens_operacionais: 5,
    trens_reserva: 1,
    ativo: true,
  },
];

function inteiroNoIntervalo(valor: unknown, padrao: number): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(999, Math.max(0, Math.trunc(numero)));
}

function normalizarLinha(valor: unknown, padrao: ConfiguracaoFrotaLinha): ConfiguracaoFrotaLinha {
  if (typeof valor !== 'object' || valor === null) return { ...padrao };

  const linha = valor as Record<string, unknown>;
  const numero = linha.numero_linha ?? linha.numeroLinha;
  if (numero !== padrao.numero_linha) return { ...padrao };

  return {
    ...(typeof linha.id === 'string' ? { id: linha.id } : {}),
    numero_linha: padrao.numero_linha,
    nome_linha:
      typeof linha.nome_linha === 'string' && linha.nome_linha.trim()
        ? linha.nome_linha.trim()
        : typeof linha.nomeLinha === 'string' && linha.nomeLinha.trim()
          ? linha.nomeLinha.trim()
          : padrao.nome_linha,
    trens_operacionais: inteiroNoIntervalo(
      linha.trens_operacionais ?? linha.trensOperacionais,
      padrao.trens_operacionais,
    ),
    trens_reserva: inteiroNoIntervalo(
      linha.trens_reserva ?? linha.trensReserva,
      padrao.trens_reserva,
    ),
    ativo: linha.ativo !== false,
    ...(typeof linha.atualizado_em === 'string'
      ? { atualizado_em: linha.atualizado_em }
      : {}),
  };
}

export function normalizarConfiguracaoFrota(valor: unknown): ConfiguracaoFrotaLinha[] {
  const linhas = Array.isArray(valor) ? valor : [];

  return FROTA_PADRAO.map((padrao) => {
    const encontrada = linhas.find((item) => {
      if (typeof item !== 'object' || item === null) return false;
      const linha = item as Record<string, unknown>;
      return (linha.numero_linha ?? linha.numeroLinha) === padrao.numero_linha;
    });

    return normalizarLinha(encontrada, padrao);
  });
}

export function criarEstadosFrota(linhas: ConfiguracaoFrotaLinha[]): EstadoFrotaLinha[] {
  const normalizadas = normalizarConfiguracaoFrota(linhas);

  return normalizadas.map((linha) => ({
    numeroLinha: linha.numero_linha,
    nomeLinha: linha.nome_linha,
    trensOperacionais: linha.trens_operacionais,
    trensReserva: linha.trens_reserva,
    circulouCompleta: true,
    trensCirculando: null,
    justificativa: '',
  }));
}

export function normalizarEstadosFrota(
  valor: unknown,
  configuracao: ConfiguracaoFrotaLinha[],
): EstadoFrotaLinha[] {
  const estadosPadrao = criarEstadosFrota(configuracao);
  const recebidos = Array.isArray(valor) ? valor : [];

  return estadosPadrao.map((padrao) => {
    const encontrado = recebidos.find((item) => {
      if (typeof item !== 'object' || item === null) return false;
      const estado = item as Record<string, unknown>;
      return (estado.numeroLinha ?? estado.numero_linha) === padrao.numeroLinha;
    });

    if (typeof encontrado !== 'object' || encontrado === null) return padrao;

    const estado = encontrado as Record<string, unknown>;
    const trensBrutos = estado.trensCirculando ?? estado.trens_circulando;
    const trensNumero = typeof trensBrutos === 'number' ? trensBrutos : Number(trensBrutos);
    const trensCirculando = trensBrutos === null || trensBrutos === ''
      ? null
      : Number.isFinite(trensNumero)
        ? Math.min(999, Math.max(0, Math.trunc(trensNumero)))
        : null;
    const justificativa = typeof estado.justificativa === 'string'
      ? estado.justificativa.trim().slice(0, 300)
      : '';

    return {
      ...padrao,
      circulouCompleta: estado.circulouCompleta !== false,
      trensCirculando,
      justificativa,
    };
  });
}

function removerPontuacaoFinal(texto: string): string {
  return texto.trim().replace(/[.;,\s]+$/g, '');
}

export function comporStatusFrota(estado: EstadoFrotaLinha): string {
  const nominal = `${estado.trensOperacionais}+${estado.trensReserva}`;

  if (estado.circulouCompleta) {
    return `Circulou com frota nominal completa (${nominal}).`;
  }

  const partes: string[] = [];
  const motivo = removerPontuacaoFinal(estado.justificativa);

  if (estado.trensCirculando !== null) {
    partes.push(`Circulou com ${estado.trensCirculando} trens.`);

    const deficit = estado.trensOperacionais - estado.trensCirculando;
    if (deficit > 0) {
      partes.push(`Déficit de ${deficit} trens${motivo ? ` devido a ${motivo}` : ''}.`);
    } else if (motivo) {
      partes.push(`Motivo: ${motivo}.`);
    }
  } else if (motivo) {
    partes.push(`Circulou com frota reduzida devido a ${motivo}.`);
  }

  return partes.join(' ') || 'Frota em circulação não informada.';
}

export function construirStatusFrota(
  estados: EstadoFrotaLinha[],
): Record<NumeroLinha, string> {
  const status = {} as Record<NumeroLinha, string>;

  for (const linha of LINHAS_REPORTE) {
    const estado = estados.find((item) => item.numeroLinha === linha.numero);
    status[linha.numero] = estado
      ? comporStatusFrota(estado)
      : 'Frota em circulação não informada.';
  }

  return status;
}
