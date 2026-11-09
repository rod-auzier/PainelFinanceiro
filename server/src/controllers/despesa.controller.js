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
import { gerarFixosDoMes } from '../services/fixos.js';
import { cartoesDoMes, garantirCartaoPadrao, linhasVirtuaisCartoes } from '../services/cartao.js';
import { lerCartaoId } from './cartao.controller.js';
import { createdAtParaMes, filtroDesdeInicio, filtroDoMes, lerMes, lerMesOpcional } from '../utils/mes.js';

/**
 * Lê o cartão de crédito do corpo de uma despesa (criação/edição).
 *  - `cartaoId` (id de um cartão do usuário, ou `null`/'' = "Nenhum") é o campo novo: grava `cartaoId`
 *    e mantém `cartao` em sincronia (`true` se tem cartão) — assim uma despesa antiga do cartão padrão
 *    que passa para "Nenhum" deixa de ser cartão de verdade.
 *  - Só `cartao` (booleano, controle antigo de um cartão só) continua aceito: `true` = cartão padrão.
 * @returns {Promise<{ campos: object, erro?: string }>}  `campos` = o que gravar (vazio = não mexe)
 */
async function lerCartaoDoCorpo(userId, { cartaoId, cartao }) {
  if (cartaoId !== undefined) {
    const r = await lerCartaoId(userId, cartaoId);
    if (r.erro) return { campos: {}, erro: r.erro };
    return { campos: { cartaoId: r.cartaoId, cartao: Boolean(r.cartaoId) } };
  }
  if (cartao !== undefined) {
    if (typeof cartao !== 'boolean') return { campos: {}, erro: 'cartao deve ser true ou false' };
    return { campos: cartao ? { cartao: true } : { cartao: false, cartaoId: null } };
  }
  return { campos: {} };
}

/**
 * Lista as despesas do usuário autenticado.
 *
 * Ao abrir um mês (`mes` informado) que ainda não foi "gerado", cria ANTES, de forma
 * automática e idempotente, as despesas recorrentes ("Repete todo mês") do mês de origem
 * — ver services/fixos.js. Só gera de MES_INICIAL até o mês atual; meses futuros não
 * geram nada. A resposta diz quantas foram criadas agora, para a tela avisar.
 *
 * @route   GET /api/despesas?mes=AAAA-MM
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa `req.userId`
 * @param   {string} [req.query.mes]          — "AAAA-MM" (não anterior a MES_INICIAL): só as
 *                                              despesas daquele mês. Sem `mes`, devolve todas
 *                                              de MES_INICIAL em diante (sem gerar fixos).
 * @param   {import('express').Response} res
 * @returns {200} `{ despesas: Array<{ _id, userId, ..., valor, recorrente, paga, cartao, cartaoId, createdAt, updatedAt }>,
 *                  fixosGerados: number, cartoes?, linhasVirtuais? }`
 *               ordenado por `createdAt` (mais recentes primeiro). `fixosGerados` = quantas
 *               despesas fixas foram criadas automaticamente NESTA chamada (0 na maioria).
 *               Só COM `mes`: `cartoes` = situação de cada cartão no mês (services/cartao.js ->
 *               `cartoesDoMes`) e `linhasVirtuais` = as linhas CALCULADAS "Outras compras no cartão
 *               (nome)" (`virtual: true`; não são registros salvos). Elas NÃO vêm dentro de
 *               `despesas` — a tela decide onde mostrá-las.
 *               Abrir a tela de Despesas aplica (uma vez) a transição do controle antigo de um
 *               cartão só: cria o cartão padrão "Cartão" se houver dados antigos.
 * @returns {400} `{ message }` — `mes` fora do formato AAAA-MM ou anterior a MES_INICIAL.
 */
