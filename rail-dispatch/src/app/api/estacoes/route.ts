import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const linha = new URL(request.url).searchParams.get('linha');

  if (!linha) {
    return NextResponse.json({ error: 'Informe a linha para carregar as estações.' }, { status: 400 });
  }

  const { data: estacoes, error } = await supabase
    .from('estacoes')
    .select('nome, sigla, linha')
    .eq('linha', linha)
    .order('ordem');

  if (error) {
    console.error('Não foi possível carregar estações do Supabase:', error.message);
    return NextResponse.json({ error: 'Não foi possível carregar as estações.' }, { status: 500 });
  }

  return NextResponse.json({ estacoes: estacoes ?? [] });
}
