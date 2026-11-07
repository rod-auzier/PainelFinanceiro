/**
 * Model: User (usuário da aplicação)
 * ---------------------------------
 * Campos:
 *  - email  : identificador de login. Único no banco (índice `unique`),
 *             sempre normalizado para minúsculas e sem espaços nas pontas.
 *             Obrigatório.
 *  - senha  : hash da senha (algoritmo bcrypt, via `bcryptjs`) — NUNCA a
 *             senha em texto puro. `select: false` faz o campo NÃO vir em
 *             consultas por padrão, evitando vazar o hash nas respostas da API.
 *  - saldoInicial : "Saldo inicial guardado" — quanto o usuário já tinha guardado
 *             ANTES de usar o painel (um único número por usuário, editável na aba
 *             Metas). É somado ao resultado (receitas − despesas) para formar o
 *             "Total guardado". Padrão 0.
 *
 * `timestamps: true` adiciona automaticamente `createdAt` e `updatedAt`.
 *
 * Usamos `bcryptjs` (implementação em JS puro) em vez de `bcrypt` (módulo
 * nativo) porque roda sem problemas nas Serverless Functions da Vercel.
 * Os hashes são compatíveis entre as duas bibliotecas.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Custo do bcrypt: quanto maior, mais lento (e mais seguro). 10 é um bom padrão.
const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'email é obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    senha: {
      type: String,
      required: [true, 'senha é obrigatória'],
      select: false,
    },
    saldoInicial: {
      type: Number,
      default: 0,
      min: [0, 'saldoInicial não pode ser negativo'],
    },
  },
  { timestamps: true },
);

/**
 * Gera o hash da senha em texto puro e o guarda em `this.senha`.
 * Uso: `user.definirSenha('minhaSenha'); await user.save();`
 */
userSchema.methods.definirSenha = async function definirSenha(senhaTextoPuro) {
  this.senha = await bcrypt.hash(senhaTextoPuro, SALT_ROUNDS);
};

/**
 * Compara uma senha em texto puro com o hash armazenado.
 * Retorna `Promise<boolean>`.
 */
userSchema.methods.verificarSenha = function verificarSenha(senhaTextoPuro) {
  return bcrypt.compare(senhaTextoPuro, this.senha);
};

// Ao converter o documento para JSON (respostas da API), remove campos sensíveis.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.senha;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
