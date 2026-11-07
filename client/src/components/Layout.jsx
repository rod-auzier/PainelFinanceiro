/**
 * Layout — moldura das telas autenticadas, RESPONSIVO.
 *
 * Breakpoint de virada: `md` (768px, padrão do Tailwind).
 *
 *  - >= md (desktop): navegação em SIDEBAR lateral fixa à esquerda
 *    (56 = 14rem de largura), com e-mail + "Sair" no rodapé.
 *  - <  md (mobile) : sidebar some. No lugar entram:
 *       • uma barra fina no topo (título + "Sair"), e
 *       • uma BOTTOM NAV fixa no rodapé da tela, com os mesmos itens da sidebar
 *         (Receitas, Despesas, Resumo, Metas — a lista NAV abaixo alimenta as duas).
 *    O <main> ganha `pb-24` no mobile para o conteúdo não ficar atrás da
 *    bottom nav (`md:pb-6` volta ao normal no desktop).
 *
 * Responsabilidades além do layout:
 *  - proteger a área logada (sem sessão → /login; enquanto carrega → aviso);
 *  - marcar o item ativo (NavLink isActive) com a cor de destaque `accent`.
 *
 * Não recebe props — usa AuthContext + react-router.
 */
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/receitas', label: 'Receitas' },
  { to: '/despesas', label: 'Despesas' },
  { to: '/resumo', label: 'Resumo' },
  { to: '/metas', label: 'Metas' },
];

// Item da sidebar (desktop). Altura mínima 44px = área de toque confortável.
function classeSidebar({ isActive }) {
  return [
    'flex min-h-[44px] items-center rounded px-3 text-sm transition-colors',
    isActive ? 'bg-bg text-accent font-medium' : 'text-muted hover:text-fg',
  ].join(' ');
}

// Item da bottom nav (mobile). 56px de altura → toque folgado.
function classeBottom({ isActive }) {
  return [
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs',
    isActive ? 'text-accent' : 'text-muted',
  ].join(' ');
}

export default function Layout() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="p-8 text-muted">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen md:flex">
      {/* ===================== SIDEBAR — só em >= md ===================== */}
      <aside
        className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col
                   md:border-r md:border-border md:bg-surface"
      >
        <div className="px-5 py-4 font-semibold tracking-tight">Painel Financeiro</div>

        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={classeSidebar}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-border px-5 py-4 text-xs text-muted">
          <p className="mb-2 truncate" title={user.email}>
            {user.email}
          </p>
          <button
            onClick={logout}
            className="flex min-h-[44px] items-center text-accent hover:opacity-80"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* ===================== TOP BAR — só em < md ===================== */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <span className="font-semibold tracking-tight">Painel Financeiro</span>
        <button
          onClick={logout}
          className="flex min-h-[44px] min-w-[44px] items-center justify-end text-sm text-accent"
        >
          Sair
        </button>
      </header>

      {/* ===================== CONTEÚDO ===================== */}
      <main className="flex-1 px-4 py-6 sm:px-6 md:ml-56 md:px-8 pb-24 md:pb-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>

      {/* ===================== BOTTOM NAV — só em < md, fixa ===================== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface
                   pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={classeBottom}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
