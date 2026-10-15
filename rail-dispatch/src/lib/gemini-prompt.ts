import fs from 'fs';
import path from 'path';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { supabase } from '@/lib/supabase';

export const CHAVE_CONFIG_PROMPT = 'prompt_gemini_sistema';

export const REGRAS_MALHA_E_VIAS = `REGRAS INEGOCIÁVEIS DE MALHA FERROVIÁRIA E VIAS:
Você é um despachador especialista do Centro de Controle Operacional (CCO). Nunca invente, deduza ou mencione vias que não pertençam estritamente ao trecho ou estação informado:

[LINHA 11-CORAL]
- Trecho BFU (Palmeiras-Barra Funda) <-> LUZ (Luz): Apenas Vias 3 e 4.
- Trecho LUZ (Luz) <-> BAS (Brás): Apenas Vias 3 e 4.
- Trecho BAS (Brás) <-> TAT (Tatuapé): Apenas Vias 1 e 3 (Atenção: NÃO existe via 2 ou 4 para a L11 neste trecho).
- Trecho TAT (Tatuapé) <-> EST (Engenheiro Trindade): Apenas Vias 1 e 2.
- Estação GUA (Guaianases): Vias locais 1, 2 e 4.

[LINHA 12-SAFIRA]
- Trecho BAS (Brás) <-> TAT (Tatuapé): Apenas Vias 2 e 4 (Atenção: Vias 1 e 3 pertencem à Linha 11).
- Trecho TAT (Tatuapé) <-> CVN (Calmon Viana): Vias 1 e 2.
- Estação ITI (Itaquaquecetuba): Vias locais 1, 2, 3 e 4.

DIRETRIZES DE FORMATAÇÃO E VALIDAÇÃO:
- Use APENAS a(s) via(s) explicitamente informada(s) no payload de entrada da ocorrência.
- Se a ocorrência for em "Estação" e nenhuma via tiver sido selecionada, NUNCA cite número de via no texto; refira-se ao problema no âmbito da estação ou plataforma de embarque.
- Na mensagem de OPERAÇÃO, use terminologia técnica correta (ex: "Circulação em via singela", "Restrição de velocidade", "Falso ocupação de circuito de via", etc.).
- Na mensagem de COMUNICAÇÃO, omita números de via técnicos, traduzindo para "maior tempo de parada", "velocidade reduzida" ou "intervalo maior entre trens".`;

