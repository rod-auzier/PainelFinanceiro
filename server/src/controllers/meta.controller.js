/**
 * Controller de Metas.
 *
 * Como nas demais rotas protegidas, toda query é filtrada por `req.userId`
 * (injetado pelo middleware `authRequired`): um usuário nunca lê, altera
 * nem apaga metas de outro.
 */
import mongoose from 'mongoose';
import { Meta, TITULO_MAX } from '../models/Meta.js';

/**
 * Valida e normaliza um título vindo do body.
 * @param   {unknown} valor
 * @returns {{ titulo?: string, erro?: string }}
 */
function validarTitulo(valor) {
  const titulo = typeof valor === 'string' ? valor.trim() : '';
  if (!titulo) return { erro: 'titulo é obrigatório' };
  if (titulo.length > TITULO_MAX) {
    return { erro: `titulo deve ter no máximo ${TITULO_MAX} caracteres` };
  }
  return { titulo };
}

/**
 * Lista as metas do usuário autenticado.
 *
 * @route   GET /api/metas
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa `req.userId`; ignora body e query
 * @param   {import('express').Response} res
 * @returns {200} `{ metas: Array<{ _id, userId, titulo, concluida, createdAt, updatedAt }> }`
 *               ordenado por `createdAt` (mais recentes primeiro). A separação
 *               pendentes/concluídas é feita no frontend.
 */
export async function listarMetas(req, res) {
  const metas = await Meta.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({ metas });
}

/**
 * Cria uma meta para o usuário autenticado (nasce pendente).
 *
 * @route   POST /api/metas
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {object} req.body
 * @param   {string} req.body.titulo — texto da meta. Obrigatório, até 200 caracteres.
 * @returns {201} `{ meta: {...} }` — documento criado (`concluida: false`).
 * @returns {400} `{ message }` — `titulo` ausente, vazio ou longo demais.
 */
export async function criarMeta(req, res) {
  const { titulo, erro } = validarTitulo(req.body?.titulo);
  if (erro) return res.status(400).json({ message: erro });

  const meta = await Meta.create({ userId: req.userId, titulo });
  return res.status(201).json({ meta });
}

/**
 * Atualiza parcialmente uma meta do usuário autenticado: marca/desmarca
 * como concluída e/ou renomeia. Só os campos enviados são alterados.
 *
 * @route   PATCH /api/metas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string}  req.params.id            — ObjectId da meta.
 * @param   {object}  req.body
 * @param   {boolean} [req.body.concluida]     — novo estado do checkbox (booleano de verdade).
 * @param   {string}  [req.body.titulo]        — novo texto (não vazio, até 200 caracteres).
 * @returns {200} `{ meta: {...} }` — documento já atualizado.
 * @returns {400} `{ message }` — `:id` inválido, nenhum campo enviado, `concluida`
 *               não booleano ou `titulo` inválido.
 * @returns {404} `{ message }` — meta inexistente OU de outro usuário.
 */
export async function atualizarMeta(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const { titulo, concluida } = req.body ?? {};
  const alteracoes = {};

  if (titulo !== undefined) {
    const v = validarTitulo(titulo);
    if (v.erro) return res.status(400).json({ message: v.erro });
    alteracoes.titulo = v.titulo;
  }

  if (concluida !== undefined) {
    if (typeof concluida !== 'boolean') {
      return res.status(400).json({ message: 'concluida deve ser true ou false' });
    }
    alteracoes.concluida = concluida;
  }

  if (Object.keys(alteracoes).length === 0) {
    return res.status(400).json({ message: 'informe titulo e/ou concluida' });
  }

  const meta = await Meta.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    alteracoes,
    { new: true, runValidators: true }, // `new`: devolve já atualizado
  );

  if (!meta) {
    return res.status(404).json({ message: 'meta não encontrada' });
  }

  return res.json({ meta });
}

/**
 * Remove uma meta do usuário autenticado.
 *
 * @route   DELETE /api/metas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string} req.params.id — ObjectId da meta a remover.
 * @returns {204} sem corpo — meta removida.
 * @returns {400} `{ message }` — `:id` inválido.
 * @returns {404} `{ message }` — meta inexistente OU de outro usuário.
 */
export async function removerMeta(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const removida = await Meta.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  });

  if (!removida) {
    return res.status(404).json({ message: 'meta não encontrada' });
  }

  return res.status(204).send();
}
