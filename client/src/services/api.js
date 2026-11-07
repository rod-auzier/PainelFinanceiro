/**
 * Cliente HTTP (axios) usado por toda a aplicação.
 *
 * - `baseURL` "/api": em dev o Vite faz proxy para o backend (ver vite.config.js).
 *   Em produção, o frontend e a API devem estar sob o mesmo domínio ou
 *   você ajusta via variável de ambiente VITE_API_URL.
 * - Um interceptor injeta o token JWT salvo no localStorage em toda requisição.
 */
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Sem timeout, uma requisição que nunca responde deixaria a tela em "Carregando…" para
  // sempre. Com ele, a chamada falha depois de 20 s e a tela mostra o erro + "Tentar de novo".
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
