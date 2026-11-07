/**
 * Totais agregados de receitas e despesas (feitos no MongoDB, não em memória).
 * Compartilhado pelo Resumo (controllers/resumo.controller.js) e pelo
 * "Total guardado" das Metas (services/guardado.js).
 */
import mongoose from 'mongoose';
import { filtroDoMes } from '../utils/mes.js';

/**
 * Soma o campo `valor` de todos os documentos de um model pertencentes a um
 * usuário, via aggregation.
 *
 * @param   {import('mongoose').Model} Model   — `Receita` ou `Despesa`
 * @param   {string} userId                    — id do usuário (string vinda do JWT)
 * @param   {string} [mes]                     — "AAAA-MM": soma só desse mês (pelo `createdAt`);
 *                                               sem `mes`, soma todos os meses
 * @returns {Promise<number>}                  — soma dos valores; 0 se não houver documentos
 */
export async function somarValor(Model, userId, mes) {
  const [resultado] = await Model.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        ...(mes ? filtroDoMes(mes) : {}),
      },
    },
    { $group: { _id: null, total: { $sum: '$valor' } } },
  ]);
  return resultado?.total ?? 0;
}
