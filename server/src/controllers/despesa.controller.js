/**
 * Controller de Despesas.
 *
 * Assim como em Receitas, toda query é filtrada por `req.userId`
 * (injetado pelo middleware `authRequired`), garantindo isolamento
 * entre contas. Uma despesa "pertence" ao mês do seu `createdAt`
 * (ver utils/mes.js).
 */
import mongoose from 'mongoose';
import { Despesa } from '../models/Despesa.js';
import { copiarFixos } from '../services/fixos.js';
import { createdAtParaMes, filtroDoMes, lerMesOpcional } from '../utils/mes.js';

/**
 * Lista as despesas do usuário autenticado.
 *
 * @route   GET /api/despesas?mes=AAAA-MM
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa `req.userId`
 * @param   {string} [req.query.mes]          — "AAAA-MM": só as despesas daquele mês.
 *                                              Sem `mes`, devolve todas.
 * @param   {import('express').Response} res
 * @returns {200} `{ despesas: Array<{ _id, userId, descricao, categoria, valor, recorrente, createdAt, updatedAt }> }`
 *               ordenado por `createdAt` (mais recentes primeiro).
 * @returns {400} `{ message }` — `mes` fora do formato AAAA-MM.
 */
export async function listarDespesas(req, res) {
  const { mes, erro } = lerMesOpcional(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });

  const filtro = { userId: req.userId, ...(mes ? filtroDoMes(mes) : {}) };
  const despesas = await Despesa.find(filtro).sort({ createdAt: -1 });
  res.json({ despesas });
}

/**
 * Cria uma despesa para o usuário autenticado.
 *
 * @route   POST /api/despesas
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {object}  req.body
 * @param   {string}  req.body.descricao     — o que é a despesa (ex.: "Conta de luz"). Obrigatório.
 * @param   {number}  req.body.valor         — quantia a pagar, número ≥ 0. Obrigatório.
 * @param   {string}  [req.body.categoria]   — agrupador (ex.: "Moradia"). Opcional → "Outros".
 * @param   {boolean} [req.body.recorrente]  — "Repete todo mês". Opcional (padrão false).
 * @param   {string}  [req.body.mes]         — "AAAA-MM": lança a despesa nesse mês (o
 *                                             `createdAt` fica dentro dele). Sem `mes`, é agora.
 * @returns {201} `{ despesa: {...} }` — documento criado.
 * @returns {400} `{ message }` — `descricao`/`valor` ausentes ou `valor` inválido,
 *               `recorrente` não booleano ou `mes` mal formatado.
 */
export async function criarDespesa(req, res) {
  const { descricao, categoria, valor, recorrente, mes: mesBruto } = req.body ?? {};

  if (!descricao || valor == null) {
    return res.status(400).json({ message: 'descricao e valor são obrigatórios' });
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

  const despesa = await Despesa.create({
    userId: req.userId,
    descricao,
    categoria,
    valor: valorNum,
    recorrente: recorrente ?? false,
    createdAt: createdAtParaMes(mes),
  });

  return res.status(201).json({ despesa });
}

/**
 * Atualiza uma despesa do usuário autenticado (edição inline na tabela).
 *
 * @route   PUT /api/despesas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string}  req.params.id         — ObjectId da despesa a atualizar.
 * @param   {object}  req.body
 * @param   {string}  req.body.descricao    — o que é a despesa. Obrigatório.
 * @param   {number}  req.body.valor        — quantia a pagar, número ≥ 0. Obrigatório.
 * @param   {string}  [req.body.categoria]  — agrupador. Opcional.
 * @param   {boolean} [req.body.recorrente] — "Repete todo mês". Só muda se enviado.
 * @returns {200} `{ despesa: {...} }` — documento já com os novos valores.
 * @returns {400} `{ message }` — `:id` inválido, ou `descricao`/`valor` ausentes/inválidos,
 *               ou `recorrente` não booleano (mesma validação do POST).
 * @returns {404} `{ message }` — despesa inexistente OU de outro usuário
 *               (o filtro por `userId` garante o isolamento).
 */
export async function atualizarDespesa(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const { descricao, categoria, valor, recorrente } = req.body ?? {};

  if (!descricao || valor == null) {
    return res.status(400).json({ message: 'descricao e valor são obrigatórios' });
  }
  const valorNum = Number(valor);
  if (Number.isNaN(valorNum) || valorNum < 0) {
    return res.status(400).json({ message: 'valor deve ser um número não-negativo' });
  }
  if (recorrente !== undefined && typeof recorrente !== 'boolean') {
    return res.status(400).json({ message: 'recorrente deve ser true ou false' });
  }

  const alteracoes = { descricao, categoria, valor: valorNum };
  if (recorrente !== undefined) alteracoes.recorrente = recorrente;

  const despesa = await Despesa.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    alteracoes,
    { new: true, runValidators: true }, // `new`: devolve já atualizado
  );

  if (!despesa) {
    return res.status(404).json({ message: 'despesa não encontrada' });
  }

  return res.json({ despesa });
}

/**
 * Copia as despesas FIXAS (`recorrente: true`) do mês anterior para o mês
 * escolhido, mantendo descrição, categoria, valor e o dia do mês, para o
 * usuário só editar o que mudou (ex.: a conta de luz). Despesas que já
 * existem no mês de destino (mesma descrição, também recorrentes) NÃO são
 * copiadas de novo — rodar duas vezes não duplica.
 *
 * @route   POST /api/despesas/copiar-fixos
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {object} req.body
 * @param   {string} req.body.mes — mês de DESTINO, "AAAA-MM". Obrigatório.
 * @returns {200} `{ copiadas, ignoradas, mesOrigem, fixosNaOrigem }` — `ignoradas` = já existiam
 *               no destino; `mesOrigem` = mês anterior de onde se copiou.
 * @returns {400} `{ message }` — `mes` ausente ou mal formatado.
 */
export async function copiarDespesasFixas(req, res) {
  const { mes, erro } = lerMesOpcional(req.body?.mes);
  if (erro || !mes) return res.status(400).json({ message: erro ?? 'mes é obrigatório (AAAA-MM)' });

  const resultado = await copiarFixos({
    Model: Despesa,
    userId: req.userId,
    mes,
    chaves: ['descricao'],
    campos: ['descricao', 'categoria', 'valor'],
  });

  return res.json(resultado);
}

/**
 * Remove uma despesa do usuário autenticado.
 *
 * @route   DELETE /api/despesas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string} req.params.id  — ObjectId da despesa a remover.
 * @returns {204} sem corpo — despesa removida.
 * @returns {400} `{ message }` — se `:id` não for um ObjectId válido.
 * @returns {404} `{ message }` — se a despesa não existe OU não pertence ao usuário.
 */
export async function removerDespesa(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const removida = await Despesa.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  });

  if (!removida) {
    return res.status(404).json({ message: 'despesa não encontrada' });
  }

  return res.status(204).send();
}
