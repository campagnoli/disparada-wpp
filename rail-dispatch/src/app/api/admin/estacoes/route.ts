import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { supabase } from '@/lib/supabase';
import { ordenarVias } from '@/lib/vias';

/**
 * GET /api/admin/estacoes
 * Retorna todas as estações cadastradas com vias, plataformas e itens de infraestrutura.
 */
export async function GET() {
  try {
    const { data: estacoes, error } = await supabase
      .from('estacoes')
      .select('id, nome, sigla, linha, ordem, vias, plataformas, itens_infraestrutura')
      .order('linha')
      .order('ordem');

    if (error) {
      console.error('Erro ao listar estações no admin:', error.message);
      return NextResponse.json(
        { error: 'Falha ao buscar estações no banco de dados.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ estacoes: estacoes ?? [] });
  } catch (err: unknown) {
    console.error('Exceção ao listar estações:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno ao listar estações.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/estacoes
 * Cria ou atualiza uma estação (requer sessão de admin).
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
    id?: string;
    nome?: unknown;
    sigla?: unknown;
    linha?: unknown;
    ordem?: unknown;
    vias?: unknown;
    plataformas?: unknown;
    itens_infraestrutura?: unknown;
  };

  const nome = typeof payload.nome === 'string' ? payload.nome.trim() : '';
  const sigla = typeof payload.sigla === 'string' ? payload.sigla.trim().toUpperCase() : '';
  const linha = typeof payload.linha === 'string' ? payload.linha.trim() : '';
  const ordem = typeof payload.ordem === 'number' ? payload.ordem : Number(payload.ordem);

  if (!nome || !sigla || !linha || isNaN(ordem)) {
    return NextResponse.json(
      { error: 'Nome, sigla, linha e ordem física são obrigatórios.' },
      { status: 400 }
    );
  }

  const vias = Array.isArray(payload.vias)
    ? ordenarVias(payload.vias.map((v) => String(v).trim()).filter(Boolean))
    : [];

  const plataformas = Array.isArray(payload.plataformas)
    ? Array.from(new Set(payload.plataformas.map((p) => String(p).trim()).filter(Boolean))).sort(
        (a, b) => {
          const nA = Number(a);
          const nB = Number(b);
          if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
          return a.localeCompare(b);
        }
      )
    : [];

  const itensValidos = ['elevador', 'escada_rolante', 'linha_bloqueio', 'acesso_estacao'];
  const itensInfra = Array.isArray(payload.itens_infraestrutura)
    ? payload.itens_infraestrutura.filter((item) => itensValidos.includes(String(item)))
    : itensValidos;

  try {
    const admin = createSupabaseAdminClient();

    const registro: Record<string, unknown> = {
      nome,
      sigla,
      linha,
      ordem,
      vias,
      plataformas,
      itens_infraestrutura: itensInfra,
    };

    if (payload.id && typeof payload.id === 'string' && payload.id.trim()) {
      registro.id = payload.id.trim();
    }

    const { data, error } = await admin
      .from('estacoes')
      .upsert(registro, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Erro ao salvar estação no Supabase:', error.message);
      return NextResponse.json(
        { error: `Erro ao salvar estação: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `Estação ${nome} (${sigla}) salva com sucesso!`,
      estacao: data,
    });
  } catch (err: unknown) {
    console.error('Exceção ao salvar estação:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao salvar estação.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/estacoes
 * Remove uma estação (requer sessão de admin).
 */
export async function DELETE(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso de administrador necessário.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const sigla = searchParams.get('sigla');
  const linha = searchParams.get('linha');

  if (!id && (!sigla || !linha)) {
    return NextResponse.json(
      { error: 'Informe o ID ou a sigla e linha da estação para exclusão.' },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    let query = admin.from('estacoes').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (sigla && linha) {
      query = query.eq('sigla', sigla.toUpperCase()).eq('linha', linha);
    }

    const { error } = await query;
    if (error) {
      console.error('Erro ao excluir estação:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Estação removida com sucesso!',
    });
  } catch (err: unknown) {
    console.error('Exceção ao excluir estação:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao excluir estação.' },
      { status: 500 }
    );
  }
}
