import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import {
  obterTemplatesMensagemAtivos,
  salvarTemplatesMensagem,
  restaurarTemplatesPadrao,
  TEMPLATES_MENSAGEM_PADRAO,
  TemplatesMensagem,
} from '@/lib/mensagem-templates';


/**
 * GET /api/admin/templates
 * Retorna os templates de mensagem ativos para cada grupo e os padrões de fábrica.
 */
export async function GET() {
  try {
    const dados = await obterTemplatesMensagemAtivos();
    return NextResponse.json({
      templates: dados.templates,
      isCustom: dados.isCustom,
      updatedAt: dados.updatedAt,
      origem: dados.origem,
      templatesPadrao: TEMPLATES_MENSAGEM_PADRAO,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Falha ao consultar templates de mensagem.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/templates
 * Salva ou restaura os templates de mensagem (requer autenticação administrativa).
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
    templates?: unknown;
    restaurarPadrao?: unknown;
    restaurar?: unknown;
  };

  // 1. Restaurar padrão de fábrica
  if (payload.restaurarPadrao === true || payload.restaurar === true) {
    try {
      await restaurarTemplatesPadrao();
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Modelos de mensagem de fábrica restaurados com sucesso!',
        templates: TEMPLATES_MENSAGEM_PADRAO,
        isCustom: false,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao restaurar templates padrão.';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // 2. Salvar templates customizados
  if (
    !payload.templates ||
    typeof payload.templates !== 'object'
  ) {
    return NextResponse.json(
      { error: 'Objeto com os templates de cada grupo deve ser fornecido.' },
      { status: 400 }
    );
  }

  const rawTemplates = payload.templates as Record<string, unknown>;

  const novosTemplates: TemplatesMensagem = {
    comunicacao:
      typeof rawTemplates.comunicacao === 'string' && rawTemplates.comunicacao.trim().length > 0
        ? rawTemplates.comunicacao.trim()
        : TEMPLATES_MENSAGEM_PADRAO.comunicacao,
    operacao:
      typeof rawTemplates.operacao === 'string' && rawTemplates.operacao.trim().length > 0
        ? rawTemplates.operacao.trim()
        : TEMPLATES_MENSAGEM_PADRAO.operacao,
    gerencia:
      typeof rawTemplates.gerencia === 'string' && rawTemplates.gerencia.trim().length > 0
        ? rawTemplates.gerencia.trim()
        : TEMPLATES_MENSAGEM_PADRAO.gerencia,
  };

  try {
    const resultado = await salvarTemplatesMensagem(novosTemplates);

    return NextResponse.json({
      sucesso: true,
      mensagem: resultado.salvoNoBanco
        ? 'Modelos de mensagem sincronizados com sucesso no Supabase!'
        : 'Modelos de mensagem salvos com sucesso no servidor!',
      templates: novosTemplates,
      isCustom: true,
      salvoNoBanco: resultado.salvoNoBanco,
      aviso: resultado.erro ? `Aviso de sincronização: ${resultado.erro}` : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Falha ao salvar novos modelos de mensagem.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
