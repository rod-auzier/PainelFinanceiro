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
 *  - nome, sobrenome : nome do usuário (String, sem espaços nas pontas, até NOME_MAX caracteres).
 *             Preenchidos no cadastro. Usuários ANTIGOS não têm esses campos (ficam `undefined`) e o
 *             app não depende deles: sem nome, a tela usa o e-mail como nome exibido até a pessoa
 *             preencher pelo Perfil. Por isso NÃO são `required` no schema (a obrigatoriedade no
 *             cadastro é validada no controller).
 *  - senhaTentativas, senhaBloqueadoAte : controle de força bruta da TROCA DE SENHA (Perfil).
 *             Contam erros seguidos da "senha atual"; ao chegar em 5, `senhaBloqueadoAte` bloqueia
 *             novas tentativas por alguns minutos. `select: false`: internos, nunca vão para a API.
 *             Ficam no banco (e não na memória) porque na Vercel cada requisição pode cair numa
 *             instância diferente da função serverless.
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

/** Limite de caracteres de `nome` e de `sobrenome` (o mesmo vale na validação do controller e no formulário). */
export const NOME_MAX = 50;

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
    // Opcionais no schema (usuários antigos não os têm); obrigatórios só no cadastro.
    nome: { type: String, trim: true, maxlength: NOME_MAX },
    sobrenome: { type: String, trim: true, maxlength: NOME_MAX },
    // Anti força bruta da troca de senha (internos; nunca saem na API).
    senhaTentativas: { type: Number, default: 0, select: false },
    senhaBloqueadoAte: { type: Date, default: null, select: false },
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
    delete ret.senhaTentativas; // (já são `select: false`; garantia extra se vierem carregados)
    delete ret.senhaBloqueadoAte;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
