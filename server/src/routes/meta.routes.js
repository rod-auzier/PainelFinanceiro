/**
 * Rotas de Metas — montadas em /api/metas (ver routes/index.js).
 * TODAS exigem autenticação: o `router.use(authRequired)` abaixo aplica o
 * middleware JWT a cada rota do arquivo.
 *
 *   GET    /api/metas       -> listarMetas
 *   POST   /api/metas       -> criarMeta
 *   PATCH  /api/metas/:id   -> atualizarMeta  (concluida e/ou titulo)
 *   DELETE /api/metas/:id   -> removerMeta
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listarMetas,
  criarMeta,
  atualizarMeta,
  removerMeta,
} from '../controllers/meta.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(listarMetas));
router.post('/', asyncHandler(criarMeta));
router.patch('/:id', asyncHandler(atualizarMeta));
router.delete('/:id', asyncHandler(removerMeta));

export default router;
