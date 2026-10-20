import { NextResponse } from 'next/server';
import {
  obterDetalheOcorrenciaOperacional,
  respostaErroOcorrencia,
} from '@/lib/ocorrencias-operacionais/service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const detalhe = await obterDetalheOcorrenciaOperacional(id);
    return NextResponse.json(detalhe);
  } catch (error: unknown) {
    const { error: mensagem, status } = respostaErroOcorrencia(error);
    return NextResponse.json({ error: mensagem }, { status });
  }
}
