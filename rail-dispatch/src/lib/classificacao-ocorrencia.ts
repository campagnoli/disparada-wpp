export const opcoesClassificacao = [
  { valor: 'IN', rotulo: 'IN (Incidente Notável)' },
  { valor: 'COPESE', rotulo: 'COPESE' },
  { valor: 'Desembarque', rotulo: 'Desembarque' },
] as const;

export type ClassificacaoOcorrencia = (typeof opcoesClassificacao)[number]['valor'];

export const tiposIN = ['A', 'B', 'C', 'D', 'E'] as const;
export type TipoIN = (typeof tiposIN)[number];

export interface DefinicaoTipoIN {
  tipo: TipoIN;
  titulo: string;
  descricao: string;
}

export const definicoesTiposIN: readonly DefinicaoTipoIN[] = [
  {
    tipo: 'A',
    titulo: 'IN Tipo A',
    descricao: 'Interrupção > 2 Intervalos > 20 minutos',
  },
  {
    tipo: 'B',
    titulo: 'IN Tipo B',
    descricao: 'Evacuação em via ou plataforma',
  },
  {
    tipo: 'C',
    titulo: 'IN Tipo C',
    descricao: 'Atuação Irregular do corpo de Segurança',
  },
  {
    tipo: 'D',
    titulo: 'IN Tipo D',
    descricao: 'Condição Insegura',
  },
  {
    tipo: 'E',
    titulo: 'IN Tipo E',
    descricao: 'Cancelamento não programado do Expresso Aeroporto',
  },
] as const;

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
      return classificacao === 'IN' ? (tipoIN ? `${rotulo} - Tipo ${tipoIN}` : rotulo) : rotulo;
    })
    .join('; ');
}
