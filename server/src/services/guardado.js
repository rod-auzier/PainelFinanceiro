/**
 * "Total guardado" e conclusão automática das Metas.
 *
 * TOTAL GUARDADO = saldo inicial guardado (campo do usuário)
 *                + soma das receitas
 *                − soma das despesas      (de MES_INICIAL em diante; nada anterior conta)
 *
 * Antes de somar, garante que os fixos de todos os meses até o mês atual já foram
 * gerados (services/fixos.js) — senão o total mudaria só depois de abrir cada mês.
 *
 * CONCLUSÃO AUTOMÁTICA: quando o total guardado atinge o `valorAlvo` de uma
 * meta, ela é marcada como concluída sozinha — sem impedir o usuário de
 * marcar/desmarcar à mão. Para isso usamos a flag interna `alvoAtingido`:
 *   1) meta com alvo, `alvoAtingido: false` e total ≥ alvo  → `concluida: true`
 *      e `alvoAtingido: true` (dispara UMA vez);
 *   2) meta com `alvoAtingido: true` e total < alvo         → `alvoAtingido: false`
 *      (rearma, para disparar de novo se o total voltar a subir). A meta NÃO é
 *      desmarcada automaticamente.
 * Como a flag continua `true` depois do disparo, se o usuário desmarcar a meta
 * à mão ela NÃO é remarcada na próxima sincronização.
 *
 * Isolamento: tudo é filtrado por `userId`.
 */
import { Receita } from '../models/Receita.js';
import { Despesa } from '../models/Despesa.js';
import { Meta } from '../models/Meta.js';
import { User } from '../models/User.js';
import { garantirFixosAteMesAtual } from './fixos.js';
import { somarValor } from './totais.js';

/** Arredonda para centavos (evita 4999.999999… em somas de ponto flutuante). */
export const arredondar = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Calcula o total guardado do usuário (gerando antes os fixos pendentes até o mês atual).
 * @param   {string} userId
 * @returns {Promise<{ saldoInicial: number, saldoAcumulado: number, total: number }>}
 *          `saldoAcumulado` = receitas − despesas (de MES_INICIAL em diante); `total` = saldoInicial + saldoAcumulado.
 */
export async function calcularGuardado(userId) {
  await garantirFixosAteMesAtual(userId);

  const [usuario, receitas, despesas] = await Promise.all([
    User.findById(userId).select('saldoInicial'),
    somarValor(Receita, userId),
    somarValor(Despesa, userId),
  ]);

  const saldoInicial = arredondar(usuario?.saldoInicial ?? 0);
  const saldoAcumulado = arredondar(receitas - despesas);
  return { saldoInicial, saldoAcumulado, total: arredondar(saldoInicial + saldoAcumulado) };
}

/**
 * Aplica a conclusão automática (e o rearme) nas metas do usuário.
 * @param   {string} userId
 * @param   {number} total  total guardado já calculado (ver `calcularGuardado`)
 * @returns {Promise<void>}
 */
export async function sincronizarMetas(userId, total) {
  // 1) Alvo alcançado agora → conclui e marca que o gatilho já disparou.
  await Meta.updateMany(
    { userId, valorAlvo: { $gt: 0, $lte: total }, alvoAtingido: false },
    { $set: { concluida: true, alvoAtingido: true } },
  );

  // 2) Total caiu abaixo do alvo → rearma o gatilho (sem desmarcar a meta).
  await Meta.updateMany(
    { userId, valorAlvo: { $gt: total }, alvoAtingido: true },
    { $set: { alvoAtingido: false } },
  );
}

/**
 * Atalho: calcula o total guardado, sincroniza as metas e devolve o total.
 * @param   {string} userId
 */
export async function calcularESincronizar(userId) {
  const guardado = await calcularGuardado(userId);
  await sincronizarMetas(userId, guardado.total);
  return guardado;
}
