/**
 * Layout — moldura das telas autenticadas, RESPONSIVO.
 *
 * Breakpoint de virada: `md` (768px, padrão do Tailwind).
 *
 *  - >= md (desktop): navegação em SIDEBAR lateral fixa à esquerda (56 = 14rem de largura):
 *       • topo: marca (logo 38x38 + "Painel Financeiro" + "Controle pessoal") e divisória;
 *       • rótulo "MENU" e os itens, cada um com ícone de linha (IconesNav.jsx); o item ativo
 *         ganha fundo, borda sutil, texto/ícone em amarelo e uma barrinha amarela de 3px
 *         encostada na borda esquerda da sidebar;
 *       • rodapé: cartão do usuário — avatar (inicial do NOME; do e-mail se ainda não tem nome),
 *         "Nome Sobrenome" em destaque (truncado) e o botão "Sair" embaixo. O e-mail NÃO aparece
 *         aqui (só no Perfil, em leitura); ele só é usado como nome por usuários antigos, sem nome,
 *         para o cartão nunca ficar vazio. Clicar no cartão (menos no "Sair") abre o Perfil.
 *  - <  md (mobile) : sidebar some. No lugar entram:
 *       • uma barra fina no topo (título + avatar). O avatar abre um menu com Perfil e "Sair"
 *         (<MenuUsuario>), para a barra de baixo ficar só com as 5 telas, e
 *       • uma BOTTOM NAV fixa no rodapé da tela, com os mesmos itens e ÍCONES da sidebar
 *         (Resumo, Receitas, Despesas, Porquinho, Metas — a lista NAV abaixo alimenta as duas), o ícone
 *         acima do rótulo e o item ativo em amarelo.
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
import { ICONE_NAV } from './IconesNav.jsx';
import MenuUsuario from './MenuUsuario.jsx';
import { CategoriasProvider } from '../context/CategoriasContext.jsx';
import { inicialDoUsuario, nomeExibido } from '../lib/usuario.js';

// Ordem do menu (sidebar e bottom nav): Resumo, Receitas, Despesas, Porquinho, Metas. O Resumo vem
// primeiro por ser a página inicial (a raiz "/" e o pós-login levam a /resumo — ver App.jsx,
// Login.jsx e Registro.jsx). Só a ordem importa aqui; as rotas e os ícones não mudam.
const NAV = [
  { to: '/resumo', label: 'Resumo' },
  { to: '/receitas', label: 'Receitas' },
  { to: '/despesas', label: 'Despesas' },
  { to: '/porquinho', label: 'Porquinho' }, // caixinhas: onde o dinheiro guardado está
  { to: '/metas', label: 'Metas' },
];

// Item da sidebar (desktop). Altura mínima 44px = área de toque confortável.
//  - `relative`: ancora a barrinha amarela do item ativo (ver <BarraAtiva> no JSX).
//  - Ativo: fundo `bg` (um degrau abaixo da sidebar, para se destacar), borda sutil e
//    texto/ícone em `accent`. Inativo: `muted`, e no hover um véu de 6% do texto principal
//    (color-mix sobre as variáveis do tema, então segue a paleta) + texto principal.
function classeSidebar({ isActive }) {
  return [
    'relative flex min-h-[44px] items-center gap-3 rounded-lg border px-3 text-sm transition-colors',
    isActive
      ? 'border-border bg-bg font-medium text-accent'
      : 'border-transparent text-muted hover:bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)] hover:text-fg',
  ].join(' ');
}

// Item da bottom nav (mobile). 56px de altura → toque folgado (mínimo recomendado: 44px).
function classeBottom({ isActive }) {
  return [
    // `min-w-0`: com 5 itens no celular, cada um encolhe por igual (sem rolagem horizontal).
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs',
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
        {/* ---------- Marca: logo + nome + subtítulo, com divisória embaixo ---------- */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <img
            src="/icon-192.png"
            alt=""
            width="38"
            height="38"
            className="h-[38px] w-[38px] shrink-0 rounded-[10px] border border-border object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">Painel Financeiro</p>
            <p className="mt-0.5 truncate text-xs text-muted">Controle pessoal</p>
          </div>
        </div>

        {/* ---------- Menu ---------- */}
        <p className="px-5 pb-2 pt-5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted/80">Menu</p>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const Icone = ICONE_NAV[item.to];
            return (
              <NavLink key={item.to} to={item.to} className={classeSidebar}>
                {({ isActive }) => (
                  <>
                    {/* Barrinha amarela de 3px encostada na borda esquerda da sidebar: o item tem
                        12px de margem (px-3 do <nav>) + 1px de borda, daí o -left-[13px]. */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute -left-[13px] top-2 bottom-2 w-[3px] rounded-r bg-accent"
                      />
                    )}
                    <Icone size={18} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ---------- Rodapé: cartão do usuário (avatar + nome + e-mail + Sair) ----------
            O cartão inteiro leva ao Perfil: um <NavLink> invisível cobre toda a área (absolute
            inset-0) e o conteúdo por cima tem `pointer-events-none`, então o clique "atravessa"
            para o link. Só o botão "Sair" reativa os cliques (pointer-events-auto) e, por ficar
            acima do link, NÃO abre o Perfil. */}
        <div className="mt-auto p-3">
          <div className="relative rounded-lg border border-border bg-bg transition-colors hover:border-muted">
            <NavLink
              to="/perfil"
              aria-label="Abrir perfil"
              className={({ isActive }) =>
                `absolute inset-0 rounded-lg ${isActive ? 'ring-1 ring-accent' : ''}`
              }
            />
            <div className="pointer-events-none relative flex items-center gap-3 p-3">
              {/* Avatar: círculo de 32px com a inicial do nome (shrink-0 mantém sempre redondo). */}
              <div
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-accent"
              >
                {inicialDoUsuario(user)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg" title={nomeExibido(user)}>
                  {nomeExibido(user)}
                </p>
                {/* Sem linha de e-mail: avatar, nome e "Sair" ficam centralizados na vertical
                    (`items-center` no contêiner), sem sobrar espaço. O e-mail está só no Perfil. */}
                <button
                  onClick={logout}
                  className="pointer-events-auto relative flex min-h-[28px] items-center text-xs font-medium text-accent hover:opacity-80"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ===================== TOP BAR — só em < md ===================== */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <span className="font-semibold tracking-tight">Painel Financeiro</span>
        {/* Avatar com menu (Perfil / Sair): mantém a barra inferior só com as 5 telas. */}
        <MenuUsuario user={user} onSair={logout} />
      </header>

      {/* ===================== CONTEÚDO ===================== */}
      {/* LARGURA DA ÁREA DE CONTEÚDO: até 1400px, centrada. Até ~1280px ocupa tudo o que sobra
          (janela − sidebar − padding); em telas muito largas (> 1800px) o limite de 1400px evita
          esticar demais. Padding lateral: 16/24px no celular, 32px (`md`) e 40px (`lg`). `min-w-0`
          deixa o <main> encolher dentro do flex (sem rolagem horizontal). */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:ml-56 md:px-8 lg:px-10 pb-24 md:pb-8">
        <div className="mx-auto max-w-[1400px]">
          {/* Categorias personalizadas do usuário, compartilhadas por todas as telas logadas. */}
          <CategoriasProvider>
            <Outlet />
          </CategoriasProvider>
        </div>
      </main>

      {/* ===================== BOTTOM NAV — só em < md, fixa ===================== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface
                   pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map((item) => {
          const Icone = ICONE_NAV[item.to];
          return (
            <NavLink key={item.to} to={item.to} className={classeBottom}>
              <Icone size={20} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
