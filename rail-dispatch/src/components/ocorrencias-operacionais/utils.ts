import type { OcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/types';

export const ROTULOS_TIPO: Record<string, string> = {
  criacao: 'Mensagem inicial',
  atualizacao_cronologia: 'Atualização de cronologia',
  encerramento: 'Encerramento',
};

export function formatarDataHora(valor: string): string {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString('pt-BR');
}

export function formatarHorario(valor: string): string {
  return valor.includes(':') ? valor.replace(':', 'h') : valor;
}

export function estaEncerrada(ocorrencia: Pick<OcorrenciaOperacional, 'status'>): boolean {
  return ocorrencia.status === 'encerrada';
}

export function rotuloStatus(ocorrencia: Pick<OcorrenciaOperacional, 'status'>): string {
  return estaEncerrada(ocorrencia) ? 'Encerrada' : 'Em andamento';
}

export function classeBadgeStatus(ocorrencia: Pick<OcorrenciaOperacional, 'status'>): string {
  return estaEncerrada(ocorrencia) ? 'badge-jade' : 'badge-coral';
}
