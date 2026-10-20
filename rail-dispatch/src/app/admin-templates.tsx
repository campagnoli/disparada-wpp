'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Save,
  RotateCcw,
  Copy,
  Check,
  Code,
  Tag,
  RefreshCw,
  Eye,
  MessageSquare,
  Radio,
  Briefcase,
  CheckCheck,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  Smile,
  TrainFront,
  Users,
  AlertTriangle,
} from 'lucide-react';
import {
  TEMPLATES_MENSAGEM_PADRAO,
  TemplatesMensagem,
  aplicarTemplateMensagem,
  aplicarEncerramentoNaMensagem,
  incluirDetalhesEncerramento,
  DadosTemplateMensagem,
  modeloEncerramentoValido,
} from '@/lib/mensagem-templates-pure';
import { formatWhatsAppText } from '@/lib/whatsapp-format';

interface AdminTemplatesProps {
  onNotificarErro?: (erro: unknown, contexto?: string) => void;
  onNotificarSucesso?: (titulo: string, mensagem: string) => void;
}

interface DadosTemplatesAPI {
  templates: TemplatesMensagem;
  isCustom: boolean;
  updatedAt: string | null;
  origem: 'supabase' | 'local' | 'padrao';
  templatesPadrao: TemplatesMensagem;
}

type CanalGrupo = 'comunicacao' | 'operacao' | 'gerencia' | 'ocorrencias_operacionais';

const DADOS_SIMULACAO: DadosTemplateMensagem = {
  titulo: 'DESPACHO CCO - LINHA 11-CORAL - FALHA DE TRAÇÃO',
  data: '14/10/2026',
  horaInicio: '14:20',
  horaFim: '',
  rotuloInformante: 'Trem que informa',
  tremEstacaoInforma: 'Trem C120 (Prefixo 1104)',
  rotuloLocalidadeAfetada: 'Trecho afetado',
  trechoEstacaoAfetados: 'Luz ⇄ Tatuapé',
  resumoLoops: 'Loop 1: Luz ⇄ Suzano (Intervalo 8 min) | Loop 2: Suzano ⇄ Estudantes (Intervalo 12 min)',
  classificacao: 'IN Tipo A (Interrupção > 2 Intervalos > 20 minutos)',
  falha: 'Falha no sistema de tração com perda de esforço e atuação de freio de emergência.',
  descritivo: 'Composição apresentou perda de esforço de tração e atuação do freio de emergência na região da estação Luz.',
  impacto: 'Circulação em via singela entre Luz e Tatuapé com maiores intervalos e velocidade reduzida.',
  temImpactoOutraLinha: true,
  linhaSecundariaAfetada: 'Linha 12-Safira',
  impactoSecundario: 'Retenção momentânea de composições na região de Tatuapé.',
  acoes: 'Manutenção elétrica a caminho da composição, manobra de recolhimento para o pátio e apoio de segurança nas plataformas.',
  textoComunicacao: 'Atenção, passageiros da Linha 11-Coral: devido a uma ocorrência técnica em um trem na região da estação Luz, a circulação está sendo realizada com intervalos maiores entre as estações Luz e Tatuapé. Nossas equipes de manutenção já estão atuando para restabelecer a normalidade com segurança.',
  sco: 'Gabriel Campagnoli (CCO)',
  linha: 'Linha 11-Coral',
  via: 'Via 1',
  idTrem: 'C120',
  prefixoViagem: '1104',
  localidade: 'Luz',
};

