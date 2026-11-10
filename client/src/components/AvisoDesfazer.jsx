/**
 * AvisoDesfazer — aviso discreto e temporário com o link "Desfazer" (ex.: "6 despesas do Neon
 * marcadas como pagas · Desfazer"). Some sozinho depois de `duracao` ms (padrão ~6 s) ou ao fechar.
 *
 * Fica FIXO na parte de baixo da tela (acima da barra inferior no celular), sem empurrar o conteúdo.
 *
 * Props:
 *  - mensagem  {string}
 *  - onDesfazer {() => Promise<void> | void}  reverte a ação (a página sabe o que desfazer).
 *  - onFechar  {() => void}                    chamado ao sumir (tempo esgotado, ✕ ou depois do Desfazer).
 *  - duracao   {number}  ms (padrão 6000).
 */
import { useEffect, useState } from 'react';

export default function AvisoDesfazer({ mensagem, onDesfazer, onFechar, duracao = 6000 }) {
  const [desfazendo, setDesfazendo] = useState(false);

  // Some sozinho depois de `duracao` (o tempo recomeça se a mensagem mudar).
  useEffect(() => {
    const id = setTimeout(onFechar, duracao);
    return () => clearTimeout(id);
  }, [mensagem, duracao, onFechar]);

  async function desfazer() {
    setDesfazendo(true);
    try {
      await onDesfazer();
    } finally {
      onFechar();
    }
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded border border-border bg-surface px-4 py-3 text-sm shadow-lg shadow-black/50 md:bottom-6"
    >
      <span className="min-w-0 flex-1">{mensagem}</span>
      <button
        type="button"
        onClick={desfazer}
        disabled={desfazendo}
        className="min-h-[36px] shrink-0 font-medium text-accent hover:opacity-80 disabled:opacity-60"
      >
        Desfazer
      </button>
      <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="min-h-[36px] shrink-0 px-1 text-muted hover:text-fg">
        ✕
      </button>
    </div>
  );
}
