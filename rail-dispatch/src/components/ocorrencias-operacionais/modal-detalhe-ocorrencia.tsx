'use client';

import {
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Lock,
  MessageSquare,
  PencilLine,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type {
  MensagemOcorrenciaOperacional,
  OcorrenciaOperacional,
} from '@/lib/ocorrencias-operacionais/types';
import ModalOcorrencia from '@/components/ui/modal-base';
import {
  ROTULOS_TIPO,
  classeBadgeStatus,
  formatarDataHora,
  formatarHorario,
  rotuloStatus,
} from '@/components/ocorrencias-operacionais/utils';

interface ModalDetalheOcorrenciaProps {
  aberto: boolean;
  ocorrencia: OcorrenciaOperacional | null;
  mensagens: MensagemOcorrenciaOperacional[];
  carregando: boolean;
  erro?: string;
  aviso?: string;
  erroAcao?: string;
  onFechar: () => void;
  onAtualizar: () => void;
  onEditarCronologia: () => void;
  onEncerrar: () => void;
}

export default function ModalDetalheOcorrencia({
  aberto,
  ocorrencia,
  mensagens,
  carregando,
  erro,
  aviso,
  erroAcao,
  onFechar,
  onAtualizar,
  onEditarCronologia,
  onEncerrar,
}: ModalDetalheOcorrenciaProps) {
  const encerrada = ocorrencia?.status === 'encerrada';

  return (
    <ModalOcorrencia
      aberto={aberto}
      titulo={ocorrencia ? `${ocorrencia.linha} · ${ocorrencia.tipo_ocorrencia}` : 'Ocorrência operacional'}
      subtitulo={ocorrencia ? `${ocorrencia.local} · início ${formatarHorario(ocorrencia.horario)}` : undefined}
      icone={<History className="h-5 w-5" />}
      largura="xl"
      onFechar={onFechar}
      footer={
        <>
          <button type="button" onClick={onAtualizar} disabled={carregando} className="btn btn-secondary btn-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar dados
          </button>
          <button type="button" onClick={onFechar} className="btn btn-secondary btn-sm">
            Fechar
          </button>
        </>
      }
    >
      {carregando && !ocorrencia ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando ocorrência...
        </p>
      ) : erro ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
          {erro}
        </p>
      ) : ocorrencia ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className={`badge ${classeBadgeStatus(ocorrencia)}`}>{rotuloStatus(ocorrencia)}</span>
              <span className="font-mono">
                Início: <strong>{formatarHorario(ocorrencia.horario)}</strong>
              </span>
              {ocorrencia.horario_fim && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">
                    Fim: <strong>{formatarHorario(ocorrencia.horario_fim)}</strong>
                  </span>
                </>
              )}
              <span className="text-slate-300">·</span>
              <span className="font-mono">
                Atualizada em <strong>{formatarDataHora(ocorrencia.atualizado_em)}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!encerrada && (
                <button
                  type="button"
                  onClick={onEditarCronologia}
                  className="btn btn-safira btn-sm text-xs"
                  disabled={carregando}
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  Atualizar cronologia
                </button>
              )}
              <button
                type="button"
                onClick={onEncerrar}
                className="btn btn-secondary btn-sm text-xs"
                disabled={carregando}
              >
                <Lock className="h-3.5 w-3.5" />
                {encerrada ? 'Atualizar encerramento' : 'Encerrar ocorrência'}
              </button>
            </div>
          </div>

          {aviso && (
            <p className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800" role="status">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{aviso}</span>
            </p>
          )}
          {erroAcao && (
            <p className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">
              {erroAcao}
            </p>
          )}

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Descritivo
            </p>
            <p className="text-xs leading-relaxed text-slate-700">
              {ocorrencia.descritivo || 'Sem descritivo preliminar.'}
            </p>
            {(ocorrencia.aas_asl || ocorrencia.cps) && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-500">
                {ocorrencia.aas_asl && <span>#AAS/ASL: {ocorrencia.aas_asl}</span>}
                {ocorrencia.cps && <span>#CPS: {ocorrencia.cps}</span>}
              </p>
            )}
            {encerrada && (ocorrencia.entregue_com_restricao || ocorrencia.relatar_atuacao) && (
              <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                {ocorrencia.entregue_com_restricao && (
                  <p>
                    <strong className="text-slate-700">Restrição:</strong>{' '}
                    {ocorrencia.descricao_restricao || '—'}
                  </p>
                )}
                {ocorrencia.relatar_atuacao && (
                  <p>
                    <strong className="text-slate-700">Atuação:</strong>{' '}
                    {ocorrencia.descricao_atuacao || '—'}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-slate-200 bg-white p-3">
              <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                <Clock className="h-3 w-3" />
                Cronologia atual ({ocorrencia.cronologia.length})
                {encerrada && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-slate-500">
                    somente leitura
                  </span>
                )}
              </p>
              {ocorrencia.cronologia.length === 0 ? (
                <p className="text-xs text-slate-500">• Em apuração inicial.</p>
              ) : (
                <ol className="space-y-1.5">
                  {ocorrencia.cronologia.map((item, indice) => (
                    <li key={`${item.horario}-${indice}`} className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800">
                        {formatarHorario(item.horario)}
                      </span>
                      <span className="flex-1 text-slate-700">{item.texto}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                <MessageSquare className="h-3 w-3" />
                Mensagens enviadas ({mensagens.length})
              </p>
              {mensagens.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma mensagem registrada para esta ocorrência.</p>
              ) : (
                <ul className="space-y-2">
                  {mensagens.map((mensagem) => (
                    <li key={mensagem.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          {mensagem.sucesso ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                          )}
                          {ROTULOS_TIPO[mensagem.tipo] ?? mensagem.tipo}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {formatarDataHora(mensagem.criado_em)}
                        </span>
                      </div>
                      {mensagem.whatsapp_message_id && (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                          ID WhatsApp: {mensagem.whatsapp_message_id}
                        </p>
                      )}
                      {mensagem.erro && (
                        <p className="mt-0.5 text-[10px] text-rose-700">Erro: {mensagem.erro}</p>
                      )}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] font-medium text-safira hover:underline">
                          Ver mensagem
                        </summary>
                        <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[10px] text-slate-700">
                          {mensagem.mensagem}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">Selecione uma ocorrência para visualizar os detalhes.</p>
      )}
    </ModalOcorrencia>
  );
}
