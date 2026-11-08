/**
 * Rotas de autenticação. Montadas na raiz de /api (ver routes/index.js):
 *   POST /api/register   -> cria usuário
 *   POST /api/login      -> retorna JWT
 *   GET  /api/me         -> dados do usuário autenticado (protegida)
 *
 * O MESMO router também é montado em /api/auth (ver routes/index.js), então valem também:
 *   GET   /api/auth/me      -> nome, sobrenome, e-mail… do usuário logado (protegida)
 *   PATCH /api/auth/perfil  -> atualiza nome e sobrenome (protegida)
 *   PATCH /api/auth/senha   -> troca a senha, com limite de tentativas (protegida)
 * (/api/me continua funcionando: as sessões e o app já em uso não quebram.)
 */
import { Router } from 'express';
import { register, login, me, atualizarPerfil, alterarSenha } from '../controllers/auth.controller.js';
import { authRequired } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Públicas
router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));

// Protegida: só passa com `Authorization: Bearer <token>` válido.
router.get('/me', authRequired, asyncHandler(me));

// Perfil e senha: protegidas pelo MESMO middleware JWT e sempre sobre o usuário do token.
router.patch('/perfil', authRequired, asyncHandler(atualizarPerfil));
router.patch('/senha', authRequired, asyncHandler(alterarSenha));

export default router;
