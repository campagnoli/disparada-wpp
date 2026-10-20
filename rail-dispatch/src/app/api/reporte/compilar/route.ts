import { NextResponse } from 'next/server';
import { obterFrotaLinhas } from '@/lib/reporte-turno/frota';
import { normalizarEstadosFrota, construirStatusFrota } from '@/lib/reporte-turno/frota-pure';
import { compilarResumosComGemini, contarEventos } from '@/lib/reporte-turno/gemini';
import { calcularPeriodoReporte, dataReporteValida } from '@/lib/reporte-turno/periodo';
import { buscarEventosDoPeriodo } from '@/lib/reporte-turno/repository';
import { obterTemplateReporteAtivo } from '@/lib/reporte-turno/template';
import { aplicarTemplateReporte } from '@/lib/reporte-turno/template-pure';
import {
  isTurnoReporte,
  type RespostaCompilarReporte,
} from '@/lib/reporte-turno/tipos';

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export async function POST(request: Request) {
  try {
    const corpo = await request.json().catch(() => null);
    if (!isRecord(corpo)) {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    const data = typeof corpo.data === 'string' ? corpo.data.trim() : '';
    const turno = corpo.turno;
    const sco = typeof corpo.sco === 'string' ? corpo.sco.trim().slice(0, 160) : '';

    if (!dataReporteValida(data)) {
      return NextResponse.json(
        { error: 'Informe uma data válida para o reporte.' },
        { status: 400 },
      );
    }

    if (!isTurnoReporte(turno)) {
      return NextResponse.json(
        { error: 'Selecione o turno 09h ou 21h.' },
        { status: 400 },
      );
    }

    const [frota, template] = await Promise.all([
      obterFrotaLinhas(),
      obterTemplateReporteAtivo(),
    ]);

    const periodo = calcularPeriodoReporte(data, turno);
    const estadosFrota = normalizarEstadosFrota(corpo.frota, frota.linhas);
    const linhaIncompleta = estadosFrota.find(
      (linha) => !linha.circulouCompleta
        && linha.trensCirculando === null
        && !linha.justificativa.trim(),
    );

    if (linhaIncompleta) {
      return NextResponse.json(
        {
          error: `${linhaIncompleta.nomeLinha}: informe a quantidade de trens em circulação ou a justificativa do déficit.`,
        },
        { status: 400 },
      );
    }

    const eventos = await buscarEventosDoPeriodo(periodo);
    const resumos = await compilarResumosComGemini(periodo, eventos);
    const statusFrota = construirStatusFrota(estadosFrota);

    const mensagem = aplicarTemplateReporte(template.template, {
      data: periodo.dataLabel,
      turnoHorario: periodo.turnoHorario,
      statusFrota,
      resumos,
      sco,
    });

    const avisos = [frota.aviso, template.aviso].filter(Boolean);
    const resposta: RespostaCompilarReporte = {
      sucesso: true,
      periodo,
      resumos,
      statusFrota,
      mensagem,
      template: template.template,
      totalEventos: eventos[11].length + eventos[12].length + eventos[13].length,
      eventosPorLinha: contarEventos(eventos),
      ...(avisos.length > 0 ? { aviso: avisos.join(' ') } : {}),
    };

    return NextResponse.json(resposta);
  } catch (error: unknown) {
    console.error('Falha ao compilar o Reporte de Turno:', error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Falha inesperada ao compilar o Reporte de Turno.',
      },
      { status: 500 },
    );
  }
}
