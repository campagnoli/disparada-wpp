'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, Send } from 'lucide-react';
import type { CanalTradicional, GruposRedisparo, MensagensTradicionais } from '@/lib/ocorrencias/tipos';

interface MensagensOcorrenciaProps {
  encerrada: boolean;
  mensagens: MensagensTradicionais;
  onMudarMensagem: (canal: CanalTradicional, valor: string) => void;
  gruposRedisparo: GruposRedisparo;
  onMudarGrupo: (canal: CanalTradicional, marcado: boolean) => void;
  disparandoWpp: boolean;
  disparandoCanal: string | null;
  onDispararCanal: (canal: CanalTradicional, texto: string) => void;
  onRedisparar: () => void;
  disparoRealizado: boolean;
  copiado: string | null;
  onCopiar: (chave: string, texto: string) => void;
}

const CANAIS = [
  {
    id: 'comunicacao',
    rotulo: 'Comunicação / Imprensa',
    descricao: 'Contexto claro para imprensa e passageiros',
    tituloClasse: 'text-safira',
    cardClasse: 'border-safira/20 bg-safira/[0.02]',
    botaoClasse: 'text-safira hover:bg-safira/10',
  },
  {
    id: 'operacao',
    rotulo: 'Operação CCO / Executivo',
    descricao: 'Técnico e sucinto para tráfego e estações',
    tituloClasse: 'text-coral',
    cardClasse: 'border-coral/20 bg-coral/[0.02]',
    botaoClasse: 'text-coral hover:bg-coral/10',
  },
  {
    id: 'gerencia',
    rotulo: 'Gerência / Órgão Regulador',
    descricao: 'Resumo executivo de fechamento',
    tituloClasse: 'text-jade',
    cardClasse: 'border-jade/20 bg-jade/[0.02]',
    botaoClasse: 'text-jade hover:bg-jade/10',
  },
] as const;

const ROTULOS_COPIA: Record<CanalTradicional, string> = {
  comunicacao: 'COMUNICAÇÃO / IMPRENSA',
  operacao: 'OPERAÇÃO CCO / EXECUTIVO',
  gerencia: 'GERÊNCIA / ÓRGÃO REGULADOR',
};

