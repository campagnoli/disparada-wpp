import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';

interface EvolutionError {
  message?: string | string[];
  error?: string;
}

function errorMessage(data: unknown, fallback: string): string {
  if (typeof data !== 'object' || data === null) return fallback;

  const payload = data as EvolutionError;
  if (typeof payload.message === 'string') return payload.message;
  if (Array.isArray(payload.message)) return payload.message.join(', ');
  if (typeof payload.error === 'string') return payload.error;
  return fallback;
}

async function getEvolutionConfig(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return {
      response: NextResponse.json({ error: 'Acesso de administrador necessário.' }, { status: 401 }),
    };
  }

  const { config } = await obterConfiguracaoWhatsAppAtiva();
  if (!config.apiUrl || !config.apiKey || !config.instanceName) {
    return {
      response: NextResponse.json(
        { error: 'Configure a URL, a chave e o nome da instância da Evolution API.' },
        { status: 503 }
      ),
    };
  }

  return { config };
}

export async function GET(request: NextRequest) {
  try {
    const result = await getEvolutionConfig(request);
    if ('response' in result) return result.response;

    const { config } = result;
    const instance = encodeURIComponent(config.instanceName);
    const headers = { apikey: config.apiKey };
    const stateResponse = await fetch(
      `${config.apiUrl}/instance/connectionState/${instance}`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }
    );
    const stateData: unknown = await stateResponse.json().catch(() => null);

    if (!stateResponse.ok) {
      return NextResponse.json(
        { error: errorMessage(stateData, `Falha ao consultar a Evolution API (HTTP ${stateResponse.status}).`) },
        { status: 502 }
      );
    }

    const instanceState =
      typeof stateData === 'object' && stateData !== null && 'instance' in stateData
        ? (stateData.instance as { state?: unknown } | null)?.state
        : typeof stateData === 'object' && stateData !== null && 'state' in stateData
          ? stateData.state
          : undefined;

    if (instanceState === 'open') {
      return NextResponse.json(
        { state: 'open', connected: true },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const connectResponse = await fetch(
      `${config.apiUrl}/instance/connect/${instance}`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }
    );
    const connectData: unknown = await connectResponse.json().catch(() => null);

    if (!connectResponse.ok) {
      return NextResponse.json(
        { error: errorMessage(connectData, `Falha ao gerar o QR Code (HTTP ${connectResponse.status}).`) },
        { status: 502 }
      );
    }

    const data =
      typeof connectData === 'object' && connectData !== null && 'base64' in connectData
        ? connectData as { base64?: unknown; pairingCode?: unknown }
        : null;

    if (!data || typeof data.base64 !== 'string' || !data.base64) {
      return NextResponse.json(
        { error: 'A Evolution API não retornou um QR Code válido para esta instância.' },
        { status: 502 }
      );
    }

    const qrcode = data.base64.startsWith('data:')
      ? data.base64
      : `data:image/png;base64,${data.base64}`;

    return NextResponse.json(
      {
        state: 'connecting',
        qrcode,
        pairingCode: typeof data.pairingCode === 'string' ? data.pairingCode : null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao comunicar com a Evolution API.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await getEvolutionConfig(request);
    if ('response' in result) return result.response;

    const { config } = result;
    const response = await fetch(
      `${config.apiUrl}/instance/logout/${encodeURIComponent(config.instanceName)}`,
      {
        method: 'DELETE',
        headers: { apikey: config.apiKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      }
    );
    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: errorMessage(data, `Falha ao desconectar a instância (HTTP ${response.status}).`) },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { state: 'close', connected: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao comunicar com a Evolution API.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
