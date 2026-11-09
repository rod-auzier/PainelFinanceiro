/**
 * Controller das Faturas — uma por usuário, CARTÃO e mês.
 *
 * O usuário informa só o TOTAL da fatura de cada cartão; quanto dela não foi detalhado nas despesas
 * daquele cartão é calculado em services/cartao.js. Toda query filtra por `req.userId`.
 * As respostas de sucesso (menos o DELETE) devolvem a SITUAÇÃO DOS CARTÕES no mês — o mesmo objeto de
 * `cartoesDoMes`: `{ cartoes: [{ cartao, fatura, temFatura, detalhado, naoDetalhado, totalCartao,
 * excedeu }], naoDetalhado, excedeu }` — para a tela atualizar os cards sem outra chamada.
 *
 * Faturas ANTIGAS (sem `cartaoId`) pertencem ao cartão padrão: os filtros de services/cartao.js
 * (`filtroFaturasDoCartao`) as encontram ao salvar/marcar/remover a fatura do padrão — sem reescrevê-las.
 */
import mongoose from 'mongoose';
import { Cartao } from '../models/Cartao.js';
import { Despesa } from '../models/Despesa.js';
import { FaturaCartao } from '../models/FaturaCartao.js';
import { cartoesDoMes, filtroDespesasDoCartao, filtroFaturasDoCartao, prepararIndicesFatura } from '../services/cartao.js';
import { filtroDoMes, lerMes } from '../utils/mes.js';

/**
 * Valida `:mes` e `:cartaoId` e carrega o cartão (só do próprio usuário).
 * @returns {Promise<{ mes?: string, cartao?: object, status?: number, message?: string }>}
 */
async function lerParametros(req) {
  const { mes, erro } = lerMes(req.params.mes);
  if (erro) return { status: 400, message: erro };
  if (!mongoose.isValidObjectId(req.params.cartaoId)) return { status: 400, message: 'cartaoId inválido' };
  const cartao = await Cartao.findOne({ _id: req.params.cartaoId, userId: req.userId }).lean();
  if (!cartao) return { status: 404, message: 'cartão não encontrado' };
  return { mes, cartao };
}

/** Filtro da fatura de UM cartão em UM mês (o padrão também acha a antiga, sem `cartaoId`). */
const filtroFatura = (userId, cartao, mes) => ({ ...filtroFaturasDoCartao(userId, cartao), mes });

/**
 * Situação de todos os cartões no mês.
 *
 * @route   GET /api/faturas?mes=AAAA-MM
 * @access  Privado
 * @returns {200} situação dos cartões · {400} `mes` ausente/inválido.
 */
export async function obterFaturas(req, res) {
  const { mes, erro } = lerMes(req.query.mes);
  if (erro) return res.status(400).json({ message: erro });
  res.json(await cartoesDoMes(req.userId, mes));
}

/**
 * Cria ou atualiza o TOTAL da fatura de um cartão no mês (não mexe no status `paga`).
 *
 * @route   PUT /api/faturas/:mes/:cartaoId
 * @access  Privado
 * @param   {number} req.body.valor  número ≥ 0.
 * @returns {200} situação dos cartões · {400} validação · {404} cartão inexistente/de outro usuário.
 */
export async function salvarFatura(req, res) {
  const { mes, cartao, status, message } = await lerParametros(req);
  if (status) return res.status(status).json({ message });
  const { valor } = req.body ?? {};
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    return res.status(400).json({ message: 'O valor da fatura deve ser um número maior ou igual a zero.' });
  }

  await prepararIndicesFatura(); // tira o índice antigo (usuário+mês), senão 2 cartões não teriam fatura no mesmo mês
  const valorCentavos = Math.round(valor * 100) / 100;
  const existente = await FaturaCartao.findOne(filtroFatura(req.userId, cartao, mes)).select('_id');
  if (existente) {
    await FaturaCartao.updateOne({ _id: existente._id, userId: req.userId }, { $set: { valor: valorCentavos } });
  } else {
    try {
      await FaturaCartao.create({ userId: req.userId, cartaoId: cartao._id, mes, valor: valorCentavos });
    } catch (e) {
      if (e?.code !== 11000) throw e;
      // Outra requisição criou ao mesmo tempo: só atualiza o valor.
      await FaturaCartao.updateOne({ userId: req.userId, cartaoId: cartao._id, mes }, { $set: { valor: valorCentavos } });
    }
  }
  res.json(await cartoesDoMes(req.userId, mes));
}