const TAGS_DISPONIVEIS: Array<{
  tag: string;
  desc: string;
  grupos: CanalGrupo[];
}> = [
  { tag: '{{TITULO}}', desc: 'Título da mensagem', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{DATA}}', desc: 'Data do evento (DD/MM/AAAA)', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{HORA_INICIO}}', desc: 'Horário de início (HH:MM)', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{HORA_FIM}}', desc: 'Horário de fim (omitido até o encerramento da ocorrência)', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{DURACAO}}', desc: 'Duração da ocorrência (calculada e exibida apenas após encerramento)', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{ENTREGA_RESTRICAO}}', desc: 'Resultado da entrega: sem restrição ou com a descrição informada no encerramento', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{ENCERRAMENTO}}', desc: 'Tag *ENCERRAMENTO* em negrito acima do título (apenas após encerramento)', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{ROTULO_INFORMANTE}}', desc: 'Rótulo dinâmico: Trem que informa ou Estação que informa', grupos: ['operacao', 'gerencia'] },
  { tag: '{{TREM_ESTACAO_INFORMA}}', desc: 'Trem ou estação informante', grupos: ['operacao', 'gerencia'] },
  { tag: '{{ROTULO_LOCALIDADE_AFETADA}}', desc: 'Rótulo dinâmico: Trecho afetado ou Estação afetada', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{TRECHO_ESTACAO_AFETADOS}}', desc: 'Localidade e trecho afetado', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{RESUMO_LOOPS}}', desc: 'Estratégia de loops (omitido se não houver loop)', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{CLASSIFICACAO}}', desc: 'Classificação da ocorrência (omitido se vazia)', grupos: ['operacao', 'gerencia'] },
  { tag: '{{FALHA}}', desc: 'Descrição técnica da falha', grupos: ['operacao', 'gerencia'] },
  { tag: '{{IMPACTO}}', desc: 'Impacto operacional imediato', grupos: ['operacao', 'gerencia'] },
  { tag: '{{TEM_IMPACTO_OUTRA_LINHA}}', desc: 'Indica se houve impacto em outra linha (Sim/Não)', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{LINHA_SECUNDARIA_AFETADA}}', desc: 'Nome(s) da(s) linha(s) secundária(s) afetada(s), omitido se vazio', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{IMPACTO_SECUNDARIO}}', desc: 'Descrição do impacto reflexo, omitida se vazia', grupos: ['operacao', 'gerencia', 'comunicacao', 'ocorrencias_operacionais'] },
  { tag: '{{ACOES}}', desc: 'Ações imediatas do CCO e áreas acionadas', grupos: ['operacao', 'gerencia'] },
  { tag: '{{TEXTO_COMUNICACAO}}', desc: 'Texto narrativo gerado pela IA para passageiros', grupos: ['comunicacao'] },
  { tag: '{{LINHA}}', desc: 'Nome da linha operacional', grupos: ['comunicacao', 'operacao', 'gerencia', 'ocorrencias_operacionais'] },
  { tag: '{{SCO}}', desc: 'Assinatura do SCO (supervisor responsável)', grupos: ['comunicacao', 'operacao', 'gerencia', 'ocorrencias_operacionais'] },
  { tag: '{{IN}}', desc: 'Tipo de IN selecionado (ex: "IN Tipo B"), ou "Não" se nenhum tipo for selecionado', grupos: ['operacao', 'gerencia'] },
  { tag: '{{COPESE}}', desc: 'Indica se a classificação COPESE foi selecionada (ex: "Sim")', grupos: ['operacao', 'gerencia'] },
  { tag: '{{DESEMBARQUE}}', desc: 'Impacto a passageiros que desembarcam ("Sim"/"Não") e o que foi observado', grupos: ['operacao', 'gerencia'] },
  { tag: '{{DESCRITIVO}}', desc: 'Narrativa completa do que ocorreu, campo opcional', grupos: ['operacao', 'gerencia', 'ocorrencias_operacionais'] },
];

