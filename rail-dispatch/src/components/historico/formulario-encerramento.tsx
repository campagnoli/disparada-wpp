'use client';

import { CheckCircle2, Clock, Timer } from 'lucide-react';
import { calcularDuracao } from '@/lib/mensagem-templates-pure';
import type { OcorrenciaDetalhe } from '@/lib/ocorrencias/tipos';

interface FormularioEncerramentoProps {
  ocorrencia: OcorrenciaDetalhe;
  encerrada: boolean;
  horaFim: string;
  onMudarHoraFim: (hora: string) => void;
  entregueComRestricao: boolean;
  descricaoRestricao: string;
  relatarAtuacao: boolean;
  descricaoAtuacao: string;
  onAlternarRestricao: (marcado: boolean) => void;
  onMudarDescricaoRestricao: (valor: string) => void;
  onAlternarAtuacao: (marcado: boolean) => void;
  onMudarDescricaoAtuacao: (valor: string) => void;
  atualizando: boolean;
  carregouTemplates: boolean;
  erroTemplates: string;
  onEncerrar: () => void;
}

export default function FormularioEncerramento({
  ocorrencia,
  encerrada,
  horaFim,
  onMudarHoraFim,
  entregueComRestricao,
  descricaoRestricao,
  relatarAtuacao,
  descricaoAtuacao,
  onAlternarRestricao,
  onMudarDescricaoRestricao,
  onAlternarAtuacao,
  onMudarDescricaoAtuacao,
  atualizando,
  carregouTemplates,
  erroTemplates,
  onEncerrar,
}: FormularioEncerramentoProps) {
  const horaAtual = new Date().toTimeString().slice(0, 5);
  const horarioValido = /^([01]\d|2[0-3]):[0-5]\d$/.test(horaFim);
  const desabilitado =
    !horaFim ||
    atualizando ||
    !carregouTemplates ||
    Boolean(erroTemplates) ||
    (entregueComRestricao && !descricaoRestricao.trim()) ||
    (relatarAtuacao && !descricaoAtuacao.trim());

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-xs leading-relaxed text-slate-600">
          {encerrada
            ? 'Esta ocorrência já está encerrada. Atualize o horário ou os detalhes abaixo para regerar as mensagens finais.'
            : 'Informe o horário de encerramento e as informações adicionais. As mensagens dos 3 canais serão geradas com o horário de fim.'}
        </p>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="hora-fim-historico" className="form-label mb-0 flex items-center gap-1.5 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Horário de encerramento
          </label>
          <button
            type="button"
            onClick={() => onMudarHoraFim(horaAtual)}
            className="text-[11px] font-medium text-safira hover:underline"
          >
            Usar hora atual ({horaAtual})
          </button>
        </div>
        <input
          id="hora-fim-historico"
          type="time"
          required
          value={horaFim}
          onChange={(event) => onMudarHoraFim(event.target.value)}
          className="w-full form-control font-mono"
        />
        {horarioValido && ocorrencia.hora_inicio && (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-safira">
            <Timer className="h-3.5 w-3.5" />
            Duração calculada: <strong>{calcularDuracao(ocorrencia.hora_inicio, horaFim)}</strong>
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={entregueComRestricao}
              onChange={(event) => onAlternarRestricao(event.target.checked)}
              className="rounded border-slate-300 text-safira focus:ring-safira"
            />
            Entregue com restrição?
          </label>
          {entregueComRestricao && (
            <div className="mt-2">
              <label htmlFor="descricao-restricao-historico" className="form-label text-xs">
                Descrição da restrição
              </label>
              <textarea
                id="descricao-restricao-historico"
                required
                maxLength={5000}
                value={descricaoRestricao}
                onChange={(event) => onMudarDescricaoRestricao(event.target.value)}
                rows={3}
                className="w-full form-control text-sm"
                placeholder="Descreva as restrições mantidas após a ocorrência"
              />
            </div>
          )}
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={relatarAtuacao}
              onChange={(event) => onAlternarAtuacao(event.target.checked)}
              className="rounded border-slate-300 text-safira focus:ring-safira"
            />
            Deseja relatar a atuação?
          </label>
          {relatarAtuacao && (
            <div className="mt-2">
              <label htmlFor="descricao-atuacao-historico" className="form-label text-xs">
                Descrição da atuação
              </label>
              <textarea
                id="descricao-atuacao-historico"
                required
                maxLength={5000}
                value={descricaoAtuacao}
                onChange={(event) => onMudarDescricaoAtuacao(event.target.value)}
                rows={3}
                className="w-full form-control text-sm"
                placeholder="Descreva a atuação realizada"
              />
            </div>
          )}
        </div>
      </div>

      {erroTemplates && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          Não foi possível carregar os modelos de encerramento: {erroTemplates}
        </p>
      )}

      {!carregouTemplates && !erroTemplates && (
        <p className="text-[11.5px] text-slate-500" role="status">
          Carregando modelos de encerramento...
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11.5px] leading-relaxed text-slate-500">
          Ao confirmar, as mensagens dos 3 canais serão atualizadas com o horário de fim e ficarão disponíveis na aba
          <strong> Textos enviados</strong>.
        </p>
        <button
          type="button"
          onClick={onEncerrar}
          disabled={desabilitado}
          className="btn btn-safira flex shrink-0 items-center justify-center gap-2 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {atualizando
            ? 'Gerando mensagens...'
            : encerrada
              ? 'Atualizar encerramento e gerar mensagens'
              : 'Encerrar ocorrência e gerar mensagens'}
        </button>
      </div>
    </div>
  );
}
