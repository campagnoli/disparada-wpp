import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { finalizarMensagemComAssinaturaSCO, incluirSCO, normalizarSCO } from '@/lib/mensagens';
import { isClassificacaoOcorrencia, isTipoIN } from '@/lib/classificacao-ocorrencia';
import { aplicarEncerramentoNaMensagem, incluirDetalhesEncerramento } from '@/lib/mensagem-templates-pure';
import { obterTemplatesMensagemAtivos } from '@/lib/mensagem-templates';
import { normalizarImpactoOutraLinha } from '@/lib/impacto-outra-linha';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function isModalidadePaese(value: unknown): value is 'SPTrans' | 'ARTESP' | 'Trilhos' {
	return typeof value === 'string' && ['SPTrans', 'ARTESP', 'Trilhos'].some((item) => item === value);
}

function occurrenceInsertError(error: { code?: string; message: string }) {
	console.error('Falha ao registrar ocorrência no Supabase:', {
		code: error.code,
		message: error.message,
	});

	if (error.code === 'PGRST202' || error.code === '42883') {
		return NextResponse.json(
			{
				error: 'O banco de dados está desatualizado: a função de gravação da ocorrência não foi encontrada. Acione a equipe técnica para atualizar o sistema.',
			},
			{ status: 503 }
		);
	}

	if (error.code === 'PGRST204' || error.code === '42703') {
		return NextResponse.json(
			{
				error: 'O banco de dados está desatualizado e não contém todos os campos da ocorrência. Acione a equipe técnica para atualizar o sistema.',
			},
			{ status: 503 }
		);
	}

	if (error.code === '42501') {
		return NextResponse.json(
			{ error: 'O banco de dados recusou a gravação por falta de permissão. Acione a equipe técnica para verificar as permissões.' },
			{ status: 503 }
		);
	}

	return NextResponse.json(
		{
			error: `Não foi possível registrar a ocorrência no banco de dados${error.code ? ` (código ${error.code})` : ''}.`,
		},
		{ status: 500 }
	);
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const codigoEvento = getText(url.searchParams.get('codigo_evento')).toUpperCase();

	if (codigoEvento) {
		const { data, error } = await supabase
			.from('ocorrencias')
			.select('id, codigo_evento, created_at, linha, via, localidade, id_trem, prefixo_viagem, classificacoes, tipo_in, paese_acionado, paese_modalidades, paese_trecho, tem_impacto_outra_linha, linhas_impactadas_secundarias, descricao_impacto_secundario, falha, hora_inicio, hora_fim, status, entregue_com_restricao, descricao_restricao, relatar_atuacao, descricao_atuacao, msg_comunicacao, msg_operacao, msg_gerencia')
			.eq('codigo_evento', codigoEvento)
			.maybeSingle();

		if (error) {
			console.error('Falha ao pesquisar ocorrência:', error.message);
			return NextResponse.json({ error: 'Não foi possível pesquisar a ocorrência.' }, { status: 500 });
		}

		if (!data) return NextResponse.json({ error: 'Nenhuma ocorrência encontrada para esse ID.' }, { status: 404 });

		return NextResponse.json({ ocorrencia: data });
	}

	const requestedPage = Number(url.searchParams.get('page') ?? 1);
	const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
	const pageSize = 10;
	const from = (page - 1) * pageSize;
	const { data, count, error } = await supabase
		.from('ocorrencias')
		.select('id, codigo_evento, created_at, linha, via, localidade, id_trem, prefixo_viagem, classificacoes, tipo_in, paese_acionado, paese_modalidades, paese_trecho, tem_impacto_outra_linha, linhas_impactadas_secundarias, descricao_impacto_secundario, falha, hora_inicio, hora_fim, status, entregue_com_restricao, descricao_restricao, relatar_atuacao, descricao_atuacao', { count: 'exact' })
		.order('created_at', { ascending: false })
		.range(from, from + pageSize - 1);

	if (error) {
		console.error('Falha ao carregar histórico de ocorrências:', error.message);
		return NextResponse.json({ error: 'Não foi possível carregar o histórico.' }, { status: 500 });
	}

	return NextResponse.json({ items: data ?? [], total: count ?? 0, page, pageSize });
}

