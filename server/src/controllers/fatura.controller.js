/**
 * Controller das Faturas do cartão de crédito (uma por usuário e mês).
 *
 * O usuário informa só o TOTAL da fatura; quanto dela não foi detalhado nas despesas é calculado
 * em services/cartao.js. Toda query filtra por `req.userId` (injetado pelo `authRequired`).
 * Todas as respostas de sucesso (menos o DELETE) devolvem a SITUAÇÃO DO CARTÃO no mês — o mesmo
 * objeto de `cartaoDoMes`: `{ fatura: { mes, valor, paga } | null, temFatura, detalhado,
 * naoDetalhado, totalCartao, excedeu }` — para a tela atualizar o card sem outra chamada.
 */
import { Despesa } from '../models/Despesa.js';
import { FaturaCartao } from '../models/FaturaCartao.js';
import { cartaoDoMes } from '../services/cartao.js';
import { filtroDoMes, lerMes } from '../utils/mes.js';

/**
 * Situação do cartão no mês (fatura informada, detalhado e não detalhado).
 *
 * @route   GET /api/faturas?mes=AAAA-MM
 * @access  Privado
 * @returns {200} situação do cartão (`fatura: null` quando não foi informada).
 * @returns {400} `{ message }` — `mes` ausente, mal formatado ou anterior a MES_INICIAL.
 */
export async function obterFatura(req, res) {
  const { mes, erro } = lerMes(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });
  res.json(await cartaoDoMes(req.userId, mes));
}

/**
 * Cria ou atualiza o TOTAL da fatura do mês (não mexe no status `paga`).
 *
 * @route   PUT /api/faturas/:mes
 * @access  Privado
 * @param   {number} req.body.valor  total da fatura, número ≥ 0.
 * @returns {200} situação do cartão já com o novo valor.
 * @returns {400} `{ message }` — `mes` ou `valor` inválidos.
 */
export async function salvarFatura(req, res) {
  const { mes, erro } = lerMes(req.params.mes);
  if (erro) return res.status(400).json({ message: erro });
  const { valor } = req.body ?? {};
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    return res.status(400).json({ message: 'O valor da fatura deve ser um número maior ou igual a zero.' });
  }

  await FaturaCartao.updateOne(
    { userId: req.userId, mes },
    { $set: { valor: Math.round(valor * 100) / 100 }, $setOnInsert: { userId: req.userId, mes } },
    { upsert: true, runValidators: true },
  );
  res.json(await cartaoDoMes(req.userId, mes));
}

/**
 * Marca / desmarca a fatura do mês como PAGA.
 *  - Marcar: marca também como pagas as despesas de cartão do mês que ainda estavam pendentes e
 *    guarda QUAIS foram (`despesasMarcadas`). A linha virtual passa a contar como paga.
 *  - Desmarcar: volta a pendente SÓ as despesas que esta ação marcou (as que o usuário já tinha
 *    pago à mão continuam pagas).
 * Repetir a mesma ação não muda nada.
 *
 * @route   PATCH /api/faturas/:mes/paga
 * @access  Privado
 * @param   {boolean} req.body.paga
 * @returns {200} situação do cartão + `despesasAlteradas` (quantas despesas mudaram de status).
 * @returns {400} `{ message }` — `mes` inválido ou `paga` não booleano.
 * @returns {404} `{ message }` — não há fatura informada para o mês.
 */
export async function marcarFaturaPaga(req, res) {
  const { mes, erro } = lerMes(req.params.mes);
  if (erro) return res.status(400).json({ message: erro });
  const { paga } = req.body ?? {};
  if (typeof paga !== 'boolean') return res.status(400).json({ message: 'paga deve ser true ou false' });

  const fatura = await FaturaCartao.findOne({ userId: req.userId, mes }).select('+despesasMarcadas');
  if (!fatura) return res.status(404).json({ message: 'Informe o total da fatura antes de marcá-la como paga.' });

  let despesasAlteradas = 0;
  if (paga && !fatura.paga) {
    // Só as despesas de cartão do mês AINDA pendentes (`$ne: true` pega também as antigas, sem o campo).
    const pendentes = await Despesa.find({ userId: req.userId, cartao: true, paga: { $ne: true }, ...filtroDoMes(mes) })
      .select('_id')
      .lean();
    const ids = pendentes.map((d) => d._id);
    if (ids.length) {
      const r = await Despesa.updateMany({ _id: { $in: ids }, userId: req.userId }, { paga: true });
      despesasAlteradas = r.modifiedCount;
    }
    fatura.paga = true;
    fatura.despesasMarcadas = ids;
    await fatura.save();
  } else if (!paga && fatura.paga) {
    // Desfaz APENAS o que a marcação da fatura fez.
    if (fatura.despesasMarcadas.length) {
      const r = await Despesa.updateMany({ _id: { $in: fatura.despesasMarcadas }, userId: req.userId }, { paga: false });
      despesasAlteradas = r.modifiedCount;
    }
    fatura.paga = false;
    fatura.despesasMarcadas = [];
    await fatura.save();
  }

  res.json({ ...(await cartaoDoMes(req.userId, mes)), despesasAlteradas });
}

/**
 * Remove a fatura informada do mês (o total de despesas volta a contar só as despesas lançadas).
 * Não mexe em nenhuma despesa.
 *
 * @route   DELETE /api/faturas/:mes
 * @access  Privado
 * @returns {204} sem corpo.
 * @returns {400} `{ message }` — `mes` inválido.
 * @returns {404} `{ message }` — não havia fatura para o mês.
 */
export async function removerFatura(req, res) {
  const { mes, erro } = lerMes(req.params.mes);
  if (erro) return res.status(400).json({ message: erro });
  const r = await FaturaCartao.deleteOne({ userId: req.userId, mes });
  if (r.deletedCount === 0) return res.status(404).json({ message: 'fatura não encontrada' });
  res.status(204).send();
}
