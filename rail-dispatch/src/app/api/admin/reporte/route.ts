import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import { obterFrotaLinhas, salvarFrotaLinhas } from '@/lib/reporte-turno/frota';
import {
  obterTemplateReporteAtivo,
  restaurarTemplateReporte,
  salvarTemplateReporte,
} from '@/lib/reporte-turno/template';
import {
  TEMPLATE_REPORTE_PADRAO,
  templateReporteValido,
} from '@/lib/reporte-turno/template-pure';
import type { ConfiguracaoFrotaLinha } from '@/lib/reporte-turno/tipos';

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

async function carregarConfiguracao() {
  const [frota, template] = await Promise.all([
    obterFrotaLinhas(),
    obterTemplateReporteAtivo(),
  ]);

  return {
    frota: frota.linhas,
    template: template.template || TEMPLATE_REPORTE_PADRAO,
    templatePadrao: TEMPLATE_REPORTE_PADRAO,
    isCustom: template.isCustom,
    updatedAt: template.updatedAt,
    ...(frota.aviso || template.aviso
      ? { aviso: [frota.aviso, template.aviso].filter(Boolean).join(' ') }
      : {}),
  };
}

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso administrativo necessário.' }, { status: 401 });
  }

  try {
    return NextResponse.json(await carregarConfiguracao());
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Falha ao carregar a configuração do reporte.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso administrativo necessário.' }, { status: 401 });
  }

  try {
    const corpo = await request.json().catch(() => null);
    if (!isRecord(corpo)) {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    const restaurar = corpo.restaurarTemplate === true;
    const template = typeof corpo.template === 'string' ? corpo.template : null;
    const frota = Array.isArray(corpo.frota) ? corpo.frota : null;

    if (!restaurar && template === null && frota === null) {
      return NextResponse.json(
        { error: 'Nenhuma alteração foi enviada.' },
        { status: 400 },
      );
    }

    if (!restaurar && template !== null && !templateReporteValido(template)) {
      return NextResponse.json(
        { error: 'O modelo do reporte não contém todas as tags obrigatórias.' },
        { status: 400 },
      );
    }

    if (frota !== null) {
      await salvarFrotaLinhas(frota as ConfiguracaoFrotaLinha[]);
    }

    if (restaurar) {
      await restaurarTemplateReporte();
    } else if (template !== null) {
      await salvarTemplateReporte(template);
    }

    return NextResponse.json(await carregarConfiguracao());
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Falha ao salvar a configuração do reporte.',
      },
      { status: 500 },
    );
  }
}
