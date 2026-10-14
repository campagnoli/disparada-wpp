import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import {
  obterPromptSistemaAtivo,
  salvarPromptSistema,
  restaurarPromptPadrao,
  PROMPT_SISTEMA_PADRAO,
} from '@/lib/gemini-prompt';

/**
 * GET /api/admin/prompt
 * Retorna o prompt do sistema atualmente ativo, status de customização e o prompt padrão de fábrica.
 */
export async function GET() {
  try {
    const dados = await obterPromptSistemaAtivo();
    return NextResponse.json(
      {
        prompt: dados.prompt,
        isCustom: dados.isCustom,
        updatedAt: dados.updatedAt,
        origem: dados.origem,
        promptPadrao: PROMPT_SISTEMA_PADRAO,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Falha ao obter prompt do sistema:', error);
    return NextResponse.json(
      {
        prompt: PROMPT_SISTEMA_PADRAO,
        isCustom: false,
        updatedAt: null,
        origem: 'padrao',
        promptPadrao: PROMPT_SISTEMA_PADRAO,
        error: error instanceof Error ? error.message : 'Erro ao recuperar prompt.',
      },
      { status: 200 }
    );
  }
}

/**
 * POST /api/admin/prompt
 * Atualiza ou restaura o prompt do sistema (exige autenticação administrativa).
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

  const payload = body as { prompt?: unknown; restaurarPadrao?: unknown; restaurar?: unknown };

  // 1. Restaurar padrão de fábrica
  if (payload.restaurarPadrao === true || payload.restaurar === true) {
    try {
      await restaurarPromptPadrao();
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Prompt de fábrica restaurado com sucesso!',
        prompt: PROMPT_SISTEMA_PADRAO,
        isCustom: false,
      });
    } catch (error: unknown) {
      console.error('Erro ao restaurar prompt padrão:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Falha ao restaurar prompt.' },
        { status: 500 }
      );
    }
  }

  // 2. Salvar novo prompt
  if (typeof payload.prompt !== 'string' || payload.prompt.trim().length === 0) {
    return NextResponse.json({ error: 'O prompt fornecido não pode ser vazio.' }, { status: 400 });
  }

  try {
    const resultado = await salvarPromptSistema(payload.prompt);
    return NextResponse.json({
      sucesso: true,
      mensagem: resultado.salvoNoBanco
        ? 'Prompt do Gemini atualizado e sincronizado no banco de dados com sucesso!'
        : 'Prompt do Gemini salvo com sucesso no servidor!',
      prompt: payload.prompt.trim(),
      isCustom: true,
      salvoNoBanco: resultado.salvoNoBanco,
      aviso: resultado.erro ? `Aviso de sincronização: ${resultado.erro}` : undefined,
    });
  } catch (error: unknown) {
    console.error('Erro ao salvar prompt customizado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao salvar o prompt.' },
      { status: 500 }
    );
  }
}
