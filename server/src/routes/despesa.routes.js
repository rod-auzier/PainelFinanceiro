/**
 * Rotas de Despesas — montadas em /api/despesas (ver routes/index.js).
 * TODAS exigem autenticação (`router.use(authRequired)`).
 *
 *   GET    /api/despesas       -> listarDespesas
 *   POST   /api/despesas       -> criarDespesa
 *   POST   /api/despesas/copiar-fixos -> copiarDespesasFixas  (recorrentes do mês anterior)
 *   PUT    /api/despesas/:id   -> atualizarDespesa
 *   DELETE /api/despesas/:id   -> removerDespesa
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listarDespesas,
  criarDespesa,
  atualizarDespesa,
  copiarDespesasFixas,
  removerDespesa,
} from '../controllers/despesa.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(listarDespesas));
router.post('/', asyncHandler(criarDespesa));
router.post('/copiar-fixos', asyncHandler(copiarDespesasFixas));
router.put('/:id', asyncHandler(atualizarDespesa));
router.delete('/:id', asyncHandler(removerDespesa));

export default router;