export async function POST(request: Request) {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json({ error: 'Dados da ocorrência inválidos.' }, { status: 400 });
	}

	const linha = getText(body.linha);
	const impactoOutraLinha = normalizarImpactoOutraLinha(
		body.temImpactoOutraLinha,
		body.linhasImpactadasSecundarias,
		body.descricaoImpactoSecundario,
		linha,
	);
	if (!impactoOutraLinha) {
		return NextResponse.json(
			{ error: 'Informe linhas secundárias diferentes da linha principal e descreva o impacto quando houver reflexo em outra linha (até 5000 caracteres).' },
			{ status: 400 }
		);
	}
	const tipoLocalidade = getText(body.tipoLocalidade);
	const viaInformada = getText(body.via);
	const via = viaInformada || (tipoLocalidade === 'estacao' ? 'Não aplicável' : '');
	const localidadeInicio = getText(body.localidadeInicio);
	const localidadeFim = getText(body.localidadeFim);
	const idTrem = getText(body.idTrem);
	const prefixoViagem = getText(body.prefixoViagem);
	const classificacoesRecebidas = Array.isArray(body.classificacoes) ? body.classificacoes : [];
	const classificacoes = classificacoesRecebidas.filter(isClassificacaoOcorrencia);
	const tipoIN = getText(body.tipoIN);
	const inSelecionada = classificacoes.includes('IN');
	const paeseAcionado = body.paeseAcionado === true;
	const paeseModalidadesRecebidas = Array.isArray(body.paeseModalidades) ? body.paeseModalidades : [];
	const paeseModalidades = paeseAcionado
		? paeseModalidadesRecebidas.filter(isModalidadePaese)
		: [];
	const paeseTrecho = paeseAcionado ? getText(body.paeseTrecho).replace(/\s+/g, ' ') : '';
	const paeseModalidadesValidas = paeseModalidades.length === paeseModalidadesRecebidas.length
		&& new Set(paeseModalidades).size === paeseModalidades.length;
	const localidade = tipoLocalidade === 'estacao'
		? localidadeInicio
		: tipoLocalidade === 'trecho' && localidadeInicio && localidadeFim
			? `${localidadeInicio} - ${localidadeFim}`
			: '';
	const falhas = Array.isArray(body.falhas)
		? body.falhas.flatMap((item) => {
			if (!isRecord(item)) return [];
			const descricao = getText(item.descricao);
			const impacto = getText(item.impacto);
			return descricao && impacto && descricao.length <= 5000 && impacto.length <= 5000
				? [{ descricao, impacto }]
				: [];
		})
		: [];
	const falha = falhas.map((item) => item.descricao).join('; ');
	const impacto = falhas.map((item) => item.impacto).join('\n');
	const horaInicio = getText(body.horaInicio) || getText(body.hora_inicio);
	const sco = normalizarSCO(body.sco ?? body.informante);
	const mensagens = isRecord(body.mensagens) ? body.mensagens : body;
	const comunicacao = incluirSCO(getText(mensagens.comunicacao) || getText(body.msg_comunicacao), sco);
	const operacao = incluirSCO(getText(mensagens.operacao) || getText(body.msg_operacao), sco);
	const gerencia = incluirSCO(getText(mensagens.gerencia) || getText(body.msg_gerencia), sco);

	if (
		(body.paeseAcionado !== undefined && typeof body.paeseAcionado !== 'boolean')
		|| !paeseModalidadesValidas
		|| (paeseAcionado && (!paeseModalidades.length || !paeseTrecho || paeseTrecho.length > 200))
	) {
		return NextResponse.json(
			{ error: 'Se houver acionamento de PAESE, selecione um ou mais tipos válidos e informe o trecho atendido (até 200 caracteres).' },
			{ status: 400 }
		);
	}

	if (
		!linha
		|| (tipoLocalidade === 'trecho' && !viaInformada)
		|| !localidade
		|| (tipoLocalidade === 'trecho' && localidadeInicio === localidadeFim)
		|| idTrem.length > 100
		|| prefixoViagem.length > 100
		|| classificacoes.length !== classificacoesRecebidas.length
		|| new Set(classificacoes).size !== classificacoes.length
		|| (inSelecionada ? !isTipoIN(tipoIN) : tipoIN !== '')
		|| !falhas.length
		|| falhas.length !== (Array.isArray(body.falhas) ? body.falhas.length : 0)
		|| !horaInicio
		|| !sco
		|| sco.length > 150
		|| !comunicacao
		|| !operacao
		|| !gerencia
	) {
		return NextResponse.json(
			{ error: 'Preencha os dados obrigatórios (incluindo via obrigatória para trechos entre estações), gere as três mensagens e confira as classificações selecionadas.' },
			{ status: 400 }
		);
	}

	try {
		const { data, error } = await supabase.rpc('registrar_ocorrencia', {
			p_linha: linha,
			p_via: via,
			p_localidade: localidade,
			p_id_trem: idTrem || null,
			p_prefixo_viagem: prefixoViagem || null,
			p_falha: falha,
			p_hora_inicio: horaInicio,
			p_impacto: impacto || null,
			p_classificacoes: classificacoes,
			p_tipo_in: inSelecionada ? tipoIN : null,
			p_msg_comunicacao: comunicacao,
			p_msg_operacao: operacao,
			p_msg_gerencia: gerencia,
			p_paese_acionado: paeseAcionado,
			p_paese_modalidades: paeseModalidades,
			p_paese_trecho: paeseTrecho || null,
			p_tem_impacto_outra_linha: impactoOutraLinha.temImpactoOutraLinha,
			p_linhas_impactadas_secundarias: impactoOutraLinha.linhasImpactadasSecundarias,
			p_descricao_impacto_secundario: impactoOutraLinha.descricaoImpactoSecundario || null,
		});

		if (error) {
			return occurrenceInsertError(error);
		}

		return NextResponse.json({ ocorrencia: data }, { status: 201 });
	} catch (error: unknown) {
		console.error('Erro inesperado ao registrar ocorrência:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha inesperada ao registrar ocorrência no banco de dados.' },
			{ status: 500 }
		);
	}
}

