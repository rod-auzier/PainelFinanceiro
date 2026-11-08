/**
 * CampoSenha — campo de senha com botão "Mostrar / Ocultar".
 *
 * Props:
 *  - rotulo       {string}                 texto do <label> (ex.: "Senha atual").
 *  - value        {string}                 valor controlado.
 *  - onChange     {(valor: string) => void}
 *  - autoComplete {string}                 dica ao navegador/gerenciador de senhas
 *                                           ("current-password" ou "new-password").
 *
 * O botão alterna o tipo do input entre `password` e `text` (ícone de olho); tem 44x44px de área
 * de toque e `aria-pressed`/`aria-label` para leitores de tela. Input com 16px (sem zoom no iOS).
 * Cores só por tokens do tema (fundo sólido, borda, amarelo no foco).
 */
import { useState } from 'react';

export default function CampoSenha({ rotulo, value, onChange, autoComplete }) {
  const [visivel, setVisivel] = useState(false);

  return (
    <label className="block text-sm text-muted">
      {rotulo}
      <div className="relative mt-1">
        <input
          type={visivel ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="min-h-[44px] w-full rounded border border-border bg-bg py-2 pl-3 pr-12 text-base text-fg placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          aria-label={visivel ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-fg"
        >
          {/* Olho aberto = mostrar; olho riscado = ocultar. Decorativo (o aria-label descreve). */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visivel && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
    </label>
  );
}
