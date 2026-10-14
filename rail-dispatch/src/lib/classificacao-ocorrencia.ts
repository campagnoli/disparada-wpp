export const opcoesClassificacao = [
  { valor: 'IN', rotulo: 'IN (Incidente Notável)' },
  { valor: 'COPESE', rotulo: 'COPESE' },
  { valor: 'Desembarque', rotulo: 'Desembarque' },
] as const;

export type ClassificacaoOcorrencia = (typeof opcoesClassificacao)[number]['valor'];

export const tiposIN = ['A', 'B', 'C', 'D', 'E'] as const;
export type TipoIN = (typeof tiposIN)[number];

export function isClassificacaoOcorrencia(value: unknown): value is ClassificacaoOcorrencia {
  return opcoesClassificacao.some((opcao) => opcao.valor === value);
}

export function isTipoIN(value: unknown): value is TipoIN {
  return tiposIN.some((tipo) => tipo === value);
}

export function formatarClassificacoes(
  classificacoes: ClassificacaoOcorrencia[],
  tipoIN: TipoIN | null,
): string {
  return classificacoes
    .map((classificacao) => {
      const rotulo = opcoesClassificacao.find((opcao) => opcao.valor === classificacao)?.rotulo ?? classificacao;
      return classificacao === 'IN' ? `${rotulo} - Tipo ${tipoIN}` : rotulo;
    })
    .join('; ');
}
