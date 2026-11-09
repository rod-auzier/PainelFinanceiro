/**
 * Model: Despesa (saída de dinheiro)
 * ----------------------------------
 * Campos:
 *  - userId     : referência (ObjectId) ao usuário dono da despesa.
 *                 Obrigatório e indexado (as consultas sempre filtram por ele).
 *  - descricao  : o que é a despesa (ex.: "Conta de luz", "Mercado"). Obrigatório.
 *  - categoria  : agrupador para relatórios (ex.: "Moradia", "Alimentação").
 *                 Opcional — assume "Outros" quando não informado.
 *  - valor      : quantia a pagar, em número. Obrigatório e não-negativo.
 *  - recorrente : lançamento FIXO que se repete todo mês (checkbox "Repete todo mês").
 *                  Padrão `false`. Só os recorrentes entram em "Copiar fixos do mês anterior".
 *  - paga       : a despesa já foi PAGA? (checkbox na lista de Despesas). Padrão `false` — as
 *                  despesas que já existiam (sem o campo) valem como não pagas. É só INFORMATIVO:
 *                  os totais e o saldo continuam somando TODAS as despesas, pagas ou não. Os fixos
 *                  gerados automaticamente NÃO herdam o status (entram sempre como não pagos) e a
 *                  edição (PUT) não o altera — só PATCH /api/despesas/:id (e o "marcar todas").
 *  - cartao     : a despesa foi paga no CARTÃO DE CRÉDITO? Padrão `false` (as despesas antigas, sem o
 *                  campo, valem como "não é cartão"). As despesas de cartão formam o "detalhado" da fatura
 *                  do mês (ver services/cartao.js): se o usuário informar o total da fatura, só a diferença
 *                  ainda não lançada é somada ao total — nada conta duas vezes. Os fixos copiados para o
 *                  mês seguinte mantêm o `cartao` da original.
 *  - createdAt  : data de registro da despesa. Gerada automaticamente pelo
 *                 `timestamps` do Mongoose (que também cria `updatedAt`).
 */
import mongoose from 'mongoose';

const despesaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    descricao: {
      type: String,
      required: [true, 'descricao é obrigatória'],
      trim: true,
    },
    categoria: {
      type: String,
      trim: true,
      default: 'Outros',
    },
    valor: {
      type: Number,
      required: [true, 'valor é obrigatório'],
      min: [0, 'valor não pode ser negativo'],
    },
    recorrente: {
      type: Boolean,
      default: false,
    },
    paga: {
      type: Boolean,
      default: false,
    },
    // Paga no cartão de crédito (ver services/cartao.js). Opcional; padrão "não é cartão".
    cartao: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const Despesa = mongoose.model('Despesa', despesaSchema);
