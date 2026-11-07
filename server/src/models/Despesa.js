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
  },
  { timestamps: true },
);

export const Despesa = mongoose.model('Despesa', despesaSchema);
