/**
 * Controller dos Cartões de crédito (vários por usuário, até 5).
 *
 * Toda query filtra por `req.userId` (injetado pelo `authRequired`). A regra de cálculo e a transição
 * do controle antigo (um cartão só → cartão padrão "Cartão") estão em services/cartao.js.
 */
import mongoose from 'mongoose';
import { Cartao, COR_REGEX, NOME_MAX, NOME_MIN, chaveCartao } from '../models/Cartao.js';
import { Despesa } from '../models/Despesa.js';
import { FaturaCartao } from '../models/FaturaCartao.js';
import {
  CHAVE_PADRAO_PROVISORIO,
  LIMITE_CARTOES,
  filtroDespesasDoCartao,
  filtroFaturasDoCartao,
  garantirCartaoPadrao,
} from '../services/cartao.js';

/** Valida o nome. @returns {string|null} */
function erroNome(nome) {
  if (typeof nome !== 'string' || nome.trim().length < NOME_MIN || nome.trim().length > NOME_MAX) {
    return `O nome deve ter de ${NOME_MIN} a ${NOME_MAX} caracteres.`;
  }
  return null;
}

/** Valida a cor. @returns {string|null} */
const erroCor = (cor) => (typeof cor === 'string' && COR_REGEX.test(cor) ? null : 'A cor deve estar no formato #RRGGBB.');

const NOME_REPETIDO = 'Já existe um cartão com esse nome.';

/** Tira o campo interno `chave` antes de responder. */
const publico = (doc) => {
  const { chave: _chave, __v: _v, ...resto } = doc.toObject ? doc.toObject() : doc; // eslint-disable-line no-unused-vars
  return resto;
};

/**
 * Quantas despesas (todos os meses) cada cartão tem — para a confirmação de exclusão.
 * Antigas (`cartao: true` sem `cartaoId`) contam no cartão padrão.
 * @returns {Promise<Map<string, number>>} id do cartão (ou 'padrao') → quantidade
 */
async function contarDespesasPorCartao(userId, padrao) {
  const grupos = await Despesa.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), $or: [{ cartaoId: { $ne: null } }, { cartao: true }] } },
    { $group: { _id: { $ifNull: ['$cartaoId', CHAVE_PADRAO_PROVISORIO] }, n: { $sum: 1 } } },
  ]);
  const mapa = new Map();
  for (const g of grupos) {
    const chave = String(g._id) === CHAVE_PADRAO_PROVISORIO && padrao ? String(padrao._id) : String(g._id);
    mapa.set(chave, (mapa.get(chave) ?? 0) + g.n);
  }
  return mapa;
}

/**
 * Lista os cartões. Aplica antes a transição do controle antigo (cria o cartão padrão, se for o caso).
 *
 * @route   GET /api/cartoes
 * @access  Privado
 * @returns {200} `{ cartoes: Array<{ _id, nome, cor, padrao, createdAt, updatedAt, qtdDespesas }>, limite }`
 *               em ordem de criação. `qtdDespesas` = despesas (de todos os meses) desse cartão.
 */
export async function listarCartoes(req, res) {
  await garantirCartaoPadrao(req.userId);
  const cartoes = await Cartao.find({ userId: req.userId }).sort({ createdAt: 1, _id: 1 }).lean();
  const contagem = await contarDespesasPorCartao(req.userId, cartoes.find((c) => c.padrao));
  res.json({
    cartoes: cartoes.map((c) => ({ ...publico(c), qtdDespesas: contagem.get(String(c._id)) ?? 0 })),
    limite: LIMITE_CARTOES,
  });
}

/**
 * Cria um cartão.
 *
 * @route   POST /api/cartoes
 * @access  Privado
 * @param   {string} req.body.nome  2 a 24 caracteres; único por usuário (sem diferenciar maiúsculas).
 * @param   {string} req.body.cor   "#RRGGBB".
 * @returns {201} `{ cartao }` · {400} validação / limite de 5 · {409} nome repetido.
 */
