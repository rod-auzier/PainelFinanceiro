/**
 * Controller do "Total guardado" (abas Porquinho e Metas).
 *
 * Total guardado = soma das CAIXINHAS (aba Porquinho). Só isso — o resultado dos meses (receitas −
 * despesas) é informativo (média e mês em andamento) e não entra no total. Ver services/guardado.js.
 * As caixinhas substituíram o antigo campo único "Saldo inicial guardado" — por isso a rota
 * PUT /api/guardado (que o editava) deixou de existir; as caixinhas são editadas em /api/caixinhas.
 * Tudo filtrado por `req.userId` (injetado por `authRequired`).
 */
import { calcularGuardado } from '../services/guardado.js';

/**
 * Retorna o total guardado do usuário autenticado.
 *
 * @route   GET /api/guardado
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa apenas `req.userId`
 * @param   {import('express').Response} res
 * @returns {200} `{ totalCaixinhas, saldoAcumulado, total, mesesFechados, mediaMensal, emAndamento }` (valores em R$):
 *   - `totalCaixinhas` — soma dos valores das caixinhas;
 *   - `total`          — o TOTAL GUARDADO = totalCaixinhas;
 *   - `saldoAcumulado` — receitas − despesas dos MESES FECHADOS (informativo, fora do total; base da média);
 *   - `mesesFechados`  — quantos meses fechados existem (0 em outubro/2026);
 *   - `mediaMensal`    — média de (receitas − despesas) por mês FECHADO (= saldoAcumulado ÷ mesesFechados;
 *                        o mês atual não entra), ou `null` sem mês fechado. Base da previsão das metas;
 *   - `emAndamento`    — parcial do mês atual (informativo, fora do total):
 *                        `{ mes: "AAAA-MM", receitas, despesas, saldo, entraEm: "AAAA-MM-DD" }`
 *                        (`entraEm` = dia em que o mês fecha); `null` se o painel
 *                        ainda não começou.
 */
export async function obterGuardado(req, res) {
  res.json(await calcularGuardado(req.userId));
}
