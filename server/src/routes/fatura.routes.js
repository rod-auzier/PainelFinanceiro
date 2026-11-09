/**
 * Rotas das Faturas do cartão — montadas em /api/faturas (ver routes/index.js).
 * TODAS exigem autenticação (`router.use(authRequired)`) e agem só sobre o usuário do token.
 *
 *   GET    /api/faturas?mes=AAAA-MM   -> obterFatura       (situação do cartão no mês)
 *   PUT    /api/faturas/:mes          -> salvarFatura      { valor } (cria ou atualiza)
 *   PATCH  /api/faturas/:mes/paga     -> marcarFaturaPaga  { paga }
 *   DELETE /api/faturas/:mes          -> removerFatura
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { obterFatura, salvarFatura, marcarFaturaPaga, removerFatura } from '../controllers/fatura.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(obterFatura));
router.put('/:mes', asyncHandler(salvarFatura));
router.patch('/:mes/paga', asyncHandler(marcarFaturaPaga));
router.delete('/:mes', asyncHandler(removerFatura));

export default router;
