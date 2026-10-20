import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { DadosOcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/types';

/**
 * Registra um exemplo de mensagem operacional para o mecanismo de aprendizado.
 * Falhas aqui nunca devem interromper o fluxo principal de salvamento/disparo.
 */
export async function salvarAprendizadoOcorrencia(
  dados: DadosOcorrenciaOperacional,
  mensagemFormatada: string
): Promise<void> {
  try {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from('aprendizado_despachos').insert({
      linha: dados.linha,
      tipo_evento: dados.tipoOcorrencia,
      dados_ocorrencia: {
        linha: dados.linha,
        tipo_ocorrencia: dados.tipoOcorrencia,
        local: dados.local,
        horario: dados.horario,
        descritivo: dados.descritivo,
        cronologia: dados.cronologia,
        aas_asl: dados.aasAsl,
        cps: dados.cps,
        status: dados.status,
        horario_fim: dados.horarioFim,
        entregue_com_restricao: dados.entregueComRestricao,
        descricao_restricao: dados.descricaoRestricao,
        relatar_atuacao: dados.relatarAtuacao,
        descricao_atuacao: dados.descricaoAtuacao,
        group_id_whatsapp: dados.groupIdWhatsApp,
      },
      mensagem_ia: mensagemFormatada,
      mensagem_final_sco: mensagemFormatada,
      tipo_grupo: 'operacao',
      houve_edicao: true,
    });
  } catch (error: unknown) {
    console.error('Falha ao salvar exemplo de aprendizado:', error);
  }
}
