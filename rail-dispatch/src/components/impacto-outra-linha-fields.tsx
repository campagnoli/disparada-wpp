import { LINHAS_OPERACIONAIS } from '@/lib/impacto-outra-linha';

interface ImpactoOutraLinhaFieldsProps {
  linhaPrincipal: string;
  temImpacto: boolean;
  linhasSelecionadas: string[];
  descricao: string;
  onMudarTemImpacto: (temImpacto: boolean) => void;
  onMudarLinhas: (linhas: string[]) => void;
  onMudarDescricao: (descricao: string) => void;
}

export function ImpactoOutraLinhaFields({
  linhaPrincipal,
  temImpacto,
  linhasSelecionadas,
  descricao,
  onMudarTemImpacto,
  onMudarLinhas,
  onMudarDescricao,
}: ImpactoOutraLinhaFieldsProps) {
  return (
    <fieldset className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <legend className="form-label px-1">Houve impacto em outra linha?</legend>
      <div className="flex flex-wrap gap-4">
        {[
          { value: false, label: 'Não' },
          { value: true, label: 'Sim' },
        ].map((opcao) => (
          <label key={String(opcao.value)} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="impacto-outra-linha"
              checked={temImpacto === opcao.value}
              onChange={() => onMudarTemImpacto(opcao.value)}
            />
            {opcao.label}
          </label>
        ))}
      </div>

      {temImpacto && (
        <div className="space-y-3 border-t border-slate-200 pt-3">
          <fieldset>
            <legend className="form-label block">Linha(s) secundária(s) afetada(s)</legend>
            <div className="flex flex-wrap gap-2">
              {LINHAS_OPERACIONAIS.filter((opcao) => opcao !== linhaPrincipal).map((opcao) => {
                const selecionada = linhasSelecionadas.includes(opcao);
                return (
                  <label
                    key={opcao}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                      selecionada
                        ? 'border-safira bg-safira/10 font-semibold text-safira'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selecionada}
                      onChange={(event) => {
                        const marcada = event.target.checked;
                        onMudarLinhas(marcada
                          ? [...linhasSelecionadas, opcao]
                          : linhasSelecionadas.filter((item) => item !== opcao));
                      }}
                      className="accent-safira"
                    />
                    {opcao}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="descricao-impacto-secundario" className="form-label block">
              Descrição do impacto na outra linha
            </label>
            <textarea
              id="descricao-impacto-secundario"
              rows={3}
              maxLength={5000}
              value={descricao}
              onChange={(event) => onMudarDescricao(event.target.value)}
              placeholder="Descreva o reflexo operacional confirmado na(s) linha(s) selecionada(s)."
              className="w-full form-control"
              required={temImpacto}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Sugestões:</span>
              {[
                'Intervalos maiores e velocidade reduzida',
                'Suspensão de loops / partidas intercaladas',
                'Retenção de composições na plataforma',
                'Circulação suspensa no trecho compartilhado',
              ].map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => onMudarDescricao(
                    `${descricao.trimEnd()}${descricao.trim() ? '\n' : ''}${sugestao}`.slice(0, 5000)
                  )}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition-colors hover:border-safira/40 hover:bg-safira/5 hover:text-safira"
                >
                  + {sugestao}
                </button>
              ))}
            </div>
          </div>
          {(linhasSelecionadas.length === 0 || !descricao.trim()) && (
            <p className="text-xs text-amber-800" role="alert">
              Selecione ao menos uma linha e descreva o impacto para avançar.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