export async function criarCartao(req, res) {
  const { nome, cor } = req.body ?? {};
  const erro = erroNome(nome) ?? erroCor(cor);
  if (erro) return res.status(400).json({ message: erro });

  await garantirCartaoPadrao(req.userId); // o padrão (se houver) conta no limite
  if ((await Cartao.countDocuments({ userId: req.userId })) >= LIMITE_CARTOES) {
    return res.status(400).json({ message: `Limite de ${LIMITE_CARTOES} cartões atingido.` });
  }
  try {
    const cartao = await Cartao.create({ userId: req.userId, nome: nome.trim(), cor: cor.toUpperCase() });
    return res.status(201).json({ cartao: { ...publico(cartao), qtdDespesas: 0 } });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: NOME_REPETIDO });
    throw e;
  }
}

/**
 * Renomeia e/ou troca a cor de um cartão (as despesas o referenciam pelo id, então nada mais muda).
 *
 * @route   PATCH /api/cartoes/:id
 * @access  Privado
 * @param   {string} [req.body.nome] / {string} [req.body.cor]  ao menos um.
 * @returns {200} `{ cartao }` · {400} validação · {404} inexistente/de outro usuário · {409} nome repetido.
 */
export async function atualizarCartao(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'id inválido' });
  const { nome, cor } = req.body ?? {};
  if (nome === undefined && cor === undefined) return res.status(400).json({ message: 'Informe o nome e/ou a cor.' });
  const erro = (nome !== undefined ? erroNome(nome) : null) ?? (cor !== undefined ? erroCor(cor) : null);
  if (erro) return res.status(400).json({ message: erro });

  const cartao = await Cartao.findOne({ _id: req.params.id, userId: req.userId });
  if (!cartao) return res.status(404).json({ message: 'cartão não encontrado' });
  if (nome !== undefined) cartao.nome = nome.trim();
  if (cor !== undefined) cartao.cor = cor.toUpperCase();
  try {
    await cartao.save(); // `save` recalcula a `chave`
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: NOME_REPETIDO });
    throw e;
  }
  return res.json({ cartao: publico(cartao) });
}

/**
 * Exclui um cartão. As despesas dele NÃO são apagadas: viram despesas comuns (sem cartão). As
 * faturas dele são removidas (só existem em função do cartão).
 *
 * @route   DELETE /api/cartoes/:id
 * @access  Privado
 * @returns {200} `{ despesasAfetadas, faturasRemovidas }` · {400} id inválido · {404} inexistente/de outro usuário.
 */
export async function removerCartao(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'id inválido' });
  const cartao = await Cartao.findOne({ _id: req.params.id, userId: req.userId }).lean();
  if (!cartao) return res.status(404).json({ message: 'cartão não encontrado' });

  // 1) Despesas do cartão viram comuns (inclui as antigas do padrão: `cartao: true` sem `cartaoId`).
  const d = await Despesa.updateMany(filtroDespesasDoCartao(req.userId, cartao), { $set: { cartao: false, cartaoId: null } });
  // 2) Faturas do cartão saem (inclui as antigas do padrão, sem `cartaoId`).
  const f = await FaturaCartao.deleteMany(filtroFaturasDoCartao(req.userId, cartao));
  // 3) O cartão.
  await Cartao.deleteOne({ _id: cartao._id, userId: req.userId });

  return res.json({ despesasAfetadas: d.modifiedCount, faturasRemovidas: f.deletedCount });
}

/**
 * Lê e valida um `cartaoId` vindo do corpo de uma despesa.
 * @returns {Promise<{ cartaoId?: import('mongoose').Types.ObjectId | null, erro?: string }>}
 *          `null` = "Nenhum (outra forma de pagamento)".
 */
export async function lerCartaoId(userId, valor) {
  if (valor === null || valor === '') return { cartaoId: null };
  if (!mongoose.isValidObjectId(valor)) return { erro: 'cartaoId inválido' };
  const existe = await Cartao.exists({ _id: valor, userId }); // só cartões do próprio usuário
  if (!existe) return { erro: 'cartão não encontrado' };
  return { cartaoId: new mongoose.Types.ObjectId(valor) };
}