export async function listarDespesas(req, res) {
  const { mes, erro } = lerMesOpcional(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });

  await garantirCartaoPadrao(req.userId); // 1ª vez: dados do cartão único antigo → cartão "Cartão"
  const fixosGerados = mes ? await gerarFixosDoMes('despesa', req.userId, mes) : 0;

  const filtro = { userId: req.userId, ...(mes ? filtroDoMes(mes) : filtroDesdeInicio()) };
  const despesas = await Despesa.find(filtro).sort({ createdAt: -1 });
  if (!mes) return res.json({ despesas, fixosGerados });

  // Cartões de crédito do mês: faturas informadas + as partes não detalhadas (linhas virtuais).
  const cartoes = await cartoesDoMes(req.userId, mes);
  res.json({ despesas, fixosGerados, cartoes, linhasVirtuais: linhasVirtuaisCartoes(mes, cartoes) });
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
 * @param   {string|null} [req.body.cartaoId] — cartão de crédito (id de um cartão do usuário) ou
 *                                             `null` = nenhum. Opcional (padrão: nenhum).
 * @param   {boolean} [req.body.cartao]      — (antigo) `true` = cartão padrão. Usado só sem `cartaoId`.
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
  const cartaoLido = await lerCartaoDoCorpo(req.userId, req.body ?? {});
  if (cartaoLido.erro) return res.status(400).json({ message: cartaoLido.erro });
  const { mes, erro } = lerMesOpcional(mesBruto);
  if (erro) return res.status(400).json({ message: erro });

  const despesa = await Despesa.create({
    userId: req.userId,
    descricao,
    categoria,
    valor: valorNum,
    recorrente: recorrente ?? false,
    cartao: false, // padrão: não é cartão (sobrescrito por `cartaoLido` quando informado)
    cartaoId: null,
    ...cartaoLido.campos,
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
 * @param   {string|null} [req.body.cartaoId] — cartão (ou `null` = nenhum). Só muda se enviado.
 * @param   {boolean} [req.body.cartao]     — (antigo) `true` = cartão padrão. Usado só sem `cartaoId`.
 *          (O status `paga` NUNCA é alterado por aqui — use PATCH /api/despesas/:id.)
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

  const cartaoLido = await lerCartaoDoCorpo(req.userId, req.body ?? {});
  if (cartaoLido.erro) return res.status(400).json({ message: cartaoLido.erro });

  const alteracoes = { descricao, categoria, valor: valorNum, ...cartaoLido.campos };
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
 * Marca ou desmarca UMA despesa como paga (checkbox da lista de Despesas).
 *
 * Só mexe no campo `paga`; é puramente informativo (totais e saldo não mudam).
 *
 * @route   PATCH /api/despesas/:id
 * @access  Privado
 * @param   {string}  req.params.id  — ObjectId da despesa.
 * @param   {object}  req.body
 * @param   {boolean} req.body.paga  — `true` = paga, `false` = pendente. Obrigatório e booleano.
 * @returns {200} `{ despesa: {...} }` — documento já atualizado.
 * @returns {400} `{ message }` — `:id` inválido ou `paga` ausente/não booleano.
 * @returns {404} `{ message }` — despesa inexistente OU de outro usuário (filtro por `userId`).
 */
export async function atualizarPagamento(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }
  const { paga } = req.body ?? {};
  if (typeof paga !== 'boolean') {
    return res.status(400).json({ message: 'paga deve ser true ou false' });
  }

  const despesa = await Despesa.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { paga },
    { new: true },
  );
  if (!despesa) {
    return res.status(404).json({ message: 'despesa não encontrada' });
  }
  return res.json({ despesa });
}

/**
 * Marca como PAGAS todas as despesas AINDA PENDENTES de um mês ("Marcar todas como pagas").
 * Idempotente: repetir não muda nada. Só toca nas despesas do usuário autenticado.
 *
 * @route   PATCH /api/despesas/pagas
 * @access  Privado
 * @param   {object} req.body
 * @param   {string} req.body.mes  — "AAAA-MM" (não anterior a MES_INICIAL). Obrigatório.
 * @returns {200} `{ atualizadas: number }` — quantas despesas passaram de pendente para paga.
 * @returns {400} `{ message }` — `mes` ausente, mal formatado ou anterior a MES_INICIAL.
 */
export async function marcarTodasPagas(req, res) {
  const { mes, erro } = lerMes(req.body?.mes);
  if (erro) return res.status(400).json({ message: erro });

  const resultado = await Despesa.updateMany(
    { userId: req.userId, paga: { $ne: true }, ...filtroDoMes(mes) }, // `$ne: true` pega também as antigas, sem o campo
    { paga: true },
  );
  return res.json({ atualizadas: resultado.modifiedCount });
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
