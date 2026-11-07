/**
 * Controller de Resumo financeiro.
 * Agrega os valores das receitas e despesas do usuário autenticado.
 */
import { Receita } from '../models/Receita.js';
import { Despesa } from '../models/Despesa.js';
import { somarValor } from '../services/totais.js';
import { lerMesOpcional } from '../utils/mes.js';

/**
 * Retorna os totais financeiros do usuário autenticado.
 *
 * @route   GET /api/resumo?mes=AAAA-MM
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa `req.userId`
 * @param   {string} [req.query.mes]          — "AAAA-MM": totais só daquele mês.
 *                                              Sem `mes`, totais de todos os meses.
 * @param   {import('express').Response} res
 * @returns {200} JSON:
 *   ```
 *   {
 *     "totalReceitas": number,  // soma de todos os Receita.valor (do mês, se informado)
 *     "totalDespesas": number,  // soma de todos os Despesa.valor (do mês, se informado)
 *     "saldo":         number   // totalReceitas - totalDespesas (pode ser negativo)
 *   }
 *   ```
 * @returns {400} `{ message }` — `mes` fora do formato AAAA-MM.
 * @returns {401} se o token estiver ausente/inválido (barrado pelo middleware antes de chegar aqui).
 */
export async function obterResumo(req, res) {
  const { mes, erro } = lerMesOpcional(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });

  const [totalReceitas, totalDespesas] = await Promise.all([
    somarValor(Receita, req.userId, mes),
    somarValor(Despesa, req.userId, mes),
  ]);

  res.json({
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
  });
}
