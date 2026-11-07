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
  'Transporte',
  'Saúde',
  'Lazer',
  'Outros',
];

/**
 * COR DE CADA CATEGORIA — a mesma em TODO o app (bolinhas na lista de Despesas, rosca e
 * lista do Resumo, "Maiores despesas").
 *
 * Paleta pensada para o fundo escuro (--color-bg, #0A0C0F): seis matizes bem separados entre si
 * (azul, laranja, lima, rosa, violeta, cinza) e com bom contraste. De propósito NÃO usa o
 * verde (#3ECF8E) nem o vermelho (#E2604A) do tema — esses dois têm significado fixo
 * (receita/superávit e despesa/déficit) e numa rosca de despesas confundiriam.
 */
export const COR_CATEGORIA = {
  Utilidades: '#5B9BD5', // azul
  Alimentação: '#F29B62', // laranja
  Transporte: '#C6D655', // lima
  Saúde: '#F06EAA', // rosa
  Lazer: '#A78BFA', // violeta
  Outros: '#8B95A1', // cinza neutro (cor de DADOS, fixa; não acompanha o texto secundário do tema)
};

/** Categoria "oficial" de um valor qualquer: se não estiver na lista, cai em "Outros". */
export function normalizarCategoria(categoria) {
  return CATEGORIAS_DESPESA.includes(categoria) ? categoria : 'Outros';
}

/** Cor fixa de uma categoria (categoria desconhecida usa a cor de "Outros"). */
export function corDaCategoria(categoria) {
  return COR_CATEGORIA[normalizarCategoria(categoria)];
}
