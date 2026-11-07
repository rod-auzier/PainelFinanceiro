/**
 * Helpers de MÊS ("AAAA-MM") usados pelo seletor de mês e pelas telas.
 * O mês de um lançamento é o mês do seu `createdAt` (ver server/src/utils/mes.js).
 */

const doisDigitos = (n) => String(n).padStart(2, '0');

/** Mês de hoje no formato "AAAA-MM" (horário local do navegador). */
export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
}

/** Soma `delta` meses (pode ser negativo) a um "AAAA-MM". */
export function deslocarMes(mes, delta) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
}

/** Rótulo legível: "2026-11" → "novembro de 2026". */
export function rotuloMes(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Mensagem amigável após "Copiar fixos do mês anterior".
 * @param {{ copiadas:number, ignoradas:number, mesOrigem:string, fixosNaOrigem:number }} r  resposta da API
 */
export function mensagemCopiaFixos(r) {
  const origem = rotuloMes(r.mesOrigem);
  if (r.fixosNaOrigem === 0) {
    return `Não há lançamentos fixos em ${origem} para copiar. Marque "Repete todo mês" nos que se repetem.`;
  }
  if (r.copiadas === 0) {
    return `Nada para copiar: os ${r.fixosNaOrigem} fixos de ${origem} já estão neste mês.`;
  }
  const copiados = `${r.copiadas} ${r.copiadas === 1 ? 'lançamento fixo copiado' : 'lançamentos fixos copiados'} de ${origem}`;
  const puladas = r.ignoradas > 0 ? `; ${r.ignoradas} já existia${r.ignoradas === 1 ? '' : 'm'} e não ${r.ignoradas === 1 ? 'foi duplicado' : 'foram duplicados'}` : '';
  return `${copiados}${puladas}.`;
}
