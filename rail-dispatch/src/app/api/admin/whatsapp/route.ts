import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import {
  obterConfiguracaoWhatsAppAtiva,
  salvarConfiguracaoWhatsApp,
  restaurarConfiguracaoWhatsAppPadrao,
  testarConexaoEvolution,
  ConfiguracaoWhatsApp,
} from '@/lib/whatsapp-config';

/**
 * GET /api/admin/whatsapp
 * Retorna as configurações ativas de WhatsApp e Evolution API
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = hasAdminSession(request);
    const dados = await obterConfiguracaoWhatsAppAtiva();

    // Se não for admin autenticado, mascara a chave de API para segurança
    const configRetorno: ConfiguracaoWhatsApp = {
      ...dados.config,
      apiKey: isAdmin
        ? dados.config.apiKey
        : dados.config.apiKey ? `${dados.config.apiKey.slice(0, 4)}...${dados.config.apiKey.slice(-4)}` : '',
    };

    return NextResponse.json({
      config: configRetorno,
      isCustom: dados.isCustom,
      updatedAt: dados.updatedAt,
      origem: dados.origem,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Falha ao consultar configurações de WhatsApp.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/whatsapp
 * Salva ou restaura configurações de WhatsApp
 */
export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso de administrador necessário.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição JSON inválido.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const payload = body as {
    config?: unknown;
    restaurarPadrao?: unknown;
  };

  // 1. Restaurar padrão de fábrica (.env.local)
  if (payload.restaurarPadrao === true) {
    try {
      await restaurarConfiguracaoWhatsAppPadrao();
      const dadosPadrao = await obterConfiguracaoWhatsAppAtiva();
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Configurações de WhatsApp restauradas para os padrões do servidor (.env)!',
        config: dadosPadrao.config,
        isCustom: false,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao restaurar configurações padrão.';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // 2. Salvar configurações customizadas
  if (!payload.config || typeof payload.config !== 'object') {
    return NextResponse.json({ error: 'Objeto de configuração deve ser fornecido.' }, { status: 400 });
  }

  const novaConfig = payload.config as ConfiguracaoWhatsApp;

  try {
    const resultado = await salvarConfiguracaoWhatsApp(novaConfig);
    const dadosSalvos = await obterConfiguracaoWhatsAppAtiva();

    return NextResponse.json({
      sucesso: true,
      mensagem: resultado.salvoNoBanco
        ? 'Configurações de WhatsApp sincronizadas no banco de dados com sucesso!'
        : 'Configurações salvas no servidor local com sucesso!',
      config: dadosSalvos.config,
      isCustom: true,
      salvoNoBanco: resultado.salvoNoBanco,
      aviso: resultado.erro ? `Aviso de sincronização: ${resultado.erro}` : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Falha ao salvar configurações.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/admin/whatsapp
 * Ações de diagnóstico: testar conexão e envio de mensagem de teste
 */
export async function PUT(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso de administrador necessário.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const payload = body as {
    acao?: 'testar_conexao' | 'enviar_teste';
    canal?: 'comunicacao' | 'operacao' | 'gerencia' | 'personalizado';
    jid?: string;
    texto?: string;
    config?: ConfiguracaoWhatsApp;
  };

  const dadosAtivos = await obterConfiguracaoWhatsAppAtiva();
  const config = payload.config || dadosAtivos.config;

  // Ação A: Teste de conexão
  if (payload.acao === 'testar_conexao') {
    const resultado = await testarConexaoEvolution(config);
    return NextResponse.json(resultado);
  }

  // Ação B: Enviar mensagem de teste
  if (payload.acao === 'enviar_teste') {
    let jidAlvo = payload.jid?.trim();
    if (!jidAlvo && payload.canal && payload.canal !== 'personalizado') {
      jidAlvo = config.grupos[payload.canal];
    }

    if (!jidAlvo) {
      return NextResponse.json({ error: 'Informe um JID ou selecione um canal com JID configurado.' }, { status: 400 });
    }

    const textoTeste = payload.texto?.trim() || `🧪 *Teste de Conexão CCO - SIDO*\nMensagem de teste enviada via Evolution API em ${new Date().toLocaleTimeString('pt-BR')}.\nSe você recebeu este informe, o disparo automático está funcionando perfeitamente!`;

    try {
      const url = `${config.apiUrl}/message/sendText/${encodeURIComponent(config.instanceName)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey,
        },
        body: JSON.stringify({
          number: jidAlvo,
          text: textoTeste,
          linkPreview: false,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        return NextResponse.json({
          sucesso: true,
          mensagem: `Mensagem de teste enviada com sucesso para ${jidAlvo}!`,
          detalhe: data,
        });
      }

      return NextResponse.json(
        {
          sucesso: false,
          error: (data as { message?: string })?.message || `Falha HTTP ${res.status} retornada pela Evolution API.`,
          detalhe: data,
        },
        { status: 400 }
      );
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Falha na comunicação com a Evolution API.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Ação não informada ou inválida.' }, { status: 400 });
}
