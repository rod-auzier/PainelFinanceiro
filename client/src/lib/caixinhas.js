/**
 * Funções PURAS das caixinhas (aba Porquinho) — sem rede nem estado, fáceis de testar.
 */
import { PALETA_CORES } from './constants.js';

/** Limites (os mesmos do servidor, que valida de novo). */
export const NOME_CAIXINHA_MIN = 2;
export const NOME_CAIXINHA_MAX = 30;

/**
 * Cor de cada caixinha, pela ORDEM DE CRIAÇÃO (índice na lista que a API devolve): assim a cor de
 * uma caixinha não muda quando os valores mudam e a ordem de exibição (maior → menor) se altera.
 * Usa a mesma paleta das categorias — tons discretos, distinguíveis, sem verde/vermelho puros.
 * Com mais caixinhas que cores, a paleta recomeça.
 *
 * @param   {Array<{ _id: string }>} caixinhas  na ordem de criação
 * @returns {Map<string, string>} _id → cor "#RRGGBB"
 */
export function coresDasCaixinhas(caixinhas) {
  return new Map(caixinhas.map((c, i) => [c._id, PALETA_CORES[i % PALETA_CORES.length]]));
}

/** Soma dos valores (arredondada em centavos). */
export function somarCaixinhas(caixinhas) {
  return Math.round(caixinhas.reduce((s, c) => s + Number(c.valor || 0), 0) * 100) / 100;
}

/** Da MAIOR para a MENOR (empate: a mais antiga primeiro). Não altera o array recebido. */
export function ordenarCaixinhas(caixinhas) {
  return caixinhas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Number(b.c.valor) - Number(a.c.valor) || a.i - b.i)
    .map(({ c }) => c);
}

/** "37%" / "<1%" a partir de um percentual 0–100. */
export const rotuloPercentual = (p) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`);

/**
 * Valida o que foi digitado no formulário (mesma regra do servidor).
 * @param   {string} nome
 * @param   {string} valorTexto  conteúdo do campo de valor
 * @returns {{ erro: string } | { nome: string, valor: number }}
 */
export function validarCaixinha(nome, valorTexto) {
  const n = String(nome ?? '').trim();
  if (n.length < NOME_CAIXINHA_MIN || n.length > NOME_CAIXINHA_MAX) {
    return { erro: `O nome deve ter de ${NOME_CAIXINHA_MIN} a ${NOME_CAIXINHA_MAX} caracteres.` };
  }
  const valor = Number(String(valorTexto ?? '').replace(',', '.'));
  if (String(valorTexto ?? '').trim() === '' || !Number.isFinite(valor) || valor < 0) {
    return { erro: 'Informe um valor maior ou igual a zero.' };
  }
  return { nome: n, valor: Math.round(valor * 100) / 100 };
}
