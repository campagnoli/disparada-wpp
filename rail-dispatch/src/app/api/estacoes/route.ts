import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const linha = new URL(request.url).searchParams.get('linha');

  let query = supabase
    .from('estacoes')
    .select('id, nome, sigla, linha, ordem, vias, plataformas, itens_infraestrutura');

  if (linha) {
    const linhaNormalizada = linha.replace(/^Linha\s+/i, '').trim();
    const linhaComPrefixo = linhaNormalizada.startsWith('Linha ')
      ? linhaNormalizada
      : `Linha ${linhaNormalizada}`;

    query = query
      .or(`linha.eq."${linhaComPrefixo}",linha.eq."${linhaNormalizada}"`)
      .order('ordem');
  } else {
    query = query.order('linha').order('ordem');
  }

  const { data: estacoes, error } = await query;

  if (error) {
    console.error('Não foi possível carregar estações do Supabase:', error.message);
    return NextResponse.json({ error: 'Não foi possível carregar as estações.' }, { status: 500 });
  }

  return NextResponse.json({ estacoes: estacoes ?? [] });
}
