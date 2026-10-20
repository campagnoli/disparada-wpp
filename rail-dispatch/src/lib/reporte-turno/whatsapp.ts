import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';
import {
  GRUPOS_REPORTE,
  NOMES_GRUPOS_REPORTE,
  type GrupoReporte,
  type ResultadoGrupoReporte,
  type StatusEnvioReporte,
} from '@/lib/reporte-turno/tipos';

interface RespostaEvolution {
  key?: { id?: string };
  message?: unknown;
  error?: unknown;
}

function sanitizarMensagem(mensagem: string): string {
  return mensagem.replace(/[\w.+-]+@g\.us/gi, '[grupo]');
}

function textoErro(valor: unknown, status: number): string {
  if (typeof valor === 'string' && valor.trim()) return sanitizarMensagem(valor.trim());
  if (Array.isArray(valor) && valor.length > 0) {
    const primeiro = valor[0];
    if (typeof primeiro === 'string') return sanitizarMensagem(primeiro);
    if (typeof primeiro === 'object' && primeiro !== null) {
      const mensagem = (primeiro as Record<string, unknown>).message;
      if (typeof mensagem === 'string') return sanitizarMensagem(mensagem);
    }
  }
  if (typeof valor === 'object' && valor !== null) {
    const mensagem = (valor as Record<string, unknown>).message;
    if (typeof mensagem === 'string') return sanitizarMensagem(mensagem);
  }
  return `Evolution API respondeu com status ${status}.`;
}

export async function enviarReporteParalelo(
  texto: string,
  gruposSelecionados: GrupoReporte[],
): Promise<{
  resultados: ResultadoGrupoReporte[];
  status: StatusEnvioReporte;
}> {
  const { config } = await obterConfiguracaoWhatsAppAtiva();
  const apiUrl = config.apiUrl.replace(/\/+$/, '');
  const apiKey = config.apiKey;
  const instance = config.instanceName;

  const grupos = GRUPOS_REPORTE.filter((grupo) => gruposSelecionados.includes(grupo));

  const resultados = await Promise.all(
    grupos.map(async (grupo): Promise<ResultadoGrupoReporte> => {
      const jid = config.grupos[grupo] || null;
      const nome = NOMES_GRUPOS_REPORTE[grupo];

      if (!jid) {
        return {
          grupo,
          nome,
          sucesso: false,
          erro: `Grupo de ${nome} não configurado.`,
        };
      }

      try {
        const resposta = await fetch(
          `${apiUrl}/message/sendText/${encodeURIComponent(instance)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: apiKey || '',
            },
            body: JSON.stringify({
              number: jid,
              text: texto,
              linkPreview: false,
            }),
            signal: AbortSignal.timeout(20_000),
          },
        );

        const dados = (await resposta.json().catch(() => null)) as RespostaEvolution | null;

        if (!resposta.ok) {
          return {
            grupo,
            nome,
            sucesso: false,
            erro: textoErro(dados?.message ?? dados?.error, resposta.status),
          };
        }

        return {
          grupo,
          nome,
          sucesso: true,
          ...(typeof dados?.key?.id === 'string' ? { messageId: dados.key.id } : {}),
        };
      } catch (error: unknown) {
        const mensagem = error instanceof Error
          ? error.name === 'TimeoutError'
            ? 'Tempo esgotado ao enviar para o WhatsApp.'
            : sanitizarMensagem(error.message)
          : 'Falha inesperada ao enviar para o WhatsApp.';

        return {
          grupo,
          nome,
          sucesso: false,
          erro: mensagem,
        };
      }
    }),
  );

  const sucessos = resultados.filter((item) => item.sucesso).length;
  const status: StatusEnvioReporte = sucessos === 0
    ? 'erro'
    : sucessos === resultados.length
      ? 'sucesso'
      : 'parcial';

  return { resultados, status };
}
