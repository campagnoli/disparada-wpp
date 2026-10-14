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
