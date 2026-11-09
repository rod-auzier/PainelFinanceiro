/**
 * Model: Categoria (categoria PERSONALIZADA de despesa, por usuário)
 * -----------------------------------------------------------------
 * Antes as categorias eram 5 fixas no código. Agora cada usuário tem as suas, que ele pode
 * criar, renomear, recolorir e excluir (ver services/categorias.js e categoria.controller.js).
 *
 * Campos:
 *  - userId    : dono da categoria. Obrigatório e indexado — toda consulta filtra por ele.
 *  - nome      : nome exibido (ex.: "Utilidades"). 2 a 24 caracteres, sem espaços nas pontas.
 *  - chave     : o `nome` NORMALIZADO (minúsculas, sem espaços nas pontas). Uso interno: é o que
 *                garante, com o índice único abaixo, que um usuário não tenha duas categorias com
 *                o mesmo nome só mudando maiúsculas ("Lazer" × "lazer"). Calculado sozinho no
 *                `pre('validate')`, então quem cria/edita só informa `nome`.
 *  - cor       : cor da bolinha/fatia, hex "#RRGGBB".
 *  - createdAt : gerado pelo `timestamps` do Mongoose (que também cria `updatedAt`).
 *
 * LIGAÇÃO COM AS DESPESAS: a Despesa continua guardando o NOME da categoria como texto (campo
 * `categoria`), como sempre foi — nenhuma despesa antiga precisa ser migrada. A ligação é feita
 * pelo nome, sem diferenciar maiúsculas (ver `chaveCategoria`).
 */
import mongoose from 'mongoose';

export const NOME_MIN = 2;
export const NOME_MAX = 24;
export const COR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Nome normalizado para comparação: sem espaços nas pontas e em minúsculas. */
export const chaveCategoria = (nome) => String(nome ?? '').trim().toLowerCase();

const categoriaSchema = new mongoose.Schema(
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
    chave: {
      type: String,
      select: false, // detalhe interno: não vai para a API
    },
    cor: {
      type: String,
      required: [true, 'cor é obrigatória'],
      match: [COR_REGEX, 'cor deve estar no formato #RRGGBB'],
    },
  },
  { timestamps: true },
);

// Mantém `chave` sempre em sincronia com `nome` (criação e `save()`).
categoriaSchema.pre('validate', function definirChave(next) {
  this.chave = chaveCategoria(this.nome);
  next();
});

// Nome único POR USUÁRIO, sem diferenciar maiúsculas (via `chave`). Também é o que impede
// duplicar as categorias padrão se duas requisições chegarem juntas no 1º acesso.
categoriaSchema.index({ userId: 1, chave: 1 }, { unique: true });

export const Categoria = mongoose.model('Categoria', categoriaSchema);
