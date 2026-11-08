/**
 * Contexto de autenticação.
 *
 * Guarda o usuário logado e o token, persiste o token no localStorage
 * e expõe `login`, `register`, `logout` e `atualizarUsuario` para o resto da aplicação.
 *
 * `user` vem do backend ({ _id, email, nome?, sobrenome?, … }). Usuários antigos não têm `nome`
 * nem `sobrenome` — quem exibe o usuário usa lib/usuario.js (cai para o e-mail).
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ao carregar a app, se houver token salvo, busca o usuário atual.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  async function authenticate(path, payload) {
    const { data } = await api.post(path, payload);
    localStorage.setItem('token', data.token);
    setUser(data.user);
  }

  const value = {
    user,
    loading,
    login: (credentials) => authenticate('/login', credentials),
    register: (payload) => authenticate('/register', payload),
    // Troca o usuário em memória pelo devolvido pela API (ex.: depois de salvar o Perfil), para o
    // nome na sidebar atualizar na hora, sem recarregar a página.
    atualizarUsuario: (novo) => setUser(novo),
    logout: () => {
      localStorage.removeItem('token');
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook de acesso ao contexto de autenticação. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
