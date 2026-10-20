import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';
import {
  EvolutionApiError,
  EvolutionTimeoutError,
  listarGruposEvolution,
  type GrupoEvolution,
} from '@/lib/evolution/grupos';

export type WhatsAppGroup = GrupoEvolution;

function emptyResponse(status: number, message?: string) {
  return NextResponse.json([], {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(message ? { 'X-Error-Message': message } : {}),
    },
  });
}

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return emptyResponse(401, 'Acesso de administrador necessário.');
  }

  try {
    const { config } = await obterConfiguracaoWhatsAppAtiva();
    const refresh = request.nextUrl.searchParams.get('refresh') === '1';
    const groups = await listarGruposEvolution(config, { refresh });

    return NextResponse.json(groups, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    if (error instanceof EvolutionTimeoutError) {
      return emptyResponse(
        504,
        `${error.message} A lista pode estar grande ou a Evolution API está sobrecarregada. Tente novamente em instantes.`
      );
    }

    if (error instanceof EvolutionApiError) {
      return emptyResponse(error.status, error.message);
    }

    const message =
      error instanceof Error ? error.message : 'Falha ao buscar os grupos do WhatsApp.';
    return emptyResponse(502, message);
  }
}
