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
 *  - saldoInicial : LEGADO — o antigo "Saldo inicial guardado" (um único número, que era editado na
 *             aba Metas). NÃO entra mais no Total guardado: foi substituído pela soma das CAIXINHAS
 *             (aba Porquinho). O campo é mantido no banco (nunca apagado nem alterado) e é lido uma
 *             única vez, na transição: vira a caixinha "Saldo inicial" (services/caixinhas.js).
 *  - fixosAjustados : `true` depois do AJUSTE ÚNICO dos fixos existentes (cartão/categoria copiados do mês
 *             anterior para os fixos seguintes sem cartão — services/propagacao.js). Impede repetir.
 *  - cartoesMigrados : `true` depois que a transição "um cartão → vários cartões" rodou para o usuário
 *             (criação do cartão padrão "Cartão", se havia dados antigos). Impede repetir.
 *  - caixinhasReferencia : LEGADO / IGNORADO. Mês de referência dos saldos das caixinhas, de uma regra
 *             anterior do Total guardado. Hoje o total é só a soma das caixinhas, então o campo NÃO é
 *             lido em lugar nenhum; fica no schema apenas para não perder o dado já gravado.
 *  - caixinhasMigradas : `true` depois que essa transição rodou para o usuário — impede que a
 *             caixinha "Saldo inicial" seja criada de novo. Ausente/`false` em quem ainda não abriu
 *             o app desde a mudança.
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
    // Marca da transição saldo inicial → caixinhas (ver services/caixinhas.js).
    caixinhasMigradas: { type: Boolean, default: false },
    // LEGADO / IGNORADO (ver o comentário do topo): mantido só para não perder o dado gravado.
    caixinhasReferencia: { type: String },
    // Marca da transição para vários cartões de crédito (ver services/cartao.js).
    cartoesMigrados: { type: Boolean, default: false },
    // Marca do ajuste único dos fixos existentes (ver services/propagacao.js).
    fixosAjustados: { type: Boolean, default: false },
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
