/**
 * Model: Cartao (cartão de crédito do usuário — ex.: "PicPay", "Nubank")
 * ----------------------------------------------------------------------
 * Cada cartão tem a sua fatura por mês (FaturaCartao.cartaoId) e as suas despesas (Despesa.cartaoId).
 * A regra de cálculo (sem contar nada duas vezes) está em services/cartao.js.
 *
 * Campos:
 *  - userId : dono. Obrigatório e indexado — toda consulta filtra por ele.
 *  - nome   : 2 a 24 caracteres, sem espaços nas pontas; único por usuário (sem diferenciar maiúsculas).
 *  - chave  : `nome` normalizado (minúsculas, sem espaços nas pontas) — uso interno do índice único.
 *             Calculado sozinho no `pre('validate')`.
 *  - cor    : cor da bolinha/selo, "#RRGGBB".
 *  - padrao : `true` só no cartão "Cartão" criado automaticamente na transição do controle antigo
 *             (um cartão só). Ele "herda" as despesas antigas com `cartao: true` sem `cartaoId` e as
 *             faturas antigas sem `cartaoId` — que continuam como estão no banco, sem migração.
 *             No máximo um por usuário (índice único parcial).
 *  - createdAt / updatedAt : `timestamps` do Mongoose.
 */
import mongoose from 'mongoose';

export const NOME_MIN = 2;
export const NOME_MAX = 24;
export const COR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Nome normalizado para comparação. */
export const chaveCartao = (nome) => String(nome ?? '').trim().toLowerCase();

const cartaoSchema = new mongoose.Schema(
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
    chave: { type: String, select: false },
    cor: {
      type: String,
      required: [true, 'cor é obrigatória'],
      match: [COR_REGEX, 'cor deve estar no formato #RRGGBB'],
    },
    padrao: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Mantém `chave` em sincronia com `nome` (criação e `save()`).
cartaoSchema.pre('validate', function definirChave(next) {
  this.chave = chaveCartao(this.nome);
  next();
});

// Nome único por usuário (sem diferenciar maiúsculas).
cartaoSchema.index({ userId: 1, chave: 1 }, { unique: true });
// No máximo UM cartão padrão por usuário (também impede duplicar na transição com requisições simultâneas).
cartaoSchema.index({ userId: 1, padrao: 1 }, { unique: true, partialFilterExpression: { padrao: true } });

export const Cartao = mongoose.model('Cartao', cartaoSchema);
