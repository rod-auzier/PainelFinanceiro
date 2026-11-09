/**
 * Controller de Categorias (categorias PERSONALIZADAS de despesa).
 *
 * Toda query filtra por `req.userId` (injetado pelo `authRequired`): um usuário nunca vê nem
 * altera categorias — ou despesas — de outro. As regras gerais (padrão no 1º acesso, "Outros"
 * protegida, ligação pelo nome) estão em services/categorias.js.
 */
import mongoose from 'mongoose';
import { Categoria, COR_REGEX, NOME_MAX, NOME_MIN, chaveCategoria } from '../models/Categoria.js';
import { Despesa } from '../models/Despesa.js';
import {
  LIMITE_CATEGORIAS,
  NOME_OUTROS,
  contarDespesasPorCategoria,
  ehOutros,
  filtroCategoriaDespesa,
  garantirCategorias,
} from '../services/categorias.js';

/** Valida o nome (já sem espaços nas pontas). @returns {string|null} mensagem de erro ou null */
function erroNome(nome) {
  if (typeof nome !== 'string' || nome.trim().length < NOME_MIN || nome.trim().length > NOME_MAX) {
    return `O nome deve ter de ${NOME_MIN} a ${NOME_MAX} caracteres.`;
  }
  return null;
}

/** Valida a cor. @returns {string|null} mensagem de erro ou null */
function erroCor(cor) {
  return typeof cor === 'string' && COR_REGEX.test(cor) ? null : 'A cor deve estar no formato #RRGGBB.';
}

/** Resposta padrão para nome repetido (índice único userId+chave). */
const NOME_REPETIDO = 'Já existe uma categoria com esse nome.';

/**
 * Lista as categorias do usuário. No 1º acesso cria as 5 padrão (transição preguiçosa).
 * Cada categoria vem com `qtdDespesas` — quantas despesas (de todos os meses) usam aquele nome —
 * para a tela avisar quantas seriam movidas para "Outros" ao excluir.
 *
 * @route   GET /api/categorias
 * @access  Privado
 * @returns {200} `{ categorias: Array<{ _id, nome, cor, createdAt, updatedAt, qtdDespesas }>, limite }`
 *               em ordem de criação.
 */
export async function listarCategorias(req, res) {
  await garantirCategorias(req.userId);
  const [categorias, contagem] = await Promise.all([
    Categoria.find({ userId: req.userId }).sort({ createdAt: 1, _id: 1 }).lean(),
    contarDespesasPorCategoria(req.userId),
  ]);
  res.json({
    categorias: categorias.map((c) => ({ ...c, qtdDespesas: contagem.get(chaveCategoria(c.nome)) ?? 0 })),
    limite: LIMITE_CATEGORIAS,
  });
}

/**
 * Cria uma categoria.
 *
 * @route   POST /api/categorias
 * @access  Privado
 * @param   {string} req.body.nome  2 a 24 caracteres; único por usuário (sem diferenciar maiúsculas).
 * @param   {string} req.body.cor   "#RRGGBB".
 * @returns {201} `{ categoria }`
 * @returns {400} `{ message }` — nome/cor inválidos ou limite de 15 categorias atingido.
 * @returns {409} `{ message }` — já existe categoria com esse nome.
 */
export async function criarCategoria(req, res) {
  const { nome, cor } = req.body ?? {};
  const erro = erroNome(nome) ?? erroCor(cor);
  if (erro) return res.status(400).json({ message: erro });

  await garantirCategorias(req.userId); // as padrão contam no limite
  const total = await Categoria.countDocuments({ userId: req.userId });
  if (total >= LIMITE_CATEGORIAS) {
    return res.status(400).json({ message: `Limite de ${LIMITE_CATEGORIAS} categorias atingido.` });
  }

  try {
    const categoria = await Categoria.create({ userId: req.userId, nome: nome.trim(), cor: cor.toUpperCase() });
    return res.status(201).json({ categoria: { ...categoria.toObject(), chave: undefined, qtdDespesas: 0 } });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: NOME_REPETIDO });
    throw e;
  }
}

