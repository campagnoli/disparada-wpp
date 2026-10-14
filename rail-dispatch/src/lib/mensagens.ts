export function normalizarSCO(valor: unknown): string {
  if (typeof valor !== 'string') return '';

  return valor.trim().replace(/^#+\s*/, '').replace(/\s+/g, ' ');
}

export function incluirSCO(mensagem: string, sco: string): string {
  const assinatura = `SCO: ${sco}`;
  const linhas = mensagem.trimEnd().split(/\r?\n/);

  while (linhas.length > 0) {
    const ultimaLinha = linhas[linhas.length - 1].trim().toLocaleLowerCase('pt-BR');
    const nome = sco.toLocaleLowerCase('pt-BR');

    if (
      ultimaLinha !== `#${nome}`
      && ultimaLinha !== `sco: ${nome}`
      && ultimaLinha !== `responsável: ${nome}`
    ) break;
    linhas.pop();
  }

  const mensagemBase = linhas.join('\n').trimEnd();
  return mensagemBase ? `${mensagemBase}\n${assinatura}` : assinatura;
}
