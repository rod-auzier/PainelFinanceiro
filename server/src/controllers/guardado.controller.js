/**
 * Controller do "Total guardado" (abas Porquinho e Metas).
 *
 * Total guardado = soma das CAIXINHAS (aba Porquinho) + (receitas − despesas) dos MESES FECHADOS:
 * de MES_INICIAL (outubro/2026) até o mês anterior ao mês atual. O mês em andamento NÃO entra (só
 * passa a entrar no dia 1 do mês seguinte, no fuso America/Fortaleza).
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
 *   - `totalCaixinhas` — soma dos valores das caixinhas (saldo em 01/10/2026);
 *   - `saldoAcumulado` — receitas − despesas dos MESES FECHADOS (de MES_INICIAL ao mês anterior ao atual);
 *   - `total`          — totalCaixinhas + saldoAcumulado (pode ser negativo);
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