/**
 * Renomeia e/ou troca a cor de uma categoria.
 * Ao RENOMEAR, as despesas do usuário que usam o nome antigo passam a usar o novo (só o campo
 * `categoria` delas; nada mais muda) — assim não ficam órfãs. "Outros" só pode trocar a cor.
 *
 * @route   PATCH /api/categorias/:id
 * @access  Privado
 * @param   {string} [req.body.nome]  novo nome (mesmas regras da criação).
 * @param   {string} [req.body.cor]   nova cor "#RRGGBB". Ao menos um dos dois.
 * @returns {200} `{ categoria, despesasAtualizadas }` — quantas despesas trocaram de nome.
 * @returns {400} `{ message }` — id/nome/cor inválidos, nada a alterar ou tentativa de renomear "Outros".
 * @returns {404} `{ message }` — categoria inexistente OU de outro usuário.
 * @returns {409} `{ message }` — já existe outra categoria com esse nome.
 */
export async function atualizarCategoria(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }
  const { nome, cor } = req.body ?? {};
  if (nome === undefined && cor === undefined) {
    return res.status(400).json({ message: 'Informe o nome e/ou a cor.' });
  }
  const erro = (nome !== undefined ? erroNome(nome) : null) ?? (cor !== undefined ? erroCor(cor) : null);
  if (erro) return res.status(400).json({ message: erro });

  const categoria = await Categoria.findOne({ _id: req.params.id, userId: req.userId });
  if (!categoria) return res.status(404).json({ message: 'categoria não encontrada' });

  const nomeAntigo = categoria.nome;
  const novoNome = nome !== undefined ? nome.trim() : nomeAntigo;
  const renomeou = novoNome !== nomeAntigo;
  if (renomeou && ehOutros(nomeAntigo)) {
    return res.status(400).json({ message: `A categoria "${NOME_OUTROS}" não pode ser renomeada.` });
  }

  categoria.nome = novoNome;
  if (cor !== undefined) categoria.cor = cor.toUpperCase();
  try {
    await categoria.save(); // `save` (e não findOneAndUpdate) para recalcular a `chave`
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: NOME_REPETIDO });
    throw e;
  }

  // Leva as despesas do nome antigo para o novo (só deste usuário).
  let despesasAtualizadas = 0;
  if (renomeou) {
    const r = await Despesa.updateMany(
      { userId: req.userId, categoria: filtroCategoriaDespesa(nomeAntigo) },
      { categoria: novoNome },
    );
    despesasAtualizadas = r.modifiedCount;
  }

  return res.json({ categoria: { ...categoria.toObject(), chave: undefined }, despesasAtualizadas });
}

/**
 * Exclui uma categoria. As despesas dela NÃO são apagadas: passam para "Outros".
 * "Outros" não pode ser excluída.
 *
 * @route   DELETE /api/categorias/:id
 * @access  Privado
 * @returns {200} `{ movidas }` — quantas despesas foram para "Outros".
 * @returns {400} `{ message }` — id inválido ou tentativa de excluir "Outros".
 * @returns {404} `{ message }` — categoria inexistente OU de outro usuário.
 */
export async function removerCategoria(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }
  const categoria = await Categoria.findOne({ _id: req.params.id, userId: req.userId });
  if (!categoria) return res.status(404).json({ message: 'categoria não encontrada' });
  if (ehOutros(categoria.nome)) {
    return res.status(400).json({ message: `A categoria "${NOME_OUTROS}" não pode ser excluída.` });
  }

  // Garante que "Outros" existe (destino das despesas) e usa o nome exato dela.
  await garantirCategorias(req.userId);
  const outros = await Categoria.findOne({ userId: req.userId, chave: chaveCategoria(NOME_OUTROS) });

  // Primeiro move as despesas (nunca apaga nenhuma), depois remove a categoria.
  const r = await Despesa.updateMany(
    { userId: req.userId, categoria: filtroCategoriaDespesa(categoria.nome) },
    { categoria: outros?.nome ?? NOME_OUTROS },
  );
  await Categoria.deleteOne({ _id: categoria._id, userId: req.userId });

  return res.json({ movidas: r.modifiedCount });
}
