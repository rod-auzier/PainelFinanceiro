/**
 * Controller de Resumo financeiro.
 * Agrega os valores das receitas e despesas do usuário autenticado.
 */
import { Receita } from '../models/Receita.js';
import { Despesa } from '../models/Despesa.js';
import { gerarFixosDoMesTodos } from '../services/fixos.js';
import { somarPagas, somarValor } from '../services/totais.js';
import { lerMesOpcional } from '../utils/mes.js';

/**
 * Retorna os totais financeiros do usuário autenticado.
 *
 * @route   GET /api/resumo?mes=AAAA-MM
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa `req.userId`
 * @param   {string} [req.query.mes]          — "AAAA-MM" (não anterior a MES_INICIAL): totais só
 *                                              daquele mês. Sem `mes`, totais de MES_INICIAL em diante.
 *                                              Com `mes`, abrir o mês também gera os fixos dele (como
 *                                              nas listas), para os totais já incluírem os recorrentes.
 * @param   {import('express').Response} res
 * @returns {200} JSON:
 *   ```
 *   {
 *     "totalReceitas": number,  // soma de todos os Receita.valor (do mês, se informado)
 *     "totalDespesas": number,  // soma de todos os Despesa.valor (do mês, se informado)
 *     "saldo":         number,  // totalReceitas - totalDespesas (pode ser negativo)
 *     "totalPago":     number,  // parte do totalDespesas já marcada como PAGA (informativo)
 *     "faltaPagar":    number,  // totalDespesas - totalPago (nunca negativo; informativo)
 *     "fixosGerados":  number   // fixos criados automaticamente nesta chamada (0 na maioria)
 *   }
 *   ```
 * @returns {400} `{ message }` — `mes` fora do formato AAAA-MM ou anterior a MES_INICIAL.
 * @returns {401} se o token estiver ausente/inválido (barrado pelo middleware antes de chegar aqui).
 */
export async function obterResumo(req, res) {
  const { mes, erro } = lerMesOpcional(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });

  // Abrir um mês gera os fixos dele (idempotente; só até o mês atual) ANTES de somar.
  const gerados = mes ? await gerarFixosDoMesTodos(req.userId, mes) : { total: 0 };

  const [totalReceitas, totalDespesas, totalPago] = await Promise.all([
    somarValor(Receita, req.userId, mes),
    somarValor(Despesa, req.userId, mes),
    somarPagas(Despesa, req.userId, mes),
  ]);

  // O saldo e o total usam TODAS as despesas, pagas ou não. `totalPago`/`faltaPagar` só
  // informam o andamento dos pagamentos.
  res.json({
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    totalPago,
    faltaPagar: Math.max(0, Math.round((totalDespesas - totalPago) * 100) / 100), // arredonda p/ centavos (evita 0,0000001)
    fixosGerados: gerados.total,
  });
}
