export function normalizarInformante(valor: unknown): string {
  if (typeof valor !== 'string') return '';

  return valor.trim().replace(/^#+\s*/, '').replace(/\s+/g, ' ');
}

export function incluirInformante(mensagem: string, informante: string): string {
  const assinatura = `Responsável: ${informante}`;
  const linhas = mensagem.trimEnd().split(/\r?\n/);

  while (linhas.length > 0) {
    const ultimaLinha = linhas[linhas.length - 1].trim().toLocaleLowerCase('pt-BR');
    const nome = informante.toLocaleLowerCase('pt-BR');

    if (ultimaLinha !== `#${nome}` && ultimaLinha !== `responsável: ${nome}`) break;
    linhas.pop();
  }

  const mensagemBase = linhas.join('\n').trimEnd();
  return mensagemBase ? `${mensagemBase}\n${assinatura}` : assinatura;
}
