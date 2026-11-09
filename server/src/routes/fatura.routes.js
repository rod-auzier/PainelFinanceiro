/**
 * Rotas das Faturas (uma por cartão e mês) — montadas em /api/faturas (ver routes/index.js).
 * TODAS exigem autenticação (`router.use(authRequired)`) e agem só sobre o usuário do token.
 *
 *   GET    /api/faturas?mes=AAAA-MM              -> obterFaturas      (situação de todos os cartões no mês)
 *   PUT    /api/faturas/:mes/:cartaoId           -> salvarFatura      { valor } (cria ou atualiza)
 *   PATCH  /api/faturas/:mes/:cartaoId/paga      -> marcarFaturaPaga  { paga }
 *   DELETE /api/faturas/:mes/:cartaoId           -> removerFatura
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { obterFaturas, salvarFatura, marcarFaturaPaga, removerFatura } from '../controllers/fatura.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(obterFaturas));
router.put('/:mes/:cartaoId', asyncHandler(salvarFatura));
router.patch('/:mes/:cartaoId/paga', asyncHandler(marcarFaturaPaga));
router.delete('/:mes/:cartaoId', asyncHandler(removerFatura));

export default router;
