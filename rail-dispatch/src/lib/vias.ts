import { supabase } from '@/lib/supabase';

export type TipoLocalidade = 'estacao' | 'trecho';

export interface EstacaoViasInfo {
  sigla: string;
  vias: string[];
}

export interface TrechoViasInfo {
  linha: string;
  estacao_origem: string;
  estacao_destino: string;
  vias: string[];
}

export interface ValidacaoViasResultado {
  valido: boolean;
  mensagem?: string;
}

/**
 * Ordena numericamente e remove duplicatas de identificadores de vias.
 * Exemplos:
 *   ['3', '1', '2'] -> ['1', '2', '3']
 *   ['Via 2', 'Via 1'] -> ['1', '2']
 */
export function ordenarVias(vias: string[]): string[] {
  if (!Array.isArray(vias)) return [];

  const limpas = vias
    .map((v) => String(v).replace(/^via\s+/i, '').trim())
    .filter(Boolean);

  return Array.from(new Set(limpas)).sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Formata um array de identificadores de vias em texto legível para o CCO e passageiros.
 * Exemplos:
 *   ['1'] -> 'Via 1'
 *   ['1', '2'] -> 'Vias 1 e 2'
 *   ['1', '2', '4'] -> 'Vias 1, 2 e 4'
 *   [] -> ''
 */
export function formatarVias(vias: string[]): string {
  if (!Array.isArray(vias) || vias.length === 0) return '';

  const viasOrdenadas = ordenarVias(vias);
  if (viasOrdenadas.length === 0) return '';

  if (viasOrdenadas.length === 1) {
    const item = viasOrdenadas[0];
    return item.toLowerCase().startsWith('via') ? item : `Via ${item}`;
  }

  const nomesLimpos = viasOrdenadas.map((v) => v.replace(/^via\s+/i, ''));
  const ultimo = nomesLimpos[nomesLimpos.length - 1];
  const anteriores = nomesLimpos.slice(0, -1).join(', ');
  return `Vias ${anteriores} e ${ultimo}`;
}

/**
 * Valida se as vias atendem às regras de negócio operacionais:
 * - Em "estacao": seleção de via é OPCIONAL (pode ser vazio).
 * - Em "trecho": seleção de via é ESTRITAMENTE OBRIGATÓRIA (ao menos 1 via).
 */
export function validarViasOcorrencia(
  tipoLocalidade: TipoLocalidade,
  vias: string[]
): ValidacaoViasResultado {
  if (tipoLocalidade === 'trecho') {
    if (!Array.isArray(vias) || vias.length === 0) {
      return {
        valido: false,
        mensagem:
          'Para ocorrências em trecho entre estações, a seleção de ao menos uma via é estritamente obrigatória.',
      };
    }
  }

  return { valido: true };
}

export interface DadosEstacaoCompleta {
  vias: string[];
  plataformas: string[];
  itens_infraestrutura: string[];
}

/**
 * Consulta os dados completos de subsistemas de uma estação no Supabase:
 * vias, plataformas reais e itens de infraestrutura.
 */
export async function buscarDadosEstacao(
  siglaEstacao: string,
  linhaEstacao?: string
): Promise<DadosEstacaoCompleta> {
  if (!siglaEstacao) {
    return { vias: [], plataformas: [], itens_infraestrutura: [] };
  }

  try {
    let query = supabase
      .from('estacoes')
      .select('vias, plataformas, itens_infraestrutura')
      .eq('sigla', siglaEstacao.toUpperCase());

    if (linhaEstacao) {
      const linhaNorm = linhaEstacao.replace(/^Linha\s+/i, '').trim();
      query = query.or(`linha.eq."${linhaNorm}",linha.eq."Linha ${linhaNorm}"`);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error(`Erro ao buscar dados da estação ${siglaEstacao}:`, error.message);
      return { vias: [], plataformas: [], itens_infraestrutura: [] };
    }

    return {
      vias: data && Array.isArray(data.vias) ? ordenarVias(data.vias) : [],
      plataformas: data && Array.isArray(data.plataformas) ? data.plataformas : [],
      itens_infraestrutura:
        data && Array.isArray(data.itens_infraestrutura) ? data.itens_infraestrutura : [],
    };
  } catch (err: unknown) {
    console.error(`Exceção ao buscar dados da estação ${siglaEstacao}:`, err);
    return { vias: [], plataformas: [], itens_infraestrutura: [] };
  }
}

/**
 * Consulta as vias disponíveis para uma determinada estação no Supabase.
 */
export async function buscarViasEstacao(
  siglaEstacao: string,
  linhaEstacao?: string
): Promise<string[]> {
  const dados = await buscarDadosEstacao(siglaEstacao, linhaEstacao);
  return dados.vias;
}

interface TrechoMalhaConhecida {
  origem: string;
  destino: string;
  vias: string[];
}

const MALHA_TRECHOS_FALLBACK: Record<string, TrechoMalhaConhecida[]> = {
  '11-Coral': [
    { origem: 'BFU', destino: 'LUZ', vias: ['3', '4'] },
    { origem: 'LUZ', destino: 'BAS', vias: ['3', '4'] },
    { origem: 'BAS', destino: 'TAT', vias: ['1', '3'] },
    { origem: 'TAT', destino: 'EST', vias: ['1', '2'] },
  ],
  '12-Safira': [
    { origem: 'BAS', destino: 'TAT', vias: ['2', '4'] },
    { origem: 'TAT', destino: 'CVN', vias: ['1', '2'] },
  ],
};

/**
 * Consulta as vias disponíveis para um trecho no Supabase:
 * 1. Prioriza busca de trecho direto na tabela `trechos` (A -> B ou B -> A).
 * 2. Caso não encontre par direto exato (ex: estações não-vizinhas como BAS e ITQ),
 *    utiliza a coluna `ordem` da tabela `estacoes` para obter todos os trechos/estações
 *    compreendidos no intervalo e calcula a união das vias (ordenadas numericamente).
 */
export async function buscarViasTrecho(
  linha: string,
  origem: string,
  destino: string
): Promise<string[]> {
  if (!linha || !origem || !destino || origem === destino) return [];

  const linhaNormalizada = linha.replace(/^Linha\s+/i, '').trim();
  const linhaComPrefixo = linhaNormalizada.startsWith('Linha ')
    ? linhaNormalizada
    : `Linha ${linhaNormalizada}`;
  const orig = origem.toUpperCase().trim();
  const dest = destino.toUpperCase().trim();

  try {
    // 1. Caso de Trecho Direto na tabela `trechos` (consecutivo direto A -> B ou B -> A)
    const { data: trechoDireto, error: errDireto } = await supabase
      .from('trechos')
      .select('vias')
      .or(`linha.eq."${linhaNormalizada}",linha.eq."${linhaComPrefixo}"`)
      .or(`and(estacao_origem.eq."${orig}",estacao_destino.eq."${dest}"),and(estacao_origem.eq."${dest}",estacao_destino.eq."${orig}")`)
      .maybeSingle();

    if (!errDireto && trechoDireto && Array.isArray(trechoDireto.vias) && trechoDireto.vias.length > 0) {
      return ordenarVias(trechoDireto.vias);
    }

    // 2. Fallback baseado na sequência (ordem) de estações na linha
    const { data: estacoesLinha, error: errEstacoes } = await supabase
      .from('estacoes')
      .select('sigla, ordem, vias')
      .or(`linha.eq."${linhaNormalizada}",linha.eq."${linhaComPrefixo}"`)
      .order('ordem');

    if (errEstacoes) {
      console.warn(`Aviso ao buscar estações para trecho ${orig}-${dest}:`, errEstacoes.message);
    }

    const mapaOrdem = new Map<string, number>();
    if (estacoesLinha) {
      for (const e of estacoesLinha) {
        if (typeof e.ordem === 'number') {
          mapaOrdem.set(e.sigla.toUpperCase(), e.ordem);
        }
      }
    }

    const ordemOrigem = mapaOrdem.get(orig);
    const ordemDestino = mapaOrdem.get(dest);

    const viasColetadas: string[] = [];

    if (ordemOrigem !== undefined && ordemDestino !== undefined) {
      const minOrdem = Math.min(ordemOrigem, ordemDestino);
      const maxOrdem = Math.max(ordemOrigem, ordemDestino);

      // 2.1. Buscar todos os trechos da linha no Supabase
      const { data: todosTrechos, error: errTrechos } = await supabase
        .from('trechos')
        .select('estacao_origem, estacao_destino, vias')
        .or(`linha.eq."${linhaNormalizada}",linha.eq."${linhaComPrefixo}"`);

      if (errTrechos) {
        console.warn('Aviso ao buscar lista de trechos no Supabase:', errTrechos.message);
      }

      if (todosTrechos && todosTrechos.length > 0) {
        for (const t of todosTrechos) {
          const o = mapaOrdem.get(t.estacao_origem.toUpperCase());
          const d = mapaOrdem.get(t.estacao_destino.toUpperCase());
          if (o !== undefined && d !== undefined) {
            const tMin = Math.min(o, d);
            const tMax = Math.max(o, d);
            // Verifica sobreposição entre o intervalo [minOrdem, maxOrdem] e o trecho [tMin, tMax]
            if (Math.max(minOrdem, tMin) < Math.min(maxOrdem, tMax)) {
              if (Array.isArray(t.vias)) {
                viasColetadas.push(...t.vias);
              }
            }
          }
        }
      }

      // 2.2. Se as estações do intervalo contiverem vias cadastradas, agrega à união
      if (estacoesLinha) {
        const estacoesNoIntervalo = estacoesLinha.filter(
          (e) => typeof e.ordem === 'number' && e.ordem >= minOrdem && e.ordem <= maxOrdem
        );
        for (const e of estacoesNoIntervalo) {
          if (Array.isArray(e.vias)) {
            viasColetadas.push(...e.vias);
          }
        }
      }

      // 2.3. Fallback da malha ferroviária estática caso não haja trechos no banco
      if (viasColetadas.length === 0) {
        const trechosMalha = MALHA_TRECHOS_FALLBACK[linhaNormalizada] || [];
        for (const t of trechosMalha) {
          const o = mapaOrdem.get(t.origem.toUpperCase());
          const d = mapaOrdem.get(t.destino.toUpperCase());
          if (o !== undefined && d !== undefined) {
            const tMin = Math.min(o, d);
            const tMax = Math.max(o, d);
            if (Math.max(minOrdem, tMin) < Math.min(maxOrdem, tMax)) {
              viasColetadas.push(...t.vias);
            }
          }
        }
      }
    }

    return ordenarVias(viasColetadas);
  } catch (err: unknown) {
    console.error(`Exceção ao buscar trecho ${orig}-${dest}:`, err);
    return [];
  }
}
