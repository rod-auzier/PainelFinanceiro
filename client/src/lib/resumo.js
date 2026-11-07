/**
 * Cálculos PUROS da tela de Resumo — só reaproveitam os dados que a API já devolve
 * (totais do mês e lista de despesas); nada aqui altera regras de cálculo do backend.
 * Funções sem efeito colateral, fáceis de testar.
 */
import { CATEGORIAS_DESPESA, normalizarCategoria } from './constants.js';

/**
 * Agrupa as despesas por categoria, da MAIOR para a MENOR.
 * Categoria fora da lista cai em "Outros". Categorias sem gasto não aparecem.
 *
 * @param   {Array<{ categoria: string, valor: number }>} despesas
 * @returns {Array<{ categoria: string, total: number, percentual: number }>}
 *          `percentual` = fatia (0–100) do TOTAL de despesas.
 */
export function agruparPorCategoria(despesas) {
  const soma = {};
  for (const d of despesas) {
    const cat = normalizarCategoria(d.categoria);
    soma[cat] = (soma[cat] || 0) + Number(d.valor || 0);
  }
  const totalGeral = Object.values(soma).reduce((a, b) => a + b, 0);

  return CATEGORIAS_DESPESA.filter((c) => soma[c] > 0)
    .map((categoria) => ({
      categoria,
      total: soma[categoria],
      percentual: totalGeral > 0 ? (soma[categoria] / totalGeral) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * As `n` maiores despesas (padrão 5), da maior para a menor. Não altera o array recebido.
 * @param {Array<{ valor: number }>} despesas
 * @param {number} [n]
 */
export function maioresDespesas(despesas, n = 5) {
  return [...despesas].sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, n);
}

/**
 * Variação de um valor em relação ao mês anterior.
 * @param   {number} atual
 * @param   {number|null|undefined} anterior  `null`/`undefined` = não há mês anterior para comparar
 * @returns {null | { delta: number, percentual: number|null }}
 *          `null` sem mês anterior. `percentual` é `null` quando o anterior foi 0 (não dá para
 *          calcular %). `delta` = atual − anterior.
 */
export function variacao(atual, anterior) {
  if (anterior == null) return null;
  const delta = atual - anterior;
  return { delta, percentual: anterior !== 0 ? (delta / Math.abs(anterior)) * 100 : null };
}

/**
 * Quanto da receita foi comprometido pelas despesas (para a barra do card principal).
 *
 * @param   {number} receitas
 * @param   {number} despesas
 * @returns {{
 *   situacao: 'vazio' | 'sem-receita' | 'normal',
 *   percentual: number,   // despesas ÷ receitas × 100 (pode passar de 100); 0 se não aplicável
 *   parteDespesas: number, // 0–100: fatia vermelha da barra (despesas, limitada a 100)
 *   parteSobra: number,    // 0–100: fatia verde da barra (o que sobrou)
 *   sobra: number,         // receitas − despesas (negativo = faltou)
 * }}
 *   - 'vazio'       → sem receitas e sem despesas (nada a mostrar);
 *   - 'sem-receita' → há despesas mas nenhuma receita (barra toda vermelha);
 *   - 'normal'      → há receita.
 */
export function comprometimento(receitas, despesas) {
  const sobra = receitas - despesas;
  if (receitas <= 0 && despesas <= 0) {
    return { situacao: 'vazio', percentual: 0, parteDespesas: 0, parteSobra: 0, sobra };
  }
  if (receitas <= 0) {
    return { situacao: 'sem-receita', percentual: 0, parteDespesas: 100, parteSobra: 0, sobra };
  }
  const percentual = (despesas / receitas) * 100;
  const parteDespesas = Math.min(percentual, 100);
  return { situacao: 'normal', percentual, parteDespesas, parteSobra: 100 - parteDespesas, sobra };
}
