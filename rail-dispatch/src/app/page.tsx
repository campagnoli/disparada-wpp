'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Send,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  Save,
  History,
  Download,
  Clock,
  Search,
  Settings,
  ChevronDown,
  Repeat,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  X,
  GitFork,
  Loader2,
  Plus,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  DoorOpen,
  Building2,
  Box,
  TrainFront,
  Headphones,
  Megaphone,
  Trash2,
} from 'lucide-react';
import { isModeloGemini, modelosGemini, type ModeloGemini } from '@/lib/gemini-models';
import { opcoesClassificacao, definicoesTiposIN } from '@/lib/classificacao-ocorrencia';
import AdminFalhas, { type FalhaPredefinida } from '@/app/admin-falhas';
import {
  aplicarEncerramentoNaMensagem,
  calcularDuracao,
  modeloEncerramentoValido,
  TEMPLATES_MENSAGEM_PADRAO,
  type TemplatesGrupoMensagem,
} from '@/lib/mensagem-templates-pure';
import {
  buscarDadosEstacao,
  buscarViasTrecho,
  formatarVias,
  validarViasOcorrencia,
} from '@/lib/vias';
import { SeletorEstacao } from '@/components/seletor-estacao';
import { ComboboxTrem } from '@/components/combobox-trem';
import { ImpactoOutraLinhaFields } from '@/components/impacto-outra-linha-fields';

export interface ItemLoop {
  id: string;
  estacaoInicio: string;
  estacaoFim: string;
  intervaloTeorico: string;
}

type EtapaId = 'iniciais' | 'loop' | 'falhas' | 'classificacao' | 'apoio-mrs';
type ModalidadePaese = 'SPTrans' | 'ARTESP' | 'Trilhos';

interface EtapaConfig {
  id: EtapaId;
  titulo: string;
}

interface Mensagens {
  comunicacao: string;
  operacao: string;
  gerencia: string;
}

interface FalhaSelecionada {
  chave: string;
  descricao: string;
  impacto: string;
}

function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export type ElementoAfetado =
  | 'via'
  | 'plataforma'
  | 'escada_rolante'
  | 'elevador'
  | 'linha_bloqueio'
  | 'acesso_estacao'
  | 'geral';

export type QuemComunicou = 'estacao' | 'trem' | 'ouvidoria';

interface Estacao {
  id?: string;
  nome: string;
  sigla: string;
  linha: string;
  ordem?: number;
  vias?: string[];
  plataformas?: string[];
  itens_infraestrutura?: string[];
}

interface OcorrenciaHistorico {
  id: string;
  codigo_evento: string | null;
  created_at: string | null;
  linha: string;
  via: string;
  localidade: string;
  id_trem: string | null;
  prefixo_viagem: string | null;
  classificacoes: string[];
  tipo_in: string | null;
  paese_acionado: boolean;
  paese_modalidades: ModalidadePaese[];
  paese_trecho: string;
  tem_impacto_outra_linha: boolean;
  linhas_impactadas_secundarias: string[];
  descricao_impacto_secundario: string | null;
  falha: string;
  hora_inicio: string;
  hora_fim: string | null;
  status: string;
}

interface OcorrenciaDetalhe extends OcorrenciaHistorico {
  msg_comunicacao: string;
  msg_operacao: string;
  msg_gerencia: string;
}

interface PaginaHistorico {
  items: OcorrenciaHistorico[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ModalMensagemConfig {
  aberto: boolean;
  tipo: 'erro' | 'sucesso' | 'info' | 'aviso';
  titulo: string;
  mensagem: string;
  dica?: string;
  detalhesTecnicos?: string;
  textoBotaoConfirmar?: string;
  onConfirmar?: () => void;
}

interface InformacoesErroHumanizado {
  titulo: string;
  mensagem: string;
  dica?: string;
  detalhesTecnicos?: string;
}

function humanizarErro(erro: unknown, contexto?: string): InformacoesErroHumanizado {
  let textoBruto = '';
  if (erro instanceof Error) {
    textoBruto = erro.message;
  } else if (typeof erro === 'string') {
    textoBruto = erro;
  } else if (erro && typeof erro === 'object') {
    try {
      textoBruto = JSON.stringify(erro);
    } catch {
      textoBruto = String(erro);
    }
  } else {
    textoBruto = String(erro ?? 'Erro desconhecido');
  }

  textoBruto = textoBruto.replace(/supabase/gi, 'banco de dados');
  const textoMinusculo = textoBruto.toLowerCase();

  // 1. Sobrecarga / 503 / Service Unavailable do Gemini
  if (
    textoMinusculo.includes('503') ||
    textoMinusculo.includes('alta demanda') ||
    textoMinusculo.includes('overloaded') ||
    textoMinusculo.includes('unavailable') ||
    textoMinusculo.includes('service unavailable')
  ) {
    return {
      titulo: 'Serviço de IA Temporariamente Ocupado',
      mensagem:
        'Os servidores do Google Gemini estão com alta demanda temporária no momento e não conseguiram responder à requisição imediatamente.',
      dica: 'Aguarde cerca de 10 a 20 segundos e tente clicar em "Gerar mensagens com Gemini" novamente. Você também pode testar o modelo "Gemini 3.5 Flash Lite" no seletor de IA.',
      detalhesTecnicos: textoBruto,
    };
  }

  // 2. Limite de requisições / 429
  if (
    textoMinusculo.includes('429') ||
    textoMinusculo.includes('resource_exhausted') ||
    textoMinusculo.includes('rate limit') ||
    textoMinusculo.includes('quota') ||
    textoMinusculo.includes('limite')
  ) {
    return {
      titulo: 'Limite de Requisições da IA Atingido',
      mensagem:
        'A taxa máxima de consultas por minuto com o modelo Gemini foi atingida temporariamente.',
      dica: 'Aguarde cerca de 30 a 60 segundos antes de tentar gerar novamente.',
      detalhesTecnicos: textoBruto,
    };
  }

  // 3. Autenticação / Chave de API / 401 / 403
  if (
    textoMinusculo.includes('401') ||
    textoMinusculo.includes('403') ||
    textoMinusculo.includes('api_key') ||
    textoMinusculo.includes('permission_denied') ||
    textoMinusculo.includes('não configurada') ||
    textoMinusculo.includes('chave gemini')
  ) {
    return {
      titulo: 'Chave de Acesso da IA Não Autorizada',
      mensagem:
        'Não foi possível autenticar o serviço com o provedor de IA. A chave GEMINI_API_KEY pode estar ausente ou inválida.',
      dica: 'Comunique a equipe técnica do CCO para revisar a variável GEMINI_API_KEY no arquivo de ambiente (.env.local).',
      detalhesTecnicos: textoBruto,
    };
  }

  // 4. Instabilidade de conexão / Rede
  if (
    textoMinusculo.includes('failed to fetch') ||
    textoMinusculo.includes('network') ||
    textoMinusculo.includes('conexão') ||
    textoMinusculo.includes('econnrefused') ||
    textoMinusculo.includes('timeout')
  ) {
    return {
      titulo: 'Instabilidade de Conexão com o Servidor',
      mensagem:
        'Não foi possível estabelecer contato com os serviços do SIDO ou com a internet.',
      dica: 'Verifique se você está conectado à rede da CPTM/Trivia e se o servidor da aplicação está em execução.',
      detalhesTecnicos: textoBruto,
    };
  }

  // 5. Ocorrência não encontrada (404)
  if (
    textoMinusculo.includes('404') ||
    textoMinusculo.includes('não encontrada') ||
    textoMinusculo.includes('não localizada') ||
    textoMinusculo.includes('não foi possível encontrar')
  ) {
    return {
      titulo: 'Ocorrência Não Localizada',
      mensagem:
        'Nenhum registro correspondente foi encontrado com os dados informados.',
      dica: 'Verifique se o código do evento foi digitado corretamente (formato DDMMAAAALLNNN, por exemplo: 1410202611001) ou clique diretamente no evento listado na tabela.',
      detalhesTecnicos: textoBruto,
    };
  }

  // 6. Banco de Dados
  if (
    textoMinusculo.includes('banco') ||
    textoMinusculo.includes('pgrst')
  ) {
    return {
      titulo: 'Falha ao Sincronizar com o Banco de Dados',
      mensagem:
        'Ocorreu uma instabilidade ao salvar ou recuperar os dados da ocorrência no banco central.',
      dica: 'Aguarde alguns segundos e tente novamente. Se a mensagem persistir, verifique a conexão com o banco de dados.',
      detalhesTecnicos: textoBruto,
    };
  }

  // 7. Validação
  if (
    textoMinusculo.includes('obrigat') ||
    textoMinusculo.includes('inválid') ||
    textoMinusculo.includes('preencha') ||
    textoMinusculo.includes('selecione')
  ) {
    return {
      titulo: 'Dados Incompletos ou Inválidos',
      mensagem: textoBruto,
      dica: 'Verifique se todas as etapas obrigatórias do formulário foram preenchidas antes de prosseguir.',
      detalhesTecnicos: textoBruto,
    };
  }

  // 8. WhatsApp / Evolution API
  if (
    textoMinusculo.includes('evolution') ||
    textoMinusculo.includes('whatsapp') ||
    textoMinusculo.includes('group_id')
  ) {
    return {
      titulo: 'Falha no Envio via WhatsApp',
      mensagem: textoBruto,
      dica: 'Verifique se a Evolution API está em execução no endereço configurado, se a instância está conectada e se os IDs dos 3 grupos estão preenchidos no .env.local.',
      detalhesTecnicos: textoBruto,
    };
  }

  // Fallback Genérico amigável
  return {
    titulo: contexto ? `Atenção: ${contexto}` : 'Não foi possível concluir a ação',
    mensagem: textoBruto.length > 0 && textoBruto.length < 250
      ? textoBruto
      : 'Ocorreu um comportamento inesperado durante o processamento desta operação no sistema.',
    dica: 'Tente repetir a ação. Se a dificuldade persistir, utilize os detalhes técnicos abaixo para acionar a equipe de suporte.',
    detalhesTecnicos: textoBruto,
  };
}

function renderizarTextoComDestaques(texto: string) {
  if (!texto.includes('**')) return texto;
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {parte.slice(2, -2)}
        </strong>
      );
    }
    return parte;
  });
}

async function buscarFalhasPredefinidas(): Promise<FalhaPredefinida[]> {
  const response = await fetch('/api/admin/falhas', { cache: 'no-store' });
  const data = (await response.json()) as { falhas?: FalhaPredefinida[]; error?: string };
  if (!response.ok || !Array.isArray(data.falhas)) {
    throw new Error(data.error || 'Não foi possível carregar as opções de falha.');
  }
  return data.falhas;
}

async function buscarHistorico(page: number, signal?: AbortSignal): Promise<PaginaHistorico> {
  const res = await fetch(`/api/ocorrencias?page=${page}`, { signal });
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Não foi possível carregar o histórico.';
    throw new Error(message);
  }

  if (typeof data !== 'object' || data === null || !('items' in data) || !Array.isArray(data.items)) {
    throw new Error('Resposta inválida ao carregar o histórico.');
  }

  return data as PaginaHistorico;
}

async function buscarOcorrencia(codigoEvento: string): Promise<OcorrenciaDetalhe> {
  const res = await fetch(`/api/ocorrencias?codigo_evento=${encodeURIComponent(codigoEvento)}`);
  const data = (await res.json().catch(() => null)) as {
    ocorrencia?: OcorrenciaDetalhe;
    error?: string;
  } | null;

  if (!res.ok || !data?.ocorrencia) {
    throw new Error(data?.error || 'Não foi possível encontrar a ocorrência.');
  }

  return data.ocorrencia;
}

