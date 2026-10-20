import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';
import type {
  ResultadoEnvioWhatsApp,
} from '@/lib/ocorrencias-operacionais/types';

/**
 * Resolve o JID do grupo Ocorrências Operacionais. O valor informado pelo
 * cliente tem prioridade; caso ausente, usa a configuração ativa (Web/Supabase
 * com fallback para .env.local).
 */
export async function resolverGroupIdOcorrenciasOperacionais(
  informado?: string
): Promise<string> {
  const direto = (informado || '').trim();
  if (direto) return direto;

  const { config } = await obterConfiguracaoWhatsAppAtiva();
  return (config.grupos?.ocorrencias_operacionais || '').trim();
}

export async function enviarMensagemOcorrenciaOperacional(
  mensagem: string,
  groupId: string
): Promise<ResultadoEnvioWhatsApp> {
  if (!groupId) {
    return { sucesso: false, erro: 'ID do grupo Ocorrências Operacionais não configurado.' };
  }

  try {
    const { config } = await obterConfiguracaoWhatsAppAtiva();

    const res = await fetch(
      `${config.apiUrl}/message/sendText/${encodeURIComponent(config.instanceName)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.apiKey || '',
        },
        body: JSON.stringify({
          number: groupId,
          text: mensagem,
          linkPreview: false,
        }),
      }
    );

    const respostaJson = (await res.json().catch(() => null)) as
      | { key?: { id?: string; remoteJid?: string }; [key: string]: unknown }
      | null;

    return {
      sucesso: res.ok,
      messageId: respostaJson?.key?.id,
      remoteJid: respostaJson?.key?.remoteJid,
      erro: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (error: unknown) {
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Falha ao disparar mensagem no WhatsApp.',
    };
  }
}
