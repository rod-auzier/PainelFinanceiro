/**
 * Rotas dos Cartões de crédito — montadas em /api/cartoes (ver routes/index.js).
 * TODAS exigem autenticação (`router.use(authRequired)`) e agem só sobre o usuário do token.
 *
 *   GET    /api/cartoes      -> listarCartoes   (aplica a transição do controle antigo na 1ª vez)
 *   POST   /api/cartoes      -> criarCartao     { nome, cor }
 *   PATCH  /api/cartoes/:id  -> atualizarCartao { nome?, cor? }
 *   DELETE /api/cartoes/:id  -> removerCartao   (despesas viram comuns; faturas do cartão saem)
 */
import { Router } from 'express';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listarCartoes, criarCartao, atualizarCartao, removerCartao } from '../controllers/cartao.controller.js';

const router = Router();

router.use(authRequired);

router.get('/', asyncHandler(listarCartoes));
router.post('/', asyncHandler(criarCartao));
router.patch('/:id', asyncHandler(atualizarCartao));
router.delete('/:id', asyncHandler(removerCartao));

export default router;