/**
 * Marca / desmarca a fatura de um cartão no mês como PAGA.
 *  - Marcar: marca também como pagas as despesas DAQUELE cartão no mês que ainda estavam pendentes e
 *    guarda QUAIS foram (`despesasMarcadas`). A linha virtual do cartão passa a contar como paga.
 *  - Desmarcar: volta a pendente SÓ as despesas que esta ação marcou.
 * Repetir a mesma ação não muda nada.
 *
 * @route   PATCH /api/faturas/:mes/:cartaoId/paga
 * @access  Privado
 * @param   {boolean} req.body.paga
 * @returns {200} situação dos cartões + `despesasAlteradas` · {400} validação · {404} sem cartão/fatura.
 */
export async function marcarFaturaPaga(req, res) {
  const { mes, cartao, status, message } = await lerParametros(req);
  if (status) return res.status(status).json({ message });
  const { paga } = req.body ?? {};
  if (typeof paga !== 'boolean') return res.status(400).json({ message: 'paga deve ser true ou false' });

  const fatura = await FaturaCartao.findOne(filtroFatura(req.userId, cartao, mes)).select('+despesasMarcadas');
  if (!fatura) return res.status(404).json({ message: 'Informe o total da fatura antes de marcá-la como paga.' });

  let despesasAlteradas = 0;
  if (paga && !fatura.paga) {
    // Despesas DESTE cartão no mês ainda pendentes (`$ne: true` pega também as antigas, sem o campo).
    const pendentes = await Despesa.find({
      ...filtroDespesasDoCartao(req.userId, cartao),
      paga: { $ne: true },
      ...filtroDoMes(mes),
    })
      .select('_id')
      .lean();
    const ids = pendentes.map((d) => d._id);
    if (ids.length) {
      despesasAlteradas = (await Despesa.updateMany({ _id: { $in: ids }, userId: req.userId }, { paga: true })).modifiedCount;
    }
    fatura.paga = true;
    fatura.despesasMarcadas = ids;
    await fatura.save();
  } else if (!paga && fatura.paga) {
    // Desfaz APENAS o que a marcação da fatura fez.
    if (fatura.despesasMarcadas.length) {
      despesasAlteradas = (
        await Despesa.updateMany({ _id: { $in: fatura.despesasMarcadas }, userId: req.userId }, { paga: false })
      ).modifiedCount;
    }
    fatura.paga = false;
    fatura.despesasMarcadas = [];
    await fatura.save();
  }

  res.json({ ...(await cartoesDoMes(req.userId, mes)), despesasAlteradas });
}

/**
 * Remove a fatura informada de um cartão no mês (o total volta a contar só as despesas lançadas
 * desse cartão). Não mexe em nenhuma despesa.
 *
 * @route   DELETE /api/faturas/:mes/:cartaoId
 * @access  Privado
 * @returns {204} · {400} validação · {404} cartão ou fatura inexistente.
 */
export async function removerFatura(req, res) {
  const { mes, cartao, status, message } = await lerParametros(req);
  if (status) return res.status(status).json({ message });
  const r = await FaturaCartao.deleteOne(filtroFatura(req.userId, cartao, mes));
  if (r.deletedCount === 0) return res.status(404).json({ message: 'fatura não encontrada' });
  res.status(204).send();
}
