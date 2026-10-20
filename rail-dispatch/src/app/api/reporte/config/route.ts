import { NextResponse } from 'next/server';
import { obterFrotaLinhas } from '@/lib/reporte-turno/frota';
import { obterTemplateReporteAtivo } from '@/lib/reporte-turno/template';
import { TEMPLATE_REPORTE_PADRAO } from '@/lib/reporte-turno/template-pure';
import type { ConfiguracaoReporteAPI, GrupoReporte } from '@/lib/reporte-turno/tipos';
import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';

export async function GET() {
  try {
    const [frota, template, whatsapp] = await Promise.all([
      obterFrotaLinhas(),
      obterTemplateReporteAtivo(),
      obterConfiguracaoWhatsAppAtiva(),
    ]);

    const grupos = {
      comunicacao: { configurado: Boolean(whatsapp.config.grupos.comunicacao) },
      operacao: { configurado: Boolean(whatsapp.config.grupos.operacao) },
      gerencia: { configurado: Boolean(whatsapp.config.grupos.gerencia) },
    } satisfies Record<GrupoReporte, { configurado: boolean }>;

    const avisos = [frota.aviso, template.aviso].filter(Boolean);
    const resposta: ConfiguracaoReporteAPI = {
      frota: frota.linhas,
      template: template.template || TEMPLATE_REPORTE_PADRAO,
      templatePadrao: TEMPLATE_REPORTE_PADRAO,
      isCustom: template.isCustom,
      updatedAt: template.updatedAt,
      grupos,
      ...(avisos.length > 0 ? { aviso: avisos.join(' ') } : {}),
    };

    return NextResponse.json(resposta);
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
