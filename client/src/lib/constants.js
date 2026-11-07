/**
 * Constantes compartilhadas do domínio.
 */

/**
 * Categorias válidas para uma Despesa (usadas no <select> do formulário,
 * na lista de Despesas e na rosca de "Despesas por categoria" do Resumo).
 */
export const CATEGORIAS_DESPESA = [
  'Utilidades',
  'Alimentação',
  'Saúde',
  'Lazer',
  'Outros',
];

/**
 * COR DE CADA CATEGORIA — ÚNICO mapa de cores de categoria do app. Quem precisa da cor chama
 * `corDaCategoria()` (abaixo): bolinhas da lista de Despesas, rosca e legenda do Resumo e
 * "Maiores despesas". Para mudar uma cor, edite SÓ aqui.
 *
 * Paleta "azuis escuros": quatro tons de azul (do mais claro ao mais escuro) + cinzas
 * azulados. De propósito NÃO usa o verde (#3ECF8E) nem o vermelho (#E2604A) do tema — esses
 * dois têm significado fixo (receita/superávit e despesa/déficit) e numa rosca de despesas
 * confundiriam. Como os azuis são parecidos entre si, a rosca compensa com um vão de 2px
 * entre as fatias na cor do card e com destaque ao passar o mouse/tocar (ver CategoriasDonut).
 */
export const COR_CATEGORIA = {
  Utilidades: '#3F78B0', // azul médio
  Saúde: '#356A9C', // azul
  Alimentação: '#2B5A86', // azul escuro
  Outros: '#234A70', // azul mais escuro
  Lazer: '#6B7682', // cinza azulado
};

/** Cor usada para qualquer categoria nova/desconhecida (a mesma de "Lazer"). */
export const COR_CATEGORIA_PADRAO = '#6B7682';

/** Categoria "oficial" de um valor qualquer: se não estiver na lista, cai em "Outros". */
export function normalizarCategoria(categoria) {
  return CATEGORIAS_DESPESA.includes(categoria) ? categoria : 'Outros';
}

/** Cor fixa de uma categoria; categoria desconhecida usa COR_CATEGORIA_PADRAO. */
export function corDaCategoria(categoria) {
  return COR_CATEGORIA[categoria] ?? COR_CATEGORIA_PADRAO;
}
