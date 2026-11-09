/** Agrupa todas as rotas da API sob o prefixo /api (ver app.js). */
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import receitaRoutes from './receita.routes.js';
import despesaRoutes from './despesa.routes.js';
import resumoRoutes from './resumo.routes.js';
import metaRoutes from './meta.routes.js';
import guardadoRoutes from './guardado.routes.js';
import categoriaRoutes from './categoria.routes.js';
import caixinhaRoutes from './caixinha.routes.js';

const router = Router();

// Healthcheck simples para monitoramento / testes de disponibilidade.
router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Auth fica na raiz de /api:  POST /api/register, POST /api/login, GET /api/me
router.use('/', authRoutes);
// Os mesmos handlers também sob /api/auth: GET /api/auth/me, PATCH /api/auth/perfil, PATCH /api/auth/senha.
router.use('/auth', authRoutes);

// Recursos protegidos (cada router aplica o middleware authRequired internamente).
router.use('/receitas', receitaRoutes);
router.use('/despesas', despesaRoutes);
router.use('/resumo', resumoRoutes);
router.use('/metas', metaRoutes);
router.use('/guardado', guardadoRoutes);
// Categorias personalizadas de despesa (criar/renomear/recolorir/excluir).
router.use('/categorias', categoriaRoutes);
// Caixinhas (aba Porquinho): a soma delas entra no Total guardado.
router.use('/caixinhas', caixinhaRoutes);

export default router;
