import { NextResponse } from 'next/server';
import {
  lerCorpo,
  respostaErroOcorrencia,
} from '@/lib/ocorrencias-operacionais/service';
import { encerrarOcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/encerramento';

/**
 * Encerra uma ocorrência operacional com mensagem final no mesmo padrão das
 * ocorrências tradicionais (horários, duração, restrição e atuação).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = lerCorpo(await request.json().catch(() => null));
    const dispararWhatsApp = body.dispararWhatsApp !== false;
    const resultado = await encerrarOcorrenciaOperacional(id, {
      ...body,
      dispararWhatsApp,
    });

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
        : { error: resultado.whatsapp.erro || 'Falha ao enviar o encerramento ao grupo Ocorrências Operacionais.' }),
    });
  } catch (error: unknown) {
    const { error: mensagem, status } = respostaErroOcorrencia(error);
    return NextResponse.json({ error: mensagem }, { status });
  }
}
