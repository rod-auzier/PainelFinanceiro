/**
 * MenuUsuario — menu do avatar na barra do topo do CELULAR (< md).
 *
 * No celular a barra inferior fica só com as 4 telas; o acesso ao Perfil e o "Sair" vivem aqui,
 * num menu aberto pelo avatar (círculo com a inicial), para não poluir a barra de baixo.
 *
 * Props:
 *  - user   {{ nome?, sobrenome?, email }}  usuário logado (usuários antigos sem nome usam o e-mail como nome).
 *  - onSair {() => void}                    chamado ao tocar em "Sair" (o logout é do AuthContext).
 *
 * Comportamento: o botão do avatar (44x44) abre/fecha um painel de fundo sólido com nome, e-mail,
 * "Perfil" (link para /perfil) e "Sair". O e-mail não aparece (só no Perfil); usuários antigos, sem
 * nome, veem o e-mail no lugar do nome para o menu nunca ficar sem título. Fecha ao tocar fora, com Esc ou ao escolher uma opção.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { inicialDoUsuario, nomeExibido } from '../lib/usuario.js';

export default function MenuUsuario({ user, onSair }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);

  // Fecha ao tocar/clicar fora do menu e ao apertar Esc (só escuta enquanto está aberto).
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const ITEM = 'flex min-h-[44px] w-full items-center rounded px-3 text-sm hover:bg-bg';

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Menu do usuário"
        className="flex h-11 w-11 items-center justify-center"
      >
        {/* Avatar: círculo de 32px que nunca deforma (shrink-0), com a inicial em amarelo. */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-sm font-semibold text-accent">
          {inicialDoUsuario(user)}
        </span>
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <div className="border-b border-border px-3 pb-2 pt-1">
            {/* Só o nome (sem e-mail). */}
            <p className="truncate text-sm font-medium" title={nomeExibido(user)}>
              {nomeExibido(user)}
            </p>
          </div>
          <Link to="/perfil" role="menuitem" onClick={() => setAberto(false)} className={`${ITEM} mt-1 text-fg`}>
            Perfil
          </Link>
          <button type="button" role="menuitem" onClick={onSair} className={`${ITEM} text-accent`}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
