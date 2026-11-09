/**
 * Regras das CATEGORIAS PERSONALIZADAS de despesa.
 *
 * TRANSIÇÃO "PREGUIÇOSA" (sem script de migração):
 *  - Na primeira vez que o usuário abre as categorias (GET /api/categorias), se ele ainda não
 *    tem nenhuma, criamos as 5 padrão com as cores que o app já usava. Nenhuma despesa é tocada.
 *  - As despesas continuam guardando o NOME da categoria como texto. Uma despesa antiga com
 *    "Utilidades" casa com a categoria "Utilidades" do usuário (sem diferenciar maiúsculas).
 *  - Despesa com categoria sem correspondência é EXIBIDA como "Outros" pelo frontend, mas o dado
 *    gravado não muda.
 *
 * "Outros" é especial: sempre existe, não pode ser excluída nem renomeada (só trocar a cor) e
 * recebe as despesas de uma categoria excluída.
 *
 * Isolamento: toda função recebe o `userId` e filtra por ele.
 */
import mongoose from 'mongoose';
import { Categoria, chaveCategoria } from '../models/Categoria.js';
import { Despesa } from '../models/Despesa.js';

/** Nome da categoria fixa que não pode ser excluída/renomeada. */
export const NOME_OUTROS = 'Outros';
export const CHAVE_OUTROS = chaveCategoria(NOME_OUTROS);

/** Máximo de categorias por usuário. */
export const LIMITE_CATEGORIAS = 15;

/** As 5 categorias que existiam fixas no app, com as mesmas cores de antes. */
export const CATEGORIAS_PADRAO = [
  { nome: 'Utilidades', cor: '#3F78B0' },
  { nome: 'Saúde', cor: '#356A9C' },
  { nome: 'Alimentação', cor: '#2B5A86' },
  { nome: 'Outros', cor: '#234A70' },
  { nome: 'Lazer', cor: '#6B7682' },
];

/** `true` se o nome (ou documento) é a categoria "Outros". */
export const ehOutros = (nome) => chaveCategoria(nome) === CHAVE_OUTROS;

/** Escapa caracteres especiais para usar um texto literal dentro de uma RegExp. */
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Filtro Mongo para "despesas cuja categoria é `nome`" — mesmo critério da `chave`: ignora
 * maiúsculas e espaços nas pontas. Assim "utilidades " numa despesa antiga também casa.
 */
export function filtroCategoriaDespesa(nome) {
  return { $regex: `^\\s*${escaparRegex(String(nome).trim())}\\s*$`, $options: 'i' };
}

/** Insere categorias ignorando as que já existem (corrida no 1º acesso → índice único). */
async function inserirIgnorandoDuplicadas(userId, lista) {
  try {
    await Categoria.insertMany(
      lista.map((c) => ({ ...c, userId, chave: chaveCategoria(c.nome) })),
      { ordered: false }, // continua inserindo as outras se uma já existir
    );
  } catch (erro) {
    // 11000 = chave duplicada: outra requisição criou primeiro. Qualquer outro erro sobe.
    const soDuplicadas = (erro?.writeErrors ?? [erro]).every((e) => (e?.code ?? e?.err?.code) === 11000);
    if (erro?.code !== 11000 && !soDuplicadas) throw erro;
  }
}

/**
 * Garante que o usuário tenha categorias:
 *  - nenhuma ainda → cria as 5 padrão (1º acesso);
 *  - tem, mas sem "Outros" (não deveria acontecer) → recria só a "Outros".
 * Idempotente e seguro com requisições simultâneas (índice único em userId+chave).
 * Nunca altera despesas.
 */
export async function garantirCategorias(userId) {
  await Categoria.init(); // garante o índice único antes de depender dele
  const existentes = await Categoria.find({ userId }).select('+chave');
  if (existentes.length === 0) {
    await inserirIgnorandoDuplicadas(userId, CATEGORIAS_PADRAO);
  } else if (!existentes.some((c) => c.chave === CHAVE_OUTROS)) {
    await inserirIgnorandoDuplicadas(userId, CATEGORIAS_PADRAO.filter((c) => ehOutros(c.nome)));
  }
}

/**
 * Quantas despesas o usuário tem em cada categoria (TODOS os meses), indexado pela `chave`
 * normalizada. Usado para a tela avisar quantas despesas seriam movidas ao excluir.
 * O agrupamento final é feito em JS porque o `$toLower` do Mongo só trata ASCII (não acentos).
 *
 * @returns {Promise<Map<string, number>>}
 */
export async function contarDespesasPorCategoria(userId) {
  const grupos = await Despesa.aggregate([
    // `aggregate` não converte tipos: o id do token (string) vira ObjectId à mão.
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: { $ifNull: ['$categoria', NOME_OUTROS] }, n: { $sum: 1 } } },
  ]);
  const contagem = new Map();
  for (const g of grupos) {
    const chave = chaveCategoria(g._id);
    contagem.set(chave, (contagem.get(chave) ?? 0) + g.n);
  }
  return contagem;
}