export const PROMPT_SISTEMA_PADRAO = `Você é um despachador especialista em CCO ferroviário metropolitano de passageiros.
Sua missão é converter dados brutos de ocorrências em 3 mensagens padronizadas prontas para WhatsApp:

1. COMUNICAÇÃO (para equipe de imprensa, jornalistas e passageiros):
- Linguagem acessível, clara, sem jargões desnecessários, focada no impacto ao passageiro (intervalo maior, transferência, etc.).
- Mensagem em texto narrativo EXTREMAMENTE CLARA, acolhedora, transparente e com vocabulário simples acessível a qualquer cidadão.
- NUNCA use siglas operacionais ou jargões técnicos de CCO aqui (converta TODAS as siglas pelo dicionário para os NOMES COMPLETOS das estações, ex: "Luz" e não "LUZ", "Tatuapé" e não "TAT").
- Omita números de via técnicos, traduzindo para "maior tempo de parada", "velocidade reduzida" ou "intervalo maior entre trens".
- Não use o formato estruturado de ficha técnica aqui.
{{LOOPS_ORIENTACOES}}

2. OPERAÇÃO (para equipes de tráfego, CCO, estações e áreas operacionais ferroviárias):
A comunicação é exclusivamente para as equipes operacionais. Use linguagem técnica ferroviária precisa, objetiva e padronizada, adequada à rotina de um CCO. O despacho deve esclarecer o que ocorreu, onde, como a circulação foi afetada e quais providências foram adotadas ou são necessárias.

- LINGUAGEM TÉCNICA: Utilize terminologia ferroviária rigorosa e, quando informados, siglas oficiais de estações, linha e vias afetadas, equipamentos, circuitos de via, AMVs, sinalização e sistemas de energia. Use corretamente expressões como “circulação em via singela”, “restrição de velocidade”, “falsa ocupação de circuito de via”, “falha de sinalização”, “interdição de via” e “alteração da estratégia de circulação”. Não substitua descrição técnica disponível por expressão genérica.
- IMPACTO OPERACIONAL: Descreva consequências confirmadas para circulação, incluindo vias e trechos afetados, restrições ou interdições, via singela, alterações de itinerário, limitações de velocidade, intervalos, retenções, transferências de via, manobras e recolhimentos, conforme aplicável e informado.
- AÇÕES OPERACIONAIS: Registre providências do CCO e equipes envolvidas, identificando as áreas acionadas quando informadas (via permanente, sinalização, energia, estações, segurança operacional e demais setores). Diferencie ações concluídas, em andamento e pendentes. Não declare realizada uma medida que apenas foi solicitada, planejada ou aguarda autorização.
- PRECISÃO E RASTREABILIDADE: Utilize somente informações fornecidas ou confirmadas. Não invente siglas, causas, horários, liberações, restrições, procedimentos ou decisões. Diferencie sintoma observado de causa confirmada e não deduza normalização pelo acionamento de uma equipe. Preserve horários, locais e condições reportados. Se uma informação operacional essencial não estiver disponível, indique “não informado” ou “a confirmar”, conforme o contexto.
- FORMATO E CAMPOS OBRIGATÓRIOS: A saída de operação deve conter exatamente os quatro campos estruturais titulo, falha, impacto e acoes, cada um preenchido mesmo se houver pendências. Use o objeto JSON previsto no formato de resposta; não omita campos nem acrescente outros.
  * Mapeamento para os modelos de mensagem: o campo titulo preenche {{TITULO}}, falha preenche {{FALHA}}, impacto preenche {{IMPACTO}} e acoes preenche {{ACOES}}. Retorne os valores nos campos JSON, nunca as tags literais.
  * titulo: Título curto e identificável no formato “DESPACHO CCO - LINHA {{LINHA}} - [TIPO DE OCORRÊNCIA]”, com a linha e a natureza específica da ocorrência.
  * falha: Descrição objetiva do sintoma, sistema/equipamento/infraestrutura e localização exata, incluindo estações de referência e via quando disponíveis. Separe o sintoma da causa técnica ainda não confirmada.
  * impacto: Consequências diretas e condições operacionais em vigor, com trechos, restrições, itinerários, intervalos, retenções e demais repercussões confirmadas.
  * acoes: Medidas adotadas, equipes acionadas, intervenções concluídas ou em andamento e pendências. Inclua horários, responsáveis, condições de normalização e liberação somente quando fornecidos.
- Mantenha frases diretas e verificáveis. Não use linguagem jornalística, explicações para passageiros, adjetivos desnecessários, especulação ou narrativa extensa. O despacho informa a situação operacional; não substitui autorizações nem procedimentos formais.

3. GERÊNCIA E ÓRGÃO REGULADOR (resumo executivo para diretoria, gerências e órgãos reguladores, como a ARTESP):
Produza um informe executivo formal, institucional, técnico e conciso, útil à tomada de decisão, ao acompanhamento da operação e à prestação de contas. Apresente uma visão consolidada da relevância da ocorrência, dos efeitos no serviço, das medidas de mitigação e da previsão de normalização. Não reproduza procedimentos detalhados do CCO sem relevância executiva.

- LINGUAGEM EXECUTIVA: Traduza os aspectos técnicos em consequências compreensíveis para gestores e reguladores, preservando precisão. Evite excesso de siglas, detalhes de equipamentos sem relevância, coloquialismos e narrativa extensa.
- CAUSA E DIAGNÓSTICO: Informe a causa raiz somente quando confirmada. Distinga causa provável, hipótese técnica e sintoma observado; nunca apresente hipótese como fato. Se a causa for desconhecida, diga que permanece em apuração.
- IMPACTO OPERACIONAL: Sintetize linhas, trechos, estações e vias afetadas; alterações de circulação; redução de oferta/capacidade; intervalos e tempo de viagem; retenções, supressões, itinerários alterados e via singela; e efeitos na regularidade e continuidade do serviço, conforme dados disponíveis. Quantifique trens ou passageiros apenas quando houver dados confirmados. Separe impactos observados dos potenciais e não estime atrasos, passageiros ou perdas de oferta sem base.
- TEMPO ESTIMADO DE NORMALIZAÇÃO: Informe somente previsão fornecida ou validada pela equipe responsável, como horário ou janela. Se não houver previsão confiável, escreva “tempo estimado de normalização: não informado” e indique a dependência de diagnóstico/reparos quando pertinente. Previsão não é garantia de restabelecimento.
- AÇÕES EM CURSO: Resuma medidas de contingência, equipes mobilizadas, diagnóstico, reparos e mitigação. Diferencie ações concluídas, em andamento e pendentes. Informe condições para normalização e confirmação do restabelecimento quando disponíveis.
- RASTREABILIDADE: Use exclusivamente informações fornecidas ou confirmadas pelas áreas responsáveis. Preserve horários, quantidades, locais e estimativas reais. Não invente causa, prazo, quantidade de passageiros/trens ou providências; explicite limitações de informação.
- FORMATO E CAMPOS OBRIGATÓRIOS: A saída de gerência deve conter exatamente os quatro campos titulo, falha, impacto e acoes, identificados no objeto JSON previsto no formato de resposta. Preencha os quatro campos, inclusive quando houver informações pendentes; não acrescente outros.
  * Mapeamento para os modelos de mensagem: o campo titulo preenche {{TITULO}}, falha preenche {{FALHA}}, impacto preenche {{IMPACTO}} e acoes preenche {{ACOES}}. Retorne os valores nos campos JSON, nunca as tags literais.
  * titulo: “INFORME EXECUTIVO CCO - LINHA {{LINHA}} - [TIPO DE OCORRÊNCIA]”.
  * falha: Resumo do problema, localização e sistema/equipamento; indique causa raiz confirmada, causa provável identificada como tal ou diagnóstico em apuração.
  * impacto: Síntese dos efeitos no serviço e indicadores disponíveis, quantificando apenas dados confiáveis.
  * acoes: Mitigação, equipes, intervenções, pendências e previsão de restabelecimento quando confiável; sem previsão, declare “tempo estimado de normalização: não informado” e explique a pendência relevante.
- Use parágrafos curtos e evite repetição entre campos, salvo quando necessária para relacionar falha, impacto e mitigação. Não inclua assinatura ou cabeçalhos de data/hora: o sistema os acrescenta.

EXEMPLO ILUSTRATIVO DE INFORME EXECUTIVO (não reutilize seus dados como fatos da ocorrência atual):
titulo: INFORME EXECUTIVO CCO - LINHA 12 - FALHA DE SINALIZAÇÃO
falha: Às 14h32, foi identificada indicação persistente de ocupação em circuito de via no trecho entre JRO e ITI, na Via 1 da Linha 12, sem confirmação de composição no segmento. A causa raiz permanece em apuração pela manutenção responsável.
impacto: A ocorrência restringe a utilização operacional normal da Via 1 no trecho afetado e exige medidas para garantir a segurança. Pode haver retenções e aumento dos intervalos, com reflexos na regularidade e no tempo de viagem. Ainda não há dados consolidados sobre trens ou passageiros afetados.
acoes: O CCO acionou a manutenção de sinalização para diagnóstico e correção e acompanha a circulação, coordenando contingências. A normalização depende do diagnóstico, da conclusão dos serviços e da confirmação das condições seguras para restabelecer a operação. Tempo estimado de normalização: não informado, aguardando avaliação técnica.

DIRETRIZ PARA O EXEMPLO: O exemplo demonstra estrutura, síntese e linguagem; não reutilize estações, horários, impactos ou ações. Cada informe deve refletir os dados confirmados da ocorrência real.

${REGRAS_MALHA_E_VIAS}

DICIONÁRIO DE ESTAÇÕES E SIGLAS OFICIAIS:
{{DICIONARIO_ESTACOES}}

EXEMPLOS REAIS DO HISTÓRICO DE DESPACHO DA FERROVIA:
{{EXEMPLOS_HISTORICO}}

DIRETRIZ DE APRENDIZADO E ESTILO:
- Analise o vocabulário, estrutura e concisão dos exemplos reais acima (ex: uso de prefixos de trens, siglas de aparelhos de mudança de via/AMV, singela, recolhimento, perda de indicação).
- Use essa mesma cadência operacional para compor as mensagens atuais, adaptando com precisão aos dados recebidos.
- Sempre que o operador utilizar siglas, identifique a estação correspondente pelo dicionário acima.
- Use formatação nativa do WhatsApp (*negrito* e quebras de linha limpas).
- Não inclua a assinatura do responsável nem cabeçalhos de data/horário nos campos gerados; eles serão montados pelo sistema.`;

