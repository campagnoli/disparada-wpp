import { NextResponse } from 'next/server';
import { listarMensagensEnviadas } from '@/lib/ocorrencias-operacionais/repository';
import {
  atualizarCronologiaEEnviar,
  lerCorpo,
  respostaErroOcorrencia,
} from '@/lib/ocorrencias-operacionais/service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const mensagens = await listarMensagensEnviadas(id);
    return NextResponse.json({ mensagens });
  } catch (error: unknown) {
    const { error: mensagem, status } = respostaErroOcorrencia(error);
    return NextResponse.json({ error: mensagem }, { status });
  }
}

/**
 * Atualiza a cronologia da ocorrência e, por padrão, envia uma NOVA
 * mensagem ao grupo Ocorrências Operacionais (ordem cronológica).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = lerCorpo(await request.json().catch(() => null));
    const dispararWhatsApp = body.dispararWhatsApp !== false;
    const resultado = await atualizarCronologiaEEnviar(id, body);

    const envioOk = !dispararWhatsApp || resultado.whatsapp.sucesso;

    return NextResponse.json({
      success: envioOk,
      sucesso: envioOk,
      id,
      ocorrencia: resultado.ocorrencia,
      mensagemFormatada: resultado.mensagemFormatada,
      whatsapp: resultado.whatsapp,
      ...(envioOk
        ? {}
        : { error: resultado.whatsapp.erro || 'Falha ao enviar a mensagem ao grupo Ocorrências Operacionais.' }),
    });
  } catch (error: unknown) {
    const { error: mensagem, status } = respostaErroOcorrencia(error);
    return NextResponse.json({ error: mensagem }, { status });
  }
}
