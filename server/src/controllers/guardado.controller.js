/**
 * Controller do "Total guardado" (aba Metas).
 *
 * Total guardado = saldo inicial guardado + (receitas − despesas) dos
 * MESES FECHADOS: de MES_INICIAL (outubro/2026) até o mês anterior ao mês atual. O mês em
 * andamento NÃO entra (só passa a entrar no dia 1 do mês seguinte, no fuso America/Fortaleza). O saldo inicial é um único número por usuário (campo do User).
 * Tudo filtrado por `req.userId` (injetado por `authRequired`).
 */
import { User } from '../models/User.js';
import { arredondar, calcularESincronizar, calcularGuardado } from '../services/guardado.js';

/**
 * Retorna o total guardado do usuário autenticado.
 *
 * @route   GET /api/guardado
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa apenas `req.userId`
 * @param   {import('express').Response} res
 * @returns {200} `{ saldoInicial, saldoAcumulado, total, mesesFechados, mediaMensal, emAndamento }` (valores em R$):
 *   - `saldoInicial`   — o número que o usuário informou (0 por padrão);
 *   - `saldoAcumulado` — receitas − despesas dos MESES FECHADOS (de MES_INICIAL ao mês anterior ao atual);
 *   - `total`          — saldoInicial + saldoAcumulado (pode ser negativo);
 *   - `mesesFechados`  — quantos meses fechados existem (0 em outubro/2026);
 *   - `mediaMensal`    — média de (receitas − despesas) por mês FECHADO (= saldoAcumulado ÷ mesesFechados;
 *                        o mês atual não entra), ou `null` sem mês fechado. Base da previsão das metas;
 *   - `emAndamento`    — parcial do mês atual, AINDA NÃO somado ao total:
 *                        `{ mes: "AAAA-MM", receitas, despesas, saldo, entraEm: "AAAA-MM-DD" }`
 *                        (`entraEm` = dia em que passa a entrar no total); `null` se o painel
 *                        ainda não começou.
 */
export async function obterGuardado(req, res) {
  res.json(await calcularGuardado(req.userId));
}

/**
 * Define o "Saldo inicial guardado" do usuário (o que já tinha guardado antes
 * de usar o painel). Como o total muda, as metas são sincronizadas: as que
 * passarem a ter o alvo atingido são marcadas como concluídas.
 *
 * @route   PUT /api/guardado
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {object} req.body
 * @param   {number} req.body.saldoInicial — número ≥ 0.
 * @returns {200} `{ saldoInicial, saldoAcumulado, total, mesesFechados, mediaMensal, emAndamento }` — já com o novo saldo (mesmo formato do GET).
 * @returns {400} `{ message }` — `saldoInicial` ausente, não numérico ou negativo.
 */
export async function definirSaldoInicial(req, res) {
  const { saldoInicial } = req.body ?? {};

  if (typeof saldoInicial !== 'number' || !Number.isFinite(saldoInicial) || saldoInicial < 0) {
    return res.status(400).json({ message: 'saldoInicial deve ser um número maior ou igual a zero' });
  }

  await User.findByIdAndUpdate(req.userId, { saldoInicial: arredondar(saldoInicial) });
  return res.json(await calcularESincronizar(req.userId));
}
