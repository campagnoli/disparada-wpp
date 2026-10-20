import type { ItemCronologia } from '@/lib/formatadores/ocorrenciaOperacional';
import type {
  DadosOcorrenciaOperacional,
  StatusOcorrenciaOperacional,
} from '@/lib/ocorrencias-operacionais/types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizarCronologia(value: unknown): ItemCronologia[] {
  const itens = Array.isArray(value) ? value : [];

  return itens
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      id: getText(item.id) || undefined,
      horario: getText(item.horario),
      texto: getText(item.texto),
    }))
    .filter((item) => Boolean(item.horario && item.texto))
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

export function normalizarStatus(value: unknown): StatusOcorrenciaOperacional {
  return getText(value) === 'encerrada' ? 'encerrada' : 'em_andamento';
}

export function normalizarDadosOcorrencia(body: Record<string, unknown>): DadosOcorrenciaOperacional {
  return {
    id: getText(body.id) || undefined,
    codigoEvento: getText(body.codigoEvento).toUpperCase() || null,
    linha: getText(body.linha),
    tipoOcorrencia: getText(body.tipoOcorrencia),
    local: getText(body.local),
    horario: getText(body.horario),
    descritivo: getText(body.descritivo),
    cronologia: normalizarCronologia(body.cronologia),
    aasAsl: getText(body.aasAsl) || null,
    cps: getText(body.cps) || null,
    status: normalizarStatus(body.status),
    horarioFim: getText(body.horarioFim) || null,
    entregueComRestricao: body.entregueComRestricao === true,
    descricaoRestricao: getText(body.descricaoRestricao) || null,
    relatarAtuacao: body.relatarAtuacao === true,
    descricaoAtuacao: getText(body.descricaoAtuacao) || null,
    groupIdWhatsApp: getText(body.groupIdWhatsApp),
  };
}

/**
 * Valida os campos obrigatórios para criação. Em atualizações de cronologia,
 * apenas o ID é obrigatório (os demais campos são herdados do registro).
 */
export function validarDadosObrigatorios(
  dados: DadosOcorrenciaOperacional,
  opcoes: { exigirCamposCompletos: boolean }
): string | null {
  if (!dados.id && !dados.linha) return 'Informe a linha.';
  if (!dados.id && !dados.tipoOcorrencia) return 'Informe o tipo de ocorrência.';
  if (!dados.id && !dados.local) return 'Informe o local (estação/trecho/plataforma).';
  if (!dados.id && !dados.horario) return 'Informe o horário.';
  if (!dados.id && !dados.descritivo) return 'Informe o descritivo.';
  if (!dados.id && !dados.groupIdWhatsApp) return 'Informe o ID do grupo do WhatsApp.';
  if (opcoes.exigirCamposCompletos && !dados.cronologia.length) {
    return 'Informe ao menos um item de cronologia válido.';
  }
  return null;
}
