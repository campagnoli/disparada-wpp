import { NextResponse } from 'next/server';
import { listarOcorrenciasOperacionais } from '@/lib/ocorrencias-operacionais/repository';
import {
  atualizarCronologiaEEnviar,
  lerCorpo,
  respostaErroOcorrencia,
  salvarOcorrenciaOperacional,
} from '@/lib/ocorrencias-operacionais/service';

/* ------------------------------------------------------------------ */
/* GET  – Listar ocorrências (ativas/recentes)                        */
/* ------------------------------------------------------------------ */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const status =
    statusParam === 'em_andamento' || statusParam === 'encerrada' ? statusParam : 'todas';
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '20'), 1), 100);

  try {
    const { ocorrencias, total } = await listarOcorrenciasOperacionais({
      page,
      pageSize,
      status,
    });

    return NextResponse.json({ ocorrencias, total, page, pageSize });
  } catch (error: unknown) {
    console.error('Falha ao listar ocorrências operacionais:', error);
    const { error: mensagem, status } = respostaErroOcorrencia(error);
    return NextResponse.json({ error: mensagem }, { status });
  }
}

/* ------------------------------------------------------------------ */
/* POST – Criar / Atualizar e (opcional) disparar WhatsApp            */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  try {
    const body = lerCorpo(await request.json().catch(() => null));
    const dispararWhatsApp = body.dispararWhatsApp === true;
    const resultado = await salvarOcorrenciaOperacional(body, {
      dispararWhatsApp,
      houveEdicaoManual: body.houveEdicaoManual === true,
    });

    const envioOk = !dispararWhatsApp || resultado.whatsapp.sucesso;

    return NextResponse.json(
      {
        success: envioOk,
        sucesso: envioOk,
        id: resultado.id,
        mensagemFormatada: resultado.mensagemFormatada,
        whatsapp: resultado.whatsapp,
        ...(envioOk
          ? {}
          : { error: resultado.whatsapp.erro || 'Falha ao enviar a mensagem ao grupo Ocorrências Operacionais.' }),
      },
      { status: envioOk ? 201 : 502 }
    );
  } catch (error: unknown) {
    const { error: mensagem, status } = respostaErroOcorrencia(error);
    return NextResponse.json({ error: mensagem }, { status });
  }
}

/* ------------------------------------------------------------------ */
/* PATCH – Atualizar cronologia de ocorrência existente               */
/* ------------------------------------------------------------------ */
export async function PATCH(request: Request) {
  try {
    const body = lerCorpo(await request.json().catch(() => null));
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'ID da ocorrência é obrigatório.' }, { status: 400 });
    }

    const dispararWhatsApp = body.dispararWhatsApp === true;
    const resultado = await atualizarCronologiaEEnviar(id, {
      ...body,
      dispararWhatsApp,
    });

    const envioOk = !dispararWhatsApp || resultado.whatsapp.sucesso;

    return NextResponse.json({
      success: envioOk,
      sucesso: envioOk,
      id,
      mensagemFormatada: resultado.mensagemFormatada,
      cronologia: resultado.ocorrencia.cronologia,
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