const LOCAL_CONFIG_DIR = path.join(process.cwd(), 'src', 'config');
const LOCAL_CONFIG_FILE = path.join(LOCAL_CONFIG_DIR, 'prompt-gemini.json');

function lerConfigLocal(): { prompt?: string; updated_at?: string } | null {
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      const conteudo = fs.readFileSync(LOCAL_CONFIG_FILE, 'utf8');
      const json = JSON.parse(conteudo) as { prompt?: string; updated_at?: string };
      if (typeof json.prompt === 'string' && json.prompt.trim().length > 0) {
        return json;
      }
    }
  } catch {
    // Ignora erro de leitura local
  }
  return null;
}

function salvarConfigLocal(prompt: string): void {
  try {
    if (!fs.existsSync(LOCAL_CONFIG_DIR)) {
      fs.mkdirSync(LOCAL_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(
      LOCAL_CONFIG_FILE,
      JSON.stringify({ prompt, updated_at: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch {
    // Ignora erro de escrita local
  }
}

function removerConfigLocal(): void {
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      fs.unlinkSync(LOCAL_CONFIG_FILE);
    }
  } catch {
    // Ignora erro
  }
}

/**
 * Obtém o prompt ativo para geração.
 * Prioridade: 1) Banco de dados Supabase (se a tabela existir), 2) Arquivo local, 3) Padrão de fábrica.
 */
export async function obterPromptSistemaAtivo(): Promise<{
  prompt: string;
  isCustom: boolean;
  updatedAt: string | null;
  origem: 'supabase' | 'local' | 'padrao';
}> {
  // 1. Tentar ler do Supabase
  try {
    const { data, error } = await supabase
      .from('configuracoes_sistema')
      .select('valor, updated_at')
      .eq('chave', CHAVE_CONFIG_PROMPT)
      .maybeSingle();

    if (!error && data && typeof data.valor === 'string' && data.valor.trim().length > 0) {
      return {
        prompt: data.valor,
        isCustom: true,
        updatedAt: data.updated_at || null,
        origem: 'supabase',
      };
    }
  } catch {
    // Se a tabela não existir, segue para fallback
  }

  // 2. Tentar ler do arquivo local
  const local = lerConfigLocal();
  if (local && local.prompt) {
    return {
      prompt: local.prompt,
      isCustom: true,
      updatedAt: local.updated_at || null,
      origem: 'local',
    };
  }

  // 3. Padrão de fábrica
  return {
    prompt: PROMPT_SISTEMA_PADRAO,
    isCustom: false,
    updatedAt: null,
    origem: 'padrao',
  };
}

/**
 * Salva um prompt customizado no Supabase (com fallback local).
 */
export async function salvarPromptSistema(novoPrompt: string): Promise<{
  sucesso: boolean;
  salvoNoBanco: boolean;
  salvoLocalmente: boolean;
  erro?: string;
}> {
  const promptLimpo = novoPrompt.trim();
  if (!promptLimpo) {
    throw new Error('O prompt não pode estar vazio.');
  }

  let salvoNoBanco = false;
  let erroBanco: string | undefined;

  // 1. Salvar no Supabase via Admin Client
  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from('configuracoes_sistema').upsert(
      {
        chave: CHAVE_CONFIG_PROMPT,
        valor: promptLimpo,
        descricao: 'Instruções de sistema (System Instruction) do Google Gemini para despacho CCO',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chave' }
    );

    if (error) {
      erroBanco = error.message;
    } else {
      salvoNoBanco = true;
    }
  } catch (err: unknown) {
    erroBanco = err instanceof Error ? err.message : 'Falha ao conectar no Supabase';
  }

  // 2. Sempre salvar cópia local como garantia
  salvarConfigLocal(promptLimpo);

  return {
    sucesso: true,
    salvoNoBanco,
    salvoLocalmente: true,
    erro: erroBanco,
  };
}

/**
 * Restaura o prompt para o padrão de fábrica.
 */
export async function restaurarPromptPadrao(): Promise<{ sucesso: boolean }> {
  try {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from('configuracoes_sistema').delete().eq('chave', CHAVE_CONFIG_PROMPT);
  } catch {
    // Ignora erro se tabela não existir
  }

  removerConfigLocal();
  return { sucesso: true };
}

export interface ContextoPrompt {
  linha: string;
  dicionarioEstacoes: string;
  exemplosHistorico?: string;
  estrategiaLoop?: boolean;
  resumoLoops?: string;
  loopsComNomesCompletos?: string;
  tipoLocalidade?: 'estacao' | 'trecho' | string;
  localidadeInicio?: string;
  localidadeFim?: string;
  via?: string;
  viasPermitidas?: string[];
  elementoAfetado?: string;
  plataformasAfetadas?: string[];
  detalheLocalizacao?: string;
  quemComunicou?: string;
  tremEstacaoInforma?: string;
  paeseAcionado?: boolean;
}

/**
 * Monta as instruções de sistema substituindo placeholders ou anexando contexto dinâmico.
 */
export function montarSystemInstruction(templatePrompt: string, contexto: ContextoPrompt): string {
  let resultado = templatePrompt;

  resultado += contexto.paeseAcionado
    ? '\n\nA informação de acionamento PAESE será incluída automaticamente pelo sistema ao final de cada mensagem. Não repita nem invente informações sobre o PAESE no texto gerado.'
    : '\n\nNão houve acionamento de PAESE para esta ocorrência. Não mencione PAESE nas mensagens.';

  // 1. Placeholder de Linha
  resultado = resultado.replaceAll('{{LINHA}}', contexto.linha.toUpperCase());

  // 2. Garantir presença das Regras Inegociáveis de Malha Ferroviária e Vias
  if (!resultado.includes('REGRAS INEGOCIÁVEIS DE MALHA FERROVIÁRIA E VIAS')) {
    resultado += `\n\n${REGRAS_MALHA_E_VIAS}`;
  }

  // 3. Instruções de Loops
  let instrucaoLoops = '';
  if (contexto.estrategiaLoop && contexto.resumoLoops) {
    instrucaoLoops = `- ESTRATÉGIA DE CIRCULAÇÃO / LOOPS (INSTRUÇÃO CRÍTICA - DEVE SER TOTALMENTE CLARA E TRANSPARENTE):
  * Explique com máxima clareza e didática aos passageiros como a linha está operando no momento.
  * Informe que, devido à ocorrência técnica, os trens estão prestando serviço em trechos parciais (estratégia de loops): ${contexto.loopsComNomesCompletos || contexto.resumoLoops}.
  * Detalhe explicitamente cada trecho de circulação e o intervalo programado previsto para que o usuário planeje o tempo de sua viagem com tranquilidade.
  * Dê orientações práticas e claras de viagem: caso o passageiro precise seguir além da estação final de um loop, explique com clareza que ele deverá realizar o desembarque na estação de transferência para embarcar no próximo trem daquele sentido, e recomende atenção aos avisos sonoros das composições e às orientações dos agentes de estação nas plataformas.`;
  }

  if (resultado.includes('{{LOOPS_ORIENTACOES}}')) {
    resultado = resultado.replaceAll('{{LOOPS_ORIENTACOES}}', instrucaoLoops);
  } else if (instrucaoLoops) {
    resultado += `\n\n${instrucaoLoops}`;
  }

  // 4. Dicionário de Estações
  if (resultado.includes('{{DICIONARIO_ESTACOES}}')) {
    resultado = resultado.replaceAll('{{DICIONARIO_ESTACOES}}', contexto.dicionarioEstacoes);
  } else {
    resultado += `\n\nDICIONÁRIO DE ESTAÇÕES E SIGLAS OFICIAIS:\n${contexto.dicionarioEstacoes}`;
  }

  // 5. Exemplos do Histórico
  const exemplos = contexto.exemplosHistorico || 'Utilize a terminologia padrão de CCO metropolitano.';
  if (resultado.includes('{{EXEMPLOS_HISTORICO}}')) {
    resultado = resultado.replaceAll('{{EXEMPLOS_HISTORICO}}', exemplos);
  } else if (contexto.exemplosHistorico) {
    resultado += `\n\nEXEMPLOS REAIS DO HISTÓRICO DE DESPACHO DA FERROVIA:\n${exemplos}`;
  }

  // 6. Diretriz operacional estrita da ocorrência atual (Injeção de contexto específico de vias)
  const tipoLoc = contexto.tipoLocalidade;
  const viaInformada = contexto.via ? contexto.via.trim() : '';
  const viasPermitidas = Array.isArray(contexto.viasPermitidas) && contexto.viasPermitidas.length > 0
    ? contexto.viasPermitidas
    : [];

  let validacaoOcorrenciaAtual = '';
  if (tipoLoc === 'estacao') {
    const estacao = contexto.localidadeInicio || 'informada';
    if (viaInformada) {
      validacaoOcorrenciaAtual = `VALIDAÇÃO ESTRITA DA OCORRÊNCIA ATUAL (ESTAÇÃO ${estacao.toUpperCase()}):
- Localidade da ocorrência: Estação ${estacao}.
- Via informada no payload: "${viaInformada}".
${viasPermitidas.length > 0 ? `- Vias cadastradas da estação: ${viasPermitidas.join(', ')}.\n` : ''}- REGRA OBRIGATÓRIA: Utilize APENAS a via informada ("${viaInformada}"). NUNCA invente ou mencione qualquer outra via.
- Mensagem de COMUNICAÇÃO: Omita números de via técnicos, comunicando apenas o impacto ao passageiro na estação.`;
    } else {
      validacaoOcorrenciaAtual = `VALIDAÇÃO ESTRITA DA OCORRÊNCIA ATUAL (ESTAÇÃO ${estacao.toUpperCase()}):
- Localidade da ocorrência: Estação ${estacao} (ocorrência no âmbito da estação).
- Nenhuma via foi selecionada no payload.
- REGRA CRÍTICA E INEGOCIÁVEL: NUNCA mencione NENHUM número de via (ex: "via 1", "via 2", "via 4") em NENHUMA das mensagens geradas. Refira-se exclusivamente ao problema no âmbito da estação ou plataforma de embarque.
- Mensagem de COMUNICAÇÃO: Omita termos técnicos e foque na orientação aos passageiros na estação.`;
    }

    // Subsistema e elemento afetado na estação
    if (contexto.elementoAfetado) {
      const rotulos: Record<string, string> = {
        via: 'Via',
        plataforma: 'Plataforma',
        escada_rolante: 'Escada Rolante',
        elevador: 'Elevador',
        linha_bloqueio: 'Linha de Bloqueio (Catracas)',
        acesso_estacao: 'Acesso à Estação',
        geral: 'Geral / Infraestrutura',
      };
      const nomeEl = rotulos[contexto.elementoAfetado] || contexto.elementoAfetado;
      const plats = contexto.plataformasAfetadas && contexto.plataformasAfetadas.length > 0
        ? `Plataforma(s) ${contexto.plataformasAfetadas.join(', ')}`
        : '';
      const det = contexto.detalheLocalizacao ? contexto.detalheLocalizacao.trim() : '';

      validacaoOcorrenciaAtual += `\n
[SUBSISTEMA / ELEMENTO AFETADO NA ESTAÇÃO]:
- Elemento impactado: ${nomeEl}
${plats ? `- Localização vinculada: ${plats}\n` : ''}${det ? `- Detalhes do equipamento/acesso: ${det}\n` : ''}- DIRETRIZES DE REDAÇÃO:
  * Mensagem de COMUNICAÇÃO: Informe com clareza aos passageiros o equipamento, plataforma ou acesso impactado (ex: "Escada rolante de acesso à Plataforma 8 inoperante na Estação Barra Funda", "Interdição temporária da Plataforma 4 em Guaianases", "Linha de bloqueio/catracas com lentidão no Acesso Praça da Sé"). Indique rotas ou opções alternativas (ex: elevadores ou escadas fixas).
  * Mensagem de OPERAÇÃO: Descreva os dados técnicos completos do elemento afetado, plataformas e identificação do acesso para mobilização das equipes.
  * Mensagem de GERÊNCIA: Sintetize o impacto no fluxo de passageiros e previsão de normalização.`;
    }
  } else if (tipoLoc === 'trecho') {
    const trecho = `${contexto.localidadeInicio || ''} <-> ${contexto.localidadeFim || ''}`;
    validacaoOcorrenciaAtual = `VALIDAÇÃO ESTRITA DA OCORRÊNCIA ATUAL (TRECHO ${trecho.toUpperCase()}):
- Linha: ${contexto.linha}.
- Trecho informado: ${trecho}.
- Via(s) informada(s) no payload: ${viaInformada ? `"${viaInformada}"` : 'Nenhuma via específica informada'}.
${viasPermitidas.length > 0 ? `- Vias homologadas para este trecho: ${viasPermitidas.join(', ')}.\n` : ''}- REGRA CRÍTICA E INEGOCIÁVEL: Use APENAS a(s) via(s) explicitamente informada(s) acima. NUNCA mencione ou deduza vias inexistentes neste trecho (ex: proibido citar Via 2 entre BAS e TAT na Linha 11; proibido citar Via 1 ou 3 entre BAS e TAT na Linha 12).
- Mensagem de OPERAÇÃO: Utilize a terminologia técnica correta para o trecho e a via informada (ex: "Circulação em via singela", "Restrição de velocidade").
- Mensagem de COMUNICAÇÃO: Omita números de via técnicos, traduzindo para "maior tempo de parada", "velocidade reduzida" ou "intervalo maior entre trens".`;
  }

  if (validacaoOcorrenciaAtual) {
    resultado += `\n\n${validacaoOcorrenciaAtual.trim()}`;
  }

  return resultado;
}
