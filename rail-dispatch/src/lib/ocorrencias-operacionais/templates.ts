import { obterTemplatesMensagemAtivos } from '@/lib/mensagem-templates';

/**
 * Retorna o modelo de encerramento configurado para ocorrências operacionais.
 * Em caso de falha, o formatador usa o modelo padrão de fábrica.
 */
export async function obterTemplateEncerramentoOperacional(): Promise<string | undefined> {
  try {
    const { templates } = await obterTemplatesMensagemAtivos();
    return templates.encerramento.ocorrencias_operacionais;
  } catch (error) {
    console.error('Falha ao carregar modelo de encerramento operacional:', error);
    return undefined;
  }
}