export default function AdminTemplates({ onNotificarErro, onNotificarSucesso }: AdminTemplatesProps) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [canalAtivo, setCanalAtivo] = useState<CanalGrupo>('operacao');
  const [tipoModeloAtivo, setTipoModeloAtivo] = useState<'normal' | 'encerramento'>('normal');

  const [templatesOriginais, setTemplatesOriginais] = useState<TemplatesMensagem>({
    ...TEMPLATES_MENSAGEM_PADRAO,
  });
  const [templatesEditados, setTemplatesEditados] = useState<TemplatesMensagem>({
    ...TEMPLATES_MENSAGEM_PADRAO,
  });
  const [isCustom, setIsCustom] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [origem, setOrigem] = useState<'supabase' | 'local' | 'padrao'>('padrao');
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [mostrarPreview, setMostrarPreview] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const carregarTemplates = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch('/api/admin/templates', { cache: 'no-store' });
      const data = (await res.json()) as DadosTemplatesAPI;
      if (!res.ok) throw new Error('Não foi possível carregar os modelos de mensagem.');

      setTemplatesOriginais(data.templates);
      setTemplatesEditados(data.templates);
      setIsCustom(data.isCustom);
      setUpdatedAt(data.updatedAt);
      setOrigem(data.origem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar modelos de mensagem.';
      setErro(msg);
      onNotificarErro?.(err, 'Modelos de Mensagem');
    } finally {
      setCarregando(false);
    }
  }, [onNotificarErro]);

  useEffect(() => {
    let ativo = true;

    async function inicializar() {
      try {
        const res = await fetch('/api/admin/templates', { cache: 'no-store' });
        const data = (await res.json()) as DadosTemplatesAPI;
        if (!res.ok) throw new Error('Não foi possível carregar os modelos de mensagem.');

        if (!ativo) return;
        setTemplatesOriginais(data.templates);
        setTemplatesEditados(data.templates);
        setIsCustom(data.isCustom);
        setUpdatedAt(data.updatedAt);
        setOrigem(data.origem);
      } catch (err: unknown) {
        if (!ativo) return;
        const msg = err instanceof Error ? err.message : 'Falha ao carregar modelos de mensagem.';
        setErro(msg);
        onNotificarErro?.(err, 'Modelos de Mensagem');
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void inicializar();

    return () => {
      ativo = false;
    };
  }, [onNotificarErro]);

  const houveAlteracao = useMemo(() => {
    return JSON.stringify(templatesEditados) !== JSON.stringify(templatesOriginais);
  }, [templatesEditados, templatesOriginais]);

  const textoCanalAtual = tipoModeloAtivo === 'normal'
    ? templatesEditados[canalAtivo]
    : templatesEditados.encerramento[canalAtivo];

  const handleAtualizarTextoCanal = (novoTexto: string) => {
    setTemplatesEditados((prev) => tipoModeloAtivo === 'normal'
      ? { ...prev, [canalAtivo]: novoTexto }
      : {
        ...prev,
        encerramento: { ...prev.encerramento, [canalAtivo]: novoTexto },
      });
  };

  const handleSalvar = async () => {
    if (
      Object.values(templatesEditados).some((value) => typeof value === 'string' && !value.trim())
      || Object.values(templatesEditados.encerramento).some((template) =>
        !template.trim() || !modeloEncerramentoValido(template))
    ) {
      setErro('Todos os modelos devem estar preenchidos. Cada modelo de encerramento deve conter {{TITULO}}, {{HORA_INICIO}}, {{HORA_FIM}}, {{DURACAO}} e {{ENTREGA_RESTRICAO}}.');
      return;
    }

    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: templatesEditados }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao salvar modelos de mensagem.');
      }

      setTemplatesOriginais({ ...templatesEditados });
      setIsCustom(true);
      setUpdatedAt(new Date().toISOString());
      const msgSucesso = data.mensagem || 'Modelos de mensagem salvos com sucesso!';
      setAviso(msgSucesso);
      onNotificarSucesso?.('Modelos Atualizados', msgSucesso);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar os modelos.';
      setErro(msg);
      onNotificarErro?.(err, 'Edição de Modelos de Mensagem');
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurarPadrao = async () => {
    if (
      !window.confirm(
        'Tem certeza de que deseja restaurar os modelos de mensagem para os padrões originais de fábrica do CCO?'
      )
    ) {
      return;
    }

    setRestaurando(true);
    setErro('');
    setAviso('');

    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurarPadrao: true }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao restaurar modelos padrão.');
      }

      setTemplatesOriginais({ ...TEMPLATES_MENSAGEM_PADRAO });
      setTemplatesEditados({ ...TEMPLATES_MENSAGEM_PADRAO });
      setIsCustom(false);
      setUpdatedAt(null);
      setOrigem('padrao');
      const msgSucesso = 'Modelos de mensagem de fábrica restaurados com sucesso!';
      setAviso(msgSucesso);
      onNotificarSucesso?.('Modelos Restaurados', msgSucesso);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao restaurar modelos.';
      setErro(msg);
      onNotificarErro?.(err, 'Restauração de Modelos');
    } finally {
      setRestaurando(false);
    }
  };

  const copiarModeloAtual = () => {
    void navigator.clipboard.writeText(textoCanalAtual);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const inserirTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      handleAtualizarTextoCanal(textoCanalAtual + '\n' + tag);
      return;
    }
    const start = el.selectionStart ?? textoCanalAtual.length;
    const end = el.selectionEnd ?? textoCanalAtual.length;
    const novo = textoCanalAtual.slice(0, start) + tag + textoCanalAtual.slice(end);
    handleAtualizarTextoCanal(novo);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const previewMensagem = useMemo(() => {
    const dadosPreview = {
      ...DADOS_SIMULACAO,
    };
    if (tipoModeloAtivo === 'normal') {
      return aplicarTemplateMensagem(textoCanalAtual, dadosPreview);
    }
    const mensagemNormal = aplicarTemplateMensagem(
      templatesEditados[canalAtivo],
      dadosPreview,
    );
    return incluirDetalhesEncerramento(aplicarEncerramentoNaMensagem(
      mensagemNormal,
      '15:35',
      DADOS_SIMULACAO.horaInicio,
      textoCanalAtual,
      DADOS_SIMULACAO.titulo,
      DADOS_SIMULACAO,
    ), {
      entregueComRestricao: false,
      descricaoRestricao: '',
      relatarAtuacao: false,
      descricaoAtuacao: '',
    });
  }, [textoCanalAtual, tipoModeloAtivo, templatesEditados, canalAtivo]);

  const tituloGrupo = {
    comunicacao: 'CCO - Comunicação Linha 11',
    operacao: 'Operação CCO / Executivo',
    gerencia: 'Gerência / Órgão Regulador',
    ocorrencias_operacionais: 'Ocorrências Operacionais',
  }[canalAtivo];
  const nomeGrupo = {
    comunicacao: 'Comunicação / Imprensa / Passageiros',
    operacao: 'Operação CCO / Executivo',
    gerencia: 'Gerência / Órgão Regulador',
    ocorrencias_operacionais: 'Ocorrências Operacionais',
  }[canalAtivo];
  const horaPreview = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const tagsParaCanal = useMemo(() => {
    return TAGS_DISPONIVEIS.filter((t) =>
      t.grupos.includes(canalAtivo)
      && (t.tag !== '{{ENCERRAMENTO}}' || tipoModeloAtivo === 'normal')
      && (t.tag !== '{{ENTREGA_RESTRICAO}}' || tipoModeloAtivo === 'encerramento')
    );
  }, [canalAtivo, tipoModeloAtivo]);

  if (carregando) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-safira" />
        <p className="text-sm">Carregando modelos de mensagens...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Modelos de Mensagem dos Grupos (WhatsApp)
            </h3>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isCustom
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isCustom ? 'Modelos Customizados Ativos' : 'Padrão de Fábrica'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personalize o layout, campos e cabeçalhos enviados em cada um dos 3 grupos de WhatsApp sem alterar o código.
            {origem === 'supabase' && ' (Sincronizado no banco de dados)'}
            {origem === 'local' && ' (Persistido no servidor)'}
            {updatedAt && (
              <span className="ml-1 text-slate-400">
                · Atualizado em {new Date(updatedAt).toLocaleString('pt-BR')}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void carregarTemplates()}
            disabled={carregando || salvando}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Recarregar modelos do servidor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            <span>Recarregar</span>
          </button>

          <button
            type="button"
            onClick={copiarModeloAtual}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Copiar modelo atual"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiado ? 'Copiado!' : 'Copiar'}</span>
          </button>

          {isCustom && (
            <button
              type="button"
              disabled={restaurando || salvando}
              onClick={() => void handleRestaurarPadrao()}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 text-rose-700 hover:bg-rose-50 border-rose-200"
              title="Restaurar o layout original de fábrica"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>{restaurando ? 'Restaurando...' : 'Restaurar padrão'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={salvando || !houveAlteracao}
            onClick={() => void handleSalvar()}
            className="btn btn-safira btn-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{salvando ? 'Salvando...' : 'Salvar alterações'}</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
          {erro}
        </div>
      )}

      {aviso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
          {aviso}
        </div>
      )}

      {/* Seletor de Grupo/Canal */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setCanalAtivo('operacao')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            canalAtivo === 'operacao'
              ? 'border-coral text-coral'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="h-4 w-4" />
          Grupo Operação CCO / Executivo
        </button>

        <button
          type="button"
          onClick={() => setCanalAtivo('gerencia')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            canalAtivo === 'gerencia'
              ? 'border-jade text-jade'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Grupo Gerência / Órgão Regulador
        </button>

        <button
          type="button"
          onClick={() => setCanalAtivo('comunicacao')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            canalAtivo === 'comunicacao'
              ? 'border-safira text-safira'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Grupo Comunicação (Imprensa / Passageiros)
        </button>

        <button
          type="button"
          onClick={() => setCanalAtivo('ocorrencias_operacionais')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            canalAtivo === 'ocorrencias_operacionais'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Grupo Ocorrências Operacionais
        </button>
      </div>

      <div className="flex gap-2" role="group" aria-label="Tipo do modelo de mensagem">
        {([
          { id: 'normal', label: 'Mensagem normal' },
          { id: 'encerramento', label: 'Mensagem de encerramento' },
        ] as const).map((modelo) => (
          <button
            key={modelo.id}
            type="button"
            aria-pressed={tipoModeloAtivo === modelo.id}
            onClick={() => setTipoModeloAtivo(modelo.id)}
            className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
              tipoModeloAtivo === modelo.id
                ? 'border-safira bg-safira text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {modelo.label}
          </button>
        ))}
      </div>

      {/* Tags Disponíveis para o Canal Selecionado */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Tag className="w-3.5 h-3.5 text-safira" />
            <span>Variáveis dinâmicas para {tipoModeloAtivo === 'normal' ? 'mensagem normal' : 'mensagem de encerramento'} · Grupo {nomeGrupo}:</span>
          </div>
          <button
            type="button"
            onClick={() => setMostrarPreview(!mostrarPreview)}
            className="text-xs text-safira hover:underline font-medium inline-flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            {mostrarPreview ? 'Ocultar pré-visualização' : 'Mostrar pré-visualização'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Clique em uma tag abaixo para inseri-la no cursor. Em tempo de execução, cada tag é preenchida com os dados reais do evento.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tagsParaCanal.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => inserirTag(item.tag)}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-700 hover:border-safira hover:text-safira transition-colors shadow-2xs"
              title={`Clique para inserir: ${item.desc}`}
            >
              <Code className="w-3 h-3 text-safira" />
              <span className="font-semibold">{item.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Editor + Preview em tempo real */}
      <div className={`grid grid-cols-1 ${mostrarPreview ? 'lg:grid-cols-2' : ''} gap-4`}>
        {/* Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <label htmlFor={`editor-template-${canalAtivo}`} className="font-semibold text-slate-700">
              Modelo de {tipoModeloAtivo === 'normal' ? 'mensagem normal' : 'encerramento'} · Grupo {nomeGrupo} (WhatsApp)
            </label>
            <span className="font-mono text-[11px]">
              {textoCanalAtual.split('\n').length} linhas | {textoCanalAtual.length} caracteres
            </span>
          </div>

          <div className="rounded-lg border border-slate-300 focus-within:border-safira focus-within:ring-1 focus-within:ring-safira bg-white shadow-2xs">
            <textarea
              ref={textareaRef}
              id={`editor-template-${canalAtivo}`}
              rows={14}
              value={textoCanalAtual}
              onChange={(e) => handleAtualizarTextoCanal(e.target.value)}
              className="w-full p-3 font-mono text-xs leading-relaxed bg-transparent resize-y outline-hidden text-slate-800"
              placeholder="Digite o modelo de mensagem com *negrito* e tags {{VARIAVEL}}..."
            />
          </div>
        </div>

        {/* Pré-visualização com dados reais de simulação */}
        {mostrarPreview && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                Pré-visualização ao vivo (Como aparecerá no WhatsApp)
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Prévia: {tipoModeloAtivo === 'normal' ? 'ocorrência em andamento' : 'ocorrência encerrada'}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2a3942] bg-[#0b141a] shadow-lg">
              <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-emerald-50">
                  {canalAtivo === 'comunicacao'
                    ? <Users className="h-5 w-5" aria-hidden="true" />
                    : <TrainFront className="h-5 w-5" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-slate-100">{tituloGrupo}</h4>
                  <p className="truncate text-xs text-slate-400">
                    Você, Supervisão CCO, Tráfego, Manutenção...
                  </p>
                </div>
                <button type="button" aria-label="Pesquisar na conversa" className="rounded-full p-2 text-slate-400">
                  <Search className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" aria-label="Mais opções do grupo" className="rounded-full p-2 text-slate-400">
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div
                className="min-h-[300px] space-y-4 overflow-y-auto px-3 py-5 sm:px-5"
                style={{
                  backgroundColor: '#0b141a',
                  backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(134, 150, 160, 0.045) 0 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, rgba(134, 150, 160, 0.04) 0 1px, transparent 1.5px)',
                  backgroundSize: '24px 24px, 32px 32px',
                }}
              >
                <div className="mx-auto w-fit rounded-lg bg-[#182229]/95 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300 shadow-sm">
                  Hoje
                </div>

                <div className="flex justify-end">
                  <div className="relative max-w-[95%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3.5 pb-2 pt-2.5 text-[12px] leading-relaxed text-[#e9edef] shadow-sm sm:max-w-[88%]">
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-[#005c4b] border-t-transparent"
                    />
                    <p className="mb-1 text-[11px] font-semibold text-[#7dd3b0]">
                      Gabriel Campagnoli (CCO)
                    </p>
                    <div className="whitespace-pre-wrap break-words">
                      {formatWhatsAppText(previewMensagem)}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#b6c9c3]">
                      <span>{horaPreview}</span>
                      <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-label="Lida" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#202c33] px-3 py-2.5">
                <button type="button" aria-label="Emoji" className="rounded-full p-2 text-slate-400">
                  <Smile className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="flex-1 rounded-lg bg-[#2a3942] px-3 py-2 text-xs text-slate-400">
                  Digite uma mensagem
                </div>
                <button type="button" aria-label="Anexar arquivo" className="rounded-full p-2 text-slate-400">
                  <Paperclip className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="Gravar áudio" className="rounded-full p-2 text-slate-400">
                  <Mic className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
