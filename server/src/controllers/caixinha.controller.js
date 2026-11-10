/**
 * Controller das Caixinhas (aba "Porquinho").
 *
 * Toda query filtra por `req.userId` (injetado pelo `authRequired`): um usuário nunca vê nem
 * altera caixinhas de outro. A transição do antigo saldo inicial está em services/caixinhas.js.
 */
import mongoose from 'mongoose';
import { Caixinha, NOME_MAX, NOME_MIN } from '../models/Caixinha.js';
import { Meta } from '../models/Meta.js';
import { LIMITE_CAIXINHAS, garantirMigracaoCaixinhas } from '../services/caixinhas.js';
import { arredondar, calcularESincronizar } from '../services/guardado.js';

/** Valida o nome. @returns {string|null} mensagem de erro ou null */
function erroNome(nome) {
  if (typeof nome !== 'string' || nome.trim().length < NOME_MIN || nome.trim().length > NOME_MAX) {
    return `O nome deve ter de ${NOME_MIN} a ${NOME_MAX} caracteres.`;
  }
  return null;
}

/** Valida o valor (número finito ≥ 0). @returns {string|null} mensagem de erro ou null */
function erroValor(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    ? null
    : 'O valor deve ser um número maior ou igual a zero.';
}

/**
 * Lista as caixinhas do usuário e já devolve o TOTAL GUARDADO, numa chamada só (a tela do
 * Porquinho precisa dos dois; duas chamadas paralelas disputariam a transição e a geração de fixos).
 * Aplica antes a transição do saldo inicial (1ª vez). O total também sincroniza a conclusão
 * automática das metas. Se o cálculo do total falhar, as caixinhas ainda são devolvidas
 * (`guardado: null`).
 *
 * @route   GET /api/caixinhas
 * @access  Privado
 * @returns {200} `{ caixinhas: Array<{ _id, nome, valor, createdAt, updatedAt, metasVinculadas }>, limite, guardado }`
 *               `metasVinculadas` = quantas metas acompanham a caixinha (aviso antes de excluí-la).
 *               caixinhas em ordem de criação (a tela ordena da maior para a menor);
 *               `guardado` = mesmo formato de GET /api/guardado.
 */
export async function listarCaixinhas(req, res) {
  await garantirMigracaoCaixinhas(req.userId);
  const [lista, vinculos] = await Promise.all([
    Caixinha.find({ userId: req.userId }).sort({ createdAt: 1, _id: 1 }).lean(),
    // Quantas METAS acompanham cada caixinha (para o aviso antes de excluir uma caixinha).
    Meta.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId), caixinhaId: { $ne: null } } },
      { $group: { _id: '$caixinhaId', n: { $sum: 1 } } },
    ]),
  ]);
  const metasPorCaixinha = new Map(vinculos.map((v) => [String(v._id), v.n]));
  const caixinhas = lista.map(({ origem: _o, ...c }) => ({ ...c, metasVinculadas: metasPorCaixinha.get(String(c._id)) ?? 0 })); // eslint-disable-line no-unused-vars

  let guardado = null;
  try {
    guardado = await calcularESincronizar(req.userId);
  } catch (erro) {
    console.error('[caixinhas] não foi possível calcular o total guardado:', erro);
  }

  res.json({ caixinhas, limite: LIMITE_CAIXINHAS, guardado });
}

/**
 * Cria uma caixinha.
 *
 * @route   POST /api/caixinhas
 * @access  Privado
 * @param   {string} req.body.nome   2 a 30 caracteres.
 * @param   {number} req.body.valor  R$ ≥ 0.
 * @returns {201} `{ caixinha }`
 * @returns {400} `{ message }` — nome/valor inválidos ou limite de 20 caixinhas atingido.
 */
export async function criarCaixinha(req, res) {
  const { nome, valor } = req.body ?? {};
  const erro = erroNome(nome) ?? erroValor(valor);
  if (erro) return res.status(400).json({ message: erro });

  await garantirMigracaoCaixinhas(req.userId); // a "Saldo inicial" (se houver) conta no limite
  const total = await Caixinha.countDocuments({ userId: req.userId });
  if (total >= LIMITE_CAIXINHAS) {
    return res.status(400).json({ message: `Limite de ${LIMITE_CAIXINHAS} caixinhas atingido.` });
  }

  const caixinha = await Caixinha.create({ userId: req.userId, nome: nome.trim(), valor: arredondar(valor) });
  const { origem, ...semInterno } = caixinha.toObject(); // eslint-disable-line no-unused-vars
  return res.status(201).json({ caixinha: semInterno });
}

/**
 * Edita o nome e/ou o valor de uma caixinha.
 *
 * @route   PATCH /api/caixinhas/:id
 * @access  Privado
 * @param   {string} [req.body.nome]   novo nome (2 a 30 caracteres).
 * @param   {number} [req.body.valor]  novo valor (≥ 0). Ao menos um dos dois.
 * @returns {200} `{ caixinha }` — já atualizada.
 * @returns {400} `{ message }` — id inválido, nada a alterar ou nome/valor inválidos.
 * @returns {404} `{ message }` — caixinha inexistente OU de outro usuário.
 */
export async function atualizarCaixinha(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }
  const { nome, valor } = req.body ?? {};
  if (nome === undefined && valor === undefined) {
    return res.status(400).json({ message: 'Informe o nome e/ou o valor.' });
  }
  const erro = (nome !== undefined ? erroNome(nome) : null) ?? (valor !== undefined ? erroValor(valor) : null);
  if (erro) return res.status(400).json({ message: erro });

  const alteracoes = {};
  if (nome !== undefined) alteracoes.nome = nome.trim();
  if (valor !== undefined) alteracoes.valor = arredondar(valor);

  const caixinha = await Caixinha.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    alteracoes,
    { new: true, runValidators: true },
  );
  if (!caixinha) return res.status(404).json({ message: 'caixinha não encontrada' });
  return res.json({ caixinha });
}

/**
 * Exclui uma caixinha (só ela; nenhum outro dado é tocado).
 *
 * @route   DELETE /api/caixinhas/:id
 * @access  Privado
 * @returns {204} sem corpo.
 * @returns {400} `{ message }` — id inválido.
 * @returns {404} `{ message }` — caixinha inexistente OU de outro usuário.
 */
export async function removerCaixinha(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }
  const removida = await Caixinha.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!removida) return res.status(404).json({ message: 'caixinha não encontrada' });
  return res.status(204).send();
}
