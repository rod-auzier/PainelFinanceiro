/**
 * Constantes e funções puras das CATEGORIAS de despesa.
 *
 * As categorias agora são PERSONALIZADAS (cada usuário cria, renomeia, recolore e exclui as suas
 * — ver context/CategoriasContext.jsx e GET /api/categorias). Não existe mais mapa fixo de cores:
 * quem precisa da cor de uma categoria usa `useCategorias().resolver(nome)`.
 * Este arquivo guarda só o que o frontend precisa ANTES de a lista do usuário chegar (padrão) e as
 * regras puras compartilhadas (paleta, comparação de nomes, "Outros").
 */

/** Categoria fixa: não pode ser excluída nem renomeada; recebe despesas sem categoria válida. */
export const NOME_OUTROS = 'Outros';

/**
 * As 5 categorias que o app tinha fixas, com as mesmas cores. O servidor as cria para o usuário
 * no 1º acesso; aqui servem só de "lista provisória" enquanto a API ainda não respondeu (evita a
 * tela piscar sem cores).
 */
export const CATEGORIAS_PADRAO = [
  { nome: 'Utilidades', cor: '#3F78B0' },
  { nome: 'Saúde', cor: '#356A9C' },
  { nome: 'Alimentação', cor: '#2B5A86' },
  { nome: 'Outros', cor: '#234A70' },
  { nome: 'Lazer', cor: '#6B7682' },
];

/**
 * PALETA do seletor de cor das categorias: tons que funcionam no fundo escuro e são distinguíveis
 * entre si. De propósito NÃO tem verde nem vermelho puros — essas cores têm significado fixo no
 * tema (receita/superávit e despesa/déficit) e confundiriam numa rosca de despesas.
 */
export const PALETA_CORES = [
  '#3F78B0', // azul
  '#4FB3BF', // ciano
  '#9B8AD9', // lavanda
  '#C9B27C', // areia
  '#B98AB5', // malva
  '#7FB5A0', // verde-acinzentado (bem diferente do verde do tema)
  '#D2A66E', // caramelo
  '#8E9AAF', // cinza azulado claro
  '#5E6AB5', // índigo
  '#6B7682', // cinza
];

/** Cor usada se, por algum motivo, nem "Outros" for encontrada. */
export const COR_CATEGORIA_PADRAO = '#6B7682';

/** Limites de nome (os mesmos do servidor, que valida de novo). */
export const NOME_CATEGORIA_MIN = 2;
export const NOME_CATEGORIA_MAX = 24;

/** Nome normalizado para comparar categorias: sem espaços nas pontas e em minúsculas. */
export const chaveCategoria = (nome) => String(nome ?? '').trim().toLowerCase();

/** `true` se o nome é a categoria "Outros" (sem diferenciar maiúsculas). */
export const ehOutros = (nome) => chaveCategoria(nome) === chaveCategoria(NOME_OUTROS);

/**
 * Primeira cor da PALETA que nenhuma categoria usa ainda (para pré-selecionar numa categoria
 * nova). Se todas já estiverem em uso, volta para a primeira.
 * @param {Array<{ cor: string }>} categorias
 */
export function primeiraCorLivre(categorias) {
  const usadas = new Set(categorias.map((c) => String(c.cor).toUpperCase()));
  return PALETA_CORES.find((cor) => !usadas.has(cor.toUpperCase())) ?? PALETA_CORES[0];
}

/**
 * Valida o nome digitado (mesma regra do servidor).
 * @returns {string} mensagem de erro, ou '' se estiver ok.
 */
export function validarNomeCategoria(nome) {
  const n = String(nome ?? '').trim();
  if (n.length < NOME_CATEGORIA_MIN || n.length > NOME_CATEGORIA_MAX) {
    return `O nome deve ter de ${NOME_CATEGORIA_MIN} a ${NOME_CATEGORIA_MAX} caracteres.`;
  }
  return '';
}
