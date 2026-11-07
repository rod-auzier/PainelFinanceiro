/**
 * Model: Receita (entrada de dinheiro)
 * ------------------------------------
 * Campos:
 *  - userId    : referência (ObjectId) ao usuário dono da receita.
 *                Obrigatório e indexado — todas as consultas filtram por ele,
 *                garantindo que um usuário só veja os próprios dados.
 *  - fonte     : origem do dinheiro (ex.: "Salário", "Freelance", "Aluguel").
 *                Obrigatório.
 *  - descricao : texto livre com detalhes adicionais. Opcional.
 *  - valor     : quantia recebida, em número. Obrigatório e não-negativo.
 *  - recorrente: lançamento FIXO que se repete todo mês (checkbox "Repete todo mês").
 *                 Padrão `false`. Só os recorrentes entram em "Copiar fixos do mês anterior".
 *  - createdAt : data de registro da receita. Gerada automaticamente pelo
 *                `timestamps` do Mongoose (que também cria `updatedAt`).
 */
import mongoose from 'mongoose';

const receitaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fonte: {
      type: String,
      required: [true, 'fonte é obrigatória'],
      trim: true,
    },
    descricao: {
      type: String,
      trim: true,
      default: '',
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

export const Receita = mongoose.model('Receita', receitaSchema);
