/**
 * Rotas de Receitas — montadas em /api/receitas (ver routes/index.js).
 * TODAS exigem autenticação: o `router.use(authRequired)` abaixo aplica
 * o middleware a cada rota do arquivo.
 *
 *   GET    /api/receitas       -> listarReceitas
 *   POST   /api/receitas       -> criarReceita
 *   POST   /api/receitas/copiar-fixos -> copiarReceitasFixas  (recorrentes do mês anterior)
 *   PUT    /api/receitas/:id   -> atualizarReceita
 *   DELETE /api/receitas/:id   -> removerReceita
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listarReceitas,
  criarReceita,
  atualizarReceita,
  copiarReceitasFixas,
  removerReceita,
} from '../controllers/receita.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(listarReceitas));
router.post('/', asyncHandler(criarReceita));
router.post('/copiar-fixos', asyncHandler(copiarReceitasFixas));
router.put('/:id', asyncHandler(atualizarReceita));
router.delete('/:id', asyncHandler(removerReceita));

export default router;
