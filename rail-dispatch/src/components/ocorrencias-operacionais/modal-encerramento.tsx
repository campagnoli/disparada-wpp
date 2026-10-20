'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Send,
  Timer,
} from 'lucide-react';
import {
  TEMPLATES_MENSAGEM_PADRAO,
  calcularDuracao,
} from '@/lib/mensagem-templates-pure';
import { formatarMensagemEncerramentoOperacional } from '@/lib/ocorrencias-operacionais/mensagem-encerramento';
import type { OcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/types';
import type { PayloadEncerramento } from '@/components/ocorrencias-operacionais/cliente';
import ModalOcorrencia from '@/components/ui/modal-base';
import { formatarHorario } from '@/components/ocorrencias-operacionais/utils';

const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

interface ModalEncerramentoProps {
  aberto: boolean;
  ocorrencia: OcorrenciaOperacional | null;
  enviando: boolean;
  erro?: string;
  templateEncerramento?: string;
  onFechar: () => void;
  onConfirmar: (payload: PayloadEncerramento) => void;
}

function horarioAtual(): string {
  return new Date().toTimeString().slice(0, 5);
}

export default function ModalEncerramento({
  aberto,
  ocorrencia,
  enviando,
  erro,
  templateEncerramento = TEMPLATES_MENSAGEM_PADRAO.encerramento.ocorrencias_operacionais,
  onFechar,
  onConfirmar,
}: ModalEncerramentoProps) {
  const [horarioFim, setHorarioFim] = useState(
    () => ocorrencia?.horario_fim || horarioAtual(),
  );
  const [entregueComRestricao, setEntregueComRestricao] = useState(
    () => ocorrencia?.entregue_com_restricao ?? false,
  );
  const [descricaoRestricao, setDescricaoRestricao] = useState(
    () => ocorrencia?.descricao_restricao ?? '',
  );
  const [relatarAtuacao, setRelatarAtuacao] = useState(
    () => ocorrencia?.relatar_atuacao ?? false,
  );
  const [descricaoAtuacao, setDescricaoAtuacao] = useState(
    () => ocorrencia?.descricao_atuacao ?? '',
  );
  const [dispararWhatsApp, setDispararWhatsApp] = useState(true);
  const [erroLocal, setErroLocal] = useState('');
  const [editandoMensagem, setEditandoMensagem] = useState(false);
  const [mensagemEditada, setMensagemEditada] = useState<string | null>(null);

  const jaEncerrada = ocorrencia?.status === 'encerrada';

  const previa = useMemo(() => {
    if (!ocorrencia) return '';
    return formatarMensagemEncerramentoOperacional(
      {
        linha: ocorrencia.linha,
        tipoOcorrencia: ocorrencia.tipo_ocorrencia,
        horario: ocorrencia.horario,
        horarioFim,
      },
      {
        entregueComRestricao,
        descricaoRestricao,
        relatarAtuacao,
        descricaoAtuacao,
      },
      templateEncerramento,
    );
  }, [
    ocorrencia,
    horarioFim,
    entregueComRestricao,
    descricaoRestricao,
    relatarAtuacao,
    descricaoAtuacao,
    templateEncerramento,
  ]);

  const mensagemExibida = mensagemEditada ?? previa;

  const iniciarEdicaoMensagem = () => {
    setMensagemEditada(mensagemExibida);
    setEditandoMensagem(true);
    setErroLocal('');
  };

  const restaurarMensagemGerada = () => {
    setMensagemEditada(null);
    setEditandoMensagem(false);
    setErroLocal('');
  };

  const concluirEdicaoMensagem = () => {
    const texto = (mensagemEditada ?? '').trim();
    if (!texto) {
      setErroLocal('A mensagem final não pode ficar vazia.');
      return;
    }
    setMensagemEditada(texto);
    setEditandoMensagem(false);
    setErroLocal('');
  };

  const confirmar = () => {
    if (!REGEX_HORARIO.test(horarioFim)) {
      setErroLocal('Informe um horário de encerramento válido no formato HH:MM.');
      return;
    }
    if (entregueComRestricao && !descricaoRestricao.trim()) {
      setErroLocal('Descreva a restrição mantida após a ocorrência.');
      return;
    }
    if (relatarAtuacao && !descricaoAtuacao.trim()) {
      setErroLocal('Descreva a atuação realizada.');
      return;
    }

    const mensagemFinal = mensagemEditada?.trim();
    if (mensagemEditada !== null && !mensagemFinal) {
      setErroLocal('A mensagem final não pode ficar vazia.');
      return;
    }

    setErroLocal('');
    onConfirmar({
      horarioFim,
      entregueComRestricao,
      descricaoRestricao: descricaoRestricao.trim(),
      relatarAtuacao,
      descricaoAtuacao: descricaoAtuacao.trim(),
      ...(mensagemFinal ? { mensagemFinal } : {}),
      dispararWhatsApp,
    });
  };

  return (
    <ModalOcorrencia
      aberto={aberto}
      titulo={jaEncerrada ? 'Atualizar encerramento' : 'Encerrar ocorrência'}
      subtitulo={
        ocorrencia
          ? `${ocorrencia.linha} · ${ocorrencia.local} · início ${formatarHorario(ocorrencia.horario)}`
          : undefined
      }
      icone={<Lock className="h-5 w-5" />}
      largura="xl"
      onFechar={onFechar}
      footer={
        <>
          <button type="button" onClick={onFechar} disabled={enviando} className="btn btn-secondary btn-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="btn btn-jade btn-sm"
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : dispararWhatsApp ? (
              <Send className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {enviando
              ? jaEncerrada
                ? 'Atualizando encerramento...'
                : 'Encerrando...'
              : jaEncerrada
                ? dispararWhatsApp
                  ? 'Atualizar e enviar nova mensagem'
                  : 'Atualizar sem enviar'
                : dispararWhatsApp
                  ? 'Encerrar e enviar nova mensagem'
                  : 'Encerrar sem enviar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {jaEncerrada && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            Esta ocorrência já está encerrada. Ao confirmar, o encerramento será atualizado e uma nova mensagem poderá
            ser enviada ao grupo.
          </p>
        )}

        <p className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">
          A mensagem final substitui a cronologia e exibe apenas o encerramento: sem restrição ou com restrição,
          além da atuação quando informada.
        </p>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="horario-fim-operacional" className="form-label mb-0 text-xs">
              Horário do encerramento
            </label>
            <button
              type="button"
              onClick={() => setHorarioFim(horarioAtual())}
              className="text-[11px] font-medium text-safira hover:underline"
            >
              Usar hora atual ({horarioAtual()})
            </button>
          </div>
          <input
            id="horario-fim-operacional"
            type="time"
            value={horarioFim}
            onChange={(event) => setHorarioFim(event.target.value)}
            className="form-control w-full font-mono text-xs"
          />
          {ocorrencia && REGEX_HORARIO.test(horarioFim) && ocorrencia.horario && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-safira">
              <Timer className="h-3.5 w-3.5" />
              Duração calculada: <strong>{calcularDuracao(ocorrencia.horario, horarioFim)}</strong>
            </p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={entregueComRestricao}
                onChange={(event) => setEntregueComRestricao(event.target.checked)}
                className="rounded border-slate-300 text-safira focus:ring-safira"
              />
              Entregue com restrição?
            </label>
            {entregueComRestricao && (
              <div className="mt-2">
                <label htmlFor="descricao-restricao-operacional" className="form-label text-xs">
                  Descrição da restrição
                </label>
                <textarea
                  id="descricao-restricao-operacional"
                  required
                  maxLength={5000}
                  rows={3}
                  value={descricaoRestricao}
                  onChange={(event) => setDescricaoRestricao(event.target.value)}
                  className="w-full form-control text-xs"
                  placeholder="Descreva as restrições mantidas após a ocorrência"
                />
              </div>
            )}
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={relatarAtuacao}
                onChange={(event) => setRelatarAtuacao(event.target.checked)}
                className="rounded border-slate-300 text-safira focus:ring-safira"
              />
              Deseja relatar a atuação?
            </label>
            {relatarAtuacao && (
              <div className="mt-2">
                <label htmlFor="descricao-atuacao-operacional" className="form-label text-xs">
                  Descrição da atuação
                </label>
                <textarea
                  id="descricao-atuacao-operacional"
                  required
                  maxLength={5000}
                  rows={3}
                  value={descricaoAtuacao}
                  onChange={(event) => setDescricaoAtuacao(event.target.value)}
                  className="w-full form-control text-xs"
                  placeholder="Descreva a atuação realizada"
                />
              </div>
            )}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={dispararWhatsApp}
            onChange={(event) => setDispararWhatsApp(event.target.checked)}
            className="rounded border-slate-300 text-safira focus:ring-safira"
          />
          Enviar nova mensagem ao grupo Ocorrências Operacionais
        </label>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Prévia da mensagem de encerramento
              </p>
              {mensagemEditada !== null && !editandoMensagem && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  personalizada
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {editandoMensagem ? (
                <>
                  <button
                    type="button"
                    onClick={restaurarMensagemGerada}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-safira hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar prévia
                  </button>
                  <button
                    type="button"
                    onClick={concluirEdicaoMensagem}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-safira hover:underline"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Concluir edição
                  </button>
                </>
              ) : (
                <>
                  {mensagemEditada !== null && (
                    <button
                      type="button"
                      onClick={restaurarMensagemGerada}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-safira hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar prévia
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={iniciarEdicaoMensagem}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-safira hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar mensagem
                  </button>
                </>
              )}
            </div>
          </div>

          {editandoMensagem ? (
            <textarea
              value={mensagemEditada ?? ''}
              onChange={(event) => setMensagemEditada(event.target.value)}
              maxLength={5000}
              rows={10}
              aria-label="Editar mensagem de encerramento"
              className="w-full form-control font-mono text-[11px] leading-relaxed"
            />
          ) : (
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2.5 font-mono text-[11px] leading-relaxed text-slate-700">
              {mensagemExibida}
            </pre>
          )}

          <p className="mt-1.5 text-[10px] text-slate-400">
            {editandoMensagem
              ? 'Use *negrito* como no WhatsApp. A mensagem editada será enviada exatamente como está.'
              : 'A mensagem editada substitui a prévia gerada a partir dos campos acima.'}
          </p>
        </div>

        {erroLocal && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900" role="alert">
            {erroLocal}
          </p>
        )}
        {erro && (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">
            {erro}
          </p>
        )}
      </div>
    </ModalOcorrencia>
  );
}
