import { NextResponse } from 'next/server';
import { obterFrotaLinhas } from '@/lib/reporte-turno/frota';
import { normalizarEstadosFrota } from '@/lib/reporte-turno/frota-pure';
import { calcularPeriodoReporte, dataReporteValida } from '@/lib/reporte-turno/periodo';
import { registrarHistoricoReporte } from '@/lib/reporte-turno/repository';
import {
  GRUPOS_REPORTE,
  isGrupoReporte,
  isTurnoReporte,
  type GrupoReporte,
  type RespostaDispararReporte,
  type ResumosReporte,
} from '@/lib/reporte-turno/tipos';
import { enviarReporteParalelo } from '@/lib/reporte-turno/whatsapp';

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export async function POST(request: Request) {
  try {
    const corpo = await request.json().catch(() => null);
    if (!isRecord(corpo)) {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    const texto = typeof corpo.texto === 'string' ? corpo.texto.trim() : '';
    const data = typeof corpo.data === 'string' ? corpo.data.trim() : '';
    const turno = corpo.turno;
    const sco = typeof corpo.sco === 'string' ? corpo.sco.trim().slice(0, 160) : '';
    const gruposRecebidos = Array.isArray(corpo.grupos) ? corpo.grupos : [];
    const grupos = GRUPOS_REPORTE.filter((grupo) =>
      gruposRecebidos.some((item) => item === grupo && isGrupoReporte(item)),
    ) as GrupoReporte[];

    if (!texto) {
      return NextResponse.json(
        { error: 'O texto do reporte está vazio.' },
        { status: 400 },
      );
    }

    if (texto.length > 8_000) {
      return NextResponse.json(
        { error: 'O texto do reporte excede o limite de 8.000 caracteres.' },
        { status: 400 },
      );
    }

    if (!dataReporteValida(data) || !isTurnoReporte(turno)) {
      return NextResponse.json(
        { error: 'Data ou turno inválido para o disparo do reporte.' },
        { status: 400 },
      );
    }

    if (grupos.length === 0) {
      return NextResponse.json(
        { error: 'Selecione ao menos um grupo para o disparo.' },
        { status: 400 },
      );
    }

    const periodo = calcularPeriodoReporte(data, turno);
    const frota = await obterFrotaLinhas();
    const estadosFrota = normalizarEstadosFrota(corpo.frota, frota.linhas);
    const { resultados, status } = await enviarReporteParalelo(texto, grupos);

    const resumos = isRecord(corpo.resumos)
      ? (corpo.resumos as unknown as ResumosReporte)
      : null;
    const falhas = resultados
      .filter((resultado) => !resultado.sucesso)
      .map((resultado) => `${resultado.nome}: ${resultado.erro ?? 'falha no envio'}`)
      .join(' | ');

    let historicoId: string | undefined;
    let aviso: string | undefined;

    try {
      historicoId = await registrarHistoricoReporte({
        periodo,
        texto,
        sco,
        frota: estadosFrota,
        resumos,
        grupos,
        resultados,
        status,
        erro: falhas || null,
      });
    } catch (error: unknown) {
      console.error('Reporte enviado, mas o histórico não foi registrado:', error);
      aviso = error instanceof Error
        ? error.message
        : 'O reporte foi enviado, mas o histórico não foi registrado.';
    }

    const resposta: RespostaDispararReporte = {
      sucesso: status === 'sucesso',
      status,
      resultados,
      ...(historicoId ? { historicoId } : {}),
      ...(aviso ? { aviso } : {}),
    };

    return NextResponse.json(resposta);
  } catch (error: unknown) {
    console.error('Falha ao disparar o Reporte de Turno:', error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Falha inesperada ao disparar o Reporte de Turno.',
      },
      { status: 500 },
    );
  }
}