export async function PATCH(request: Request) {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json({ error: 'Dados para atualização inválidos.' }, { status: 400 });
	}

	const codigoEvento = getText(body.codigo_evento).toUpperCase();
	const horaFim = getText(body.hora_fim);

	if (!codigoEvento) {
		return NextResponse.json({ error: 'Informe o ID do evento.' }, { status: 400 });
	}

	if (horaFim && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFim)) {
		return NextResponse.json({ error: 'Informe um horário fim válido no formato HH:MM.' }, { status: 400 });
	}
	for (const campo of ['entregue_com_restricao', 'relatar_atuacao'] as const) {
		if (body[campo] !== undefined && typeof body[campo] !== 'boolean') {
			return NextResponse.json({ error: 'As respostas sobre restrição e atuação devem ser verdadeiras ou falsas.' }, { status: 400 });
		}
	}
	if (
		(body.descricao_restricao !== undefined && typeof body.descricao_restricao !== 'string')
		|| (body.descricao_atuacao !== undefined && typeof body.descricao_atuacao !== 'string')
	) {
		return NextResponse.json({ error: 'As descrições de encerramento devem ser textos.' }, { status: 400 });
	}
	const descricaoRestricaoRecebida = body.descricao_restricao === undefined
		? undefined
		: getText(body.descricao_restricao);
	const descricaoAtuacaoRecebida = body.descricao_atuacao === undefined
		? undefined
		: getText(body.descricao_atuacao);
	if (
		(descricaoRestricaoRecebida !== undefined && descricaoRestricaoRecebida.length > 5000)
		|| (descricaoAtuacaoRecebida !== undefined && descricaoAtuacaoRecebida.length > 5000)
	) {
		return NextResponse.json({ error: 'As descrições de encerramento devem ter até 5000 caracteres.' }, { status: 400 });
	}

	try {
		const { data: atual, error: buscaError } = await supabase
			.from('ocorrencias')
			.select('linha, hora_inicio, tem_impacto_outra_linha, linhas_impactadas_secundarias, descricao_impacto_secundario, entregue_com_restricao, descricao_restricao, relatar_atuacao, descricao_atuacao, msg_comunicacao, msg_operacao, msg_gerencia')
			.eq('codigo_evento', codigoEvento)
			.maybeSingle();

		if (buscaError) {
			console.error('Falha ao carregar mensagens da ocorrência:', buscaError.message);
			return NextResponse.json({ error: 'Não foi possível carregar a ocorrência.' }, { status: 500 });
		}

		if (!atual) return NextResponse.json({ error: 'Nenhuma ocorrência encontrada para esse ID.' }, { status: 404 });

		const textoComunicacao = getText(body.msg_comunicacao) || atual.msg_comunicacao;
		const textoOperacao = getText(body.msg_operacao) || atual.msg_operacao;
		const textoGerencia = getText(body.msg_gerencia) || atual.msg_gerencia;
		const { templates } = await obterTemplatesMensagemAtivos();
		const linha = getText(atual.linha) || 'LINHA NÃO INFORMADA';
		const impactoOutraLinha = {
			temImpactoOutraLinha: atual.tem_impacto_outra_linha,
			linhaSecundariaAfetada: atual.linhas_impactadas_secundarias.join(', '),
			impactoSecundario: atual.descricao_impacto_secundario ?? '',
		};
		const entregueComRestricao = body.entregue_com_restricao === undefined
			? atual.entregue_com_restricao
			: body.entregue_com_restricao === true;
		const descricaoRestricao = entregueComRestricao
			? descricaoRestricaoRecebida ?? atual.descricao_restricao ?? ''
			: '';
		const relatarAtuacao = body.relatar_atuacao === undefined
			? atual.relatar_atuacao
			: body.relatar_atuacao === true;
		const descricaoAtuacao = relatarAtuacao
			? descricaoAtuacaoRecebida ?? atual.descricao_atuacao ?? ''
			: '';
		if (horaFim && entregueComRestricao && !descricaoRestricao) {
			return NextResponse.json({ error: 'Informe a descrição da restrição antes de encerrar a ocorrência.' }, { status: 400 });
		}
		if (horaFim && relatarAtuacao && !descricaoAtuacao) {
			return NextResponse.json({ error: 'Informe a atuação realizada antes de encerrar a ocorrência.' }, { status: 400 });
		}
		const detalhesEncerramento = {
			entregueComRestricao,
			descricaoRestricao,
			relatarAtuacao,
			descricaoAtuacao,
		};

		const msgComunicacao = horaFim
			? incluirDetalhesEncerramento(aplicarEncerramentoNaMensagem(textoComunicacao, horaFim, atual.hora_inicio, templates.encerramento.comunicacao, `INFORME CCO - ${linha}`, impactoOutraLinha), detalhesEncerramento)
			: textoComunicacao;
		const msgOperacao = horaFim
			? incluirDetalhesEncerramento(aplicarEncerramentoNaMensagem(textoOperacao, horaFim, atual.hora_inicio, templates.encerramento.operacao, `DESPACHO CCO - ${linha}`, impactoOutraLinha), detalhesEncerramento)
			: textoOperacao;
		const msgGerencia = horaFim
			? incluirDetalhesEncerramento(aplicarEncerramentoNaMensagem(textoGerencia, horaFim, atual.hora_inicio, templates.encerramento.gerencia, `INFORME EXECUTIVO CCO - ${linha}`, impactoOutraLinha), detalhesEncerramento)
			: textoGerencia;
		const comunicacaoFinal = finalizarMensagemComAssinaturaSCO(msgComunicacao);
		const operacaoFinal = finalizarMensagemComAssinaturaSCO(msgOperacao);
		const gerenciaFinal = finalizarMensagemComAssinaturaSCO(msgGerencia);

		const updatePayload: Record<string, unknown> = {
			msg_comunicacao: comunicacaoFinal,
			msg_operacao: operacaoFinal,
			msg_gerencia: gerenciaFinal,
		};

		if (horaFim) {
			updatePayload.hora_fim = horaFim;
			updatePayload.status = 'encerrada';
			updatePayload.entregue_com_restricao = entregueComRestricao;
			updatePayload.descricao_restricao = descricaoRestricao || null;
			updatePayload.relatar_atuacao = relatarAtuacao;
			updatePayload.descricao_atuacao = descricaoAtuacao || null;
		}

		const { data, error } = await supabase
			.from('ocorrencias')
			.update(updatePayload)
			.eq('codigo_evento', codigoEvento)
			.select('id, codigo_evento, created_at, linha, via, localidade, id_trem, prefixo_viagem, classificacoes, tipo_in, paese_acionado, paese_modalidades, paese_trecho, tem_impacto_outra_linha, linhas_impactadas_secundarias, descricao_impacto_secundario, falha, hora_inicio, hora_fim, status, entregue_com_restricao, descricao_restricao, relatar_atuacao, descricao_atuacao, msg_comunicacao, msg_operacao, msg_gerencia')
			.single();

		if (error) {
			console.error('Falha ao atualizar ocorrência no Supabase:', error.message);
			return NextResponse.json({ error: 'Não foi possível atualizar a ocorrência.' }, { status: 500 });
		}

		return NextResponse.json({ ocorrencia: data });
	} catch (error: unknown) {
		console.error('Erro inesperado ao atualizar ocorrência:', error);
		return NextResponse.json({ error: 'Não foi possível atualizar a ocorrência.' }, { status: 500 });
	}
}

