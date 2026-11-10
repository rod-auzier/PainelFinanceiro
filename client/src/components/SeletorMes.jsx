/**
 * SeletorMes — navegação entre meses: "‹ [Novembro de 2026 ▾] ›  Hoje". Usado em Despesas, Receitas
 * e Resumo (componente ÚNICO — nenhuma página tem cópia própria).
 * O nome do mês é o <MonthPicker>: um botão que abre um painel com ‹ ANO › e a grade Jan…Dez para pular
 * direto para qualquer mês (ver MonthPicker.jsx).
 *
 * Props:
 *  - mes      {string}              mês selecionado, "AAAA-MM".
 *  - onChange {(mes: string) => void}  chamado com o novo mês ao clicar em ‹ ou ›
 *                                      (ou em "Hoje", que volta ao mês atual).
 *
 * Os botões têm 44x44px (área de toque). O botão "Hoje" só aparece quando o
 * mês selecionado não é o atual. A seta "anterior" fica DESABILITADA (apagada) em
 * MES_INICIAL (outubro/2026): não dá para ir antes disso (no painel, os meses anteriores também
 * ficam apagados). Componente controlado: o mês vive na página ("AAAA-MM").
 */
import { MES_INICIAL, deslocarMes, mesAtualDoPainel } from '../lib/mes.js';
import MonthPicker from './MonthPicker.jsx';

const BOTAO =
  'flex h-11 w-11 items-center justify-center rounded border border-border bg-surface text-xl ' +
  'text-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted';

export default function SeletorMes({ mes, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {/* Desabilitada no mês inicial: o painel só existe de MES_INICIAL em diante. */}
      <button
        type="button"
        aria-label="Mês anterior"
        disabled={mes <= MES_INICIAL}
        onClick={() => onChange(deslocarMes(mes, -1))}
        className={BOTAO}
      >
        ‹
      </button>
      {/* Nome do mês = botão do painel de escolha de mês/ano. */}
      <MonthPicker mes={mes} onChange={onChange} />
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(deslocarMes(mes, 1))} className={BOTAO}>
        ›
      </button>
      {mes !== mesAtualDoPainel() && (
        <button
          type="button"
          onClick={() => onChange(mesAtualDoPainel())}
          className="ml-1 flex min-h-[44px] items-center px-2 text-sm text-accent hover:opacity-80"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
