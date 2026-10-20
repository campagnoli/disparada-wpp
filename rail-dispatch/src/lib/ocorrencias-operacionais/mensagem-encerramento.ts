import {
  TEMPLATES_MENSAGEM_PADRAO,
  aplicarTemplateMensagem,
  calcularDuracao,
  incluirDetalhesEncerramento,
  type DetalhesEncerramento,
} from '@/lib/mensagem-templates-pure';

export interface DadosMensagemEncerramentoOperacional {
  linha: string;
  tipoOcorrencia: string;
  horario: string;
  horarioFim: string;
}

/**
 * Gera a mensagem final de uma ocorrência operacional no mesmo padrão das
 * ocorrências tradicionais: apenas título, horários, duração, restrição e
 * atuação. A cronologia não é repetida na mensagem de encerramento.
 */
export function formatarMensagemEncerramentoOperacional(
  dados: DadosMensagemEncerramentoOperacional,
  detalhes: DetalhesEncerramento,
  templateEncerramento: string = TEMPLATES_MENSAGEM_PADRAO.encerramento.ocorrencias_operacionais
): string {
  const titulo = [dados.tipoOcorrencia, dados.linha].filter(Boolean).join(' - ') || 'Ocorrência Operacional';

  const base = aplicarTemplateMensagem(templateEncerramento, {
    titulo,
    horaInicio: dados.horario,
    horaFim: dados.horarioFim,
    duracao: calcularDuracao(dados.horario, dados.horarioFim),
    isEncerramento: true,
  });

  return incluirDetalhesEncerramento(base, detalhes);
}
