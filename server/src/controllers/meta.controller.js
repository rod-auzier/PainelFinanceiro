/**
 * Controller de Metas.
 *
 * Como nas demais rotas protegidas, toda query é filtrada por `req.userId`
 * (injetado pelo middleware `authRequired`): um usuário nunca lê, altera
 * nem apaga metas de outro.
 *
 * Metas podem ter um `valorAlvo` (R$). Nesse caso, quando o TOTAL GUARDADO
 * (saldo inicial + receitas − despesas dos MESES FECHADOS, ver services/guardado.js) atinge o
 * alvo, a meta é marcada como concluída automaticamente. Essa sincronização
 * roda ao listar, criar e atualizar metas, então as respostas já refletem o
 * estado atual.
 */
import mongoose from 'mongoose';
import { Meta, TITULO_MAX } from '../models/Meta.js';
import { calcularESincronizar } from '../services/guardado.js';

/**
 * Sincroniza as metas com o total guardado (só meses fechados) SEM deixar uma falha travar
 * a resposta: se o cálculo ou a geração de fixos der erro, registra no log e segue — a lista
 * de metas (o que o usuário quer ver) continua sendo devolvida, só sem a conclusão automática
 * daquela vez.
 * @param   {string} userId
 * @returns {Promise<object|null>}  o total guardado (ver services/guardado.js) ou `null` se falhou
 */
async function sincronizarSemFalhar(userId) {
  try {
    return await calcularESincronizar(userId);
  } catch (erro) {
    console.error('[metas] não foi possível sincronizar com o total guardado:', erro);
    return null;
  }
}

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
 * Valida o `valorAlvo` vindo do body (opcional).
 * @param   {unknown} valor  número > 0, `null` (= sem valor) ou `undefined` (= não enviado)
 * @returns {{ valorAlvo?: number|null, erro?: string }}  `valorAlvo` fica `undefined` se não enviado.
 */
function validarValorAlvo(valor) {
  if (valor === undefined) return {};
  if (valor === null) return { valorAlvo: null };
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return { erro: 'valorAlvo deve ser um número maior que zero (ou null para remover)' };
  }
  return { valorAlvo: Math.round(valor * 100) / 100 };
}

/**
 * Lista as metas do usuário autenticado (já sincronizadas com o total guardado).
 *
 * @route   GET /api/metas
 * @access  Privado — header `Authorization: Bearer <token>`
 * @param   {import('express').Request}  req  — usa `req.userId`; ignora body e query
 * @param   {import('express').Response} res
 * @returns {200} `{ metas: Array<{ _id, userId, titulo, concluida, valorAlvo, alvoAtingido, createdAt, updatedAt }>, guardado }`
 *               `metas` ordenado por `createdAt` (mais recentes primeiro); `valorAlvo` é `null` nas
 *               metas sem valor. A separação pendentes/concluídas é feita no frontend.
 *               `guardado` = `{ saldoInicial, saldoAcumulado, total, mesesFechados, mediaMensal, emAndamento }` (mesmo formato de
 *               GET /api/guardado, só meses fechados) — vai junto para a tela de Metas precisar de UMA
 *               chamada só (duas chamadas simultâneas disputariam a geração de fixos). É `null` se o
 *               cálculo falhou (a lista é devolvida mesmo assim).
 */
export async function listarMetas(req, res) {
  // Conclui automaticamente as metas cujo alvo foi atingido e já traz o total guardado.
  const guardado = await sincronizarSemFalhar(req.userId);
  const metas = await Meta.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({ metas, guardado });
}

/**
 * Cria uma meta para o usuário autenticado (nasce pendente — a menos que o
 * total guardado já cubra o `valorAlvo`, caso em que é concluída na hora).
 *
 * @route   POST /api/metas
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {object} req.body
 * @param   {string} req.body.titulo       — texto da meta. Obrigatório, até 200 caracteres.
 * @param   {number} [req.body.valorAlvo]  — valor em R$ a atingir (> 0). Opcional; sem ele a
 *                                           meta é um item de checklist comum.
 * @returns {201} `{ meta: {...} }` — documento criado.
 * @returns {400} `{ message }` — `titulo` ausente/vazio/longo, ou `valorAlvo` inválido.
 */
export async function criarMeta(req, res) {
  const { titulo, erro } = validarTitulo(req.body?.titulo);
  if (erro) return res.status(400).json({ message: erro });

  const alvo = validarValorAlvo(req.body?.valorAlvo);
  if (alvo.erro) return res.status(400).json({ message: alvo.erro });

  const criada = await Meta.create({
    userId: req.userId,
    titulo,
    valorAlvo: alvo.valorAlvo ?? null,
  });

  await sincronizarSemFalhar(req.userId);
  const meta = await Meta.findById(criada._id); // relê: pode ter sido concluída automaticamente
  return res.status(201).json({ meta });
}

/**
 * Atualiza parcialmente uma meta do usuário autenticado: marca/desmarca
 * como concluída, renomeia e/ou altera o valor. Só os campos enviados mudam.
 *
 * Marcar/desmarcar `concluida` à mão é sempre permitido — a conclusão
 * automática só dispara quando o total cruza o alvo (ver services/guardado.js).
 *
 * @route   PATCH /api/metas/:id
 * @access  Privado
 * @param   {import('express').Request} req
 * @param   {string}  req.params.id            — ObjectId da meta.
 * @param   {object}  req.body
 * @param   {boolean} [req.body.concluida]     — novo estado do checkbox (booleano de verdade).
 * @param   {string}  [req.body.titulo]        — novo texto (não vazio, até 200 caracteres).
 * @param   {number|null} [req.body.valorAlvo] — novo valor alvo (> 0) ou `null` para remover.
 *                                               Mudar o valor re-arma a conclusão automática.
 * @returns {200} `{ meta: {...} }` — documento já atualizado (e sincronizado).
 * @returns {400} `{ message }` — `:id` inválido, nenhum campo enviado, `concluida`
 *               não booleano, `titulo` ou `valorAlvo` inválidos.
 * @returns {404} `{ message }` — meta inexistente OU de outro usuário.
 */
export async function atualizarMeta(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const { titulo, concluida, valorAlvo } = req.body ?? {};
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

  const alvo = validarValorAlvo(valorAlvo);
  if (alvo.erro) return res.status(400).json({ message: alvo.erro });

  if (Object.keys(alteracoes).length === 0 && alvo.valorAlvo === undefined) {
    return res.status(400).json({ message: 'informe titulo, concluida e/ou valorAlvo' });
  }

  // Filtro por userId: meta de outro usuário não é encontrada (404).
  const meta = await Meta.findOne({ _id: req.params.id, userId: req.userId });
  if (!meta) {
    return res.status(404).json({ message: 'meta não encontrada' });
  }

  meta.set(alteracoes);
  if (alvo.valorAlvo !== undefined && alvo.valorAlvo !== meta.valorAlvo) {
    meta.valorAlvo = alvo.valorAlvo;
    meta.alvoAtingido = false; // valor mudou: reavalia a conclusão automática
  }
  await meta.save(); // roda os validadores do schema

  await sincronizarSemFalhar(req.userId);
  const atualizada = await Meta.findById(meta._id); // relê: pode ter sido concluída automaticamente
  return res.json({ meta: atualizada });
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
