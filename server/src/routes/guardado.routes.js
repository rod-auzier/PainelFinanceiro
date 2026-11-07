/**
 * Rotas do "Total guardado" — montadas em /api/guardado (ver routes/index.js).
 * Exigem autenticação (`router.use(authRequired)`).
 *
 *   GET /api/guardado  -> obterGuardado        ({ saldoInicial, saldoAcumulado, total })
 *   PUT /api/guardado  -> definirSaldoInicial  ({ saldoInicial })
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { obterGuardado, definirSaldoInicial } from '../controllers/guardado.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(obterGuardado));
router.put('/', asyncHandler(definirSaldoInicial));

export default router;
