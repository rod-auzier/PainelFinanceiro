/**
 * Rotas de Categorias (personalizadas, de despesa) — montadas em /api/categorias (ver routes/index.js).
 * TODAS exigem autenticação (`router.use(authRequired)`) e agem só sobre o usuário do token.
 *
 *   GET    /api/categorias      -> listarCategorias   (cria as 5 padrão no 1º acesso)
 *   POST   /api/categorias      -> criarCategoria     { nome, cor }
 *   PATCH  /api/categorias/:id  -> atualizarCategoria { nome?, cor? } (renomeia também nas despesas)
 *   DELETE /api/categorias/:id  -> removerCategoria   (despesas vão para "Outros")
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  removerCategoria,
} from '../controllers/categoria.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(listarCategorias));
router.post('/', asyncHandler(criarCategoria));
router.patch('/:id', asyncHandler(atualizarCategoria));
router.delete('/:id', asyncHandler(removerCategoria));

export default router;
