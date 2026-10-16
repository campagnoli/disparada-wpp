export const LINHAS_OPERACIONAIS = [
  'Linha 11-Coral',
  'Linha 12-Safira',
  'Linha 13-Jade',
] as const;

export interface DadosImpactoOutraLinha {
  temImpactoOutraLinha: boolean;
  linhasImpactadasSecundarias: string[];
  descricaoImpactoSecundario: string;
}

export function normalizarImpactoOutraLinha(
  temImpactoRecebido: unknown,
  linhasRecebidas: unknown,
  descricaoRecebida: unknown,
  linhaPrincipal: string,
): DadosImpactoOutraLinha | null {
  if (temImpactoRecebido !== undefined && typeof temImpactoRecebido !== 'boolean') return null;
  if (linhasRecebidas !== undefined && !Array.isArray(linhasRecebidas)) return null;
  if (descricaoRecebida !== undefined && typeof descricaoRecebida !== 'string') return null;

  const temImpactoOutraLinha = temImpactoRecebido === true;
  const linhas = Array.isArray(linhasRecebidas) ? linhasRecebidas : [];
  if (
    linhas.some((linha) =>
      typeof linha !== 'string'
      || !LINHAS_OPERACIONAIS.some((opcao) => opcao === linha)
      || linha === linhaPrincipal
    )
  ) {
    return null;
  }

  const linhasImpactadasSecundarias = [...new Set(linhas as string[])];
  if (linhasImpactadasSecundarias.length !== linhas.length) return null;

  const descricaoImpactoSecundario = typeof descricaoRecebida === 'string'
    ? descricaoRecebida.trim()
    : '';

  if (
    temImpactoOutraLinha
    && (
      linhasImpactadasSecundarias.length === 0
      || !descricaoImpactoSecundario
      || descricaoImpactoSecundario.length > 5000
    )
  ) {
    return null;
  }

  return temImpactoOutraLinha
    ? { temImpactoOutraLinha, linhasImpactadasSecundarias, descricaoImpactoSecundario }
    : { temImpactoOutraLinha, linhasImpactadasSecundarias: [], descricaoImpactoSecundario: '' };
}
