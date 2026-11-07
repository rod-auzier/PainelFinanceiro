/** Agrupa todas as rotas da API sob o prefixo /api (ver app.js). */
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import receitaRoutes from './receita.routes.js';
import despesaRoutes from './despesa.routes.js';
import resumoRoutes from './resumo.routes.js';
import metaRoutes from './meta.routes.js';

const router = Router();

// Healthcheck simples para monitoramento / testes de disponibilidade.
router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Auth fica na raiz de /api:  POST /api/register, POST /api/login, GET /api/me
router.use('/', authRoutes);

// Recursos protegidos (cada router aplica o middleware authRequired internamente).
router.use('/receitas', receitaRoutes);
router.use('/despesas', despesaRoutes);
router.use('/resumo', resumoRoutes);
router.use('/metas', metaRoutes);

export default router;
