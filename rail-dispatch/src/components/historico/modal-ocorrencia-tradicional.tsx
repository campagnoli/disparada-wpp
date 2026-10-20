'use client';

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Info,
} from 'lucide-react';
import ModalBase from '@/components/ui/modal-base';
import { calcularDuracao } from '@/lib/mensagem-templates-pure';
import type {
  AbaOcorrenciaTradicional,
  CanalTradicional,
  GruposRedisparo,
  MensagensTradicionais,
  OcorrenciaDetalhe,
} from '@/lib/ocorrencias/tipos';
import MensagensOcorrencia from '@/components/historico/mensagens-ocorrencia';
import FormularioEncerramento from '@/components/historico/formulario-encerramento';

interface ModalOcorrenciaTradicionalProps {
  ocorrencia: OcorrenciaDetalhe;
  onFechar: () => void;
  abaAtiva: AbaOcorrenciaTradicional;
  onMudarAba: (aba: AbaOcorrenciaTradicional) => void;

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
  atualizandoEncerramento: boolean;
  carregouTemplatesEncerramento: boolean;
  erroTemplatesEncerramento: string;
  sucessoEncerramento: string;
  onEncerrar: () => void;

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

function ItemResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-slate-700">{valor || '—'}</dd>
    </div>
  );
}

function AbaButton({
  ativa,
  onClick,
  icone,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-1 pb-2 text-xs font-semibold transition-colors ${
        ativa ? 'border-safira text-safira' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icone}
      {children}
    </button>
  );
}