interface OcorrenciaExcluida {
	codigo_evento: string | null;
	linha: string | null;
	localidade: string | null;
	hora_inicio: string | null;
	falha: string | null;
	created_at: string | null;
}

interface ResultadoLimpezaOperacional {
	excluidas: number;
	falhou: boolean;
}

function localCompativel(localOperacional: unknown, localTradicional: unknown): boolean {
	const operacional = typeof localOperacional === 'string' ? localOperacional.trim() : '';
	const tradicional = typeof localTradicional === 'string' ? localTradicional.trim() : '';
	if (!operacional || !tradicional) return false;
	return tradicional === operacional || tradicional.startsWith(`${operacional} - `);
}

/**
 * Remove os registros de Ocorrências Operacionais vinculados às ocorrências
 * tradicionais excluídas. O vínculo por codigo_evento cobre os registros novos;
 * o fallback por linha/horário/descritivo/local cobre os registros antigos,
 * criados antes da coluna codigo_evento.
 */
async function excluirOperacionaisVinculadas(
	admin: ReturnType<typeof createSupabaseAdminClient>,
	alvos: OcorrenciaExcluida[],
): Promise<ResultadoLimpezaOperacional> {
	const ids = new Set<string>();
	let falhou = false;

	const codigos = [...new Set(
		alvos
			.map((item) => item.codigo_evento)
			.filter((codigo): codigo is string => Boolean(codigo)),
	)];

	if (codigos.length > 0) {
		const { data, error } = await admin
			.from('ocorrencias_operacionais')
			.select('id')
			.in('codigo_evento', codigos);

		if (error) {
			// A coluna pode não existir em ambientes que ainda não aplicaram a migration 005.
			if (error.code !== 'PGRST204' && error.code !== '42703') {
				console.error('Falha ao buscar ocorrências operacionais vinculadas:', error.message);
				falhou = true;
			}
		} else {
			for (const item of data ?? []) {
				if (item.id) ids.add(String(item.id));
			}
		}
	}

	const linhas = [...new Set(alvos.map((item) => item.linha).filter((valor): valor is string => Boolean(valor)))];
	const horarios = [...new Set(alvos.map((item) => item.hora_inicio).filter((valor): valor is string => Boolean(valor)))];
	const descritivos = [...new Set(alvos.map((item) => item.falha).filter((valor): valor is string => Boolean(valor)))];

	if (linhas.length > 0 && horarios.length > 0 && descritivos.length > 0) {
		const { data, error } = await admin
			.from('ocorrencias_operacionais')
			.select('id, linha, local, horario, descritivo')
			.in('linha', linhas)
			.in('horario', horarios)
			.in('descritivo', descritivos);

		if (error) {
			console.error('Falha ao buscar ocorrências operacionais legadas:', error.message);
			falhou = true;
		} else {
			for (const operacional of data ?? []) {
				const corresponde = alvos.some((alvo) =>
					alvo.linha === operacional.linha
					&& alvo.hora_inicio === operacional.horario
					&& alvo.falha === operacional.descritivo
					&& localCompativel(operacional.local, alvo.localidade),
				);
				if (corresponde) ids.add(String(operacional.id));
			}
		}
	}

	if (ids.size === 0) return { excluidas: 0, falhou };

	const { data, error } = await admin
		.from('ocorrencias_operacionais')
		.delete()
		.in('id', [...ids])
		.select('id');

	if (error) {
		console.error('Falha ao excluir ocorrências operacionais vinculadas:', error.message);
		return { excluidas: 0, falhou: true };
	}

	return { excluidas: data?.length ?? 0, falhou };
}