export default function MensagensOcorrencia({
  encerrada,
  mensagens,
  onMudarMensagem,
  gruposRedisparo,
  onMudarGrupo,
  disparandoWpp,
  disparandoCanal,
  onDispararCanal,
  onRedisparar,
  disparoRealizado,
  copiado,
  onCopiar,
}: MensagensOcorrenciaProps) {
  const [editando, setEditando] = useState(!encerrada);

  const qtdSelecionada = [
    gruposRedisparo.comunicacao,
    gruposRedisparo.operacao,
    gruposRedisparo.gerencia,
  ].filter(Boolean).length;
  const podeRedisparar =
    qtdSelecionada > 0 &&
    (!gruposRedisparo.comunicacao || Boolean(mensagens.comunicacao)) &&
    (!gruposRedisparo.operacao || Boolean(mensagens.operacao)) &&
    (!gruposRedisparo.gerencia || Boolean(mensagens.gerencia)) &&
    !disparandoWpp;

  const textoBotao = disparandoWpp
    ? 'Disparando no WhatsApp...'
    : qtdSelecionada === 0
      ? 'Selecione ao menos 1 grupo'
      : qtdSelecionada === 3
        ? 'Disparar novamente nos 3 grupos'
        : qtdSelecionada === 1
          ? `Disparar novamente no grupo ${
              gruposRedisparo.comunicacao
                ? 'Comunicação'
                : gruposRedisparo.operacao
                  ? 'Operação'
                  : 'Gerência'
            }`
          : 'Disparar novamente nos 2 grupos selecionados';

  const copiarTodos = () => {
    const texto = CANAIS
      .map((canal) => `--- ${ROTULOS_COPIA[canal.id]} ---\n\n${mensagens[canal.id] || '(sem texto)'}`)
      .join('\n\n');
    onCopiar('hist-todos', texto);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            {encerrada ? 'Textos enviados no encerramento' : 'Mensagens do encerramento'}
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {encerrada
              ? 'Conteúdo registrado para esta ocorrência. Você pode revisar, copiar ou redisparar os textos.'
              : 'Revise os textos antes de encerrar a ocorrência. Eles serão usados no disparo final.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={copiarTodos}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs"
            title="Copiar os três textos"
          >
            {copiado === 'hist-todos' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            Copiar todos
          </button>
          <button
            type="button"
            onClick={() => setEditando((atual) => !atual)}
            className="btn btn-secondary btn-sm text-xs"
          >
            {editando ? 'Concluir edição' : 'Editar textos'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
            Redisparar em
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-safira">
            <input
              type="checkbox"
              checked={gruposRedisparo.comunicacao}
              onChange={(event) => onMudarGrupo('comunicacao', event.target.checked)}
              className="rounded border-slate-300 text-safira focus:ring-safira"
            />
            Comunicação
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-coral">
            <input
              type="checkbox"
              checked={gruposRedisparo.operacao}
              onChange={(event) => onMudarGrupo('operacao', event.target.checked)}
              className="rounded border-slate-300 text-coral focus:ring-coral"
            />
            Operação CCO / Executivo
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-jade">
            <input
              type="checkbox"
              checked={gruposRedisparo.gerencia}
              onChange={(event) => onMudarGrupo('gerencia', event.target.checked)}
              className="rounded border-slate-300 text-jade focus:ring-jade"
            />
            Gerência / Órgão Regulador
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {CANAIS.map((canal) => {
          const texto = mensagens[canal.id];
          const enviandoEsteCanal = disparandoCanal === canal.id;

          return (
            <article key={canal.id} className={`rounded-lg border p-3 ${canal.cardClasse}`}>
              <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h5 className={`text-xs font-bold ${canal.tituloClasse}`}>{canal.rotulo}</h5>
                  <p className="text-[11px] text-slate-400">{canal.descricao}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDispararCanal(canal.id, texto)}
                    disabled={!texto || disparandoWpp}
                    className={`btn btn-secondary btn-sm flex items-center gap-1 text-xs disabled:opacity-30 ${canal.botaoClasse}`}
                    title="Disparar apenas neste grupo"
                  >
                    {enviandoEsteCanal ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{enviandoEsteCanal ? 'Enviando...' : 'Disparar grupo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCopiar(`hist-${canal.id}`, texto)}
                    className="btn btn-secondary btn-sm"
                    title="Copiar texto"
                  >
                    {copiado === `hist-${canal.id}` ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </header>

              {editando ? (
                <textarea
                  rows={canal.id === 'gerencia' ? 4 : 3}
                  value={texto}
                  onChange={(event) => onMudarMensagem(canal.id, event.target.value)}
                  className={`mt-2 w-full form-control text-xs ${canal.id === 'operacao' ? 'font-mono' : 'font-sans'}`}
                  placeholder="Sem texto para este grupo."
                />
              ) : (
                <pre
                  className={`mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 ${
                    canal.id === 'operacao' ? 'font-mono' : 'font-sans'
                  }`}
                >
                  {texto || 'Sem texto registrado para este grupo.'}
                </pre>
              )}
            </article>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {disparoRealizado ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <Check className="h-4 w-4 text-emerald-600" />
                Disparo registrado com sucesso.
              </span>
            ) : (
              <span>Selecione os grupos e redisparre os textos acima.</span>
            )}
          </div>
          <button
            type="button"
            disabled={!podeRedisparar}
            onClick={onRedisparar}
            className="btn btn-jade flex w-full items-center justify-center gap-2 px-5 py-2.5 font-semibold shadow-xs disabled:opacity-50 sm:w-auto"
          >
            {disparandoWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {textoBotao}
          </button>
        </div>
      </div>
    </div>
  );
}
