/**
 * Controller de Receitas.
 *
 * Todas as ações são escopadas ao usuário autenticado: o middleware
 * `authRequired` injeta `req.userId`, e cada query usa `{ userId: req.userId }`.
 * Assim, um usuário nunca lê nem apaga receitas de outro.
 *
 * Mês: uma receita "pertence" ao mês do seu `createdAt` (ver utils/mes.js).
 */
import mongoose from 'mongoose';
import { Receita } from '../models/Receita.js';
import { gerarFixosDoMes } from '../services/fixos.js';
import { createdAtParaMes, filtroDesdeInicio, filtroDoMes, lerMesOpcional } from '../utils/mes.js';

/**
 * Lista as receitas do usuário autenticado.
 *
 * Ao abrir um mês (`mes` informado) que ainda não foi "gerado", cria ANTES, de forma
 * automática e idempotente, as receitas recorrentes ("Repete todo mês") do mês de origem
 * — ver services/fixos.js. Só gera de MES_INICIAL até o mês atual; meses futuros não
 * geram nada. A resposta diz quantas foram criadas agora, para a tela avisar.
 *
 * @route   GET /api/receitas?mes=AAAA-MM
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa `req.userId`
 * @param   {string} [req.query.mes]          — "AAAA-MM" (não anterior a MES_INICIAL): só as
 *                                              receitas daquele mês. Sem `mes`, devolve todas
 *                                              de MES_INICIAL em diante (sem gerar fixos).
 * @param   {import('express').Response} res
 * @returns {200} `{ receitas: Array<{ _id, userId, ..., valor, recorrente, createdAt, updatedAt }>, fixosGerados: number }`
 *               ordenado por `createdAt` (mais recentes primeiro). `fixosGerados` = quantas
 *               receitas fixas foram criadas automaticamente NESTA chamada (0 na maioria).
 * @returns {400} `{ message }` — `mes` fora do formato AAAA-MM ou anterior a MES_INICIAL.
 */
export async function listarReceitas(req, res) {
  const { mes, erro } = lerMesOpcional(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });

  const fixosGerados = mes ? await gerarFixosDoMes('receita', req.userId, mes) : 0;

  const filtro = { userId: req.userId, ...(mes ? filtroDoMes(mes) : filtroDesdeInicio()) };
  const receitas = await Receita.find(filtro).sort({ createdAt: -1 });
  res.json({ receitas, fixosGerados });
}

/**
 * Cria uma receita para o usuário autenticado.
 *
 * @route   POST /api/receitas
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {object}  req.body
 * @param   {string}  req.body.fonte         — origem do dinheiro (ex.: "Salário"). Obrigatório.
 * @param   {number}  req.body.valor         — quantia recebida, número ≥ 0. Obrigatório.
 * @param   {string}  [req.body.descricao]   — detalhe livre. Opcional.
 * @param   {boolean} [req.body.recorrente]  — "Repete todo mês". Opcional (padrão false).
 * @param   {string}  [req.body.mes]         — "AAAA-MM": lança a receita nesse mês (o
 *                                             `createdAt` fica dentro dele). Sem `mes`, é agora.
 * @returns {201} `{ receita: {...} }` — documento criado (com `_id` e `createdAt`).
 * @returns {400} `{ message }` — `fonte`/`valor` ausentes, `valor` inválido,
 *               `recorrente` não booleano ou `mes` mal formatado.
 */
export async function criarReceita(req, res) {
  const { fonte, descricao, valor, recorrente, mes: mesBruto } = req.body ?? {};

  if (!fonte || valor == null) {
    return res.status(400).json({ message: 'fonte e valor são obrigatórios' });
  }
  const valorNum = Number(valor);
  if (Number.isNaN(valorNum) || valorNum < 0) {
    return res.status(400).json({ message: 'valor deve ser um número não-negativo' });
  }
  if (recorrente !== undefined && typeof recorrente !== 'boolean') {
    return res.status(400).json({ message: 'recorrente deve ser true ou false' });
  }
  const { mes, erro } = lerMesOpcional(mesBruto);
  if (erro) return res.status(400).json({ message: erro });

  const receita = await Receita.create({
    userId: req.userId,
    fonte,
    descricao,
    valor: valorNum,
    recorrente: recorrente ?? false,
    createdAt: createdAtParaMes(mes),
  });

  return res.status(201).json({ receita });
}

/**
 * Atualiza uma receita do usuário autenticado (edição inline na tabela).
 *
 * @route   PUT /api/receitas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string}  req.params.id          — ObjectId da receita a atualizar.
 * @param   {object}  req.body
 * @param   {string}  req.body.fonte         — origem do dinheiro. Obrigatório.
 * @param   {number}  req.body.valor         — quantia recebida, número ≥ 0. Obrigatório.
 * @param   {string}  [req.body.descricao]   — detalhe livre. Opcional.
 * @param   {boolean} [req.body.recorrente]  — "Repete todo mês". Só muda se enviado.
 * @returns {200} `{ receita: {...} }` — documento já com os novos valores.
 * @returns {400} `{ message }` — `:id` inválido, ou `fonte`/`valor` ausentes/inválidos,
 *               ou `recorrente` não booleano (mesma validação do POST).
 * @returns {404} `{ message }` — receita inexistente OU de outro usuário
 *               (o filtro por `userId` garante o isolamento).
 */
export async function atualizarReceita(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const { fonte, descricao, valor, recorrente } = req.body ?? {};

  if (!fonte || valor == null) {
    return res.status(400).json({ message: 'fonte e valor são obrigatórios' });
  }
  const valorNum = Number(valor);
  if (Number.isNaN(valorNum) || valorNum < 0) {
    return res.status(400).json({ message: 'valor deve ser um número não-negativo' });
  }
  if (recorrente !== undefined && typeof recorrente !== 'boolean') {
    return res.status(400).json({ message: 'recorrente deve ser true ou false' });
  }

  const alteracoes = { fonte, descricao, valor: valorNum };
  if (recorrente !== undefined) alteracoes.recorrente = recorrente;

  const receita = await Receita.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    alteracoes,
    { new: true, runValidators: true }, // `new`: devolve já atualizado
  );

  if (!receita) {
    return res.status(404).json({ message: 'receita não encontrada' });
  }

  return res.json({ receita });
}

/**
 * Remove uma receita do usuário autenticado.
 *
 * @route   DELETE /api/receitas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string} req.params.id  — ObjectId da receita a remover.
 * @returns {204} sem corpo — receita removida.
 * @returns {400} `{ message }` — se `:id` não for um ObjectId válido.
 * @returns {404} `{ message }` — se a receita não existe OU não pertence ao usuário.
 */
export async function removerReceita(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const removida = await Receita.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  });

  if (!removida) {
    return res.status(404).json({ message: 'receita não encontrada' });
  }

  return res.status(204).send();
}
