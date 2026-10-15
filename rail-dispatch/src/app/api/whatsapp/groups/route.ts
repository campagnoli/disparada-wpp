import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';

export interface WhatsAppGroup {
  id: string;
  subject: string;
  size?: number;
}

function emptyResponse(status: number, message?: string) {
  return NextResponse.json([], {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(message ? { 'X-Error-Message': message } : {}),
    },
  });
}

function parseGroups(data: unknown): WhatsAppGroup[] | null {
  const values =
    Array.isArray(data)
      ? data
      : typeof data === 'object' && data !== null && 'groups' in data && Array.isArray(data.groups)
        ? data.groups
        : null;

  if (!values) return null;

  return values.flatMap((value): WhatsAppGroup[] => {
    if (typeof value !== 'object' || value === null) return [];
    const group = value as { id?: unknown; subject?: unknown; size?: unknown };
    if (typeof group.id !== 'string' || typeof group.subject !== 'string') return [];
    return [{
      id: group.id,
      subject: group.subject,
      ...(typeof group.size === 'number' ? { size: group.size } : {}),
    }];
  });
}

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return emptyResponse(401, 'Acesso de administrador necessário.');
  }

  try {
    const { config } = await obterConfiguracaoWhatsAppAtiva();
    if (!config.apiUrl || !config.apiKey || !config.instanceName) {
      return emptyResponse(503, 'Configure a URL, a chave e o nome da instância da Evolution API.');
    }

    const instance = encodeURIComponent(config.instanceName);
    const headers = { apikey: config.apiKey };
    const stateResponse = await fetch(
      `${config.apiUrl}/instance/connectionState/${instance}`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }
    );
    if (!stateResponse.ok) {
      return emptyResponse(502, `Falha ao consultar o estado da instância (HTTP ${stateResponse.status}).`);
    }

    const stateData: unknown = await stateResponse.json().catch(() => null);
    const instanceState =
      typeof stateData === 'object' && stateData !== null && 'instance' in stateData
        ? (stateData.instance as { state?: unknown } | null)?.state
        : typeof stateData === 'object' && stateData !== null && 'state' in stateData
          ? stateData.state
          : undefined;

    if (instanceState !== 'open') {
      return emptyResponse(409, 'A instância do WhatsApp está desconectada.');
    }

    const groupsResponse = await fetch(
      `${config.apiUrl}/group/fetchAllGroups/${instance}?getParticipants=false`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }
    );

    if (!groupsResponse.ok) {
      return emptyResponse(502, `Falha ao buscar grupos na Evolution API (HTTP ${groupsResponse.status}).`);
    }

    const groups = parseGroups(await groupsResponse.json().catch(() => null));
    if (!groups) {
      return emptyResponse(502, 'A Evolution API retornou uma lista de grupos inválida.');
    }

    return NextResponse.json(groups, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar os grupos do WhatsApp.';
    return emptyResponse(502, message);
  }
}
