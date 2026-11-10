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
import {
  cartoesDoMes,
  filtroDespesasDoCartao,
  filtroFaturasDoCartao,
  garantirCartaoPadrao,
  linhasVirtuaisCartoes,
} from '../services/cartao.js';
import { Cartao } from '../models/Cartao.js';
import { FaturaCartao } from '../models/FaturaCartao.js';
import { lerCartaoId } from './cartao.controller.js';
import { ajustarFixosExistentes, idsDosSeguintes, propagarEdicaoFixo } from '../services/propagacao.js';
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
 *               cartão só: cria o cartão padrão "Cartão" se houver dados antigos. E aplica (uma vez)
 *               o AJUSTE dos fixos existentes: `fixosAjustados` = quantos receberam o cartão/categoria
 *               do mês anterior (services/propagacao.js; 0 nas outras vezes).
 * @returns {400} `{ message }` — `mes` fora do formato AAAA-MM ou anterior a MES_INICIAL.
 */
export async function listarDespesas(req, res) {
  const { mes, erro } = lerMesOpcional(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });

  await garantirCartaoPadrao(req.userId); // 1ª vez: dados do cartão único antigo → cartão "Cartão"
  // 1ª vez: copia cartão/categoria do mês anterior para fixos seguintes sem cartão (ANTES de gerar
  // meses novos, para eles já nascerem certos). Devolve quantos ajustou (0 nas outras vezes).
  const fixosAjustados = await ajustarFixosExistentes(req.userId);
  const fixosGerados = mes ? await gerarFixosDoMes('despesa', req.userId, mes) : 0;

  const filtro = { userId: req.userId, ...(mes ? filtroDoMes(mes) : filtroDesdeInicio()) };
  const despesas = await Despesa.find(filtro).sort({ createdAt: -1 });
  if (!mes) return res.json({ despesas, fixosGerados, fixosAjustados });

  // Cartões de crédito do mês: faturas informadas + as partes não detalhadas (linhas virtuais).
  const cartoes = await cartoesDoMes(req.userId, mes);
  res.json({ despesas, fixosGerados, fixosAjustados, cartoes, linhasVirtuais: linhasVirtuaisCartoes(mes, cartoes) });
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
 * PROPAGAÇÃO: se a despesa é FIXA, descrição, categoria, cartão e "Repete todo mês" também são
 * aplicados às cópias dela nos MESES SEGUINTES (valor e paga NÃO) — ver services/propagacao.js.
 *
 * @returns {200} `{ despesa: {...}, propagadas: number }` — documento já com os novos valores e
 *               quantos lançamentos dos meses seguintes receberam a mudança.
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

  // `new: false`: pega o documento ANTES da edição (chave antiga e mês, para achar as cópias seguintes).
  const antes = await Despesa.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    alteracoes,
    { new: false, runValidators: true },
  ).lean();

  if (!antes) {
    return res.status(404).json({ message: 'despesa não encontrada' });
  }
  const despesa = await Despesa.findOne({ _id: req.params.id, userId: req.userId });
  // Mesma operação da edição: leva os campos que se propagam para os meses seguintes.
  const propagadas = await propagarEdicaoFixo('despesa', req.userId, antes, despesa.toObject());

  return res.json({ despesa, propagadas });
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
 * Marca (ou desmarca) como PAGAS, DE UMA VEZ, as despesas de um mês — todas, ou só as de UM CARTÃO.
 * É a rota ÚNICA de "pagar em lote": "Marcar todas como pagas" da lista (com ou sem filtro de cartão),
 * "Marcar fatura como paga" no bloco do cartão e o "Desfazer" do aviso que aparece depois.
 *
 * - Só o campo `paga` das despesas do USUÁRIO, do MÊS e (se informado) do CARTÃO é alterado. Um único
 *   `updateMany`; idempotente (despesas que já estão no valor pedido não contam).
 * - FATURAS: o "pago" da LINHA CALCULADA "Outras compras no cartão (nome)" (= max(fatura − detalhado, 0))
 *   é o campo `FaturaCartao.paga` (o mesmo de sempre; faturas antigas sem o campo valem `false`). Por isso
 *   a ação também marca/desmarca as faturas informadas no mês: a do CARTÃO (com `cartaoId`) ou as de
 *   TODOS os cartões (sem `cartaoId`, no "Marcar todas como pagas" sem filtro). Assim um cartão que só tem
 *   a linha calculada (fatura informada, nenhuma despesa detalhada) também pode ser pago.
 * - Com `cartaoId`: usa o mesmo critério de "despesa do cartão" do cálculo (inclui as antigas do cartão
 *   padrão). `cartaoId` + `ids: []` = alterna SÓ a linha calculada daquele cartão (caixa da linha na lista).
 * - `ids` (opcional) restringe as DESPESAS a esses lançamentos e `restaurarFaturas` (opcional) devolve cada
 *   fatura ao estado anterior — é como o "Desfazer" reverte EXATAMENTE o que a ação alterou.
 * - Mês aberto ou fechado não faz diferença aqui.
 *
 * @route   PATCH /api/despesas/pagas
 * @access  Privado
 * @param   {string}   req.body.mes          "AAAA-MM" (não anterior a MES_INICIAL). Obrigatório.
 * @param   {boolean}  [req.body.paga]       valor desejado (padrão `true`).
 * @param   {string}   [req.body.cartaoId]   só as despesas desse cartão (do próprio usuário). Sem ele: todas do mês.
 * @param   {string[]} [req.body.ids]        (Desfazer / linha calculada) só estes lançamentos (`[]` = nenhum).
 * @param   {boolean}  [req.body.faturaPaga] valor a gravar na fatura do cartão (padrão: = `paga`). (Compatibilidade.)
 * @param   {Array<{ _id: string, paga: boolean }>} [req.body.restaurarFaturas]  (Desfazer) estado anterior de
 *               cada fatura; quando enviado, as faturas recebem exatamente esses valores.
 * @returns {200} `{ atualizadas, ids, faturas, faturaPagaAntes }` — quantas despesas mudaram e quais;
 *               `faturas` = `[{ _id, cartaoId, pagaAntes, paga }]` das faturas tocadas (cartaoId já resolvido,
 *               inclusive o cartão padrão das faturas antigas); `faturaPagaAntes` = a do cartão (compatibilidade).
 * @returns {400} `{ message }` — `mes`/`paga`/`ids`/`faturaPaga` inválidos.
 * @returns {404} `{ message }` — cartão inexistente ou de outro usuário.
 */
