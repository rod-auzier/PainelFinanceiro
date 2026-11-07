/**
 * Rotas de Despesas — montadas em /api/despesas (ver routes/index.js).
 * TODAS exigem autenticação (`router.use(authRequired)`).
 *
 *   GET    /api/despesas       -> listarDespesas  (abrir um mês gera os fixos automaticamente)
 *   POST   /api/despesas       -> criarDespesa
 *   PUT    /api/despesas/:id   -> atualizarDespesa  (não altera o status `paga`)
 *   PATCH  /api/despesas/pagas -> marcarTodasPagas  ("Marcar todas como pagas" de um mês)
 *   PATCH  /api/despesas/:id   -> atualizarPagamento (marca/desmarca UMA despesa como paga)
 *   DELETE /api/despesas/:id   -> removerDespesa
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listarDespesas,
  criarDespesa,
  atualizarDespesa,
  atualizarPagamento,
  marcarTodasPagas,
  removerDespesa,
} from '../controllers/despesa.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(listarDespesas));
router.post('/', asyncHandler(criarDespesa));
router.put('/:id', asyncHandler(atualizarDespesa));
// '/pagas' vem ANTES de '/:id', senão o Express trataria "pagas" como um id.
router.patch('/pagas', asyncHandler(marcarTodasPagas));
router.patch('/:id', asyncHandler(atualizarPagamento));
router.delete('/:id', asyncHandler(removerDespesa));

export default router;
