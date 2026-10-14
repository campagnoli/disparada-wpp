import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

interface FalhaPredefinida {
  id: number;
  descricao: string;
  impacto: string;
  ordem: number;
}

export async function GET() {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from('falhas_predefinidas')
      .select('id, descricao, impacto, ordem')
      .order('ordem')
      .order('descricao');

    if (error) throw error;
    return NextResponse.json(
      { falhas: data as FalhaPredefinida[] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Falha ao carregar falhas predefinidas:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as opções de falha.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso de administrador necessário.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  // Suporte a importação em lote (ex: via CSV)
  if (typeof body === 'object' && body !== null && 'lote' in body && Array.isArray((body as { lote: unknown }).lote)) {
    const rawLote = (body as { lote: unknown[] }).lote;
    if (rawLote.length === 0) {
      return NextResponse.json({ error: 'Nenhum item informado para importação.' }, { status: 400 });
    }
    if (rawLote.length > 500) {
      return NextResponse.json({ error: 'Limite de 500 itens por importação excedido.' }, { status: 400 });
    }

    const loteValido: { descricao: string; impacto: string }[] = [];
    for (let i = 0; i < rawLote.length; i++) {
      const item = rawLote[i];
      if (
        typeof item !== 'object'
        || item === null
        || !('descricao' in item)
        || typeof (item as { descricao: unknown }).descricao !== 'string'
        || !('impacto' in item)
        || typeof (item as { impacto: unknown }).impacto !== 'string'
      ) {
        return NextResponse.json({ error: `Item ${i + 1} com formato inválido.` }, { status: 400 });
      }

      const descricao = (item as { descricao: string }).descricao.trim().replace(/\s+/g, ' ');
      const impacto = (item as { impacto: string }).impacto.trim().replace(/\s+/g, ' ');

      if (!descricao || descricao.length > 120 || !impacto || impacto.length > 500) {
        return NextResponse.json(
          { error: `Item ${i + 1} ("${descricao.slice(0, 30)}"): a falha deve ter até 120 caracteres e o impacto de 1 a 500 caracteres.` },
          { status: 400 }
        );
      }
      loteValido.push({ descricao, impacto });
    }

    try {
      const supabase = createSupabaseAdminClient();
      const { data: ultimaFalha, error: buscaError } = await supabase
        .from('falhas_predefinidas')
        .select('ordem')
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (buscaError) throw buscaError;

      const { data: existentes, error: existentesError } = await supabase
        .from('falhas_predefinidas')
        .select('descricao');

      if (existentesError) throw existentesError;

      const existentesSet = new Set((existentes ?? []).map((f) => f.descricao.toLowerCase().trim()));
      let ordemAtual = ultimaFalha?.ordem ?? 0;
      const novasParaInserir: { descricao: string; impacto: string; ordem: number }[] = [];
      let ignoradas = 0;

      for (const item of loteValido) {
        const chave = item.descricao.toLowerCase().trim();
        if (existentesSet.has(chave)) {
          ignoradas++;
        } else {
          existentesSet.add(chave);
          ordemAtual += 1;
          novasParaInserir.push({
            descricao: item.descricao,
            impacto: item.impacto,
            ordem: ordemAtual,
          });
        }
      }

      if (novasParaInserir.length > 0) {
        const { error: insertError } = await supabase
          .from('falhas_predefinidas')
          .insert(novasParaInserir);

        if (insertError) throw insertError;
      }

      return NextResponse.json({
        sucesso: true,
        inseridas: novasParaInserir.length,
        ignoradas,
        total: loteValido.length,
      }, { status: 201 });
    } catch (error: unknown) {
      console.error('Falha ao importar lote de falhas:', error);
      return NextResponse.json({ error: 'Não foi possível importar o lote de falhas.' }, { status: 500 });
    }
  }

  if (
    typeof body !== 'object'
    || body === null
    || !('descricao' in body)
    || typeof body.descricao !== 'string'
    || !('impacto' in body)
    || typeof body.impacto !== 'string'
  ) {
    return NextResponse.json({ error: 'Informe a descrição da falha e o impacto inicial.' }, { status: 400 });
  }

  const descricao = body.descricao.trim().replace(/\s+/g, ' ');
  const impacto = body.impacto.trim().replace(/\s+/g, ' ');
  if (!descricao || descricao.length > 120 || !impacto || impacto.length > 500) {
    return NextResponse.json({ error: 'A falha deve ter até 120 caracteres e o impacto, entre 1 e 500 caracteres.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: ultimaFalha, error: buscaError } = await supabase
      .from('falhas_predefinidas')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (buscaError) throw buscaError;

    const { data, error } = await supabase
      .from('falhas_predefinidas')
      .insert({ descricao, impacto, ordem: (ultimaFalha?.ordem ?? 0) + 1 })
      .select('id, descricao, impacto, ordem')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Essa opção já está cadastrada.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ falha: data as FalhaPredefinida }, { status: 201 });
  } catch (error: unknown) {
    console.error('Falha ao cadastrar opção de falha:', error);
    return NextResponse.json({ error: 'Não foi possível cadastrar a opção.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso de administrador necessário.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (
    typeof body !== 'object'
    || body === null
    || !('id' in body)
    || typeof body.id !== 'number'
    || !Number.isSafeInteger(body.id)
    || body.id < 1
    || !('descricao' in body)
    || typeof body.descricao !== 'string'
    || !('impacto' in body)
    || typeof body.impacto !== 'string'
  ) {
    return NextResponse.json({ error: 'Informe o identificador, a descrição da falha e o impacto inicial.' }, { status: 400 });
  }

  const descricao = body.descricao.trim().replace(/\s+/g, ' ');
  const impacto = body.impacto.trim().replace(/\s+/g, ' ');
  if (!descricao || descricao.length > 120 || !impacto || impacto.length > 500) {
    return NextResponse.json({ error: 'A falha deve ter até 120 caracteres e o impacto, entre 1 e 500 caracteres.' }, { status: 400 });
  }

  try {
    const { data, error } = await createSupabaseAdminClient()
      .from('falhas_predefinidas')
      .update({ descricao, impacto })
      .eq('id', body.id)
      .select('id, descricao, impacto, ordem')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Essa opção já está cadastrada.' }, { status: 409 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ error: 'A opção não foi encontrada.' }, { status: 404 });

    return NextResponse.json({ falha: data as FalhaPredefinida });
  } catch (error: unknown) {
    console.error('Falha ao atualizar opção de falha:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar a opção.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Acesso de administrador necessário.' }, { status: 401 });
  }

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Identificador da opção inválido.' }, { status: 400 });
  }

  try {
    const { error, data } = await createSupabaseAdminClient()
      .from('falhas_predefinidas')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: 'A opção não foi encontrada.' }, { status: 404 });

    return NextResponse.json({ removida: true });
  } catch (error: unknown) {
    console.error('Falha ao remover opção de falha:', error);
    return NextResponse.json({ error: 'Não foi possível remover a opção.' }, { status: 500 });
  }
}