export async function marcarTodasPagas(req, res) {
  const { mes, erro } = lerMes(req.body?.mes);
  if (erro) return res.status(400).json({ message: erro });
  const { paga = true, cartaoId, ids, faturaPaga, restaurarFaturas } = req.body ?? {};
  if (typeof paga !== 'boolean') return res.status(400).json({ message: 'paga deve ser true ou false' });
  if (faturaPaga !== undefined && typeof faturaPaga !== 'boolean') {
    return res.status(400).json({ message: 'faturaPaga deve ser true ou false' });
  }
  if (ids !== undefined && (!Array.isArray(ids) || !ids.every((id) => mongoose.isValidObjectId(id)))) {
    return res.status(400).json({ message: 'ids inválidos' });
  }
  if (
    restaurarFaturas !== undefined &&
    (!Array.isArray(restaurarFaturas) ||
      !restaurarFaturas.every((f) => f && mongoose.isValidObjectId(f._id) && typeof f.paga === 'boolean'))
  ) {
    return res.status(400).json({ message: 'restaurarFaturas inválido' });
  }

  // Escopo: usuário + mês (+ cartão) (+ ids) e só quem ainda NÃO está no valor pedido.
  let cartao = null;
  let filtro = { userId: req.userId, ...filtroDoMes(mes) };
  if (cartaoId) {
    if (!mongoose.isValidObjectId(cartaoId)) return res.status(400).json({ message: 'cartaoId inválido' });
    cartao = await Cartao.findOne({ _id: cartaoId, userId: req.userId }).lean();
    if (!cartao) return res.status(404).json({ message: 'cartão não encontrado' });
    filtro = { ...filtro, ...filtroDespesasDoCartao(req.userId, cartao) };
  }
  if (ids) filtro._id = { $in: ids };
  // `$ne: true` também pega as antigas sem o campo (= não pagas).
  filtro.paga = paga ? { $ne: true } : true;

  const alvo = await Despesa.find(filtro).select('_id').lean();
  const idsAlterados = alvo.map((d) => d._id);
  let atualizadas = 0;
  if (idsAlterados.length) {
    atualizadas = (await Despesa.updateMany({ _id: { $in: idsAlterados }, userId: req.userId }, { $set: { paga } })).modifiedCount;
  }

  // FATURAS do mês (o "pago" das linhas calculadas): a do cartão, ou as de todos os cartões.
  const filtroFaturas = cartao ? { ...filtroFaturasDoCartao(req.userId, cartao), mes } : { userId: req.userId, mes };
  const [faturasDoMes, padrao] = await Promise.all([
    FaturaCartao.find(filtroFaturas).select('_id cartaoId paga'),
    // Faturas antigas (sem cartaoId) são do cartão padrão: resolve o id para a tela saber de qual cartão é.
    Cartao.findOne({ userId: req.userId, padrao: true }).select('_id').lean(),
  ]);
  const restaurar = restaurarFaturas ? new Map(restaurarFaturas.map((f) => [String(f._id), f.paga])) : null;

  const faturas = [];
  for (const fatura of faturasDoMes) {
    // Desfazer: só as faturas listadas, cada uma com o seu valor anterior; senão, o valor pedido.
    if (restaurar && !restaurar.has(String(fatura._id))) continue;
    const novo = restaurar ? restaurar.get(String(fatura._id)) : (faturaPaga ?? paga);
    const pagaAntes = Boolean(fatura.paga); // registros antigos sem o campo = false
    if (pagaAntes !== novo) {
      await FaturaCartao.updateOne({ _id: fatura._id, userId: req.userId }, { $set: { paga: novo, despesasMarcadas: [] } });
    }
    faturas.push({
      _id: String(fatura._id),
      cartaoId: String(fatura.cartaoId ?? padrao?._id ?? ''),
      pagaAntes,
      paga: novo,
    });
  }

  return res.json({
    atualizadas,
    ids: idsAlterados.map(String),
    faturas,
    faturaPagaAntes: cartao ? (faturas[0]?.pagaAntes ?? null) : null, // compatibilidade
  });
}

