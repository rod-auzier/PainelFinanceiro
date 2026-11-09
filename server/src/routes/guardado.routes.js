/**
 * Rotas do "Total guardado" — montadas em /api/guardado (ver routes/index.js).
 * Exigem autenticação (`router.use(authRequired)`).
 *
 *   GET /api/guardado  -> obterGuardado  ({ totalCaixinhas, saldoAcumulado, total, mesesFechados, mediaMensal, emAndamento })
 *
 * (O antigo PUT /api/guardado, que editava o "Saldo inicial guardado", foi removido: o saldo
 *  agora é a soma das caixinhas — ver /api/caixinhas.)
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { obterGuardado } from '../controllers/guardado.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(obterGuardado));

export default router;
