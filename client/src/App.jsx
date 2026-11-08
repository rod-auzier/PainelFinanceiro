/**
 * Define o mapa de rotas da aplicação.
 *
 * Rotas públicas:
 *   /login      -> <Login>
 *   /registro   -> <Registro>
 *
 * Rotas privadas (dentro de <Layout>, que exige usuário autenticado):
 *   /resumo     -> <Resumo>      (página inicial)
 *   /receitas   -> <Receitas>
 *   /despesas   -> <Despesas>
 *   /metas      -> <Metas>
 *   /perfil     -> <Perfil>      (nome/sobrenome e troca de senha; aberta pelo cartão do usuário)
 *
 * `/` redireciona para `/resumo`; qualquer rota desconhecida também.
 * O <Layout> cuida do redirect para /login quando não há sessão.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Receitas from './pages/Receitas.jsx';
import Despesas from './pages/Despesas.jsx';
import Resumo from './pages/Resumo.jsx';
import Metas from './pages/Metas.jsx';
import Perfil from './pages/Perfil.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route element={<Layout />}>
        <Route path="/receitas" element={<Receitas />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/resumo" element={<Resumo />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/perfil" element={<Perfil />} />
      </Route>

      <Route path="/" element={<Navigate to="/resumo" replace />} />
      <Route path="*" element={<Navigate to="/resumo" replace />} />
    </Routes>
  );
}
