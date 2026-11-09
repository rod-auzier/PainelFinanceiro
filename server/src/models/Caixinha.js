/**
 * Model: Caixinha (um lugar onde o usuário guarda dinheiro — aba "Porquinho")
 * --------------------------------------------------------------------------
 * Ex.: "Caixinha Nubank" R$ 10.000, "Carteira Binance" R$ 30.000. A SOMA das caixinhas substitui o
 * antigo campo único "Saldo inicial guardado" no cálculo do Total guardado (services/guardado.js).
 *
 * Campos:
 *  - userId    : dono. Obrigatório e indexado — toda consulta filtra por ele.
 *  - nome      : 2 a 30 caracteres, sem espaços nas pontas.
 *  - valor     : quanto há nela, em R$ (Number ≥ 0).
 *  - origem    : uso INTERNO. Só a caixinha criada automaticamente a partir do antigo saldo inicial
 *                tem `origem: 'saldoInicial'`. O índice único parcial abaixo garante que ela seja
 *                criada UMA vez por usuário, mesmo com duas requisições chegando juntas.
 *  - createdAt / updatedAt : gerados pelo `timestamps` do Mongoose.
 */
import mongoose from 'mongoose';

export const NOME_MIN = 2;
export const NOME_MAX = 30;

/** Valor de `origem` da caixinha criada a partir do antigo "Saldo inicial guardado". */
export const ORIGEM_SALDO_INICIAL = 'saldoInicial';

const caixinhaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    nome: {
      type: String,
      required: [true, 'nome é obrigatório'],
      trim: true,
      minlength: [NOME_MIN, `nome deve ter de ${NOME_MIN} a ${NOME_MAX} caracteres`],
      maxlength: [NOME_MAX, `nome deve ter de ${NOME_MIN} a ${NOME_MAX} caracteres`],
    },
    valor: {
      type: Number,
      required: [true, 'valor é obrigatório'],
      min: [0, 'valor não pode ser negativo'],
    },
    origem: {
      type: String,
      select: false, // detalhe interno: não vai para a API
    },
  },
  { timestamps: true },
);

// No máximo UMA caixinha "migrada do saldo inicial" por usuário (só vale para quem tem `origem`).
caixinhaSchema.index(
  { userId: 1, origem: 1 },
  { unique: true, partialFilterExpression: { origem: { $exists: true } } },
);

export const Caixinha = mongoose.model('Caixinha', caixinhaSchema);
