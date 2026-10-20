'use client';

import { useMemo, useState } from 'react';
import {
  Clock,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { formatarMensagemOcorrencia, type ItemCronologia } from '@/lib/formatadores/ocorrenciaOperacional';
import type { OcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/types';
import ModalOcorrencia from '@/components/ui/modal-base';
import { formatarHorario } from '@/components/ocorrencias-operacionais/utils';

const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

interface ModalCronologiaProps {
  aberto: boolean;
  ocorrencia: OcorrenciaOperacional | null;
  salvando: boolean;
  erro?: string;
  onFechar: () => void;
  onSalvar: (
    cronologia: ItemCronologia[],
    aasAsl: string,
    cps: string,
    dispararWhatsApp: boolean
  ) => void;
}

export default function ModalCronologia({
  aberto,
  ocorrencia,
  salvando,
  erro,
  onFechar,
  onSalvar,
}: ModalCronologiaProps) {
  const [itens, setItens] = useState<ItemCronologia[]>(() => ocorrencia?.cronologia ?? []);
  const [aasAsl, setAasAsl] = useState(() => ocorrencia?.aas_asl ?? '');
  const [cps, setCps] = useState(() => ocorrencia?.cps ?? '');
  const [novoHorario, setNovoHorario] = useState('');
  const [novoTexto, setNovoTexto] = useState('');
  const [erroLocal, setErroLocal] = useState('');

  const itensOrdenados = useMemo(
    () => [...itens].sort((a, b) => a.horario.localeCompare(b.horario)),
    [itens]
  );

  const previa = useMemo(() => {
    if (!ocorrencia) return '';
    return formatarMensagemOcorrencia({
      linha: ocorrencia.linha,
      tipoOcorrencia: ocorrencia.tipo_ocorrencia,
      local: ocorrencia.local,
      horario: ocorrencia.horario,
      descritivo: ocorrencia.descritivo,
      cronologia: itensOrdenados,
      aasAsl,
      cps,
      status: ocorrencia.status,
    });
  }, [ocorrencia, itensOrdenados, aasAsl, cps]);

  const adicionarItem = () => {
    if (!REGEX_HORARIO.test(novoHorario) || !novoTexto.trim()) {
      setErroLocal('Informe um horário válido (HH:MM) e a descrição da ação.');
      return;
    }
    setErroLocal('');
    setItens((atuais) =>
      [...atuais, { horario: novoHorario, texto: novoTexto.trim() }].sort((a, b) =>
        a.horario.localeCompare(b.horario)
      )
    );
    setNovoHorario('');
    setNovoTexto('');
  };

  const alterarItem = (indice: number, campo: 'horario' | 'texto', valor: string) => {
    setItens((atuais) =>
      atuais.map((item, posicao) => (posicao === indice ? { ...item, [campo]: valor } : item))
    );
  };

  const removerItem = (indice: number) => {
    setItens((atuais) => atuais.filter((_, posicao) => posicao !== indice));
  };

  const salvar = (dispararWhatsApp: boolean) => {
    const invalido = itens.find(
      (item) => !REGEX_HORARIO.test(item.horario) || !item.texto.trim()
    );
    if (invalido) {
      setErroLocal('Todas as ações precisam de um horário válido (HH:MM) e uma descrição.');
      return;
    }

    setErroLocal('');
    onSalvar(
      itensOrdenados.map((item) => ({ horario: item.horario, texto: item.texto.trim() })),
      aasAsl.trim(),
      cps.trim(),
      dispararWhatsApp
    );
  };

  return (
    <ModalOcorrencia
      aberto={aberto}
      titulo="Atualizar cronologia"
      subtitulo={
        ocorrencia
          ? `${ocorrencia.linha} · ${ocorrencia.local} · início ${formatarHorario(ocorrencia.horario)}`
          : undefined
      }
      icone={<Clock className="h-5 w-5" />}
      largura="xl"
      onFechar={onFechar}
      footer={
        <>
          <button type="button" onClick={onFechar} disabled={salvando} className="btn btn-secondary btn-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => salvar(false)}
            disabled={salvando}
            className="btn btn-secondary btn-sm"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar sem enviar
          </button>
          <button
            type="button"
            onClick={() => salvar(true)}
            disabled={salvando}
            className="btn btn-jade btn-sm"
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {salvando ? 'Enviando...' : 'Salvar e enviar nova mensagem'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-md border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-900">
          As ações são organizadas automaticamente por horário. Cada envio gera uma <strong>nova mensagem</strong> no
          grupo Ocorrências Operacionais, preservando o histórico anterior.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="aas-asl-cronologia" className="form-label text-xs">
              AAS/ASL
            </label>
            <input
              id="aas-asl-cronologia"
              type="text"
              value={aasAsl}
              onChange={(event) => setAasAsl(event.target.value)}
              placeholder="Ex.: ASL 123"
              className="w-full form-control text-xs"
            />
          </div>
          <div>
            <label htmlFor="cps-cronologia" className="form-label text-xs">
              CPS
            </label>
            <input
              id="cps-cronologia"
              type="text"
              value={cps}
              onChange={(event) => setCps(event.target.value)}
              placeholder="Ex.: CPS 456"
              className="w-full form-control text-xs"
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            <Plus className="h-3 w-3" />
            Nova ação
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="time"
              value={novoHorario}
              onChange={(event) => setNovoHorario(event.target.value)}
              className="form-control w-full font-mono text-xs sm:w-28"
              aria-label="Horário da nova ação"
            />
            <input
              type="text"
              value={novoTexto}
              onChange={(event) => setNovoTexto(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') adicionarItem();
              }}
              placeholder="Ex.: Circulação normalizada no trecho."
              className="form-control flex-1 text-xs"
              aria-label="Descrição da nova ação"
            />
            <button type="button" onClick={adicionarItem} className="btn btn-secondary btn-sm text-xs">
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            <Clock className="h-3 w-3" />
            Cronologia ({itens.length})
          </p>

          {itens.length === 0 ? (
            <p className="text-xs text-slate-500">• Em apuração inicial.</p>
          ) : (
            <ul className="space-y-2">
              {itens.map((item, indice) => (
                <li key={indice} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="time"
                    value={item.horario}
                    onChange={(event) => alterarItem(indice, 'horario', event.target.value)}
                    className="form-control w-full font-mono text-xs sm:w-28"
                    aria-label={`Horário da ação ${indice + 1}`}
                  />
                  <input
                    type="text"
                    value={item.texto}
                    onChange={(event) => alterarItem(indice, 'texto', event.target.value)}
                    className="form-control flex-1 text-xs"
                    aria-label={`Descrição da ação ${indice + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removerItem(indice)}
                    className="btn btn-secondary btn-sm self-end text-xs text-rose-600 sm:self-auto"
                    title="Remover ação"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Prévia da mensagem
          </p>
          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2.5 font-mono text-[11px] leading-relaxed text-slate-700">
            {previa}
          </pre>
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