export default function DespachoOcorrencias() {
  const [linha, setLinha] = useState('Linha 11-Coral');
  const [tipoLocalidade, setTipoLocalidade] = useState<'estacao' | 'trecho'>('estacao');
  const [localidadeInicio, setLocalidadeInicio] = useState('');
  const [localidadeFim, setLocalidadeFim] = useState('');
  const [elementoAfetado, setElementoAfetado] = useState<ElementoAfetado>('geral');
  const [viasSelecionadas, setViasSelecionadas] = useState<string[]>([]);
  const [viasDisponiveis, setViasDisponiveis] = useState<string[]>([]);
  const [plataformasDisponiveis, setPlataformasDisponiveis] = useState<string[]>([]);
  const [plataformasSelecionadas, setPlataformasSelecionadas] = useState<string[]>([]);
  const [detalheLocalizacao, setDetalheLocalizacao] = useState('');
  const [loadingVias, setLoadingVias] = useState(false);
  const [novaViaManual, setNovaViaManual] = useState('');
  const [novaPlataformaManual, setNovaPlataformaManual] = useState('');

  const viaTextoFormatado = formatarVias(viasSelecionadas);
  const via = viaTextoFormatado || (tipoLocalidade === 'estacao' ? 'Não aplicável' : '');
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [carregandoEstacoes, setCarregandoEstacoes] = useState(true);
  const [erroEstacoes, setErroEstacoes] = useState('');
  const [quemComunicou, setQuemComunicou] = useState<QuemComunicou>('estacao');
  const [idTrem, setIdTrem] = useState('');
  const [prefixoViagem, setPrefixoViagem] = useState('');
  const [apoioMRSCiente, setApoioMRSCiente] = useState<boolean | null>(null);
  const [justificativaApoioMRS, setJustificativaApoioMRS] = useState('');
  const [templatesEncerramento, setTemplatesEncerramento] = useState<TemplatesGrupoMensagem>(
    TEMPLATES_MENSAGEM_PADRAO.encerramento,
  );
  const [carregouTemplatesEncerramento, setCarregouTemplatesEncerramento] = useState(false);
  const [erroTemplatesEncerramento, setErroTemplatesEncerramento] = useState('');
  const [classificacoes, setClassificacoes] = useState<string[]>([]);
  const [tipoIN, setTipoIN] = useState('');
  const [paeseAcionado, setPaeseAcionado] = useState(false);
  const [paeseModalidades, setPaeseModalidades] = useState<ModalidadePaese[]>([]);
  const [paeseTrecho, setPaeseTrecho] = useState('');
  const [sco, setSCO] = useState('');
  const [identificacaoComunicador, setIdentificacaoComunicador] = useState('');

  const estacaoSelecionadaObj = useMemo(() => {
    if (!localidadeInicio) return null;
    return (
      estacoes.find((e) => e.sigla === localidadeInicio && (!linha || e.linha === linha)) ||
      estacoes.find((e) => e.sigla === localidadeInicio) ||
      null
    );
  }, [localidadeInicio, linha, estacoes]);

  const estacaoNomeDisplay = estacaoSelecionadaObj
    ? `Estação ${estacaoSelecionadaObj.nome} (${estacaoSelecionadaObj.sigla})`
    : localidadeInicio
    ? `Estação ${localidadeInicio}`
    : '';

  const handleTrocarQuemComunicou = (opcao: QuemComunicou) => {
    setQuemComunicou(opcao);
    if (opcao === 'estacao') {
      setIdTrem('');
      setPrefixoViagem('');
      setIdentificacaoComunicador(
        estacaoSelecionadaObj
          ? `Estação ${estacaoSelecionadaObj.nome} (${estacaoSelecionadaObj.sigla})`
          : localidadeInicio ? `Estação ${localidadeInicio}` : '',
      );
    } else if (opcao === 'ouvidoria') {
      setIdTrem('');
      setPrefixoViagem('');
      setIdentificacaoComunicador('Ouvidoria');
    } else if (opcao === 'trem') {
      setIdentificacaoComunicador('');
    }
  };
  const alterarTipoLocalidade = (novoTipo: 'estacao' | 'trecho') => {
    if (novoTipo === tipoLocalidade) return;

    setTipoLocalidade(novoTipo);
    setLocalidadeInicio('');
    setLocalidadeFim('');
    setViasSelecionadas([]);
    setViasDisponiveis([]);
    setPlataformasSelecionadas([]);
    setPlataformasDisponiveis([]);
    setDetalheLocalizacao('');
    setElementoAfetado('geral');
    if (novoTipo === 'estacao') {
      setQuemComunicou('estacao');
      setIdTrem('');
      setPrefixoViagem('');
      setIdentificacaoComunicador('');
    } else {
      setQuemComunicou('trem');
      setIdentificacaoComunicador('');
    }
  };
  const [falhasSelecionadas, setFalhasSelecionadas] = useState<FalhaSelecionada[]>([]);
  const [buscaFalhas, setBuscaFalhas] = useState('');
  const [falhaEditada, setFalhaEditada] = useState<string | null>(null);
  const [impactoEditado, setImpactoEditado] = useState<string | null>(null);
  const [temImpactoOutraLinha, setTemImpactoOutraLinha] = useState(false);
  const [linhasImpactadasSecundarias, setLinhasImpactadasSecundarias] = useState<string[]>([]);
  const [descricaoImpactoSecundario, setDescricaoImpactoSecundario] = useState('');
  const [falhasPredefinidas, setFalhasPredefinidas] = useState<FalhaPredefinida[]>([]);
  const [carregandoFalhas, setCarregandoFalhas] = useState(true);
  const [erroFalhas, setErroFalhas] = useState('');
  const [estrategiaLoop, setEstrategiaLoop] = useState(false);
  const [qtdLoops, setQtdLoops] = useState<number>(1);
  const [loops, setLoops] = useState<ItemLoop[]>([
    { id: '1', estacaoInicio: '', estacaoFim: '', intervaloTeorico: '' },
  ]);
  const [etapaAtiva, setEtapaAtiva] = useState<EtapaId>('iniciais');
  const [horaInicio, setHoraInicio] = useState('');
  const [modeloGemini, setModeloGemini] = useState<ModeloGemini>('gemini-3.5-flash-lite');

  useEffect(() => {
    const controller = new AbortController();
    const carregarModelosEncerramento = async () => {
      try {
        const response = await fetch('/api/admin/templates', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json() as {
          templates?: { encerramento?: Partial<TemplatesGrupoMensagem> };
          error?: string;
        };
        if (!response.ok || !data.templates?.encerramento) {
          throw new Error(data.error || 'Não foi possível carregar os modelos de encerramento.');
        }
        const modelos = data.templates.encerramento;
        if (
          !modelos.comunicacao || !modeloEncerramentoValido(modelos.comunicacao)
          || !modelos.operacao || !modeloEncerramentoValido(modelos.operacao)
          || !modelos.gerencia || !modeloEncerramentoValido(modelos.gerencia)
        ) {
          throw new Error('Os modelos de encerramento estão incompletos. Acione a equipe técnica.');
        }
        setTemplatesEncerramento({
          comunicacao: modelos.comunicacao,
          operacao: modelos.operacao,
          gerencia: modelos.gerencia,
        });
        setErroTemplatesEncerramento('');
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : 'Falha ao carregar modelos de encerramento.';
          setErroTemplatesEncerramento(message);
        }
      } finally {
        if (!controller.signal.aborted) setCarregouTemplatesEncerramento(true);
      }
    };
    void carregarModelosEncerramento();
    return () => controller.abort();
  }, []);

  const aplicarModeloEncerramento = useCallback((
    canal: keyof TemplatesGrupoMensagem,
    mensagem: string,
    horaFim: string,
    horaInicio?: string,
    linha?: string,
    impactoOutraLinha?: Pick<
      OcorrenciaHistorico,
      'tem_impacto_outra_linha' | 'linhas_impactadas_secundarias' | 'descricao_impacto_secundario'
    >,
  ) => {
    const rotulo = canal === 'operacao'
      ? 'DESPACHO CCO'
      : canal === 'gerencia'
        ? 'INFORME EXECUTIVO CCO'
        : 'INFORME CCO';
    const tituloFallback = `${rotulo} - ${linha || 'LINHA NÃO INFORMADA'}`;
    return aplicarEncerramentoNaMensagem(
      mensagem,
      horaFim,
      horaInicio,
      templatesEncerramento[canal],
      tituloFallback,
      impactoOutraLinha
        ? {
            temImpactoOutraLinha: impactoOutraLinha.tem_impacto_outra_linha,
            linhaSecundariaAfetada: impactoOutraLinha.linhas_impactadas_secundarias.join(', '),
            impactoSecundario: impactoOutraLinha.descricao_impacto_secundario ?? '',
          }
        : undefined,
    );
  }, [templatesEncerramento]);

  const prefixoDeCarga = /^[A-Z]{3}\d{4}$/i.test(prefixoViagem.trim());
  const etapas: EtapaConfig[] = [
    { id: 'iniciais', titulo: 'Informações iniciais' },
    ...(estrategiaLoop ? [{ id: 'loop' as const, titulo: 'Configuração de Loop' }] : []),
    { id: 'falhas', titulo: 'Falha e impacto operacional' },
    { id: 'classificacao', titulo: 'Classificação da ocorrência' },
    ...(prefixoDeCarga ? [{ id: 'apoio-mrs' as const, titulo: 'Confirmação do Apoio da MRS' }] : []),
  ];

  const indiceEtapaAtiva = Math.max(
    0,
    etapas.findIndex((e) => e.id === etapaAtiva)
  );
  const etapaAtual = etapas[indiceEtapaAtiva] ?? etapas[0];
  const totalEtapas = etapas.length;

  const handleToggleEstrategiaLoop = (marcado: boolean) => {
    setEstrategiaLoop(marcado);
    if (!marcado && etapaAtiva === 'loop') {
      setEtapaAtiva('iniciais');
    }
  };

  const alterarQtdLoops = (novaQtd: number) => {
    const qtd = Math.max(1, Math.min(5, novaQtd));
    setQtdLoops(qtd);
    setLoops((atuais) => {
      if (atuais.length === qtd) return atuais;
      if (atuais.length < qtd) {
        const novos = [...atuais];
        for (let i = atuais.length + 1; i <= qtd; i++) {
          novos.push({
            id: String(i),
            estacaoInicio: '',
            estacaoFim: '',
            intervaloTeorico: '',
          });
        }
        return novos;
      }
      return atuais.slice(0, qtd);
    });
  };

  const atualizarLoop = (index: number, campo: keyof ItemLoop, valor: string) => {
    setLoops((atuais) => atuais.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, [campo]: valor };
    }));
  };

  const isEtapaValida = () => {
    if (etapaAtual.id === 'iniciais') {
      const validacaoVias = validarViasOcorrencia(tipoLocalidade, viasSelecionadas);
      return (
        !loading
        && !carregandoEstacoes
        && !loadingVias
        && !!localidadeInicio
        && (tipoLocalidade !== 'trecho' || (!!localidadeFim && localidadeFim !== localidadeInicio))
        && validacaoVias.valido
        && !!sco.trim()
        && (
          tipoLocalidade !== 'estacao'
          || quemComunicou === 'trem'
          || !!identificacaoComunicador.trim()
        )
        && !!horaInicio
      );
    }
    if (etapaAtual.id === 'loop') {
      return (
        loops.length > 0
        && loops.every((l) =>
          !!l.estacaoInicio
          && !!l.estacaoFim
          && l.estacaoInicio !== l.estacaoFim
          && l.intervaloTeorico.trim().length > 0
        )
      );
    }
    if (etapaAtual.id === 'falhas') {
      return (
        !loading
        && !carregandoFalhas
        && falhasSelecionadas.length > 0
        && falha.trim().length > 0
        && impacto.trim().length > 0
        && (
          !temImpactoOutraLinha
          || (
            linhasImpactadasSecundarias.length > 0
            && !!descricaoImpactoSecundario.trim()
          )
        )
      );
    }
    if (etapaAtual.id === 'classificacao') {
      return !loading
        && (!classificacoes.includes('IN') || !!tipoIN)
        && (!paeseAcionado || (paeseModalidades.length > 0 && !!paeseTrecho.trim()));
    }
    if (etapaAtual.id === 'apoio-mrs') {
      return !loading
        && apoioMRSCiente !== null
        && (apoioMRSCiente || !!justificativaApoioMRS.trim());
    }
    return true;
  };

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<OcorrenciaHistorico[]>([]);
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [abaAtiva, setAbaAtiva] = useState<'ocorrencia' | 'historico' | 'admin'>('ocorrencia');
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState('');
  const [codigoBusca, setCodigoBusca] = useState('');
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<OcorrenciaDetalhe | null>(null);
  const [buscandoOcorrencia, setBuscandoOcorrencia] = useState(false);
  const [atualizandoHorarioFim, setAtualizandoHorarioFim] = useState(false);
  const [horaFim, setHoraFim] = useState('');
  const [erroBusca, setErroBusca] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [msgFimEditada, setMsgFimEditada] = useState<{
    comunicacao: string;
    operacao: string;
    gerencia: string;
  }>({
    comunicacao: '',
    operacao: '',
    gerencia: '',
  });
  const [sucessoEncerramento, setSucessoEncerramento] = useState('');
  const [disparoRealizado, setDisparoRealizado] = useState(false);

  /**
   * Estados para exclusão de ocorrências (validador triplo)
   */
  const [ocorrenciasSelecionadasExclusao, setOcorrenciasSelecionadasExclusao] = useState<
    Set<string>
  >(new Set());
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [etapaExclusao, setEtapaExclusao] = useState<1 | 2 | 3>(1);
  const [nomeExclusao, setNomeExclusao] = useState('');
  const [dataExclusao, setDataExclusao] = useState('');
  const [excluindoOcorrencias, setExcluindoOcorrencias] = useState(false);
  const [disparandoWpp, setDisparandoWpp] = useState(false);
  const [codigoEventoAtual, setCodigoEventoAtual] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagens>({
    comunicacao: '',
    operacao: '',
    gerencia: '',
  });
  const [mensagensGemini, setMensagensGemini] = useState<Mensagens | null>(null);
  const [dadosOcorrenciaGerada, setDadosOcorrenciaGerada] = useState<Record<string, unknown> | null>(null);
  const [gruposSelecionados, setGruposSelecionados] = useState<{
    comunicacao: boolean;
    operacao: boolean;
    gerencia: boolean;
  }>({
    comunicacao: true,
    operacao: true,
    gerencia: true,
  });
  const [gruposRedisparo, setGruposRedisparo] = useState<{
    comunicacao: boolean;
    operacao: boolean;
    gerencia: boolean;
  }>({
    comunicacao: true,
    operacao: true,
    gerencia: true,
  });
  const [disparandoCanal, setDisparandoCanal] = useState<string | null>(null);

  const [modalConfig, setModalConfig] = useState<ModalMensagemConfig>({
    aberto: false,
    tipo: 'info',
    titulo: '',
    mensagem: '',
  });

  const fecharModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, aberto: false }));
  }, []);

  const exibirModal = useCallback((config: Omit<ModalMensagemConfig, 'aberto'>) => {
    setModalConfig({
      ...config,
      aberto: true,
    });
  }, []);

  const exibirErro = useCallback((erro: unknown, contexto?: string) => {
    const dados = humanizarErro(erro, contexto);
    exibirModal({
      tipo: 'erro',
      titulo: dados.titulo,
      mensagem: dados.mensagem,
      dica: dados.dica,
      detalhesTecnicos: dados.detalhesTecnicos,
      textoBotaoConfirmar: 'Entendi',
    });
  }, [exibirModal]);

  useEffect(() => {
    if (!modalConfig.aberto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalConfig.aberto, fecharModal]);
  const falha = falhaEditada
    ?? falhasSelecionadas.map((item) => item.descricao.trim()).filter(Boolean).join('\n');
  const impacto = impactoEditado
    ?? falhasSelecionadas.map((item) => item.impacto.trim()).filter(Boolean).join('\n');
  const falhasFiltradas = useMemo(() => {
    const termo = normalizarBusca(buscaFalhas);
    return termo
      ? falhasPredefinidas.filter((opcao) => normalizarBusca(opcao.descricao).includes(termo))
      : falhasPredefinidas;
  }, [buscaFalhas, falhasPredefinidas]);

  const atrasoComunicacao = (() => {
    if (!horaInicio || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio)) return false;
    const agora = new Date();
    const minutosAtuais = agora.getHours() * 60 + agora.getMinutes();
    const [h, m] = horaInicio.split(':').map(Number);
    const minutosInicio = h * 60 + m;
    let diff = minutosAtuais - minutosInicio;
    // Trata virada de meia-noite (ex: agora 00:15 e ocorrência às 23:40 -> 35 min)
    if (diff < -12 * 60) {
      diff += 24 * 60;
    }
    return diff > 30;
  })();

  const carregarFalhasPredefinidas = useCallback(async () => {
    try {
      const data = await buscarFalhasPredefinidas();
      setErroFalhas('');
      const anteriores = new Map(falhasPredefinidas.map((item) => [`preset:${item.id}`, item]));
      const atuaisDisponiveis = new Map(data.map((item) => [`preset:${item.id}`, item]));
      setFalhasPredefinidas(data);
      setFalhasSelecionadas((atuais) => atuais.flatMap((item) => {
        if (item.chave === 'personalizada') return [item];
        const atualizada = atuaisDisponiveis.get(item.chave);
        if (!atualizada) return [];
        const anterior = anteriores.get(item.chave);
        const semEdicaoManual = anterior
          && item.descricao === anterior.descricao
          && item.impacto === anterior.impacto;
        return [{
          ...item,
          descricao: semEdicaoManual ? atualizada.descricao : item.descricao,
          impacto: semEdicaoManual ? atualizada.impacto : item.impacto,
        }];
      }));
      setFalhaEditada(null);
      setImpactoEditado(null);
    } catch (error: unknown) {
      setErroFalhas(error instanceof Error ? error.message : 'Não foi possível carregar as opções de falha.');
    }
    setCarregandoFalhas(false);
  }, [falhasPredefinidas]);

  useEffect(() => {
    let mounted = true;

    const carregar = async () => {
      try {
        const falhas = await buscarFalhasPredefinidas();
        if (!mounted) return;
        setFalhasPredefinidas(falhas);
      } catch (error: unknown) {
        if (mounted) {
          setErroFalhas(error instanceof Error ? error.message : 'Não foi possível carregar as opções de falha.');
        }
      } finally {
        if (mounted) setCarregandoFalhas(false);
      }
    };

    void carregar();
    return () => {
      mounted = false;
    };
  }, []);

  const alternarFalha = (falha: FalhaPredefinida | null, selecionada: boolean) => {
    const chave = falha ? `preset:${falha.id}` : 'personalizada';
    setFalhaEditada(null);
    setImpactoEditado(null);
    setFalhasSelecionadas((atuais) => {
      if (selecionada) {
        if (atuais.some((item) => item.chave === chave)) return atuais;
        return [...atuais, {
          chave,
          descricao: falha?.descricao ?? '',
          impacto: falha?.impacto ?? '',
        }];
      }
      return atuais.filter((item) => item.chave !== chave);
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setHoraInicio(new Date().toTimeString().slice(0, 5));
    }, 0);

    void buscarHistorico(1, controller.signal)
      .then((pagina) => {
        setHistorico(pagina.items);
        setTotalHistorico(pagina.total);
        setPaginaHistorico(pagina.page);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErroHistorico(error instanceof Error ? error.message : 'Falha ao carregar histórico.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoHistorico(false);
      });

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const carregarEstacoes = async () => {
      try {
        const res = await fetch('/api/estacoes', {
          signal: controller.signal,
        });
        const data = (await res.json()) as { estacoes?: Estacao[]; error?: string };

        if (!res.ok) throw new Error(data.error || 'Falha ao carregar as estações.');
        setEstacoes(data.estacoes ?? []);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setErroEstacoes(error instanceof Error ? error.message : 'Falha ao carregar as estações.');
        }
      } finally {
        if (!controller.signal.aborted) setCarregandoEstacoes(false);
      }
    };

    void carregarEstacoes();
    return () => controller.abort();
  }, []);

  // Protege contra navegação acidental com formulário preenchido e não salvo
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const temPreenchimento = Boolean(
        localidadeInicio ||
          localidadeFim ||
          falhasSelecionadas.length > 0 ||
          falha.trim().length > 0 ||
          impacto.trim().length > 0 ||
          temImpactoOutraLinha ||
          linhasImpactadasSecundarias.length > 0 ||
          descricaoImpactoSecundario.trim().length > 0 ||
          classificacoes.length > 0 ||
          tipoIN.trim().length > 0 ||
          idTrem.trim().length > 0 ||
          prefixoViagem.trim().length > 0 ||
          sco.trim().length > 0 ||
          identificacaoComunicador.trim().length > 0 ||
          horaInicio.trim().length > 0 ||
          gruposSelecionados.comunicacao ||
          gruposSelecionados.operacao ||
          gruposSelecionados.gerencia
      );
      if (temPreenchimento && !codigoEventoAtual && !disparoRealizado) {
        e.preventDefault();
        e.returnValue =
          'Você tem dados de ocorrência preenchidos que ainda não foram salvos. Tem certeza de que deseja sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    localidadeInicio,
    localidadeFim,
    falhasSelecionadas,
    falha,
    impacto,
    temImpactoOutraLinha,
    linhasImpactadasSecundarias,
    descricaoImpactoSecundario,
    classificacoes,
    tipoIN,
    idTrem,
    prefixoViagem,
    sco,
    identificacaoComunicador,
    horaInicio,
    gruposSelecionados,
    codigoEventoAtual,
    disparoRealizado,
  ]);

  // Easter egg: Konami code revela mensagem do Aprendiz Maçom no console
  useEffect(() => {
    const konami: string[] = [];
    const handler = (e: KeyboardEvent) => {
      konami.push(e.key);
      if (konami.length > 10) konami.shift();
      const seq = konami.join('');
      if (
        seq === 'ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightBA'
      ) {
        console.log('%c☐ Oficina do Aprendiz Maçom ☐', 'color: #8b4513; font-size: 14px; font-weight: bold;');
        console.log('%c"Trabalhe com retidão, aprenda os segredos da oficina. O martelo e o cinzel aguardam."', 'color: #5c4033; font-size: 12px;');
        console.log('%cGrau: Aprendiz · Símbolo: Esquadro e Compasso · Luz: ao Oriente', 'color: #5c4033; font-size: 11px; font-style: italic;');
        konami.length = 0;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Carregamento dinâmico de vias e subsistemas para Estação no Supabase
  const carregarDadosEstacaoSelecionada = useCallback(async (
    siglaEstacao: string,
    linhaEstacao: string,
    estaAtivo: () => boolean,
  ) => {
    if (!siglaEstacao) {
      if (!estaAtivo()) return;
      setViasDisponiveis([]);
      setViasSelecionadas([]);
      setPlataformasDisponiveis([]);
      setPlataformasSelecionadas([]);
      return;
    }
    if (!estaAtivo()) return;
    setLoadingVias(true);
    try {
      const dados = await buscarDadosEstacao(siglaEstacao, linhaEstacao);
      if (!estaAtivo()) return;
      setViasDisponiveis(dados.vias);
      setPlataformasDisponiveis(dados.plataformas);
      setViasSelecionadas([]);
      setPlataformasSelecionadas([]);
    } catch (err: unknown) {
      if (estaAtivo()) console.error('Falha ao carregar dados da estação:', err);
    } finally {
      if (estaAtivo()) setLoadingVias(false);
    }
  }, []);

  // Carregamento dinâmico de vias para Trecho entre estações no Supabase
  const carregarViasTrecho = useCallback(async (
    origem: string,
    destino: string,
    linhaAtual: string,
    estaAtivo: () => boolean,
  ) => {
    if (!origem || !destino || origem === destino) {
      if (!estaAtivo()) return;
      setViasDisponiveis([]);
      setViasSelecionadas([]);
      return;
    }
    if (!estaAtivo()) return;
    setLoadingVias(true);
    setViasSelecionadas([]);

    try {
      const viasEncontradas = await buscarViasTrecho(linhaAtual, origem, destino);
      if (!estaAtivo()) return;
      setViasDisponiveis(viasEncontradas);
    } catch (err: unknown) {
      if (estaAtivo()) console.error('Falha ao carregar vias do trecho:', err);
    } finally {
      if (estaAtivo()) setLoadingVias(false);
    }
  }, []);

  // Monitora alterações de localidade e dispara consulta das vias e subsistemas
  useEffect(() => {
    let ativo = true;
    const sincronizarLocalidade = async () => {
      await Promise.resolve();
      if (!ativo) return;

      if (tipoLocalidade === 'estacao') {
        if (localidadeInicio) {
          void carregarDadosEstacaoSelecionada(localidadeInicio, linha, () => ativo);
        } else {
          setViasDisponiveis([]);
          setViasSelecionadas([]);
          setPlataformasDisponiveis([]);
          setPlataformasSelecionadas([]);
        }
      } else if (tipoLocalidade === 'trecho') {
        if (localidadeInicio && localidadeFim && localidadeInicio !== localidadeFim) {
          void carregarViasTrecho(localidadeInicio, localidadeFim, linha, () => ativo);
        } else {
          setViasDisponiveis([]);
          setViasSelecionadas([]);
        }
      }
    };

    void sincronizarLocalidade();
    return () => {
      ativo = false;
    };
  }, [tipoLocalidade, localidadeInicio, localidadeFim, linha, carregarDadosEstacaoSelecionada, carregarViasTrecho]);

  const alternarVia = (viaItem: string) => {
    setViasSelecionadas((atuais) => {
      if (atuais.includes(viaItem)) {
        return atuais.filter((v) => v !== viaItem);
      }
      return [...atuais, viaItem];
    });
  };

  const selecionarTodasVias = () => {
    setViasSelecionadas([...viasDisponiveis]);
  };

  const limparVias = () => {
    setViasSelecionadas([]);
  };

  const adicionarViaManual = (textoVia: string) => {
    const limpa = textoVia.trim().replace(/^via\s+/i, '');
    if (!limpa) return;
    if (!viasDisponiveis.includes(limpa)) {
      setViasDisponiveis((prev) => [...prev, limpa]);
    }
    if (!viasSelecionadas.includes(limpa)) {
      setViasSelecionadas((prev) => [...prev, limpa]);
    }
    setNovaViaManual('');
  };

  const alternarPlataforma = (platItem: string) => {
    setPlataformasSelecionadas((atuais) => {
      if (atuais.includes(platItem)) {
        return atuais.filter((p) => p !== platItem);
      }
      return [...atuais, platItem];
    });
  };

  const alternarPlataformaUnica = (platItem: string) => {
    setPlataformasSelecionadas((atuais) => {
      if (atuais.includes(platItem)) {
        return [];
      }
      return [platItem];
    });
  };

  const selecionarTodasPlataformas = () => {
    setPlataformasSelecionadas([...plataformasDisponiveis]);
  };

  const limparPlataformas = () => {
    setPlataformasSelecionadas([]);
  };

  const adicionarPlataformaManual = (textoPlat: string) => {
    const limpa = textoPlat.trim().replace(/^plat(aforma)?\s*/i, '');
    if (!limpa) return;
    if (!plataformasDisponiveis.includes(limpa)) {
      setPlataformasDisponiveis((prev) => [...prev, limpa]);
    }
    if (!plataformasSelecionadas.includes(limpa)) {
      setPlataformasSelecionadas((prev) => [...prev, limpa]);
    }
    setNovaPlataformaManual('');
  };

  const handleVoltar = () => {
    if (indiceEtapaAtiva > 0) {
      setEtapaAtiva(etapas[indiceEtapaAtiva - 1].id);
    }
  };

  const handleGerarMensagens = async (e: React.FormEvent) => {
    e.preventDefault();

    if (indiceEtapaAtiva < totalEtapas - 1) {
      if (etapaAtual.id === 'iniciais') {
        const validacao = validarViasOcorrencia(tipoLocalidade, viasSelecionadas);
        if (!validacao.valido) {
          exibirModal({
            tipo: 'aviso',
            titulo: 'Seleção de Via Obrigatória',
            mensagem: validacao.mensagem || 'Para ocorrências em trecho entre estações, a seleção de ao menos uma via é estritamente obrigatória.',
            dica: 'Clique nas vias disponíveis (ex: Via 1, Via 2) para indicar as vias afetadas.',
            textoBotaoConfirmar: 'Selecionar Vias',
          });
          return;
        }
      }
      setEtapaAtiva(etapas[indiceEtapaAtiva + 1].id);
      return;
    }

    const validacaoFinal = validarViasOcorrencia(tipoLocalidade, viasSelecionadas);
    if (!validacaoFinal.valido) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Seleção de Via Obrigatória',
        mensagem: validacaoFinal.mensagem || 'Para ocorrências em trecho entre estações, a seleção de ao menos uma via é estritamente obrigatória.',
        dica: 'Clique nas vias disponíveis (ex: Via 1, Via 2) para indicar as vias afetadas.',
        textoBotaoConfirmar: 'Selecionar Vias',
      });
      return;
    }

    setLoading(true);
    setMensagensGemini(null);
    setDadosOcorrenciaGerada(null);

    try {
      let localidade = tipoLocalidade === 'estacao'
        ? localidadeInicio
        : `${localidadeInicio} - ${localidadeFim}`;

      if (tipoLocalidade === 'estacao') {
        if (elementoAfetado === 'plataforma' && plataformasSelecionadas.length > 0) {
          localidade = `${localidadeInicio} - Plat. ${plataformasSelecionadas.join(', ')}`;
        } else if (elementoAfetado === 'escada_rolante' || elementoAfetado === 'elevador') {
          const eqNome = elementoAfetado === 'escada_rolante' ? 'Escada Rolante' : 'Elevador';
          const platStr = plataformasSelecionadas.length > 0 ? ` (Plat. ${plataformasSelecionadas.join(', ')})` : '';
          const detStr = detalheLocalizacao ? ` - ${detalheLocalizacao}` : '';
          localidade = `${localidadeInicio} - ${eqNome}${platStr}${detStr}`;
        } else if (elementoAfetado === 'linha_bloqueio' || elementoAfetado === 'acesso_estacao') {
          const eqNome = elementoAfetado === 'linha_bloqueio' ? 'Linha de Bloqueio' : 'Acesso à Estação';
          const detStr = detalheLocalizacao ? ` (${detalheLocalizacao})` : '';
          localidade = `${localidadeInicio} - ${eqNome}${detStr}`;
        } else if (elementoAfetado === 'via' && viasSelecionadas.length > 0) {
          localidade = `${localidadeInicio} - ${formatarVias(viasSelecionadas)}`;
        }
      }

      let tremEstacaoInforma = '';
      if (tipoLocalidade === 'estacao') {
        if (quemComunicou === 'estacao' || quemComunicou === 'ouvidoria') {
          tremEstacaoInforma = identificacaoComunicador.trim();
        } else {
          const partes: string[] = [];
          if (idTrem.trim()) partes.push(`Trem ${idTrem.trim()}`);
          if (prefixoViagem.trim()) partes.push(`Prefixo ${prefixoViagem.trim()}`);
          tremEstacaoInforma = partes.join(' / ') || 'Trem não identificado';
        }
      } else {
        const partes: string[] = [];
        if (idTrem.trim()) partes.push(`Trem ${idTrem.trim()}`);
        if (prefixoViagem.trim()) partes.push(`Prefixo ${prefixoViagem.trim()}`);
        tremEstacaoInforma = partes.join(' / ') || (localidadeInicio ? `Estação ${localidadeInicio}` : 'Não informado');
      }

      const dadosOcorrencia = {
        linha,
        via,
        vias: viasSelecionadas,
        tipoLocalidade,
        quemComunicou: tipoLocalidade === 'estacao' ? quemComunicou : 'trem',
        tremEstacaoInforma,
        localidade,
        localidadeInicio,
        localidadeFim,
        elementoAfetado,
        viasAfetadas: viasSelecionadas,
        plataformasAfetadas: plataformasSelecionadas,
        detalheLocalizacao,
        estrategiaLoop,
        loops: estrategiaLoop ? loops : [],
        resumoLoops: estrategiaLoop
          ? loops
              .filter((l) => l.estacaoInicio && l.estacaoFim)
              .map((l, idx, arr) => arr.length === 1
                ? `Loop entre ${l.estacaoInicio} ⇄ ${l.estacaoFim}${l.intervaloTeorico ? ` (Intervalo teórico: ${l.intervaloTeorico})` : ''}`
                : `Loop ${idx + 1}: ${l.estacaoInicio} ⇄ ${l.estacaoFim}${l.intervaloTeorico ? ` (Intervalo teórico: ${l.intervaloTeorico})` : ''}`
              )
              .join('; ')
          : '',
        idTrem: (tipoLocalidade === 'trecho' || quemComunicou === 'trem') ? idTrem : '',
        prefixoViagem: (tipoLocalidade === 'trecho' || quemComunicou === 'trem') ? prefixoViagem : '',
        apoioMRSCiente: prefixoDeCarga ? apoioMRSCiente : null,
        justificativaApoioMRS: prefixoDeCarga && apoioMRSCiente === false
          ? justificativaApoioMRS.trim()
          : '',
        classificacoes,
        tipoIN,
        paeseAcionado,
        paeseModalidades: paeseAcionado ? paeseModalidades : [],
        paeseTrecho: paeseAcionado ? paeseTrecho.trim() : '',
        falhas: [{ descricao: falha, impacto }],
        temImpactoOutraLinha,
        linhasImpactadasSecundarias: temImpactoOutraLinha ? linhasImpactadasSecundarias : [],
        descricaoImpactoSecundario: temImpactoOutraLinha ? descricaoImpactoSecundario.trim() : '',
        sco,
        identificacaoComunicador,
        falha,
        horaInicio,
        impacto,
        modelo: modeloGemini,
      };

      const res = await fetch('/api/gerar-mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosOcorrencia),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || `Falha na resposta da API (${res.status}).`);
      }
      const data: Mensagens = await res.json();
      setMensagens(data);
      setMensagensGemini(data);
      setDadosOcorrenciaGerada(dadosOcorrencia);
      setCodigoEventoAtual(null);
      setDisparoRealizado(false);
    } catch (err: unknown) {
      exibirErro(err, 'Geração de Mensagens com IA');
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async (pagina = paginaHistorico) => {
    setCarregandoHistorico(true);
    setErroHistorico('');

    try {
      const resultado = await buscarHistorico(pagina);
      setHistorico(resultado.items);
      setTotalHistorico(resultado.total);
      setPaginaHistorico(resultado.page);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar histórico.';
      setErroHistorico(message);
      exibirErro(error, 'Histórico de Ocorrências');
    } finally {
      setCarregandoHistorico(false);
    }
  };

  /**
   * Registra uma nova ocorrência (POST) ou sincroniza uma existente (PATCH) no Supabase.
   * Usado tanto no salvamento manual quanto no salvamento automático pós-disparo WhatsApp.
   */
  const salvarOcorrenciaInterna = async (textosParaSalvar?: Mensagens): Promise<string> => {
    const mensagensAlvo = textosParaSalvar ?? (abaAtiva === 'historico' ? msgFimEditada : mensagens);

    // 1. Cenário: Estamos na aba de histórico com ocorrência já selecionada (PATCH)
    if (abaAtiva === 'historico' && ocorrenciaSelecionada?.codigo_evento) {
      const codigo = ocorrenciaSelecionada.codigo_evento;
      const res = await fetch('/api/ocorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_evento: codigo,
          hora_fim: horaFim || undefined,
          msg_comunicacao: mensagensAlvo.comunicacao,
          msg_operacao: mensagensAlvo.operacao,
          msg_gerencia: mensagensAlvo.gerencia,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ocorrencia?: OcorrenciaDetalhe;
        error?: string;
      } | null;
      if (!res.ok || !data?.ocorrencia) {
        throw new Error(data?.error || 'Falha ao sincronizar ocorrência existente.');
      }
      setOcorrenciaSelecionada(data.ocorrencia);
      await carregarHistorico(paginaHistorico);
      return codigo;
    }

    // 2. Cenário: Ocorrência já registrada nesta sessão no gerador (atualização via PATCH)
    if (codigoEventoAtual) {
      const res = await fetch('/api/ocorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_evento: codigoEventoAtual,
          msg_comunicacao: mensagensAlvo.comunicacao,
          msg_operacao: mensagensAlvo.operacao,
          msg_gerencia: mensagensAlvo.gerencia,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ocorrencia?: OcorrenciaDetalhe;
        error?: string;
      } | null;
      if (!res.ok || !data?.ocorrencia) {
        throw new Error(data?.error || 'Falha ao sincronizar mensagens da ocorrência.');
      }
      await carregarHistorico(1);
      return codigoEventoAtual;
    }

    // 3. Cenário: Nova ocorrência sendo cadastrada no gerador (criação via POST)
    let localidade = tipoLocalidade === 'estacao'
      ? localidadeInicio
      : `${localidadeInicio} - ${localidadeFim}`;

    if (tipoLocalidade === 'estacao') {
      if (elementoAfetado === 'plataforma' && plataformasSelecionadas.length > 0) {
        localidade = `${localidadeInicio} - Plat. ${plataformasSelecionadas.join(', ')}`;
      } else if (elementoAfetado === 'escada_rolante' || elementoAfetado === 'elevador') {
        const eqNome = elementoAfetado === 'escada_rolante' ? 'Escada Rolante' : 'Elevador';
        const platStr = plataformasSelecionadas.length > 0 ? ` (Plat. ${plataformasSelecionadas.join(', ')})` : '';
        const detStr = detalheLocalizacao ? ` - ${detalheLocalizacao}` : '';
        localidade = `${localidadeInicio} - ${eqNome}${platStr}${detStr}`;
      } else if (elementoAfetado === 'linha_bloqueio' || elementoAfetado === 'acesso_estacao') {
        const eqNome = elementoAfetado === 'linha_bloqueio' ? 'Linha de Bloqueio' : 'Acesso à Estação';
        const detStr = detalheLocalizacao ? ` (${detalheLocalizacao})` : '';
        localidade = `${localidadeInicio} - ${eqNome}${detStr}`;
      } else if (elementoAfetado === 'via' && viasSelecionadas.length > 0) {
        localidade = `${localidadeInicio} - ${formatarVias(viasSelecionadas)}`;
      }
    }

    const res = await fetch('/api/ocorrencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linha,
        via,
        vias: viasSelecionadas,
        tipoLocalidade,
        localidadeInicio,
        localidadeFim,
        localidade,
        elementoAfetado,
        viasAfetadas: viasSelecionadas,
        plataformasAfetadas: plataformasSelecionadas,
        detalheLocalizacao,
        idTrem: (tipoLocalidade === 'trecho' || quemComunicou === 'trem') ? idTrem : '',
        prefixoViagem: (tipoLocalidade === 'trecho' || quemComunicou === 'trem') ? prefixoViagem : '',
        quemComunicou: tipoLocalidade === 'estacao' ? quemComunicou : 'trem',
        classificacoes,
        tipoIN,
        paeseAcionado,
        paeseModalidades: paeseAcionado ? paeseModalidades : [],
        paeseTrecho: paeseAcionado ? paeseTrecho.trim() : '',
        falhas: [{ descricao: falha, impacto }],
        temImpactoOutraLinha,
        linhasImpactadasSecundarias: temImpactoOutraLinha ? linhasImpactadasSecundarias : [],
        descricaoImpactoSecundario: temImpactoOutraLinha ? descricaoImpactoSecundario.trim() : '',
        sco,
        falha,
        horaInicio,
        impacto,
        mensagens: mensagensAlvo,
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      error?: string;
      ocorrencia?: { codigo_evento?: string };
    } | null;

    if (!res.ok) throw new Error(data?.error || 'Falha ao registrar ocorrência no banco.');
    const codigoEvento = data?.ocorrencia?.codigo_evento;
    if (!codigoEvento) throw new Error('O registro não retornou o ID do evento.');

    setCodigoEventoAtual(codigoEvento);
    setCodigoBusca(codigoEvento);
    await carregarHistorico(1);
    return codigoEvento;
  };

  const handleSalvarOcorrencia = async () => {
    if (!mensagens.comunicacao || !mensagens.operacao || !mensagens.gerencia) return;
    setSalvando(true);

    try {
      const codigoEvento = await salvarOcorrenciaInterna(mensagens);
      setAbaAtiva('historico');
      exibirModal({
        tipo: 'sucesso',
        titulo: 'Ocorrência Gravada com Sucesso!',
        mensagem: `A ocorrência foi registrada no banco de dados com o ID de evento **${codigoEvento}**.`,
        dica: 'O histórico foi sincronizado e você já pode acompanhar, encerrar ou redisparar as mensagens deste evento.',
        textoBotaoConfirmar: 'OK',
      });
    } catch (error: unknown) {
      exibirErro(error, 'Gravação da Ocorrência');
    } finally {
      setSalvando(false);
    }
  };

  const selecionarOcorrencia = (ocorrencia: OcorrenciaDetalhe) => {
    setMensagensGemini(null);
    setDadosOcorrenciaGerada(null);
    setOcorrenciaSelecionada(ocorrencia);
    const horaAtual = new Date().toTimeString().slice(0, 5);
    const horaFinal = ocorrencia.hora_fim || horaAtual;
    setHoraFim(horaFinal);
    setMsgFimEditada({
      comunicacao: aplicarModeloEncerramento('comunicacao', ocorrencia.msg_comunicacao, horaFinal, ocorrencia.hora_inicio, ocorrencia.linha, ocorrencia),
      operacao: aplicarModeloEncerramento('operacao', ocorrencia.msg_operacao, horaFinal, ocorrencia.hora_inicio, ocorrencia.linha, ocorrencia),
      gerencia: aplicarModeloEncerramento('gerencia', ocorrencia.msg_gerencia, horaFinal, ocorrencia.hora_inicio, ocorrencia.linha, ocorrencia),
    });
    setSucessoEncerramento('');
    setDisparoRealizado(false);
    setErroBusca('');
    setTimeout(() => {
      document.getElementById('painel-encerramento')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleMudarHoraFim = (novaHora: string) => {
    setHoraFim(novaHora);
    if (novaHora && /^([01]\d|2[0-3]):[0-5]\d$/.test(novaHora) && ocorrenciaSelecionada) {
      setMsgFimEditada({
        comunicacao: aplicarModeloEncerramento('comunicacao', ocorrenciaSelecionada.msg_comunicacao, novaHora, ocorrenciaSelecionada.hora_inicio, ocorrenciaSelecionada.linha, ocorrenciaSelecionada),
        operacao: aplicarModeloEncerramento('operacao', ocorrenciaSelecionada.msg_operacao, novaHora, ocorrenciaSelecionada.hora_inicio, ocorrenciaSelecionada.linha, ocorrenciaSelecionada),
        gerencia: aplicarModeloEncerramento('gerencia', ocorrenciaSelecionada.msg_gerencia, novaHora, ocorrenciaSelecionada.hora_inicio, ocorrenciaSelecionada.linha, ocorrenciaSelecionada),
      });
    }
  };

  const handlePesquisarOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoBusca.trim()) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Código de Ocorrência Necessário',
        mensagem: 'Por favor, informe o código do evento para realizar a consulta.',
        dica: 'Digite o código da ocorrência (exemplo: 1410202611001) ou selecione diretamente na tabela do histórico.',
        textoBotaoConfirmar: 'Entendido',
      });
      return;
    }
    setBuscandoOcorrencia(true);
    setErroBusca('');
    setOcorrenciaSelecionada(null);
    setHoraFim('');

    try {
      const ocorrencia = await buscarOcorrencia(codigoBusca.trim());
      selecionarOcorrencia(ocorrencia);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao pesquisar ocorrência.';
      setErroBusca(msg);
      exibirErro(error, 'Busca de Ocorrência');
    } finally {
      setBuscandoOcorrencia(false);
    }
  };

  const handleCarregarOcorrenciaRapida = async (codigo: string) => {
    setCodigoBusca(codigo);
    setBuscandoOcorrencia(true);
    setErroBusca('');
    try {
      const ocorrencia = await buscarOcorrencia(codigo);
      selecionarOcorrencia(ocorrencia);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao carregar detalhes da ocorrência.';
      setErroBusca(msg);
      exibirErro(error, 'Consulta de Ocorrência');
    } finally {
      setBuscandoOcorrencia(false);
    }
  };

  const handleAtualizarHorarioFim = async () => {
    if (!ocorrenciaSelecionada) return;
    if (!carregouTemplatesEncerramento || erroTemplatesEncerramento) {
      exibirModal({
        tipo: 'erro',
        titulo: 'Modelo de Encerramento Indisponível',
        mensagem: erroTemplatesEncerramento || 'Aguarde o carregamento do modelo de encerramento antes de continuar.',
        textoBotaoConfirmar: 'Entendi',
      });
      return;
    }
    if (!horaFim || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFim)) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Horário de Encerramento Inválido',
        mensagem: 'Por favor, informe um horário válido de encerramento no padrão HH:MM (ex: 15:40) para finalizar a ocorrência.',
        dica: 'Preencha a hora e minutos em que a circulação dos trens foi normalizada.',
        textoBotaoConfirmar: 'Ajustar Horário',
      });
      return;
    }
    setAtualizandoHorarioFim(true);
    setErroBusca('');
    setSucessoEncerramento('');

    const msgAtualizada = {
      comunicacao: aplicarModeloEncerramento('comunicacao', msgFimEditada.comunicacao, horaFim, ocorrenciaSelecionada.hora_inicio, ocorrenciaSelecionada.linha, ocorrenciaSelecionada),
      operacao: aplicarModeloEncerramento('operacao', msgFimEditada.operacao, horaFim, ocorrenciaSelecionada.hora_inicio, ocorrenciaSelecionada.linha, ocorrenciaSelecionada),
      gerencia: aplicarModeloEncerramento('gerencia', msgFimEditada.gerencia, horaFim, ocorrenciaSelecionada.hora_inicio, ocorrenciaSelecionada.linha, ocorrenciaSelecionada),
    };
    setMsgFimEditada(msgAtualizada);

    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_evento: ocorrenciaSelecionada.codigo_evento,
          hora_fim: horaFim,
          msg_comunicacao: msgAtualizada.comunicacao,
          msg_operacao: msgAtualizada.operacao,
          msg_gerencia: msgAtualizada.gerencia,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ocorrencia?: OcorrenciaDetalhe;
        error?: string;
      } | null;

      if (!res.ok || !data?.ocorrencia) {
        throw new Error(data?.error || 'Falha ao atualizar a ocorrência.');
      }

      setOcorrenciaSelecionada(data.ocorrencia);
      setMsgFimEditada({
        comunicacao: data.ocorrencia.msg_comunicacao,
        operacao: data.ocorrencia.msg_operacao,
        gerencia: data.ocorrencia.msg_gerencia,
      });
      setSucessoEncerramento(`Ocorrência ${data.ocorrencia.codigo_evento} encerrada com sucesso às ${horaFim}! Mensagens atualizadas com o horário de fim.`);
      await carregarHistorico(paginaHistorico);
      exibirModal({
        tipo: 'sucesso',
        titulo: 'Ocorrência Encerrada com Sucesso!',
        mensagem: `O evento **${data.ocorrencia.codigo_evento}** foi finalizado com o horário de fim **${horaFim}**. As mensagens dos 3 canais foram atualizadas e estão prontas para redisparo.`,
        dica: 'Você pode redisparar as mensagens nos canais do CCO ou copiar individualmente os textos gerados.',
        textoBotaoConfirmar: 'OK',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao atualizar ocorrência.';
      setErroBusca(msg);
      exibirErro(error, 'Encerramento de Ocorrência');
    } finally {
      setAtualizandoHorarioFim(false);
    }
  };

  const handleDispararWhatsApp = async (
    textos: { comunicacao: string; operacao: string; gerencia: string },
    gruposAlvo?: Array<'comunicacao' | 'operacao' | 'gerencia'>,
    mensagensCompletasParaSalvar?: { comunicacao: string; operacao: string; gerencia: string }
  ) => {
    const gruposParaEnviar: Array<'comunicacao' | 'operacao' | 'gerencia'> =
      gruposAlvo ??
      (
        Object.entries(gruposSelecionados)
          .filter(([, selecionado]) => selecionado)
          .map(([grupo]) => grupo as 'comunicacao' | 'operacao' | 'gerencia')
      );

    if (gruposParaEnviar.length === 0) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Nenhum Grupo Selecionado',
        mensagem: 'Por favor, selecione ao menos um grupo do WhatsApp (Comunicação, Operação ou Gerência) para realizar o disparo.',
        dica: 'Marque a caixa de seleção do grupo desejado antes de clicar no botão de disparo.',
        textoBotaoConfirmar: 'Selecionar Grupos',
      });
      return;
    }

    const faltantes: string[] = [];
    if (gruposParaEnviar.includes('comunicacao') && !textos.comunicacao.trim()) {
      faltantes.push('Comunicação');
    }
    if (gruposParaEnviar.includes('operacao') && !textos.operacao.trim()) {
      faltantes.push('Operação');
    }
    if (gruposParaEnviar.includes('gerencia') && !textos.gerencia.trim()) {
      faltantes.push('Gerência');
    }

    if (faltantes.length > 0) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Mensagem em Branco',
        mensagem: `A mensagem para o(s) grupo(s) **${faltantes.join(', ')}** está em branco. Preencha o texto correspondente ou desmarque o grupo antes de disparar.`,
        dica: 'Gere as mensagens com a IA ou digite as informações necessárias.',
        textoBotaoConfirmar: 'Entendido',
      });
      return;
    }

    setDisparandoWpp(true);

    const mensagensFinais = mensagensCompletasParaSalvar ?? textos;
    if (
      abaAtiva === 'ocorrencia'
      && mensagensGemini
      && dadosOcorrenciaGerada
    ) {
      const exemplos = gruposParaEnviar.flatMap((tipoGrupo) => {
        const mensagemFinal = mensagensFinais[tipoGrupo];
        const mensagemSugerida = mensagensGemini[tipoGrupo];
        if (!mensagemFinal.trim()) return [];
        return [{
          tipo_grupo: tipoGrupo,
          mensagem_ia: mensagemSugerida,
          mensagem_final_sco: mensagemFinal,
          houve_edicao: mensagemSugerida.trim() !== mensagemFinal.trim(),
        }];
      });

      if (exemplos.length > 0) {
        void fetch('/api/aprendizado-despachos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dadosOcorrencia: dadosOcorrenciaGerada, exemplos }),
        }).then(async (response) => {
          if (response.ok) return;
          const result = await response.json().catch(() => null) as { error?: string } | null;
          console.warn('Não foi possível salvar o feedback do despacho:', result?.error || response.statusText);
        }).catch((feedbackError: unknown) => {
          console.warn('Não foi possível salvar o feedback do despacho:', feedbackError);
        });
      }
    }

    try {
      const res = await fetch('/api/disparar-wpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagens: textos,
          grupos: gruposParaEnviar,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
        sucessos?: number;
        falhas?: number;
        resultados?: Array<{ grupo: string; status: 'sucesso' | 'erro'; detalhe: unknown }>;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || data?.mensagem || 'Falha ao despachar mensagens via Evolution API.');
      }

      // Salvamento automático no histórico (Supabase) após o disparo com sucesso
      const textosParaSalvar = mensagensCompletasParaSalvar ?? (abaAtiva === 'historico' ? msgFimEditada : mensagens);
      let codigoEventoSalvo: string | null = null;
      let erroAoSalvar: string | null = null;

      try {
        codigoEventoSalvo = await salvarOcorrenciaInterna(textosParaSalvar);
      } catch (errSalvar: unknown) {
        erroAoSalvar = errSalvar instanceof Error ? errSalvar.message : 'Falha ao salvar ocorrência.';
        console.error('Falha no salvamento automático após disparo WhatsApp:', errSalvar);
      }

      setDisparoRealizado(true);

      if (codigoEventoSalvo) {
        exibirModal({
          tipo: 'sucesso',
          titulo: 'Disparo Concluído e Ocorrência Salva!',
          mensagem: `Mensagens enviadas com sucesso no WhatsApp e **registradas automaticamente no histórico sob o ID de evento ${codigoEventoSalvo}**.`,
          dica: 'O histórico foi sincronizado. Você pode acompanhar, atualizar o encerramento ou redisparar mensagens na aba Histórico.',
          textoBotaoConfirmar: 'OK',
        });
      } else {
        exibirModal({
          tipo: 'sucesso',
          titulo: 'Disparo Concluído no WhatsApp!',
          mensagem: data.mensagem || 'Mensagens despachadas com sucesso nos grupos selecionados do CCO via Evolution API.',
          dica: erroAoSalvar
            ? `Nota: Ocorreu uma instabilidade ao salvar automaticamente (${erroAoSalvar}). Você pode clicar em "Salvar mensagens" para registrar no histórico.`
            : 'Os informes foram transmitidos aos canais selecionados com sucesso.',
          textoBotaoConfirmar: 'OK',
        });
      }
    } catch (err: unknown) {
      exibirErro(err, 'Disparo no WhatsApp');
    } finally {
      setDisparandoWpp(false);
    }
  };

  const handleDispararCanalIndividual = async (
    canal: 'comunicacao' | 'operacao' | 'gerencia',
    texto: string
  ) => {
    if (!texto.trim()) {
      const nomeCanal = canal === 'comunicacao' ? 'Comunicação' : canal === 'operacao' ? 'Operação' : 'Gerência';
      exibirModal({
        tipo: 'aviso',
        titulo: 'Mensagem em Branco',
        mensagem: `A mensagem do grupo **${nomeCanal}** está vazia. Preencha o texto antes de disparar.`,
        dica: 'Gere ou digite o informe para este canal.',
        textoBotaoConfirmar: 'Entendido',
      });
      return;
    }

    setDisparandoCanal(canal);
    try {
      const isHistorico = abaAtiva === 'historico';
      const baseMensagens = isHistorico ? msgFimEditada : mensagens;
      const mensagensCompletas = {
        ...baseMensagens,
        [canal]: texto,
      };

      await handleDispararWhatsApp(
        {
          comunicacao: canal === 'comunicacao' ? texto : '',
          operacao: canal === 'operacao' ? texto : '',
          gerencia: canal === 'gerencia' ? texto : '',
        },
        [canal],
        mensagensCompletas
      );
    } finally {
      setDisparandoCanal(null);
    }
  };

  const handleRedispararWhatsApp = async () => {
    if (!ocorrenciaSelecionada) return;
    const gruposAlvo = (
      Object.entries(gruposRedisparo)
        .filter(([, sel]) => sel)
        .map(([g]) => g as 'comunicacao' | 'operacao' | 'gerencia')
    );
    await handleDispararWhatsApp(msgFimEditada, gruposAlvo, msgFimEditada);
  };

  const copiarTexto = (chave: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(chave);
    setTimeout(() => setCopiado(null), 2000);
  };

  /**
   * Alterna seleção de ocorrência para exclusão
   */
  const toggleSelecaoExclusao = (codigoEvento: string) => {
    setOcorrenciasSelecionadasExclusao((prev) => {
      const novo = new Set(prev);
      if (novo.has(codigoEvento)) {
        novo.delete(codigoEvento);
      } else {
        novo.add(codigoEvento);
      }
      return novo;
    });
  };

  /**
   * Seleciona/deseleciona todas as ocorrências visíveis na página
   */
  const toggleSelecaoTodasExclusao = () => {
    const codigosVisiveis = historico
      .map((item) => item.codigo_evento)
      .filter((c): c is string => Boolean(c));
    setOcorrenciasSelecionadasExclusao((prev) => {
      const todosSelecionados = codigosVisiveis.every((c) => prev.has(c));
      const novo = new Set(prev);
      if (todosSelecionados) {
        codigosVisiveis.forEach((c) => novo.delete(c));
      } else {
        codigosVisiveis.forEach((c) => novo.add(c));
      }
      return novo;
    });
  };

  /**
   * Abre o modal de exclusão (etapa 1 de 3)
   */
  const abrirModalExclusao = () => {
    if (ocorrenciasSelecionadasExclusao.size === 0) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Nenhuma ocorrência selecionada',
        mensagem: 'Selecione ao menos uma ocorrência na tabela antes de excluir.',
        textoBotaoConfirmar: 'OK',
      });
      return;
    }
    setEtapaExclusao(1);
    setNomeExclusao('');
    setDataExclusao('');
    setModalExclusaoAberto(true);
  };

  /**
   * Avança para a próxima etapa do validador de exclusão
   */
  const avancarEtapaExclusao = () => {
    if (etapaExclusao === 1) {
      setEtapaExclusao(2);
    } else if (etapaExclusao === 2) {
      setEtapaExclusao(3);
    } else {
      executarExclusao();
    }
  };

  /**
   * Executa a exclusão após validação tripla
   */
  const executarExclusao = async () => {
    if (etapaExclusao !== 3) return;

    // Valida nome preenchido
    if (!nomeExclusao.trim()) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Nome obrigatório',
        mensagem: 'Informe o nome de quem está realizando a exclusão.',
        textoBotaoConfirmar: 'OK',
      });
      return;
    }

    // Valida data preenchida e no formato correto (YYYY-MM-DD)
    const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dataExclusao.trim() || !dataRegex.test(dataExclusao.trim())) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Data inválida',
        mensagem: 'Informe a data no formato AAAA-MM-DD (ex: 2026-10-15).',
        textoBotaoConfirmar: 'OK',
      });
      return;
    }

    // Valida que a data não é futura
    const dataInformada = new Date(dataExclusao.trim());
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (dataInformada > hoje) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Data não permitida',
        mensagem: 'A data informada não pode ser futura.',
        textoBotaoConfirmar: 'OK',
      });
      return;
    }

    setExcluindoOcorrencias(true);
    setModalExclusaoAberto(false);

    try {
      const codigos = Array.from(ocorrenciasSelecionadasExclusao);
      const res = await fetch('/api/ocorrencias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigos_evento: codigos }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        excluidas?: number;
        codigos?: string[];
        error?: string;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao excluir ocorrências.');
      }

      setOcorrenciasSelecionadasExclusao(new Set());
      setEtapaExclusao(1);
      setNomeExclusao('');
      setDataExclusao('');

      await carregarHistorico(paginaHistorico);

      exibirModal({
        tipo: 'sucesso',
        titulo: 'Ocorrências excluídas',
        mensagem: `${data.excluidas} ocorrência${
          data.excluidas !== 1 ? 's' : ''
        } excluída${
          data.excluidas !== 1 ? 's' : ''
        } com sucesso por **${nomeExclusao.trim()}** em ${dataExclusao.trim()}.`,
        textoBotaoConfirmar: 'OK',
      });
    } catch (error: unknown) {
      exibirErro(error, 'Exclusão de Ocorrências');
    } finally {
      setExcluindoOcorrencias(false);
    }
  };

  /**
   * Exporta o histórico carregado para um arquivo CSV (separado por ponto-e-vírgula).
   * Útil para relatórios operacionais e auditoria do CCO.
   */
  const exportarHistoricoCSV = () => {
    if (historico.length === 0) {
      exibirModal({
        tipo: 'aviso',
        titulo: 'Nenhum dado para exportar',
        mensagem: 'Não há ocorrências no histórico para exportar.',
        textoBotaoConfirmar: 'OK',
      });
      return;
    }

    const cabecalho = [
      'ID do evento',
      'Data/Hora criação',
      'Linha',
      'Via',
      'Localidade',
      'Trem',
      'Prefixo viagem',
      'Falha',
      'Classificações',
      'Tipo IN',
      'PAESE acionado',
      'PAESE modalidades',
      'PAESE trecho',
      'Hora início',
      'Hora fim',
      'Status',
    ].join(';');

    const linhas = historico.map((item) =>
      [
        item.codigo_evento ?? '',
        item.created_at ?? '',
        item.linha,
        item.via,
        item.localidade,
        item.id_trem ?? '',
        item.prefixo_viagem ?? '',
        `"${(item.falha ?? '').replace(/"/g, '""')}"`,
        item.classificacoes.join('; '),
        item.tipo_in ?? '',
        item.paese_acionado ? 'Sim' : 'Não',
        item.paese_modalidades.join('; '),
        item.paese_trecho,
        item.hora_inicio,
        item.hora_fim ?? '',
        item.status,
      ].join(';')
    );

    const conteudo = [cabecalho, ...linhas].join('\r\n');
    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `historico_ocorrencias_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    exibirModal({
      tipo: 'sucesso',
      titulo: 'Histórico exportado',
      mensagem: `O histórico foi exportado com ${historico.length} ocorrência${
        historico.length !== 1 ? 's' : ''
      } para CSV.`,
      textoBotaoConfirmar: 'OK',
    });
  };

  return (
    <main className="min-h-screen bg-white text-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabeçalho Oficial SIDO + Trivia Trens */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-300 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white px-2 py-1 rounded border border-slate-300 shadow-sm">
              <img
                src="/logo-trivia.svg"
                alt="Logo Trivia Trens"
                className="h-7 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'https://www.triviatrens.com.br/img/logos/logo-trivia.svg';
                }}
              />
            </div>
            <div className="h-7 w-px bg-slate-300 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-safira text-white tracking-wider">
                  SIDO
                </span>
                <h1 className="text-lg font-bold tracking-tight text-safira">
                  Sistema Integrado de Despacho de Ocorrências
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Padronização, gestão de contingências e disparo via WhatsApp
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-jade-50 text-green-800 border border-jade-200">
              <span className="w-1.5 h-1.5 rounded-full bg-jade animate-pulse" />
              CCO Ativo
            </span>
          </div>
        </header>

        <div className="flex gap-1 border-b border-slate-300" role="tablist" aria-label="Seções da ocorrência">
          <button
            id="aba-ocorrencia"
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'ocorrencia'}
            aria-controls="painel-ocorrencia"
            onClick={() => setAbaAtiva('ocorrencia')}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${abaAtiva === 'ocorrencia' ? 'border-safira text-safira' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <AlertTriangle className="h-4 w-4" />
            Nova ocorrência
          </button>
          <button
            id="aba-historico"
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'historico'}
            aria-controls="painel-historico"
            onClick={() => {
              setAbaAtiva('historico');
              void carregarHistorico(1);
            }}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${abaAtiva === 'historico' ? 'border-safira text-safira' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <History className="h-4 w-4" />
            Histórico
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 border border-slate-300">{totalHistorico}</span>
          </button>
          <button
            id="aba-admin"
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'admin'}
            aria-controls="painel-admin"
            onClick={() => setAbaAtiva('admin')}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${abaAtiva === 'admin' ? 'border-safira text-safira' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <Settings className="h-4 w-4" />
            Administração
          </button>
        </div>

        <div
          id="painel-ocorrencia"
          role="tabpanel"
          aria-labelledby="aba-ocorrencia"
          hidden={abaAtiva !== 'ocorrencia'}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >

          {/* Formulário de Registro */}
          <div className="lg:col-span-5 p-3">
            <div className="border border-slate-300 bg-white p-3">
              <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-coral" />
                Dados da Ocorrência
              </h2>

              <form onSubmit={handleGerarMensagens} className="space-y-4">
              <div aria-live="polite" className="rounded-md border border-slate-300 bg-slate-50 p-2.5">
                <p className="text-sm font-semibold text-safira">
                  Etapa {indiceEtapaAtiva + 1} de {totalEtapas}: {etapaAtual.titulo}
                </p>
                <div className="mt-2 flex gap-1.5" aria-hidden="true">
                  {etapas.map((etapa, idx) => (
                    <span
                      key={etapa.id}
                      className={`h-1 flex-1 rounded-full ${indiceEtapaAtiva >= idx ? 'bg-safira' : 'bg-slate-200'}`}
                    />
                  ))}
                </div>
              </div>

              {etapaAtual.id === 'iniciais' && (
                <div className="space-y-4">
                  {/* Seleção de Área Afetada (Linha é auto-inferida a partir da Estação selecionada) */}
                  <div>
                    <span id="tipo-localidade-label" className="form-label block">Área afetada</span>
                    <details className="group relative">
                      <summary
                        aria-labelledby="tipo-localidade-label"
                        className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                      >
                        <span>
                          {tipoLocalidade === 'estacao' ? 'Estação' : 'Trecho entre estações'}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
                        {[
                          { valor: 'estacao' as const, rotulo: 'Estação' },
                          { valor: 'trecho' as const, rotulo: 'Trecho entre estações' },
                        ].map((opcao) => {
                          const selecionada = tipoLocalidade === opcao.valor;
                          return (
                            <button
                              key={opcao.valor}
                              type="button"
                              aria-pressed={selecionada}
                              onClick={(event) => {
                                alterarTipoLocalidade(opcao.valor);
                                event.currentTarget.closest('details')?.removeAttribute('open');
                              }}
                              className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                                selecionada
                                  ? 'bg-safira/10 font-semibold text-safira'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {opcao.rotulo}
                              {selecionada && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  </div>

                  {tipoLocalidade === 'estacao' ? (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="estacao-afetada" className="form-label block mb-0">Estação afetada</label>
                          {localidadeInicio && (
                            <span className="text-[11px] font-semibold text-safira bg-safira/10 px-2.5 py-0.5 rounded-full border border-safira/20">
                              {linha}
                            </span>
                          )}
                        </div>
                        <SeletorEstacao
                          id="estacao-afetada"
                          estacoes={estacoes}
                          valor={localidadeInicio ? `${localidadeInicio}|${linha}` : ''}
                          formatoValor="sigla|linha"
                          placeholder={carregandoEstacoes ? 'Carregando estações...' : 'Digite ou selecione a estação...'}
                          desabilitado={carregandoEstacoes || estacoes.length === 0}
                          carregando={carregandoEstacoes}
                          obrigatorio
                          visualCompacto
                          aoMudar={(val, est) => {
                            if (!val || !est) {
                              setLocalidadeInicio('');
                              setViasDisponiveis([]);
                              setViasSelecionadas([]);
                              setPlataformasDisponiveis([]);
                              setPlataformasSelecionadas([]);
                              setDetalheLocalizacao('');
                              setElementoAfetado('geral');
                              return;
                            }
                            setLocalidadeInicio(est.sigla);
                            if (est.linha) {
                              setLinha(est.linha);
                              setLinhasImpactadasSecundarias((atuais) => atuais.filter((item) => item !== est.linha));
                            }
                            // Limpeza de estados da estação anterior
                            setViasSelecionadas([]);
                            setPlataformasSelecionadas([]);
                            setDetalheLocalizacao('');
                            setElementoAfetado('geral');
                            if (quemComunicou === 'estacao') {
                              setIdentificacaoComunicador(`Estação ${est.nome} (${est.sigla})`);
                            }
                          }}
                        />
                      </div>

                      {/* Seletor de Subsistema / Elemento Afetado */}
                      {localidadeInicio && (
                        <div className="rounded-md border border-slate-300 bg-white p-3 space-y-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-safira" />
                              Subsistema / Elemento Afetado
                            </span>
                            <span className="text-[11px] text-slate-400">Local ou equipamento específico</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {[
                              { id: 'geral' as const, label: 'Geral / Outros', icon: Building2 },
                              { id: 'plataforma' as const, label: 'Plataforma', icon: Layers },
                              { id: 'via' as const, label: 'Via', icon: GitFork },
                              { id: 'escada_rolante' as const, label: 'Escada Rolante', icon: ArrowUpRight },
                              { id: 'elevador' as const, label: 'Elevador', icon: Box },
                              { id: 'linha_bloqueio' as const, label: 'Linha de Bloqueio', icon: ShieldAlert },
                              { id: 'acesso_estacao' as const, label: 'Acesso à Estação', icon: DoorOpen },
                            ].map((item) => {
                              const ativo = elementoAfetado === item.id;
                              const Icone = item.icon;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setElementoAfetado(item.id);
                                    if (item.id !== 'via') setViasSelecionadas([]);
                                    if (item.id !== 'plataforma' && item.id !== 'escada_rolante' && item.id !== 'elevador') {
                                      setPlataformasSelecionadas([]);
                                    }
                                  }}
                                  className={`px-2.5 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all text-left cursor-pointer ${
                                    ativo
                                      ? 'bg-safira text-white border-safira shadow-xs font-semibold ring-2 ring-safira/25'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                                  }`}
                                >
                                  <Icone className={`w-3.5 h-3.5 shrink-0 ${ativo ? 'text-white' : 'text-slate-500'}`} />
                                  <span className="truncate">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Renderização Condicional Dinâmica com base no elemento selecionado */}
                          <div className="pt-2 border-t border-slate-100">
                            {/* 1. SE SELECIONADO: VIA */}
                            {elementoAfetado === 'via' && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">Vias da Estação:</span>
                                  {viasDisponiveis.length > 1 && (
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <button
                                        type="button"
                                        onClick={selecionarTodasVias}
                                        className="text-safira hover:underline font-medium cursor-pointer"
                                      >
                                        Selecionar todas
                                      </button>
                                      {viasSelecionadas.length > 0 && (
                                        <>
                                          <span className="text-slate-300">•</span>
                                          <button
                                            type="button"
                                            onClick={limparVias}
                                            className="text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                                          >
                                            Limpar
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {viasDisponiveis.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {viasDisponiveis.map((v) => {
                                      const selecionada = viasSelecionadas.includes(v);
                                      const rotulo = v.toLowerCase().startsWith('via') ? v : `Via ${v}`;
                                      return (
                                        <button
                                          key={v}
                                          type="button"
                                          onClick={() => alternarVia(v)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                            selecionada
                                              ? 'bg-safira text-white border-safira shadow-sm ring-1 ring-safira/25'
                                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                                          }`}
                                        >
                                          <span
                                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              selecionada ? 'bg-white text-safira' : 'bg-slate-200 text-slate-600'
                                            }`}
                                          >
                                            {selecionada ? '✓' : ''}
                                          </span>
                                          {rotulo}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-2">
                                    <p className="text-[11px] text-amber-700">
                                      Nenhuma via específica cadastrada para esta estação. Escolha uma opção rápida:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {['1', '2', 'Auxiliar', 'Singela'].map((viaPadrao) => {
                                        const sel = viasSelecionadas.includes(viaPadrao);
                                        return (
                                          <button
                                            key={viaPadrao}
                                            type="button"
                                            onClick={() => alternarVia(viaPadrao)}
                                            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                                              sel
                                                ? 'bg-amber-800 text-white border-amber-800'
                                                : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                                            }`}
                                          >
                                            {sel ? '✓ ' : '+ '}Via {viaPadrao}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 pt-1">
                                  <input
                                    type="text"
                                    value={novaViaManual}
                                    onChange={(e) => setNovaViaManual(e.target.value)}
                                    placeholder="Outra via (ex: 3, 5, Manobra)..."
                                    className="form-control text-xs py-1 px-2.5 max-w-[200px] bg-white"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        adicionarViaManual(novaViaManual);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => adicionarViaManual(novaViaManual)}
                                    disabled={!novaViaManual.trim()}
                                    className="btn btn-secondary btn-sm text-xs py-1 px-2.5 disabled:opacity-40"
                                  >
                                    <Plus className="w-3 h-3 mr-0.5" /> Adicionar
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 2. SE SELECIONADO: PLATAFORMA */}
                            {elementoAfetado === 'plataforma' && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">Plataformas da Estação:</span>
                                  {plataformasDisponiveis.length > 1 && (
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <button
                                        type="button"
                                        onClick={selecionarTodasPlataformas}
                                        className="text-safira hover:underline font-medium cursor-pointer"
                                      >
                                        Selecionar todas
                                      </button>
                                      {plataformasSelecionadas.length > 0 && (
                                        <>
                                          <span className="text-slate-300">•</span>
                                          <button
                                            type="button"
                                            onClick={limparPlataformas}
                                            className="text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                                          >
                                            Limpar
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {plataformasDisponiveis.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {plataformasDisponiveis.map((p) => {
                                      const selecionada = plataformasSelecionadas.includes(p);
                                      const rotulo = p.toLowerCase().startsWith('plat') ? p : `Plataforma ${p}`;
                                      return (
                                        <button
                                          key={p}
                                          type="button"
                                          onClick={() => alternarPlataforma(p)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                            selecionada
                                              ? 'bg-safira text-white border-safira shadow-sm ring-1 ring-safira/25'
                                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                                          }`}
                                        >
                                          <span
                                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              selecionada ? 'bg-white text-safira' : 'bg-slate-200 text-slate-600'
                                            }`}
                                          >
                                            {selecionada ? '✓' : ''}
                                          </span>
                                          {rotulo}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-2">
                                    <p className="text-[11px] text-amber-700">
                                      Nenhuma plataforma cadastrada. Selecione uma opção rápida:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {['1', '2', '3', '4'].map((platPadrao) => {
                                        const sel = plataformasSelecionadas.includes(platPadrao);
                                        return (
                                          <button
                                            key={platPadrao}
                                            type="button"
                                            onClick={() => alternarPlataforma(platPadrao)}
                                            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                                              sel
                                                ? 'bg-amber-800 text-white border-amber-800'
                                                : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                                            }`}
                                          >
                                            {sel ? '✓ ' : '+ '}Plataforma {platPadrao}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 pt-1">
                                  <input
                                    type="text"
                                    value={novaPlataformaManual}
                                    onChange={(e) => setNovaPlataformaManual(e.target.value)}
                                    placeholder="Outra plataforma (ex: 5, Central)..."
                                    className="form-control text-xs py-1 px-2.5 max-w-[200px] bg-white"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        adicionarPlataformaManual(novaPlataformaManual);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => adicionarPlataformaManual(novaPlataformaManual)}
                                    disabled={!novaPlataformaManual.trim()}
                                    className="btn btn-secondary btn-sm text-xs py-1 px-2.5 disabled:opacity-40"
                                  >
                                    <Plus className="w-3 h-3 mr-0.5" /> Adicionar
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 3. SE SELECIONADO: ESCADA ROLANTE OU ELEVADOR */}
                            {(elementoAfetado === 'escada_rolante' || elementoAfetado === 'elevador') && (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                                    Vincular ao acesso da plataforma:
                                  </label>
                                  {plataformasDisponiveis.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {plataformasDisponiveis.map((p) => {
                                        const selecionada = plataformasSelecionadas.includes(p);
                                        return (
                                          <button
                                            key={p}
                                            type="button"
                                            onClick={() => alternarPlataformaUnica(p)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                              selecionada
                                                ? 'bg-safira text-white border-safira shadow-xs'
                                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                            }`}
                                          >
                                            {selecionada ? '✓ ' : ''}Acesso Plataforma {p}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">
                                      Sem plataformas cadastradas no banco para esta estação.
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <label htmlFor="detalhe-localizacao" className="text-xs font-semibold text-slate-700 block mb-1">
                                    Identificação complementar (opcional):
                                  </label>
                                  <input
                                    id="detalhe-localizacao"
                                    type="text"
                                    value={detalheLocalizacao}
                                    onChange={(e) => setDetalheLocalizacao(e.target.value)}
                                    placeholder="Ex: Acesso Mezanino Sul / Rua Mauá, Lado Pari..."
                                    className="form-control text-xs py-1.5 px-3 w-full bg-white"
                                  />
                                </div>
                              </div>
                            )}

                            {/* 4. SE SELECIONADO: LINHA DE BLOQUEIO OU ACESSO À ESTAÇÃO */}
                            {(elementoAfetado === 'linha_bloqueio' || elementoAfetado === 'acesso_estacao') && (
                              <div className="space-y-1.5">
                                <label htmlFor="detalhe-acesso" className="text-xs font-semibold text-slate-700 block">
                                  {elementoAfetado === 'linha_bloqueio' ? 'Identificação do Bloqueio / Catracas:' : 'Identificação do Acesso:'}
                                </label>
                                <input
                                  id="detalhe-acesso"
                                  type="text"
                                  value={detalheLocalizacao}
                                  onChange={(e) => setDetalheLocalizacao(e.target.value)}
                                  placeholder={
                                    elementoAfetado === 'linha_bloqueio'
                                      ? 'Ex: Bloqueio Principal, Catracas Lado Sul...'
                                      : 'Ex: Acesso Praça da Sé, Saída Rua Mauá, Portão Principal...'
                                  }
                                  className="form-control text-xs py-1.5 px-3 w-full bg-white"
                                />
                              </div>
                            )}

                            {/* 5. SE SELECIONADO: GERAL */}
                            {elementoAfetado === 'geral' && (
                              <p className="text-xs text-slate-500 italic py-1">
                                Ocorrência no âmbito geral da estação (sem impacto restrito a um equipamento específico).
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* CENÁRIO 2: TRECHO ENTRE ESTAÇÕES */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label htmlFor="estacao-inicio" className="form-label block mb-0">Estação A / início</label>
                            {localidadeInicio && (
                              <span className="text-[10px] font-semibold text-safira bg-safira/10 px-1.5 py-0.5 rounded border border-safira/20">
                                {linha}
                              </span>
                            )}
                          </div>
                          <SeletorEstacao
                            id="estacao-inicio"
                            estacoes={estacoes}
                            valor={localidadeInicio ? `${localidadeInicio}|${linha}` : ''}
                            formatoValor="sigla|linha"
                            placeholder={carregandoEstacoes ? 'Carregando...' : 'Digite a estação inicial...'}
                            desabilitado={carregandoEstacoes || estacoes.length === 0}
                            carregando={carregandoEstacoes}
                            obrigatorio
                            visualCompacto
                            alinhamento="esquerda"
                            aoMudar={(val, est) => {
                              if (!val || !est) {
                                setLocalidadeInicio('');
                                setLocalidadeFim('');
                                setViasSelecionadas([]);
                                setViasDisponiveis([]);
                                return;
                              }
                              setLocalidadeInicio(est.sigla);
                              if (est.linha && est.linha !== linha) {
                                setLinha(est.linha);
                                setLinhasImpactadasSecundarias((atuais) => atuais.filter((item) => item !== est.linha));
                                setLocalidadeFim('');
                              }
                              setViasSelecionadas([]);
                            }}
                          />
                        </div>

                        <div>
                          <label htmlFor="estacao-fim" className="form-label block">Estação B / fim</label>
                          <SeletorEstacao
                            id="estacao-fim"
                            estacoes={estacoes.filter((e) => e.linha === linha && e.sigla !== localidadeInicio)}
                            valor={localidadeFim}
                            formatoValor="sigla"
                            placeholder={
                              !localidadeInicio
                                ? 'Selecione a Estação A primeiro'
                                : 'Digite a estação final...'
                            }
                            desabilitado={!localidadeInicio || carregandoEstacoes}
                            carregando={carregandoEstacoes}
                            obrigatorio
                            visualCompacto
                            alinhamento="direita"
                            mostrarBadgeLinha={false}
                            aoMudar={(val) => {
                              setLocalidadeFim(val);
                              setViasSelecionadas([]);
                            }}
                          />
                        </div>
                      </div>

                      {/* Seletor Dinâmico de Via(s) Afetada(s) do Trecho */}
                      <div className="rounded-md border border-slate-300 bg-white p-3 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <GitFork className="w-4 h-4 text-safira" />
                            <span className="text-xs font-semibold text-slate-800">
                              Via(s) Afetada(s) no Trecho
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-coral/10 text-coral border border-coral/30">
                              Obrigatório
                            </span>
                          </div>

                          {loadingVias ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-safira font-medium animate-pulse">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Carregando vias do banco de dados...
                            </span>
                          ) : viasDisponiveis.length > 1 ? (
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={selecionarTodasVias}
                                className="text-safira hover:underline font-medium cursor-pointer"
                              >
                                Selecionar todas
                              </button>
                              {viasSelecionadas.length > 0 && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={limparVias}
                                    className="text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                                  >
                                    Limpar
                                  </button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {/* Estado 1: Aguardando seleção de estações */}
                        {!localidadeInicio || !localidadeFim || localidadeInicio === localidadeFim ? (
                          <p className="text-xs text-slate-400 italic">
                            Selecione as estações de início e fim acima para consultar as vias deste trecho.
                          </p>
                        ) : loadingVias ? (
                          <div className="flex items-center gap-2 py-1">
                            <div className="h-7 w-20 bg-slate-200 rounded-md animate-pulse" />
                            <div className="h-7 w-20 bg-slate-200 rounded-md animate-pulse" />
                            <div className="h-7 w-20 bg-slate-200 rounded-md animate-pulse" />
                          </div>
                        ) : viasDisponiveis.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {viasDisponiveis.map((v) => {
                              const selecionada = viasSelecionadas.includes(v);
                              const rotulo = v.toLowerCase().startsWith('via') ? v : `Via ${v}`;
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => alternarVia(v)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                    selecionada
                                      ? 'bg-safira text-white border-safira shadow-sm ring-1 ring-safira/25'
                                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                                  }`}
                                >
                                  <span
                                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                      selecionada ? 'bg-white text-safira' : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {selecionada ? '✓' : ''}
                                  </span>
                                  {rotulo}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-2">
                            <div className="flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Nenhuma via pré-cadastrada no banco de dados para este trecho.</span>
                            </div>
                            <p className="text-[11px] text-amber-700">
                              Selecione uma opção operacional rápida:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {['1', '2', 'Auxiliar', 'Singela'].map((viaPadrao) => {
                                const sel = viasSelecionadas.includes(viaPadrao);
                                return (
                                  <button
                                    key={viaPadrao}
                                    type="button"
                                    onClick={() => alternarVia(viaPadrao)}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                                      sel
                                        ? 'bg-amber-800 text-white border-amber-800'
                                        : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                                    }`}
                                  >
                                    {sel ? '✓ ' : '+ '}Via {viaPadrao}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Feedback de via do trecho */}
                        {viasSelecionadas.length > 0 ? (
                          <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                            <span>Via(s) definida(s): <strong>{formatarVias(viasSelecionadas)}</strong></span>
                          </p>
                        ) : localidadeInicio && localidadeFim && localidadeInicio !== localidadeFim && !loadingVias ? (
                          <p className="text-xs text-coral font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Atenção: Selecione ao menos uma via para prosseguir com a ocorrência no trecho.</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {(erroEstacoes || (!carregandoEstacoes && estacoes.length === 0)) && (
                    <p className="text-sm text-rose-700" role="alert">
                      {erroEstacoes || 'Nenhuma estação cadastrada.'}
                    </p>
                  )}

                  <div>
                    <label htmlFor="hora-inicio" className="form-label block">Hora de Início</label>
                    <input
                      id="hora-inicio"
                      type="time"
                      required
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className="w-full form-control"
                    />
                    {atrasoComunicacao && (
                      <div
                        className="mt-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium text-amber-900"
                        role="alert"
                      >
                        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>Lembre-se de comunicar a falha dentro de 30 minutos</span>
                      </div>
                    )}
                  </div>

                  {/* Caixinha de seleção: Estratégia de Loop */}
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                    <label htmlFor="estrategia-loop" className="flex cursor-pointer items-start gap-3">
                      <input
                        id="estrategia-loop"
                        type="checkbox"
                        checked={estrategiaLoop}
                        onChange={(e) => handleToggleEstrategiaLoop(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-safira focus:ring-safira"
                      />
                      <div>
                        <span className="text-sm font-semibold text-slate-800">
                          Está sendo realizada a estratégia de Loop?
                        </span>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Se marcado, uma nova etapa será aberta para configurar quantidade de loops, estações envolvidas e intervalos teóricos.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Seletor de Origem da Comunicação: Estação, Trem ou Ouvidoria (quando área é Estação) */}
                  {tipoLocalidade === 'estacao' && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <Megaphone className="w-4 h-4 text-safira" />
                          Quem comunicou a ocorrência?
                        </label>
                        <span className="text-[11px] text-slate-400">Origem da informação</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            id: 'estacao' as const,
                            label: 'Estação',
                            desc: 'Equipe da estação',
                            icon: Building2,
                          },
                          {
                            id: 'trem' as const,
                            label: 'Trem',
                            desc: 'Tripulação / Operador de Trens',
                            icon: TrainFront,
                          },
                          {
                            id: 'ouvidoria' as const,
                            label: 'Ouvidoria',
                            desc: 'SAC / Usuário',
                            icon: Headphones,
                          },
                        ].map((opcao) => {
                          const ativo = quemComunicou === opcao.id;
                          const Icone = opcao.icon;
                          return (
                            <button
                              key={opcao.id}
                              type="button"
                              onClick={() => handleTrocarQuemComunicou(opcao.id)}
                              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                                ativo
                                  ? 'bg-safira text-white border-safira shadow-sm ring-1 ring-safira/25'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <Icone className={`w-4 h-4 ${ativo ? 'text-white' : 'text-safira'}`} />
                                {ativo && <span className="text-[10px] font-bold">✓</span>}
                              </div>
                              <span className="text-xs font-semibold">{opcao.label}</span>
                              <span className={`text-[10px] leading-tight ${ativo ? 'text-white/80' : 'text-slate-400'}`}>
                                {opcao.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Feedback informativo do comunicador */}
                      {quemComunicou === 'estacao' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white p-2 rounded-md border border-slate-200/80">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Comunicador: <strong className="text-safira">{estacaoNomeDisplay || 'Estação selecionada acima'}</strong>
                          </span>
                        </div>
                      )}

                      {quemComunicou === 'ouvidoria' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white p-2 rounded-md border border-slate-200/80">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Comunicador: <strong className="text-safira">Ouvidoria</strong>
                          </span>
                        </div>
                      )}

                      {quemComunicou === 'trem' && (
                        <p className="text-[11px] text-slate-500 italic">
                          Informe o ID e o Prefixo do trem que reportou a ocorrência na estação:
                        </p>
                      )}
                    </div>
                  )}

                  {/* ID do trem e Prefixo da viagem (apenas para Trecho ou quando quem comunicou na estação for Trem) */}
                  {(tipoLocalidade === 'trecho' || quemComunicou === 'trem') && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="id-trem" className="form-label block">ID do trem</label>
                        <ComboboxTrem
                          id="id-trem"
                          valor={idTrem}
                          linhaSelecionada={linha}
                          aoMudar={(novoValor) => setIdTrem(novoValor)}
                          placeholder="Ex: Q004, S024 ou digite livremente"
                          desabilitado={loading}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label htmlFor="prefixo-viagem" className="form-label block">Prefixo da viagem</label>
                        <input
                          id="prefixo-viagem"
                          type="text"
                          placeholder="Ex: E169"
                          value={prefixoViagem}
                          onChange={(e) => {
                            setPrefixoViagem(e.target.value);
                            setApoioMRSCiente(null);
                            setJustificativaApoioMRS('');
                          }}
                          maxLength={100}
                          className="w-full form-control"
                        />
                      </div>
                    </div>
                  )}

                  {tipoLocalidade === 'estacao' && quemComunicou !== 'trem' && (
                    <div>
                      <label htmlFor="identificacao-comunicador" className="form-label block">
                        Nome da estação ou ouvidoria que comunicou
                      </label>
                      <input
                        id="identificacao-comunicador"
                        type="text"
                        required
                        placeholder="Ex: Estação Luz ou Ouvidoria"
                        value={identificacaoComunicador}
                        onChange={(e) => setIdentificacaoComunicador(e.target.value)}
                        maxLength={150}
                        className="w-full form-control"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="sco" className="form-label block">SCO</label>
                    <input
                      id="sco"
                      type="text"
                      required
                      placeholder="Nome do supervisor que assina a mensagem"
                      value={sco}
                      onChange={(e) => setSCO(e.target.value)}
                      maxLength={150}
                      className="w-full form-control"
                    />
                  </div>
                </div>
              )}

              {/* Etapa de Configuração de Loop */}
              {etapaAtual.id === 'loop' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-safira/20 bg-safira-50/60 p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Repeat className="h-4 w-4 text-safira shrink-0" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        Configuração de Loop
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600">
                      Defina quantos loops estão sendo operados, os trechos entre estações e o intervalo teórico programado para cada um.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="qtd-loops" className="form-label block">
                      Quantos loops estão sendo feitos?
                    </label>
                    <select
                      id="qtd-loops"
                      value={qtdLoops}
                      onChange={(e) => alterarQtdLoops(Number(e.target.value))}
                      className="w-full form-select"
                    >
                      <option value={1}>1 loop em operação</option>
                      <option value={2}>2 loops em operação</option>
                      <option value={3}>3 loops em operação</option>
                      <option value={4}>4 loops em operação</option>
                      <option value={5}>5 loops em operação</option>
                    </select>
                  </div>

                  <div className="space-y-3 pt-1">
                    {loops.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-safira/10 px-2.5 py-0.5 text-xs font-semibold text-safira">
                            <Repeat className="h-3.5 w-3.5" />
                            Loop {index + 1}
                          </span>
                          {item.estacaoInicio && item.estacaoFim && (
                            <span className="text-xs font-mono font-medium text-slate-500">
                              {item.estacaoInicio} ⇄ {item.estacaoFim}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor={`loop-${index}-inicio`} className="form-label block text-xs">
                              Estação A (Início)
                            </label>
                            <SeletorEstacao
                              id={`loop-${index}-inicio`}
                              estacoes={estacoes.filter((e) => e.sigla !== item.estacaoFim)}
                              valor={item.estacaoInicio}
                              formatoValor="sigla"
                              placeholder="Digite a estação A..."
                              desabilitado={carregandoEstacoes || estacoes.length === 0}
                              carregando={carregandoEstacoes}
                              obrigatorio
                              alinhamento="esquerda"
                              aoMudar={(val) => atualizarLoop(index, 'estacaoInicio', val)}
                            />
                          </div>

                          <div>
                            <label htmlFor={`loop-${index}-fim`} className="form-label block text-xs">
                              Estação B (Fim / Retorno)
                            </label>
                            <SeletorEstacao
                              id={`loop-${index}-fim`}
                              estacoes={estacoes.filter((e) => e.sigla !== item.estacaoInicio)}
                              valor={item.estacaoFim}
                              formatoValor="sigla"
                              placeholder="Digite a estação B..."
                              desabilitado={carregandoEstacoes || estacoes.length === 0}
                              carregando={carregandoEstacoes}
                              obrigatorio
                              alinhamento="direita"
                              aoMudar={(val) => atualizarLoop(index, 'estacaoFim', val)}
                            />
                          </div>
                        </div>

                        {item.estacaoInicio && item.estacaoFim && item.estacaoInicio === item.estacaoFim && (
                          <p className="text-xs text-rose-600" role="alert">
                            As estações de início e fim do loop não podem ser iguais.
                          </p>
                        )}

                        <div>
                          <label htmlFor={`loop-${index}-intervalo`} className="form-label block text-xs">
                            Intervalo teórico
                          </label>
                          <input
                            id={`loop-${index}-intervalo`}
                            type="text"
                            required
                            placeholder="Ex: 6 min, 8 a 10 min"
                            value={item.intervaloTeorico}
                            onChange={(e) => atualizarLoop(index, 'intervaloTeorico', e.target.value)}
                            maxLength={50}
                            className="w-full form-control text-xs"
                          />
                          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                            <span className="text-[11px] text-slate-400">Sugestões:</span>
                            {['5 min', '6 min', '8 min', '10 min', '12 min', '15 min'].map((sugestao) => (
                              <button
                                key={sugestao}
                                type="button"
                                onClick={() => atualizarLoop(index, 'intervaloTeorico', sugestao)}
                                className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${item.intervaloTeorico === sugestao ? 'bg-safira text-white border-safira' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                              >
                                {sugestao}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isEtapaValida() && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                      Para avançar, selecione as duas estações e o intervalo teórico de cada loop.
                    </p>
                  )}
                </div>
              )}

              {etapaAtual.id === 'falhas' && (
                <div className="space-y-4">

                  <div>
                    <fieldset disabled={carregandoFalhas}>
                      <legend className="form-label block">Falhas / Descrições do Operador</legend>
                      <details className="group relative">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
                          <span>
                            {falhasSelecionadas.length === 0
                              ? 'Selecione uma ou mais falhas'
                              : `${falhasSelecionadas.length} ${falhasSelecionadas.length === 1 ? 'falha selecionada' : 'falhas selecionadas'}`}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                          <div className="border-b border-slate-100 bg-slate-50/70 p-2.5">
                            <div className="relative flex items-center">
                              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
                              <input
                                type="search"
                                value={buscaFalhas}
                                onChange={(event) => setBuscaFalhas(event.target.value)}
                                placeholder="Digite para pesquisar falhas..."
                                aria-label="Pesquisar falhas"
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none transition-all placeholder:text-slate-400 focus:border-safira focus:ring-1 focus:ring-safira"
                              />
                            </div>
                            <p className="mt-1.5 px-0.5 text-[11px] text-slate-400">
                              {falhasFiltradas.length} {falhasFiltradas.length === 1 ? 'falha encontrada' : 'falhas encontradas'}
                            </p>
                          </div>
                          <div className="max-h-52 overflow-y-auto p-3">
                            <div className="space-y-2">
                              {falhasFiltradas.map((opcao) => {
                                const chave = `preset:${opcao.id}`;
                                const selecionada = falhasSelecionadas.some((item) => item.chave === chave);
                                return (
                                  <label key={opcao.id} className="flex cursor-pointer items-start gap-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={selecionada}
                                      onChange={(event) => alternarFalha(opcao, event.target.checked)}
                                      className="mt-1"
                                    />
                                    <span>{opcao.descricao}</span>
                                  </label>
                                );
                              })}
                              {falhasFiltradas.length === 0 && (
                                <p className="py-3 text-center text-xs text-slate-500">
                                  Nenhuma falha encontrada.
                                </p>
                              )}
                              <label className="flex cursor-pointer items-start gap-2 border-t border-slate-200 pt-2">
                                <input
                                  type="checkbox"
                                  checked={falhasSelecionadas.some((item) => item.chave === 'personalizada')}
                                  onChange={(event) => alternarFalha(null, event.target.checked)}
                                  className="mt-1"
                                />
                                <span>Outra / descrever</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </details>
                    </fieldset>
                    {carregandoFalhas && <p className="mt-1 text-sm text-slate-500">Carregando opções de falha...</p>}
                    {erroFalhas && <p className="mt-1 text-sm text-rose-700" role="alert">{erroFalhas}</p>}
                    {falhasSelecionadas.length > 0 && (
                      <p className="mt-1 truncate text-xs text-slate-500" title={falhasSelecionadas.map((item) => item.descricao || 'Outra').join(', ')}>
                        Selecionadas: {falhasSelecionadas.map((item) => item.descricao || 'Outra').join(', ')}
                      </p>
                    )}
                    <div className="mt-3">
                      <label htmlFor="falha-descricao" className="form-label block">Falha / Descrição</label>
                      <textarea
                        id="falha-descricao"
                        required
                        rows={3}
                        maxLength={5000}
                        value={falha}
                        onChange={(event) => setFalhaEditada(event.target.value)}
                        placeholder="A descrição das falhas selecionadas aparecerá aqui; você pode editá-la."
                        className="w-full form-control"
                      />
                    </div>
                    <div className="mt-3">
                      <label htmlFor="falha-impacto" className="form-label block">Impacto inicial</label>
                      <textarea
                        id="falha-impacto"
                        required
                        rows={3}
                        maxLength={5000}
                        value={impacto}
                        onChange={(event) => setImpactoEditado(event.target.value)}
                        placeholder="Os impactos das falhas selecionadas aparecerão aqui; você pode editá-los."
                        className="w-full form-control"
                      />
                    </div>
                    <ImpactoOutraLinhaFields
                      linhaPrincipal={linha}
                      temImpacto={temImpactoOutraLinha}
                      linhasSelecionadas={linhasImpactadasSecundarias}
                      descricao={descricaoImpactoSecundario}
                      onMudarTemImpacto={(temImpacto) => {
                        setTemImpactoOutraLinha(temImpacto);
                        if (!temImpacto) {
                          setLinhasImpactadasSecundarias([]);
                          setDescricaoImpactoSecundario('');
                        }
                      }}
                      onMudarLinhas={setLinhasImpactadasSecundarias}
                      onMudarDescricao={setDescricaoImpactoSecundario}
                    />
                  </div>

                  <div>
                    <label htmlFor="modelo-gemini" className="form-label block">Modelo do Gemini</label>
                    <select
                      id="modelo-gemini"
                      value={modeloGemini}
                      onChange={(e) => {
                        if (isModeloGemini(e.target.value)) setModeloGemini(e.target.value);
                      }}
                      className="w-full form-select"
                    >
                      {modelosGemini.map((modelo) => (
                        <option key={modelo.id} value={modelo.id}>
                          {modelo.nome} — até {modelo.limiteDiario} solicitações/dia
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      O Flash Lite tem uma cota diária maior; escolha o modelo conforme a necessidade.
                    </p>
                  </div>
                </div>
              )}

              {etapaAtual.id === 'classificacao' && (
                <div className="space-y-4">
                  <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5">
                    <legend className="form-label px-1">Acionamento de PAESE</legend>
                    <p className="text-sm text-slate-600">
                      Há operação de PAESE para esta ocorrência?
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { value: false, label: 'Não' },
                        { value: true, label: 'Sim' },
                      ].map((opcao) => (
                        <label key={String(opcao.value)} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="paese-acionado"
                            checked={paeseAcionado === opcao.value}
                            onChange={() => {
                              setPaeseAcionado(opcao.value);
                              if (!opcao.value) {
                                setPaeseModalidades([]);
                                setPaeseTrecho('');
                              }
                            }}
                          />
                          {opcao.label}
                        </label>
                      ))}
                    </div>

                    {paeseAcionado && (
                      <div className="space-y-3 border-t border-slate-200 pt-3">
                        <fieldset>
                          <legend className="form-label block">Tipo de PAESE (selecione um ou mais)</legend>
                          <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {(['SPTrans', 'ARTESP', 'Trilhos'] as const).map((modalidade) => (
                              <label key={modalidade} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={paeseModalidades.includes(modalidade)}
                                  onChange={(event) => {
                                    setPaeseModalidades((atuais) => event.target.checked
                                      ? [...atuais, modalidade]
                                      : atuais.filter((item) => item !== modalidade));
                                  }}
                                />
                                PAESE {modalidade}
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <div>
                          <label htmlFor="paese-trecho" className="form-label block">
                            Trecho atendido pelo PAESE
                          </label>
                          <input
                            id="paese-trecho"
                            type="text"
                            required
                            maxLength={200}
                            value={paeseTrecho}
                            onChange={(event) => setPaeseTrecho(event.target.value)}
                            placeholder="Ex: entre as estações Luz e Tatuapé"
                            className="w-full form-control"
                          />
                        </div>

                        {(paeseModalidades.length === 0 || !paeseTrecho.trim()) && (
                          <p className="text-xs text-amber-800" role="status">
                            Selecione ao menos um tipo de PAESE e informe o trecho atendido para avançar.
                          </p>
                        )}
                      </div>
                    )}
                  </fieldset>

                  <fieldset>
                    <legend className="form-label block">Classificação da ocorrência</legend>
                    <p className="mb-2 text-sm text-slate-600">Selecione uma ou mais opções.</p>
                    <div className="space-y-2">
                      {opcoesClassificacao.map((opcao) => (
                        <label key={opcao.valor} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={classificacoes.includes(opcao.valor)}
                            onChange={(event) => {
                              setClassificacoes((atuais) => event.target.checked
                                ? [...atuais, opcao.valor]
                                : atuais.filter((item) => item !== opcao.valor));
                              if (opcao.valor === 'IN' && !event.target.checked) setTipoIN('');
                            }}
                          />
                          <span>{opcao.rotulo}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {classificacoes.includes('IN') && (
                    <div>
                      <label htmlFor="tipo-in" className="form-label block">Tipo de IN</label>
                      <select
                        id="tipo-in"
                        required
                        value={tipoIN}
                        onChange={(event) => setTipoIN(event.target.value)}
                        className="w-full form-select"
                      >
                        <option value="" disabled>Selecione o tipo de IN</option>
                        {definicoesTiposIN.map((item) => (
                          <option key={item.tipo} value={item.tipo}>
                            Tipo {item.tipo} — {item.descricao}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Campo de Consulta / Seleção Rápida: Relembrando as IN's */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-safira shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-safira">
                          Relembrando as IN&apos;s
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Guia rápido CCO</span>
                    </div>

                    <p className="text-xs text-slate-600">
                      Critérios de enquadramento para Incidente Notável (clique para selecionar rapidamente):
                    </p>

                    <div className="space-y-1.5">
                      {definicoesTiposIN.map((item) => {
                        const selecionado = classificacoes.includes('IN') && tipoIN === item.tipo;
                        return (
                          <button
                            key={item.tipo}
                            type="button"
                            onClick={() => {
                              if (!classificacoes.includes('IN')) {
                                setClassificacoes((atuais) => [...atuais, 'IN']);
                              }
                              setTipoIN(item.tipo);
                            }}
                            className={`w-full text-left p-2.5 rounded-md border text-xs transition-all flex items-start justify-between gap-3 ${
                              selecionado
                                ? 'border-safira bg-white ring-2 ring-safira/20 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span
                                className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                                  selecionado
                                    ? 'bg-safira text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                Tipo {item.tipo}
                              </span>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 block leading-tight">
                                  {item.titulo}
                                </span>
                                <span className="text-[11.5px] text-slate-600 block mt-0.5 leading-snug">
                                  {item.descricao}
                                </span>
                              </div>
                            </div>
                            {selecionado && (
                              <span className="inline-flex items-center text-safira text-[11px] font-semibold shrink-0 gap-0.5">
                                <Check className="w-3.5 h-3.5" />
                                Ativo
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {etapaAtual.id === 'apoio-mrs' && (
                <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5">
                  <legend className="form-label px-1">Apoio da MRS</legend>
                  <p className="text-sm text-slate-700">
                    O Apoio da MRS está ciente da ocorrência do trem de carga ({prefixoViagem.trim().toUpperCase()})?
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { value: true, label: 'Sim' },
                      { value: false, label: 'Não' },
                    ].map((opcao) => (
                      <label key={String(opcao.value)} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="apoio-mrs-ciente"
                          checked={apoioMRSCiente === opcao.value}
                          onChange={() => {
                            setApoioMRSCiente(opcao.value);
                            if (opcao.value) setJustificativaApoioMRS('');
                          }}
                          required
                        />
                        {opcao.label}
                      </label>
                    ))}
                  </div>
                  {apoioMRSCiente === null && (
                    <p className="text-xs text-amber-800" role="status">
                      Informe se o Apoio da MRS está ciente para gerar as mensagens.
                    </p>
                  )}
                  {apoioMRSCiente === false && (
                    <div>
                      <label htmlFor="justificativa-apoio-mrs" className="form-label block">
                        Justificativa
                      </label>
                      <textarea
                        id="justificativa-apoio-mrs"
                        required
                        rows={3}
                        maxLength={500}
                        value={justificativaApoioMRS}
                        onChange={(event) => setJustificativaApoioMRS(event.target.value)}
                        placeholder="Informe por que o Apoio da MRS não está ciente."
                        className="w-full form-control"
                      />
                      {!justificativaApoioMRS.trim() && (
                        <p className="mt-1 text-xs text-amber-800" role="status">
                          A justificativa é obrigatória para avançar.
                        </p>
                      )}
                    </div>
                  )}
                </fieldset>
              )}

              {atrasoComunicacao && (
                <div
                  className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium text-amber-900"
                  role="alert"
                >
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Lembre-se de comunicar a falha dentro de 30 minutos</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {indiceEtapaAtiva > 0 && (
                  <button
                    type="button"
                    onClick={handleVoltar}
                    disabled={loading}
                    className="flex-1 btn btn-secondary disabled:opacity-50"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Tem certeza de que deseja limpar todos os campos do formulário? Os dados não salvos serão perdidos.'
                      )
                    ) {
                      setLocalidadeInicio('');
                      setLocalidadeFim('');
                      setViasSelecionadas([]);
                      setViasDisponiveis([]);
                      setPlataformasSelecionadas([]);
                      setPlataformasDisponiveis([]);
                      setDetalheLocalizacao('');
                      setElementoAfetado('geral');
                      setQuemComunicou('estacao');
                      setIdTrem('');
                      setPrefixoViagem('');
                      setClassificacoes([]);
                      setTipoIN('');
                      setPaeseAcionado(false);
                      setPaeseModalidades([]);
                      setPaeseTrecho('');
                      setSCO('');
                      setIdentificacaoComunicador('');
                      setFalhasSelecionadas([]);
                      setFalhaEditada(null);
                      setImpactoEditado(null);
                      setTemImpactoOutraLinha(false);
                      setLinhasImpactadasSecundarias([]);
                      setDescricaoImpactoSecundario('');
                      setEstrategiaLoop(false);
                      setQtdLoops(1);
                      setLoops([
                        { id: '1', estacaoInicio: '', estacaoFim: '', intervaloTeorico: '' },
                      ]);
                      setEtapaAtiva('iniciais');
                      setHoraInicio('');
                      setMensagens({ comunicacao: '', operacao: '', gerencia: '' });
                      setCodigoEventoAtual(null);
                      setDisparoRealizado(false);
                      setErroBusca('');
                    }
                  }}
                  disabled={loading}
                  className="flex-1 btn btn-secondary text-rose-600 hover:bg-rose-50 border-rose-200 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Limpar formulário
                </button>
                <button
                  type="submit"
                  disabled={!isEtapaValida()}
                  className="flex-1 btn btn-safira disabled:opacity-50"
                >
                  {indiceEtapaAtiva < totalEtapas - 1 ? (
                    'Próxima página'
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {loading ? 'Formatando com Gemini...' : 'Gerar Mensagens'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

          {/* Cards de Pré-visualização das Mensagens */}
          <div className="lg:col-span-7 space-y-4">

            {/* Banner de Ocorrência Salva / Código de Evento */}
            {codigoEventoAtual && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Ocorrência registrada no histórico: <strong className="font-mono text-emerald-900">{codigoEventoAtual}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCodigoBusca(codigoEventoAtual);
                    setAbaAtiva('historico');
                    void handleCarregarOcorrenciaRapida(codigoEventoAtual);
                  }}
                  className="underline font-semibold hover:text-emerald-950 transition-colors cursor-pointer"
                >
                  Acompanhar no Histórico &rarr;
                </button>
              </div>
            )}

            {/* Seletor de Grupos para Disparo */}
            <div className="border border-slate-300 bg-white p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-safira" />
                <span className="text-xs font-bold text-slate-800">
                  Grupos Selecionados para Disparo:
                </span>
              </div>

              <div className="flex items-center gap-3.5 flex-wrap">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-safira hover:opacity-80 transition-opacity">
                  <input
                    type="checkbox"
                    checked={gruposSelecionados.comunicacao}
                    onChange={(e) => setGruposSelecionados((prev) => ({ ...prev, comunicacao: e.target.checked }))}
                    className="rounded border-slate-300 text-safira focus:ring-safira"
                  />
                  <span>Comunicação</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-coral hover:opacity-80 transition-opacity">
                  <input
                    type="checkbox"
                    checked={gruposSelecionados.operacao}
                    onChange={(e) => setGruposSelecionados((prev) => ({ ...prev, operacao: e.target.checked }))}
                    className="rounded border-slate-300 text-coral focus:ring-coral"
                  />
                  <span>Operação</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-jade hover:opacity-80 transition-opacity">
                  <input
                    type="checkbox"
                    checked={gruposSelecionados.gerencia}
                    onChange={(e) => setGruposSelecionados((prev) => ({ ...prev, gerencia: e.target.checked }))}
                    className="rounded border-slate-300 text-jade focus:ring-jade"
                  />
                  <span>Gerência</span>
                </label>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <button
                  type="button"
                  onClick={() => {
                    const todosMarcados =
                      gruposSelecionados.comunicacao &&
                      gruposSelecionados.operacao &&
                      gruposSelecionados.gerencia;
                    setGruposSelecionados({
                      comunicacao: !todosMarcados,
                      operacao: !todosMarcados,
                      gerencia: !todosMarcados,
                    });
                  }}
                  className="text-[11px] text-slate-500 hover:text-safira font-medium underline"
                >
                  {gruposSelecionados.comunicacao && gruposSelecionados.operacao && gruposSelecionados.gerencia
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </button>
              </div>
            </div>

            {/* Card 1: Comunicação */}
            <div className="border border-slate-300 bg-white p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-safira">Grupo: Comunicação / Imprensa</span>
                  <p className="text-xs text-slate-500">Contexto claro para a equipe de comunicação e jornalistas</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDispararCanalIndividual('comunicacao', mensagens.comunicacao)}
                    disabled={!mensagens.comunicacao || disparandoWpp}
                    className="btn btn-secondary btn-sm flex items-center gap-1 text-xs text-safira hover:bg-safira/10 disabled:opacity-30"
                    title="Disparar apenas neste grupo"
                  >
                    <Send className={`w-3.5 h-3.5 ${disparandoCanal === 'comunicacao' ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">Disparar grupo</span>
                  </button>
                  <button
                    onClick={() => copiarTexto('comunicacao', mensagens.comunicacao)}
                    disabled={!mensagens.comunicacao}
                    className="btn btn-secondary btn-sm disabled:opacity-30"
                    title="Copiar texto"
                  >
                    {copiado === 'comunicacao' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={mensagens.comunicacao}
                onChange={(e) => setMensagens({ ...mensagens, comunicacao: e.target.value })}
                placeholder="Aguardando geração..."
                className="w-full form-control font-sans"
              />
            </div>

            {/* Card 2: Operação */}
            <div className="border border-slate-300 bg-white p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-coral">Grupo: Operação / Tráfego CCO</span>
                  <p className="text-xs text-slate-500">Técnico, sucinto e direcionado à circulação</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDispararCanalIndividual('operacao', mensagens.operacao)}
                    disabled={!mensagens.operacao || disparandoWpp}
                    className="btn btn-secondary btn-sm flex items-center gap-1 text-xs text-coral hover:bg-coral/10 disabled:opacity-30"
                    title="Disparar apenas neste grupo"
                  >
                    <Send className={`w-3.5 h-3.5 ${disparandoCanal === 'operacao' ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">Disparar grupo</span>
                  </button>
                  <button
                    onClick={() => copiarTexto('operacao', mensagens.operacao)}
                    disabled={!mensagens.operacao}
                    className="btn btn-secondary btn-sm disabled:opacity-30"
                    title="Copiar texto"
                  >
                    {copiado === 'operacao' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={mensagens.operacao}
                onChange={(e) => setMensagens({ ...mensagens, operacao: e.target.value })}
                placeholder="Aguardando geração..."
                className="w-full form-control font-mono text-xs"
              />
            </div>

            {/* Card 3: Gerência */}
            <div className="border border-slate-300 bg-white p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-jade">Grupo: Gerência / Diretoria</span>
                  <p className="text-xs text-slate-500">Informe executivo com causa e previsão de atuação</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDispararCanalIndividual('gerencia', mensagens.gerencia)}
                    disabled={!mensagens.gerencia || disparandoWpp}
                    className="btn btn-secondary btn-sm flex items-center gap-1 text-xs text-jade hover:bg-jade/10 disabled:opacity-30"
                    title="Disparar apenas neste grupo"
                  >
                    <Send className={`w-3.5 h-3.5 ${disparandoCanal === 'gerencia' ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">Disparar grupo</span>
                  </button>
                  <button
                    onClick={() => copiarTexto('gerencia', mensagens.gerencia)}
                    disabled={!mensagens.gerencia}
                    className="btn btn-secondary btn-sm disabled:opacity-30"
                    title="Copiar texto"
                  >
                    {copiado === 'gerencia' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={mensagens.gerencia}
                onChange={(e) => setMensagens({ ...mensagens, gerencia: e.target.value })}
                placeholder="Aguardando geração..."
                className="w-full form-control font-sans"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!mensagens.comunicacao || !mensagens.operacao || !mensagens.gerencia || salvando}
                onClick={handleSalvarOcorrencia}
                className="w-full btn btn-safira disabled:opacity-30"
              >
                <Save className="w-4 h-4" />
                {salvando ? 'Salvando...' : codigoEventoAtual ? 'Atualizar no histórico' : 'Salvar mensagens'}
              </button>

              {(() => {
                const qtdSelecionada = Object.values(gruposSelecionados).filter(Boolean).length;
                const podeDisparar =
                  qtdSelecionada > 0 &&
                  (!gruposSelecionados.comunicacao || Boolean(mensagens.comunicacao)) &&
                  (!gruposSelecionados.operacao || Boolean(mensagens.operacao)) &&
                  (!gruposSelecionados.gerencia || Boolean(mensagens.gerencia)) &&
                  !disparandoWpp;

                const textoBotao =
                  disparandoWpp
                    ? 'Disparando no WhatsApp...'
                    : qtdSelecionada === 0
                    ? 'Selecione ao menos 1 grupo'
                    : qtdSelecionada === 3
                    ? 'Disparar nos 3 Grupos Selecionados'
                    : qtdSelecionada === 1
                    ? `Disparar no Grupo ${
                        gruposSelecionados.comunicacao
                          ? 'Comunicação'
                          : gruposSelecionados.operacao
                          ? 'Operação'
                          : 'Gerência'
                      }`
                    : `Disparar nos 2 Grupos Selecionados`;

                return (
                  <button
                    type="button"
                    disabled={!podeDisparar}
                    onClick={() => void handleDispararWhatsApp(mensagens)}
                    className="w-full btn btn-jade disabled:opacity-30 font-semibold flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {textoBotao}
                  </button>
                );
              })()}
            </div>

          </div>

        </div>

        <section
          id="painel-historico"
          role="tabpanel"
          aria-labelledby="aba-historico"
          hidden={abaAtiva !== 'historico'}
          className="border border-slate-300 bg-white p-3 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <History className="h-4 w-4 text-safira" />
              Histórico recente de ocorrências
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void exportarHistoricoCSV()}
                disabled={carregandoHistorico || historico.length === 0}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() => void carregarHistorico(paginaHistorico)}
                disabled={carregandoHistorico}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                <History className="h-4 w-4" />
                {carregandoHistorico ? 'Atualizando...' : 'Atualizar lista'}
              </button>
            </div>
          </div>

          {erroHistorico && <p className="mb-3 text-sm text-rose-700" role="alert">{erroHistorico}</p>}

          {/* Botão de exclusão (visível quando há seleção) */}
          {ocorrenciasSelecionadasExclusao.size > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={abrirModalExclusao}
                disabled={excluindoOcorrencias}
                className="btn btn-secondary btn-sm text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir {ocorrenciasSelecionadasExclusao.size} selecionada{ocorrenciasSelecionadasExclusao.size !== 1 ? 's' : ''}
              </button>
              <button
                type="button"
                onClick={() => setOcorrenciasSelecionadasExclusao(new Set())}
                className="text-xs text-slate-500 hover:text-safira underline"
              >
                Limpar seleção
              </button>
            </div>
          )}

          <form onSubmit={handlePesquisarOcorrencia} className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="codigo-evento" className="form-label block">Pesquisar por ID do evento</label>
              <input
                id="codigo-evento"
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
                required
                placeholder="DDMMAAAALLNNN"
                className="w-full form-control font-mono"
              />
            </div>
            <button type="submit" disabled={buscandoOcorrencia || !codigoBusca.trim()} className="btn btn-safira disabled:opacity-50">
              <Search className="h-4 w-4" />
              {buscandoOcorrencia ? 'Pesquisando...' : 'Pesquisar'}
            </button>
          </form>

          {erroBusca && <p className="mb-4 text-sm text-rose-700" role="alert">{erroBusca}</p>}

          {ocorrenciaSelecionada && (
            <section id="painel-encerramento" className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-4" aria-label="Atualizar horário fim e redisparar evento">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-base font-bold text-safira">
                      Evento {ocorrenciaSelecionada.codigo_evento}
                    </h3>
                    <span className={`badge ${ocorrenciaSelecionada.status === 'encerrada' ? 'badge-jade' : 'badge-coral'}`}>
                      {ocorrenciaSelecionada.status === 'encerrada' ? 'Encerrada' : 'Em andamento'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {ocorrenciaSelecionada.linha} ({ocorrenciaSelecionada.via}) · {ocorrenciaSelecionada.localidade}
                    {ocorrenciaSelecionada.id_trem ? ` · Trem ${ocorrenciaSelecionada.id_trem}` : ''}
                    {ocorrenciaSelecionada.prefixo_viagem ? ` · Prefixo ${ocorrenciaSelecionada.prefixo_viagem}` : ''}
                  </p>
                  {ocorrenciaSelecionada.paese_acionado && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                      <strong>PAESE:</strong> {ocorrenciaSelecionada.paese_modalidades.map((modalidade) => `PAESE ${modalidade}`).join(' + ')}
                      {ocorrenciaSelecionada.paese_trecho ? ` · Trecho: ${ocorrenciaSelecionada.paese_trecho}` : ''}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                    <span>Início: <strong>{ocorrenciaSelecionada.hora_inicio}</strong></span>
                    <span>·</span>
                    <span>Fim: <strong>{ocorrenciaSelecionada.hora_fim || 'Não encerrada'}</strong></span>
                    {ocorrenciaSelecionada.hora_fim && (
                      <>
                        <span>·</span>
                        <span>Duração: <strong className="text-safira">{calcularDuracao(ocorrenciaSelecionada.hora_inicio, ocorrenciaSelecionada.hora_fim)}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOcorrenciaSelecionada(null)}
                  className="btn btn-secondary btn-sm flex items-center gap-1 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                  Fechar detalhes
                </button>
              </div>

              {sucessoEncerramento && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-900" role="status">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{sucessoEncerramento}</span>
                </div>
              )}

              {/* Formulário de Encerramento com Horário de Fim */}
              <div className="rounded-md border border-slate-300 bg-white p-3 shadow-sm space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="hora-fim" className="form-label mb-0 text-xs font-semibold">
                        Horário de Encerramento (Fim da Ocorrência)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleMudarHoraFim(new Date().toTimeString().slice(0, 5))}
                        className="text-[11px] text-safira hover:underline font-medium"
                      >
                        Usar hora atual ({new Date().toTimeString().slice(0, 5)})
                      </button>
                    </div>
                    <input
                      id="hora-fim"
                      type="time"
                      required
                      value={horaFim}
                      onChange={(e) => handleMudarHoraFim(e.target.value)}
                      className="w-full form-control font-mono"
                    />
                    {horaFim && /^([01]\d|2[0-3]):[0-5]\d$/.test(horaFim) && ocorrenciaSelecionada?.hora_inicio && (
                      <p className="text-[11.5px] text-safira mt-1 font-mono font-medium">
                        ⏱️ Duração calculada: <strong>{calcularDuracao(ocorrenciaSelecionada.hora_inicio, horaFim)}</strong>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAtualizarHorarioFim()}
                  disabled={!horaFim || atualizandoHorarioFim || !carregouTemplatesEncerramento || Boolean(erroTemplatesEncerramento)}
                    className="btn btn-safira disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {atualizandoHorarioFim ? 'Encerrando...' : 'Encerrar Ocorrência e Gerar Mensagens'}
                  </button>
                </div>
                {erroTemplatesEncerramento && (
                  <p className="text-xs text-rose-700" role="alert">
                    Não foi possível carregar os modelos de encerramento: {erroTemplatesEncerramento}
                  </p>
                )}
                <p className="text-[11.5px] text-slate-500">
                  A mensagem final terá somente o título, o horário de início, o horário de fim e a duração, seguida pela assinatura do SCO.
                </p>
              </div>

              {/* Mensagens Prontas para Disparo */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Mensagens com Horário de Fim
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-medium">Redisparar em:</span>
                    <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-semibold text-safira hover:opacity-80">
                      <input
                        type="checkbox"
                        checked={gruposRedisparo.comunicacao}
                        onChange={(e) => setGruposRedisparo((prev) => ({ ...prev, comunicacao: e.target.checked }))}
                        className="rounded border-slate-300 text-safira focus:ring-safira"
                      />
                      <span>Comunicação</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-semibold text-coral hover:opacity-80">
                      <input
                        type="checkbox"
                        checked={gruposRedisparo.operacao}
                        onChange={(e) => setGruposRedisparo((prev) => ({ ...prev, operacao: e.target.checked }))}
                        className="rounded border-slate-300 text-coral focus:ring-coral"
                      />
                      <span>Operação</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-semibold text-jade hover:opacity-80">
                      <input
                        type="checkbox"
                        checked={gruposRedisparo.gerencia}
                        onChange={(e) => setGruposRedisparo((prev) => ({ ...prev, gerencia: e.target.checked }))}
                        className="rounded border-slate-300 text-jade focus:ring-jade"
                      />
                      <span>Gerência</span>
                    </label>
                  </div>
                </div>

                {/* Mensagem 1: Comunicação */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-safira">Grupo: Comunicação / Imprensa</span>
                      <p className="text-[11px] text-slate-400">Contexto claro para imprensa e passageiros</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleDispararCanalIndividual('comunicacao', msgFimEditada.comunicacao)}
                        disabled={!msgFimEditada.comunicacao || disparandoWpp}
                        className="btn btn-secondary btn-sm flex items-center gap-1 text-xs text-safira hover:bg-safira/10 disabled:opacity-30"
                        title="Disparar apenas neste grupo"
                      >
                        <Send className={`w-3.5 h-3.5 ${disparandoCanal === 'comunicacao' ? 'animate-pulse' : ''}`} />
                        <span className="hidden sm:inline">Disparar grupo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copiarTexto('hist-comunicacao', msgFimEditada.comunicacao)}
                        className="btn btn-secondary btn-sm"
                        title="Copiar texto"
                      >
                        {copiado === 'hist-comunicacao' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={msgFimEditada.comunicacao}
                    onChange={(e) => setMsgFimEditada((prev) => ({ ...prev, comunicacao: e.target.value }))}
                    className="w-full form-control font-sans text-xs"
                  />
                </div>

                {/* Mensagem 2: Operação */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-coral">Grupo: Operação / Tráfego CCO</span>
                      <p className="text-[11px] text-slate-400">Técnico e sucinto para tráfego e estações</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleDispararCanalIndividual('operacao', msgFimEditada.operacao)}
                        disabled={!msgFimEditada.operacao || disparandoWpp}
                        className="btn btn-secondary btn-sm flex items-center gap-1 text-xs text-coral hover:bg-coral/10 disabled:opacity-30"
                        title="Disparar apenas neste grupo"
                      >
                        <Send className={`w-3.5 h-3.5 ${disparandoCanal === 'operacao' ? 'animate-pulse' : ''}`} />
                        <span className="hidden sm:inline">Disparar grupo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copiarTexto('hist-operacao', msgFimEditada.operacao)}
                        className="btn btn-secondary btn-sm"
                        title="Copiar texto"
                      >
                        {copiado === 'hist-operacao' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={msgFimEditada.operacao}
                    onChange={(e) => setMsgFimEditada((prev) => ({ ...prev, operacao: e.target.value }))}
                    className="w-full form-control font-mono text-xs"
                  />
                </div>

                {/* Mensagem 3: Gerência */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-jade">Grupo: Gerência / Diretoria</span>
                      <p className="text-[11px] text-slate-400">Resumo executivo de fechamento</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleDispararCanalIndividual('gerencia', msgFimEditada.gerencia)}
                        disabled={!msgFimEditada.gerencia || disparandoWpp}
                        className="btn btn-secondary btn-sm flex items-center gap-1 text-xs text-jade hover:bg-jade/10 disabled:opacity-30"
                        title="Disparar apenas neste grupo"
                      >
                        <Send className={`w-3.5 h-3.5 ${disparandoCanal === 'gerencia' ? 'animate-pulse' : ''}`} />
                        <span className="hidden sm:inline">Disparar grupo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copiarTexto('hist-gerencia', msgFimEditada.gerencia)}
                        className="btn btn-secondary btn-sm"
                        title="Copiar texto"
                      >
                        {copiado === 'hist-gerencia' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={msgFimEditada.gerencia}
                    onChange={(e) => setMsgFimEditada((prev) => ({ ...prev, gerencia: e.target.value }))}
                    className="w-full form-control font-sans text-xs"
                  />
                </div>
              </div>

              {/* Botão de Disparo Novamente */}
              <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {disparoRealizado ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Disparo de encerramento registrado!
                    </span>
                  ) : (
                    <span>Pronto para enviar o informe final de encerramento da ocorrência.</span>
                  )}
                </div>

                {(() => {
                  const qtdSelecionada = Object.values(gruposRedisparo).filter(Boolean).length;
                  const podeRedisparar =
                    qtdSelecionada > 0 &&
                    (!gruposRedisparo.comunicacao || Boolean(msgFimEditada.comunicacao)) &&
                    (!gruposRedisparo.operacao || Boolean(msgFimEditada.operacao)) &&
                    (!gruposRedisparo.gerencia || Boolean(msgFimEditada.gerencia)) &&
                    !disparandoWpp;

                  const textoBotao =
                    disparandoWpp
                      ? 'Disparando no WhatsApp...'
                      : qtdSelecionada === 0
                      ? 'Selecione ao menos 1 grupo'
                      : qtdSelecionada === 3
                      ? 'Disparar Novamente nos 3 Grupos'
                      : qtdSelecionada === 1
                      ? `Disparar Novamente no Grupo ${
                          gruposRedisparo.comunicacao
                            ? 'Comunicação'
                            : gruposRedisparo.operacao
                            ? 'Operação'
                            : 'Gerência'
                        }`
                      : 'Disparar Novamente nos 2 Grupos Selecionados';

                  return (
                    <button
                      type="button"
                      disabled={!podeRedisparar}
                      onClick={() => void handleRedispararWhatsApp()}
                      className="w-full sm:w-auto btn btn-jade font-semibold flex items-center justify-center gap-2 px-5 py-2.5 shadow-xs disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {textoBotao}
                    </button>
                  );
                })()}
              </div>
            </section>
          )}

          <div className="overflow-x-auto">
            <table className="table w-full text-left">
              <thead>
                <tr>
                  <th className="w-8">
                    <input
                      type="checkbox"
                      checked={
                        historico.length > 0 &&
                        historico.every(
                          (item) =>
                            item.codigo_evento &&
                            ocorrenciasSelecionadasExclusao.has(item.codigo_evento)
                        )
                      }
                      onChange={toggleSelecaoTodasExclusao}
                      className="rounded border-slate-300 text-safira focus:ring-safira"
                    />
                  </th>
                  <th>ID do evento</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Linha / Via</th>
                  <th>Local</th>
                  <th>Trem / Prefixo</th>
                  <th>Falha informada</th>
                  <th>Status</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-500">
                      {carregandoHistorico ? 'Carregando histórico...' : 'Nenhuma ocorrência registrada.'}
                    </td>
                  </tr>
                ) : (
                  historico.map((item) => {
                    const encerrada = item.status === 'encerrada';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="w-8">
                          <input
                            type="checkbox"
                            checked={item.codigo_evento ? ocorrenciasSelecionadasExclusao.has(item.codigo_evento) : false}
                            onChange={() => toggleSelecaoExclusao(item.codigo_evento || '')}
                            className="rounded border-slate-300 text-safira focus:ring-safira"
                          />
                        </td>
                        <td className="font-mono font-medium text-safira">
                          {item.codigo_evento || '-'}
                        </td>
                        <td>
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {item.hora_inicio}
                          </span>
                        </td>
                        <td>
                          {item.hora_fim ? (
                            <span className="flex items-center gap-1 font-mono text-xs text-emerald-700 font-semibold">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {item.hora_fim}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-xs">{item.linha} ({item.via})</td>
                        <td className="font-medium text-xs">{item.localidade}</td>
                        <td className="font-mono text-xs">
                          {item.id_trem || item.prefixo_viagem
                            ? `${item.id_trem ? `Trem ${item.id_trem}` : ''}${item.id_trem && item.prefixo_viagem ? ' / ' : ''}${item.prefixo_viagem ? `Pref. ${item.prefixo_viagem}` : ''}`
                            : '-'}
                        </td>
                        <td className="max-w-xs truncate text-xs" title={item.falha}>{item.falha}</td>
                        <td>
                          <span className={`badge ${encerrada ? 'badge-jade' : 'badge-coral'}`}>
                            {encerrada ? 'Encerrada' : 'Em andamento'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.codigo_evento) {
                                void handleCarregarOcorrenciaRapida(item.codigo_evento);
                              }
                            }}
                            className={`btn btn-sm text-xs inline-flex items-center gap-1.5 ${
                              encerrada ? 'btn-secondary text-slate-700' : 'btn-safira'
                            }`}
                            title={encerrada ? 'Ver e redisparar mensagens' : 'Encerrar ocorrência com horário de fim'}
                          >
                            {encerrada ? (
                              <>
                                <Send className="h-3.5 w-3.5 text-jade" />
                                <span>Ver / Redisparar</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                <span>Encerrar</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => void carregarHistorico(paginaHistorico - 1)}
              disabled={paginaHistorico <= 1 || carregandoHistorico}
              className="btn btn-secondary btn-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <p className="text-sm text-slate-600" aria-live="polite">
              Página {paginaHistorico} de {Math.max(1, Math.ceil(totalHistorico / 10))}
            </p>
            <button
              type="button"
              onClick={() => void carregarHistorico(paginaHistorico + 1)}
              disabled={paginaHistorico >= Math.ceil(totalHistorico / 10) || carregandoHistorico}
              className="btn btn-secondary btn-sm disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </section>

        <div
          id="painel-admin"
          role="tabpanel"
          aria-labelledby="aba-admin"
          hidden={abaAtiva !== 'admin'}
        >
          <div className="border border-slate-300 bg-white p-3 shadow-sm">
            <AdminFalhas
            falhas={falhasPredefinidas}
            onFalhasAtualizadas={carregarFalhasPredefinidas}
            onNotificarErro={exibirErro}
            onNotificarSucesso={(titulo, mensagem) => {
              exibirModal({
                tipo: 'sucesso',
                titulo,
                mensagem,
                textoBotaoConfirmar: 'OK',
              });
            }}
          />
          </div>
        </div>

        {/* Modal Universal do SIDO: Mensagens Humanas de Notificação, Sucesso e Erros */}
        {modalConfig.aberto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 transition-opacity duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-sido-titulo"
            aria-describedby="modal-sido-descricao"
            onClick={(e) => {
              if (e.target === e.currentTarget) fecharModal();
            }}
          >
            <div className="relative w-full max-w-lg bg-white rounded-md shadow-sm border border-slate-300 overflow-hidden transform transition-all duration-200">
              
              {/* Barra superior com indicador temático */}
              <div
                className={`h-1.5 w-full ${
                  modalConfig.tipo === 'erro'
                    ? 'bg-rose-500'
                    : modalConfig.tipo === 'sucesso'
                    ? 'bg-jade'
                    : modalConfig.tipo === 'aviso'
                    ? 'bg-amber-500'
                    : 'bg-safira'
                }`}
              />

              {/* Botão de Fechar no canto superior */}
              <button
                type="button"
                onClick={fecharModal}
                className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Fechar janela"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 space-y-4">
                {/* Cabeçalho do Modal: Ícone e Título */}
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex-shrink-0 p-2.5 rounded-xl ${
                      modalConfig.tipo === 'erro'
                        ? 'bg-rose-100 text-rose-600'
                        : modalConfig.tipo === 'sucesso'
                        ? 'bg-emerald-100 text-emerald-700'
                        : modalConfig.tipo === 'aviso'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {modalConfig.tipo === 'erro' && <AlertCircle className="w-6 h-6" />}
                    {modalConfig.tipo === 'sucesso' && <CheckCircle2 className="w-6 h-6" />}
                    {modalConfig.tipo === 'aviso' && <AlertTriangle className="w-6 h-6" />}
                    {modalConfig.tipo === 'info' && <Info className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 pr-6">
                    <h3 id="modal-sido-titulo" className="text-lg font-bold text-slate-900 leading-snug">
                      {modalConfig.titulo}
                    </h3>
                    <p id="modal-sido-descricao" className="mt-1.5 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {renderizarTextoComDestaques(modalConfig.mensagem)}
                    </p>
                  </div>
                </div>

                {/* Dica Prática de Ação (quando aplicável) */}
                {modalConfig.dica && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-900">
                    <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold block mb-0.5 text-amber-950">O que você pode fazer:</span>
                      <span className="leading-relaxed">{modalConfig.dica}</span>
                    </div>
                  </div>
                )}

                {/* Detalhes Técnicos Expansíveis (para suporte do CCO / TI) */}
                {modalConfig.detalhesTecnicos && (
                  <details className="group border border-slate-200 rounded-lg bg-slate-50 text-xs overflow-hidden">
                    <summary className="cursor-pointer select-none px-3.5 py-2 font-medium text-slate-600 hover:text-slate-900 flex items-center justify-between transition-colors">
                      <span>Detalhes técnicos (para suporte do CCO / TI)</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-3.5 py-2.5 border-t border-slate-200 bg-white font-mono text-[11px] text-slate-700 max-h-36 overflow-y-auto break-all whitespace-pre-wrap select-all">
                      {modalConfig.detalhesTecnicos}
                    </div>
                  </details>
                )}

                {/* Rodapé com Botão de Confirmação */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (modalConfig.onConfirmar) {
                        modalConfig.onConfirmar();
                      }
                      fecharModal();
                    }}
                    className={`btn btn-sm px-5 py-2 font-semibold shadow-xs ${
                      modalConfig.tipo === 'erro'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : modalConfig.tipo === 'sucesso'
                        ? 'btn-jade'
                        : 'btn-safira'
                    }`}
                  >
                    {modalConfig.textoBotaoConfirmar || 'Entendi'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

      {/* Modal de Validação Tripla - Exclusão de Ocorrências */}
      {modalExclusaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 transition-opacity duration-200"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalExclusaoAberto(false);
          }}
        >
          <div className="relative w-full max-w-md bg-white rounded-md shadow-sm border border-slate-300 overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-200 p-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Exclusão de Ocorrências - Etapa {etapaExclusao} de 3
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {ocorrenciasSelecionadasExclusao.size} ocorrência{ocorrenciasSelecionadasExclusao.size !== 1 ? 's' : ''} selecionada{ocorrenciasSelecionadasExclusao.size !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="p-6">
              {/* Etapa 1 - Confirmação inicial */}
              {etapaExclusao === 1 && (
                <div className="space-y-4">
                  <p className="text-slate-700">
                    Tem certeza de que deseja excluir{' '}
                    <span className="font-semibold text-rose-600">
                      {ocorrenciasSelecionadasExclusao.size} ocorrência{ocorrenciasSelecionadasExclusao.size !== 1 ? 's' : ''}
                    </span>{' '}
                    do histórico? Esta ação é irreversível.
                  </p>
                  <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-800">
                    Aviso: Todas as mensagens e dados dessas ocorrências serão permanentemente removidos.
                  </div>
                </div>
              )}

              {/* Etapa 2 - Confirmação final */}
              {etapaExclusao === 2 && (
                <div className="space-y-4">
                  <p className="text-slate-700">
                    Confirma a exclusão permanente de{' '}
                    <span className="font-semibold text-rose-600">
                      {ocorrenciasSelecionadasExclusao.size} ocorrência{ocorrenciasSelecionadasExclusao.size !== 1 ? 's' : ''}
                    </span>?{' '}
                    <span className="font-semibold text-rose-600">Não será possível desfazer.</span>
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
                    Dica: Após esta etapa, você precisará informar nome e data para validação final.
                  </div>
                </div>
              )}

              {/* Etapa 3 - Validador com nome e data */}
              {etapaExclusao === 3 && (
                <div className="space-y-4">
                  <p className="text-slate-700">
                    Para validar a exclusão, informe seu nome e a data de hoje:
                  </p>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nome de quem está apagando
                    </label>
                    <input
                      type="text"
                      value={nomeExclusao}
                      onChange={(e) => setNomeExclusao(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full form-control text-xs"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Data (AAAA-MM-DD)
                    </label>
                    <input
                      type="date"
                      value={dataExclusao}
                      onChange={(e) => setDataExclusao(e.target.value)}
                      className="w-full form-control text-xs"
                    />
                    <p className="text-xs text-slate-500">
                      A data não pode ser futura. Se estiver incorreta, a exclusão será cancelada.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (etapaExclusao === 1) {
                    setModalExclusaoAberto(false);
                    setOcorrenciasSelecionadasExclusao(new Set());
                  } else {
                    setEtapaExclusao((etapaExclusao - 1) as 1 | 2 | 3);
                  }
                }}
                disabled={excluindoOcorrencias}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                {etapaExclusao === 1 ? 'Cancelar' : 'Voltar'}
              </button>
              <button
                type="button"
                onClick={avancarEtapaExclusao}
                disabled={excluindoOcorrencias}
                className="btn btn-secondary btn-sm text-rose-600 border-rose-200 hover:bg-rose-50 disabled:opacity-50"
              >
                {excluindoOcorrencias ? 'Processando...' : etapaExclusao === 3 ? 'Confirmar Exclusão' : 'Próxima etapa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de envio de mensagens via WhatsApp */}
      {disparandoWpp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-envio-whatsapp-titulo"
        >
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 p-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2" id="modal-envio-whatsapp-titulo">
                <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                Enviando mensagens via WhatsApp
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Aguarde enquanto as mensagens são despachadas para os grupos selecionados.
              </p>
            </div>
            <div className="p-6 text-center">
              <div className="inline-flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                </div>
                <p className="text-slate-700 font-medium">
                  Não feche a página enquanto o envio estiver em andamento.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Símbolo do Aprendiz Maçom (apenas para inspeção do DOM) */}
      <div
        className="fixed bottom-0 right-0 w-px h-px bg-transparent opacity-0 pointer-events-none"
        title="Oficina do Aprendiz Maçom · Esquadro e Compasso · Grau: Aprendiz"
      >
        ☐
      </div>

    </main>
  );
}