/**
 * Remove uma despesa do usuário autenticado.
 *
 * @route   DELETE /api/despesas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string} req.params.id  — ObjectId da despesa a remover.
 * @param   {string} [req.query.escopo] — só para despesa FIXA: `seguintes` = excluir também as cópias
 *                                        dela nos MESES SEGUINTES (mesma descrição normalizada). Padrão
 *                                        (ausente ou `mes`) = só esta. Escolha explícita do usuário.
 * @returns {200} `{ removidas }` — quantas foram excluídas (1 + as dos meses seguintes, se pedido).
 * @returns {400} `{ message }` — se `:id` não for um ObjectId válido ou `escopo` inválido.
 * @returns {404} `{ message }` — se a despesa não existe OU não pertence ao usuário.
 */
export async function removerDespesa(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }
  const escopo = req.query.escopo ?? 'mes';
  if (!['mes', 'seguintes'].includes(escopo)) return res.status(400).json({ message: 'escopo inválido' });

  const removida = await Despesa.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  }).lean();

  if (!removida) {
    return res.status(404).json({ message: 'despesa não encontrada' });
  }

  // "Este e os meses seguintes": também as cópias fixas posteriores (nunca meses anteriores).
  let removidas = 1;
  if (escopo === 'seguintes' && removida.recorrente) {
    const ids = await idsDosSeguintes('despesa', req.userId, removida);
    if (ids.length) removidas += (await Despesa.deleteMany({ _id: { $in: ids }, userId: req.userId })).deletedCount;
  }
  return res.json({ removidas });
}