export async function DELETE(request: Request) {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json({ error: 'Dados inválidos para exclusão.' }, { status: 400 });
	}

	const { codigos_evento } = body;

	if (!Array.isArray(codigos_evento) || codigos_evento.length === 0) {
		return NextResponse.json(
			{ error: 'Informe ao menos um ID de evento para exclusão.' },
			{ status: 400 }
		);
	}

	const codigosLimpos = codigos_evento
		.map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : ''))
		.filter(Boolean);

	if (codigosLimpos.length === 0) {
		return NextResponse.json(
			{ error: 'Nenhum ID de evento válido informado.' },
			{ status: 400 }
		);
	}

	try {
		const admin = createSupabaseAdminClient();
		const { data: excluidas, error } = await admin
			.from('ocorrencias')
			.delete()
			.in('codigo_evento', codigosLimpos)
			.select('codigo_evento, linha, localidade, hora_inicio, falha, created_at');

		if (error) {
			console.error('Falha ao excluir ocorrências:', error.message);
			return NextResponse.json(
				{ error: 'Não foi possível excluir as ocorrências.' },
				{ status: 500 }
			);
		}

		const registrosExcluidos = (excluidas ?? []) as OcorrenciaExcluida[];
		const codigosExcluidos = registrosExcluidos
			.map((item) => item.codigo_evento)
			.filter((codigo): codigo is string => Boolean(codigo));

		if (codigosExcluidos.length === 0) {
			return NextResponse.json(
				{ error: 'Nenhuma ocorrência encontrada com os IDs informados.' },
				{ status: 404 }
			);
		}

		const limpezaOperacional = await excluirOperacionaisVinculadas(admin, registrosExcluidos);

		return NextResponse.json({
			sucesso: true,
			excluidas: codigosExcluidos.length,
			operacionais_excluidas: limpezaOperacional.excluidas,
			codigos: codigosExcluidos,
			...(limpezaOperacional.falhou
				? { aviso: 'As ocorrências foram excluídas, mas não foi possível limpar todos os registros de Ocorrências Operacionais vinculados.' }
				: {}),
		});
	} catch (error: unknown) {
		console.error('Erro inesperado ao excluir ocorrências:', error);
		return NextResponse.json(
			{ error: 'Falha inesperada ao excluir ocorrências.' },
			{ status: 500 }
		);
	}
}