export default function ModalOcorrenciaTradicional({
  ocorrencia,
  onFechar,
  abaAtiva,
  onMudarAba,
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
  atualizandoEncerramento,
  carregouTemplatesEncerramento,
  erroTemplatesEncerramento,
  sucessoEncerramento,
  onEncerrar,
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
}: ModalOcorrenciaTradicionalProps) {
  const encerrada = ocorrencia.status === 'encerrada';
  const tremPrefixo = [
    ocorrencia.id_trem ? `Trem ${ocorrencia.id_trem}` : null,
    ocorrencia.prefixo_viagem ? `Prefixo ${ocorrencia.prefixo_viagem}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <ModalBase
      aberto
      titulo={`Evento ${ocorrencia.codigo_evento ?? 'sem código'}`}
      subtitulo={`${ocorrencia.linha} (${ocorrencia.via}) · ${ocorrencia.localidade}`}
      icone={<History className="h-5 w-5" />}
      largura="xl"
      onFechar={onFechar}
      footer={
        <button type="button" onClick={onFechar} className="btn btn-secondary">
          Fechar
        </button>
      }
    >
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`badge ${encerrada ? 'badge-jade' : 'badge-coral'}`}>
              {encerrada ? 'Encerrada' : 'Em andamento'}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Início <strong className="text-slate-700">{ocorrencia.hora_inicio}</strong>
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-500">
              Fim <strong className="text-slate-700">{ocorrencia.hora_fim || '—'}</strong>
            </span>
            {ocorrencia.hora_fim && (
              <>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-500">
                  Duração{' '}
                  <strong className="text-safira">
                    {calcularDuracao(ocorrencia.hora_inicio, ocorrencia.hora_fim)}
                  </strong>
                </span>
              </>
            )}
          </div>

          <dl className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <ItemResumo rotulo="Linha / Via" valor={`${ocorrencia.linha} (${ocorrencia.via})`} />
            <ItemResumo rotulo="Local" valor={ocorrencia.localidade} />
            <ItemResumo rotulo="Trem / Prefixo" valor={tremPrefixo} />
            <ItemResumo rotulo="Falha informada" valor={ocorrencia.falha} />
          </dl>

          {(ocorrencia.classificacoes.length > 0 || ocorrencia.tipo_in) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {ocorrencia.classificacoes.map((classificacao) => (
                <span
                  key={classificacao}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-600"
                >
                  {classificacao}
                </span>
              ))}
              {ocorrencia.tipo_in && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-800">
                  IN: {ocorrencia.tipo_in}
                </span>
              )}
            </div>
          )}

          {ocorrencia.paese_acionado && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              <strong>PAESE:</strong>{' '}
              {ocorrencia.paese_modalidades.map((modalidade) => `PAESE ${modalidade}`).join(' + ')}
              {ocorrencia.paese_trecho ? ` · Trecho: ${ocorrencia.paese_trecho}` : ''}
            </p>
          )}

          {ocorrencia.tem_impacto_outra_linha && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              <strong>Impacto em outra linha:</strong>{' '}
              {ocorrencia.linhas_impactadas_secundarias.join(', ') || 'linha não informada'}
              {ocorrencia.descricao_impacto_secundario
                ? ` · ${ocorrencia.descricao_impacto_secundario}`
                : ''}
            </p>
          )}
        </section>

        {sucessoEncerramento && (
          <div
            className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-900"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{sucessoEncerramento}</span>
          </div>
        )}

        {encerrada && !sucessoEncerramento && (
          <div
            className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-900"
            role="status"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Ocorrência encerrada{ocorrencia.hora_fim ? ` às ${ocorrencia.hora_fim}` : ''}. Os textos abaixo são os
              registrados para esta ocorrência; você pode revisar, copiar ou redisparar.
            </span>
          </div>
        )}

        {!encerrada && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Esta ocorrência ainda está em andamento. A prévia abaixo usa o horário atual; confirme o encerramento
              para registrar os textos finais.
            </span>
          </div>
        )}

        <div className="border-b border-slate-200">
          <nav className="-mb-px flex gap-5" role="tablist" aria-label="Detalhes da ocorrência">
            <AbaButton
              ativa={abaAtiva === 'textos'}
              onClick={() => onMudarAba('textos')}
              icone={<FileText className="h-3.5 w-3.5" />}
            >
              {encerrada ? 'Textos enviados' : 'Mensagens'}
            </AbaButton>
            <AbaButton
              ativa={abaAtiva === 'encerramento'}
              onClick={() => onMudarAba('encerramento')}
              icone={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              {encerrada ? 'Atualizar encerramento' : 'Encerrar ocorrência'}
            </AbaButton>
          </nav>
        </div>

        {abaAtiva === 'textos' ? (
          <MensagensOcorrencia
            key={`${ocorrencia.id}-${ocorrencia.status}`}
            encerrada={encerrada}
            mensagens={mensagens}
            onMudarMensagem={onMudarMensagem}
            gruposRedisparo={gruposRedisparo}
            onMudarGrupo={onMudarGrupo}
            disparandoWpp={disparandoWpp}
            disparandoCanal={disparandoCanal}
            onDispararCanal={onDispararCanal}
            onRedisparar={onRedisparar}
            disparoRealizado={disparoRealizado}
            copiado={copiado}
            onCopiar={onCopiar}
          />
        ) : (
          <FormularioEncerramento
            ocorrencia={ocorrencia}
            encerrada={encerrada}
            horaFim={horaFim}
            onMudarHoraFim={onMudarHoraFim}
            entregueComRestricao={entregueComRestricao}
            descricaoRestricao={descricaoRestricao}
            relatarAtuacao={relatarAtuacao}
            descricaoAtuacao={descricaoAtuacao}
            onAlternarRestricao={onAlternarRestricao}
            onMudarDescricaoRestricao={onMudarDescricaoRestricao}
            onAlternarAtuacao={onAlternarAtuacao}
            onMudarDescricaoAtuacao={onMudarDescricaoAtuacao}
            atualizando={atualizandoEncerramento}
            carregouTemplates={carregouTemplatesEncerramento}
            erroTemplates={erroTemplatesEncerramento}
            onEncerrar={onEncerrar}
          />
        )}
      </div>
    </ModalBase>
  );
}
