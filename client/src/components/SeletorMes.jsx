/**
 * SeletorMes — navegação simples entre meses: "‹ novembro de 2026 ›".
 *
 * Props:
 *  - mes      {string}              mês selecionado, "AAAA-MM".
 *  - onChange {(mes: string) => void}  chamado com o novo mês ao clicar em ‹ ou ›
 *                                      (ou em "Hoje", que volta ao mês atual).
 *
 * Os botões têm 44x44px (área de toque). O botão "Hoje" só aparece quando o
 * mês selecionado não é o atual. Componente controlado, sem estado próprio.
 */
import { deslocarMes, mesAtual, rotuloMes } from '../lib/mes.js';

const BOTAO =
  'flex h-11 w-11 items-center justify-center rounded border border-border bg-surface text-xl ' +
  'text-muted hover:text-fg';

// "novembro de 2026" → "Novembro de 2026" (só a 1ª letra; `capitalize` do CSS poria "De").
const primeiraMaiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export default function SeletorMes({ mes, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Mês anterior" onClick={() => onChange(deslocarMes(mes, -1))} className={BOTAO}>
        ‹
      </button>
      <span className="min-w-[9.5rem] text-center text-sm font-medium" aria-live="polite">
        {primeiraMaiuscula(rotuloMes(mes))}
      </span>
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(deslocarMes(mes, 1))} className={BOTAO}>
        ›
      </button>
      {mes !== mesAtual() && (
        <button
          type="button"
          onClick={() => onChange(mesAtual())}
          className="ml-1 flex min-h-[44px] items-center px-2 text-sm text-accent hover:opacity-80"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
