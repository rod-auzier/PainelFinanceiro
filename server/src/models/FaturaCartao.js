/**
 * Model: FaturaCartao (total da fatura do cartão de crédito de um mês)
 * --------------------------------------------------------------------
 * O usuário informa só o TOTAL da fatura do mês de CADA cartão; o painel calcula quanto dela NÃO foi
 * detalhado nas despesas daquele cartão (ver services/cartao.js). Uma fatura por usuário, cartão e mês
 * (índice único). Faturas ANTIGAS (do tempo de um cartão só) não têm `cartaoId` e valem para o cartão
 * padrão — continuam como estão no banco.
 *
 * Campos:
 *  - userId : dono. Obrigatório — toda consulta filtra por ele.
 *  - cartaoId : cartão a que a fatura pertence (Cartao). Ausente nas faturas antigas = cartão padrão.
 *  - mes    : "AAAA-MM" — o mês a que a fatura se refere (o mesmo mês das despesas de cartão).
 *  - valor  : total da fatura em R$ (Number ≥ 0).
 *  - paga   : a fatura foi paga? Padrão `false`. Marcar como paga também marca as despesas de
 *             cartão do mês (e a linha virtual "Outras compras no cartão" conta como paga).
 *  - despesasMarcadas : uso INTERNO. Ids das despesas que ESTA ação de "fatura paga" marcou como
 *             pagas — para, ao desmarcar a fatura, desfazer só o que ela marcou (as que o usuário já
 *             tinha marcado à mão continuam pagas). `select: false`: não vai para a API.
 *  - createdAt / updatedAt : `timestamps` do Mongoose.
 *
 * O valor da fatura NÃO é copiado para o mês seguinte (muda todo mês).
 */
import mongoose from 'mongoose';

const faturaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cartaoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cartao',
      default: undefined, // as antigas não têm; ausente = cartão padrão
    },
    mes: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'mes deve estar no formato AAAA-MM'],
    },
    valor: {
      type: Number,
      required: true,
      min: [0, 'valor não pode ser negativo'],
    },
    paga: {
      type: Boolean,
      default: false,
    },
    despesasMarcadas: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      select: false,
    },
  },
  { timestamps: true },
);

// Uma fatura por usuário, CARTÃO e mês. (O índice antigo, só usuário+mês, é removido uma vez por
// `prepararIndicesFatura` em services/cartao.js — remover um índice não apaga dado nenhum.)
faturaSchema.index({ userId: 1, cartaoId: 1, mes: 1 }, { unique: true });

export const FaturaCartao = mongoose.model('FaturaCartao', faturaSchema);
