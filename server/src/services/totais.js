/**
 * Totais agregados de receitas e despesas (feitos no MongoDB, não em memória).
 * Compartilhado pelo Resumo (controllers/resumo.controller.js) e pelo
 * "Total guardado" das Metas (services/guardado.js).
 */
import mongoose from 'mongoose';
import { MES_INICIAL, filtroDesdeInicio, filtroDoMes, limitesDoMes } from '../utils/mes.js';

/**
 * Soma `valor` dos documentos de um usuário que satisfaçam um filtro de `createdAt`.
 * @param {import('mongoose').Model} Model
 * @param {string} userId
 * @param {object} filtroData  ex.: `{ createdAt: { $gte, $lt } }`
 */
async function somarComFiltro(Model, userId, filtroData) {
  const [resultado] = await Model.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), ...filtroData } },
    { $group: { _id: null, total: { $sum: '$valor' } } },
  ]);
  return resultado?.total ?? 0;
}

/**
 * Soma o campo `valor` de todos os documentos de um model pertencentes a um
 * usuário, via aggregation.
 *
 * @param   {import('mongoose').Model} Model   — `Receita` ou `Despesa`
 * @param   {string} userId                    — id do usuário (string vinda do JWT)
 * @param   {string} [mes]                     — "AAAA-MM": soma só desse mês (pelo `createdAt`);
 *                                               sem `mes`, soma de MES_INICIAL em diante (nunca
 *                                               conta lançamentos anteriores ao início do painel)
 * @returns {Promise<number>}                  — soma dos valores; 0 se não houver documentos
 */
export function somarValor(Model, userId, mes) {
  return somarComFiltro(Model, userId, mes ? filtroDoMes(mes) : filtroDesdeInicio());
}

/**
 * Soma o `valor` só das DESPESAS PAGAS (`paga: true`) de um mês (ou de MES_INICIAL em diante,
 * sem `mes`). Informativo: alimenta o "Pago / Falta pagar" do Resumo; o total e o saldo
 * continuam somando TODAS as despesas. Despesas antigas, sem o campo `paga`, não casam com
 * `paga: true` — contam como pendentes.
 *
 * @param   {import('mongoose').Model} Model  — `Despesa`
 * @param   {string} userId                   — isolamento por usuário
 * @param   {string} [mes]                    — "AAAA-MM"
 * @returns {Promise<number>}
 */
export function somarPagas(Model, userId, mes) {
  return somarComFiltro(Model, userId, { paga: true, ...(mes ? filtroDoMes(mes) : filtroDesdeInicio()) });
}

/**
 * Soma só os MESES FECHADOS: de MES_INICIAL até o mês ANTERIOR ao mês atual. O mês
 * atual (em andamento) e meses futuros NÃO entram. Ex.: hoje em 07/11/2026 → só outubro;
 * novembro passa a entrar em 01/12/2026.
 *
 * @param   {import('mongoose').Model} Model
 * @param   {string} userId
 * @param   {string} mesAtualRef  mês atual "AAAA-MM" (use `mesAtual()` de utils/mes.js)
 * @returns {Promise<number>}  0 se ainda não há mês fechado (mês atual ≤ MES_INICIAL)
 */
export function somarMesesFechados(Model, userId, mesAtualRef) {
  if (mesAtualRef <= MES_INICIAL) return Promise.resolve(0); // outubro/2026 ainda está em andamento
  return somarComFiltro(Model, userId, {
    createdAt: { $gte: limitesDoMes(MES_INICIAL).inicio, $lt: limitesDoMes(mesAtualRef).inicio },
  });
}
