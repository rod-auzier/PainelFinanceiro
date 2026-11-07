/**
 * Controller do "Total guardado" (aba Metas).
 *
 * Total guardado = saldo inicial guardado + (receitas − despesas) de todos os
 * meses. O saldo inicial é um único número por usuário (campo do User).
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
 * @returns {200} `{ saldoInicial, saldoAcumulado, total }` (valores em R$):
 *   - `saldoInicial`   — o número que o usuário informou (0 por padrão);
 *   - `saldoAcumulado` — receitas − despesas de todos os meses;
 *   - `total`          — saldoInicial + saldoAcumulado (pode ser negativo).
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
 * @returns {200} `{ saldoInicial, saldoAcumulado, total }` — já com o novo saldo.
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
