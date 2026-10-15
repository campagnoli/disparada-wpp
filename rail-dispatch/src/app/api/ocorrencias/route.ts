import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { incluirSCO, normalizarSCO } from '@/lib/mensagens';
import { isClassificacaoOcorrencia, isTipoIN } from '@/lib/classificacao-ocorrencia';
import { aplicarEncerramentoNaMensagem } from '@/lib/mensagem-templates-pure';

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
				error: 'O banco Supabase está desatualizado: a função de gravação da ocorrência não foi encontrada. Execute as migrações 202610130004_occurrence_classification_and_train_fields.sql e 202610150006_paese_activation.sql no Supabase.',
			},
			{ status: 503 }
		);
	}

	if (error.code === 'PGRST204' || error.code === '42703') {
		return NextResponse.json(
			{
				error: 'O esquema do banco Supabase está desatualizado e não contém todos os campos da ocorrência. Execute a migração 202610150006_paese_activation.sql no Supabase.',
			},
			{ status: 503 }
		);
	}

	if (error.code === '42501') {
		return NextResponse.json(
			{ error: 'O Supabase recusou a gravação por falta de permissão. Verifique as permissões da função registrar_ocorrencia.' },
			{ status: 503 }
		);
	}

	return NextResponse.json(
		{
			error: `Não foi possível registrar a ocorrência no Supabase${error.code ? ` (código ${error.code})` : ''}.`,
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
			.select('id, codigo_evento, created_at, linha, via, localidade, id_trem, prefixo_viagem, classificacoes, tipo_in, paese_acionado, paese_modalidades, paese_trecho, falha, hora_inicio, hora_fim, status, msg_comunicacao, msg_operacao, msg_gerencia')
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
		.select('id, codigo_evento, created_at, linha, via, localidade, id_trem, prefixo_viagem, classificacoes, tipo_in, paese_acionado, paese_modalidades, paese_trecho, falha, hora_inicio, hora_fim, status', { count: 'exact' })
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
		});

		if (error) {
			return occurrenceInsertError(error);
		}

		return NextResponse.json({ ocorrencia: data }, { status: 201 });
	} catch (error: unknown) {
		console.error('Erro inesperado ao registrar ocorrência:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha inesperada ao registrar ocorrência no Supabase.' },
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

	try {
		const { data: atual, error: buscaError } = await supabase
			.from('ocorrencias')
			.select('hora_inicio, msg_comunicacao, msg_operacao, msg_gerencia')
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

		const msgComunicacao = horaFim
			? aplicarEncerramentoNaMensagem(textoComunicacao, horaFim, atual.hora_inicio)
			: textoComunicacao;
		const msgOperacao = horaFim
			? aplicarEncerramentoNaMensagem(textoOperacao, horaFim, atual.hora_inicio)
			: textoOperacao;
		const msgGerencia = horaFim
			? aplicarEncerramentoNaMensagem(textoGerencia, horaFim, atual.hora_inicio)
			: textoGerencia;

		const updatePayload: Record<string, unknown> = {
			msg_comunicacao: msgComunicacao,
			msg_operacao: msgOperacao,
			msg_gerencia: msgGerencia,
		};

		if (horaFim) {
			updatePayload.hora_fim = horaFim;
			updatePayload.status = 'encerrada';
		}

		const { data, error } = await supabase
			.from('ocorrencias')
			.update(updatePayload)
			.eq('codigo_evento', codigoEvento)
			.select('id, codigo_evento, created_at, linha, via, localidade, id_trem, prefixo_viagem, classificacoes, tipo_in, paese_acionado, paese_modalidades, paese_trecho, falha, hora_inicio, hora_fim, status, msg_comunicacao, msg_operacao, msg_gerencia')
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
