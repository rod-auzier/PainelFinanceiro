/**
 * Rotas das Caixinhas (aba "Porquinho") — montadas em /api/caixinhas (ver routes/index.js).
 * TODAS exigem autenticação (`router.use(authRequired)`) e agem só sobre o usuário do token.
 *
 *   GET    /api/caixinhas      -> listarCaixinhas   (+ total guardado; transição do saldo inicial na 1ª vez)
 *   POST   /api/caixinhas      -> criarCaixinha     { nome, valor }
 *   PATCH  /api/caixinhas/:id  -> atualizarCaixinha { nome?, valor? }
 *   DELETE /api/caixinhas/:id  -> removerCaixinha
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listarCaixinhas,
  criarCaixinha,
  atualizarCaixinha,
  removerCaixinha,
} from '../controllers/caixinha.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(listarCaixinhas));
router.post('/', asyncHandler(criarCaixinha));
router.patch('/:id', asyncHandler(atualizarCaixinha));
router.delete('/:id', asyncHandler(removerCaixinha));

export default router;
