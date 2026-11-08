/**
 * Tela de Registro (rota pública `/registro`).
 *
 * Responsabilidades:
 *  - renderizar o <AuthForm> no modo "criar conta", com Nome e Sobrenome (obrigatórios) antes do
 *    e-mail e da senha (`comNome`);
 *  - ao registrar, o backend já devolve `{ user, token }`, então o
 *    AuthContext deixa o usuário autenticado e seguimos para `/resumo`;
 *  - se já estiver logado, redireciona.
 *
 * Validação de senha (mín. 6 caracteres) é feita no input e também no backend.
 */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthForm from '../components/AuthForm.jsx';

export default function Registro() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/resumo" replace />;

  return (
    <AuthForm
      titulo="Criar conta"
      textoBotao="Cadastrar"
      comNome
      onSubmit={async (dados) => {
        await register(dados);
        navigate('/resumo');
      }}
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="inline-block py-2 text-accent hover:opacity-80">
            Entrar
          </Link>
        </>
      }
    />
  );
}
