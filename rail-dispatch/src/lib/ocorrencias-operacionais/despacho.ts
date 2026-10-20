import { formatarMensagemOcorrencia } from '@/lib/formatadores/ocorrenciaOperacional';
import { formatarMensagemEncerramentoOperacional } from '@/lib/ocorrencias-operacionais/mensagem-encerramento';
import {
  persistirResultadoWhatsApp,
  registrarMensagemEnviada,
} from '@/lib/ocorrencias-operacionais/repository';
import { enviarMensagemOcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/whatsapp';
import type {
  DadosOcorrenciaOperacional,
  ResultadoEnvioWhatsApp,
  TipoMensagemOcorrenciaOperacional,
} from '@/lib/ocorrencias-operacionais/types';

export function formatarOcorrenciaOperacional(
  dados: DadosOcorrenciaOperacional,
  templateEncerramento?: string
): string {
  if (dados.status === 'encerrada' && dados.horarioFim) {
    return formatarMensagemEncerramentoOperacional(
      {
        linha: dados.linha,
        tipoOcorrencia: dados.tipoOcorrencia,
        horario: dados.horario,
        horarioFim: dados.horarioFim,
      },
      {
        entregueComRestricao: dados.entregueComRestricao,
        descricaoRestricao: dados.descricaoRestricao ?? '',
        relatarAtuacao: dados.relatarAtuacao,
        descricaoAtuacao: dados.descricaoAtuacao ?? '',
      },
      templateEncerramento
    );
  }

  return formatarMensagemOcorrencia({
    linha: dados.linha,
    tipoOcorrencia: dados.tipoOcorrencia,
    local: dados.local,
    horario: dados.horario,
    descritivo: dados.descritivo,
    cronologia: dados.cronologia,
    aasAsl: dados.aasAsl ?? undefined,
    cps: dados.cps ?? undefined,
    status: dados.status,
  });
}

interface ParametrosDisparo {
  ocorrenciaId: string;
  dados: DadosOcorrenciaOperacional;
  mensagemFormatada: string;
  tipo: TipoMensagemOcorrenciaOperacional;
}

/**
 * Envia a mensagem ao grupo, persiste os IDs retornados pela Evolution API e
 * registra a tentativa no histórico de mensagens da ocorrência.
 */
export async function dispararERegistrar(
  params: ParametrosDisparo
): Promise<ResultadoEnvioWhatsApp> {
  let resultado: ResultadoEnvioWhatsApp = {
    sucesso: false,
    erro: 'ID do grupo Ocorrências Operacionais não configurado.',
  };

  if (params.dados.groupIdWhatsApp) {
    resultado = await enviarMensagemOcorrenciaOperacional(
      params.mensagemFormatada,
      params.dados.groupIdWhatsApp
    );

    try {
      await persistirResultadoWhatsApp(params.ocorrenciaId, resultado);
    } catch (error: unknown) {
      console.error('Falha ao persistir IDs da mensagem WhatsApp:', error);
    }
  }

  try {
    await registrarMensagemEnviada({
      ocorrenciaId: params.ocorrenciaId,
      tipo: params.tipo,
      mensagem: params.mensagemFormatada,
      cronologia: params.dados.cronologia,
      resultado,
    });
  } catch (error: unknown) {
    console.error('Falha ao registrar mensagem enviada no histórico:', error);
  }

  return resultado;
}
