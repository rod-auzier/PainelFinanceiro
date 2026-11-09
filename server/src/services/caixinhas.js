/**
 * Regras das CAIXINHAS (aba "Porquinho").
 *
 * A soma das caixinhas substitui o antigo "Saldo inicial guardado" (campo `saldoInicial` do User,
 * que CONTINUA no banco, sem ser apagado nem alterado) no cálculo do Total guardado.
 *
 * TRANSIÇÃO "PREGUIÇOSA" (sem script de migração):
 *  Na primeira vez que o total guardado ou as caixinhas do usuário são consultados depois desta
 *  mudança, se ele tem `saldoInicial > 0` e nenhuma caixinha, criamos UMA caixinha "Saldo inicial"
 *  com esse valor e marcamos `caixinhasMigradas: true` no usuário — assim o total de hoje não muda
 *  e a migração nunca se repete (nem se a caixinha for excluída depois).
 *  Roda tanto ao abrir o Porquinho quanto ao calcular o total (Metas/Resumo): se rodasse só no
 *  Porquinho, quem abrisse as Metas antes veria o total sem o saldo inicial.
 *  CONCORRÊNCIA: a caixinha migrada tem `origem: 'saldoInicial'`, com índice único parcial por
 *  usuário; se duas requisições tentarem criar juntas, só uma consegue (a outra recebe 11000).
 *
 * Isolamento: toda função recebe o `userId` e filtra por ele.
 */
import mongoose from 'mongoose';
import { Caixinha, ORIGEM_SALDO_INICIAL } from '../models/Caixinha.js';
import { User } from '../models/User.js';

/** Máximo de caixinhas por usuário. */
export const LIMITE_CAIXINHAS = 20;

/** Nome da caixinha criada a partir do antigo saldo inicial. */
export const NOME_CAIXINHA_MIGRADA = 'Saldo inicial';

/**
 * Aplica (uma única vez por usuário) a transição do saldo inicial para caixinhas.
 * Idempotente e segura com requisições simultâneas. Nunca altera nem apaga o `saldoInicial`.
 * @param {string} userId
 */
export async function garantirMigracaoCaixinhas(userId) {
  const usuario = await User.findById(userId).select('saldoInicial caixinhasMigradas').lean();
  if (!usuario || usuario.caixinhasMigradas) return; // caminho rápido: já migrou

  const saldo = Number(usuario.saldoInicial ?? 0);
  if (saldo > 0 && (await Caixinha.countDocuments({ userId })) === 0) {
    await Caixinha.init(); // garante o índice único parcial antes de depender dele
    try {
      await Caixinha.create({ userId, nome: NOME_CAIXINHA_MIGRADA, valor: saldo, origem: ORIGEM_SALDO_INICIAL });
    } catch (erro) {
      if (erro?.code !== 11000) throw erro; // 11000: outra requisição já criou — tudo certo
    }
  }

  // Marca que a transição aconteceu (só ADICIONA o campo; nada existente é sobrescrito).
  await User.updateOne({ _id: userId }, { $set: { caixinhasMigradas: true } });
}

/**
 * Soma dos valores das caixinhas do usuário (em R$, sem arredondar).
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function somarCaixinhas(userId) {
  const [r] = await Caixinha.aggregate([
    // `aggregate` não converte tipos: o id do token (string) vira ObjectId à mão.
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: '$valor' } } },
  ]);
  return r?.total ?? 0;
}
