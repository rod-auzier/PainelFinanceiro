/**
 * Controller das Caixinhas (aba "Porquinho").
 *
 * Toda query filtra por `req.userId` (injetado pelo `authRequired`): um usuário nunca vê nem
 * altera caixinhas de outro. A transição do antigo saldo inicial está em services/caixinhas.js.
 */
import mongoose from 'mongoose';
import { Caixinha, NOME_MAX, NOME_MIN } from '../models/Caixinha.js';
import { LIMITE_CAIXINHAS, garantirMigracaoCaixinhas } from '../services/caixinhas.js';
import { arredondar, calcularESincronizar, referenciaDasCaixinhas } from '../services/guardado.js';
import { User } from '../models/User.js';
import { lerMes, mesAtual } from '../utils/mes.js';

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
 * @returns {200} `{ caixinhas: Array<{ _id, nome, valor, createdAt, updatedAt }>, limite, guardado }`
 *               caixinhas em ordem de criação (a tela ordena da maior para a menor);
 *               `guardado` = mesmo formato de GET /api/guardado.
 */
export async function listarCaixinhas(req, res) {
  await garantirMigracaoCaixinhas(req.userId);
  const caixinhas = await Caixinha.find({ userId: req.userId }).sort({ createdAt: 1, _id: 1 });

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

/**
 * Mês de REFERÊNCIA dos saldos das caixinhas (o mês em que o usuário os conferiu). Os meses fechados
 * antes dele já estão dentro dos valores das caixinhas e não são somados de novo ao Total guardado.
 *
 * @route   GET /api/caixinhas/referencia
 * @access  Privado
 * @returns {200} `{ referencia: "AAAA-MM" }` (padrão "2026-10" para quem nunca escolheu).
 */
export async function obterReferencia(req, res) {
  const usuario = await User.findById(req.userId).select('caixinhasReferencia').lean();
  res.json({ referencia: referenciaDasCaixinhas(usuario) });
}

/**
 * Define o mês de referência das caixinhas e devolve o Total guardado recalculado (e as metas já
 * sincronizadas com ele). Só atua sobre o usuário do token.
 *
 * @route   PATCH /api/caixinhas/referencia
 * @access  Privado
 * @param   {string} req.body.mes  "AAAA-MM", não anterior a 2026-10 nem posterior ao mês atual
 *                                 (fuso America/Fortaleza).
 * @returns {200} `{ referencia, guardado }` (`guardado` no mesmo formato de GET /api/guardado).
 * @returns {400} `{ message }` — formato inválido, antes de 2026-10 ou depois do mês atual.
 */
export async function definirReferencia(req, res) {
  const { mes, erro } = lerMes(req.body?.mes); // formato AAAA-MM e não anterior a MES_INICIAL
  if (erro) return res.status(400).json({ message: erro });
  if (mes > mesAtual()) {
    return res.status(400).json({ message: 'O mês de referência não pode ser posterior ao mês atual.' });
  }

  await User.updateOne({ _id: req.userId }, { $set: { caixinhasReferencia: mes } });
  const guardado = await calcularESincronizar(req.userId); // o total mudou: metas reavaliadas
  return res.json({ referencia: mes, guardado });
}
