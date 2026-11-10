/**
 * SeletorMes — navegação entre meses: "[Novembro de 2026 ▾]  Hoje". Usado em Despesas, Receitas e
 * Resumo (componente ÚNICO — nenhuma página tem cópia própria).
 *
 * Não há mais setas ‹ › ao lado do mês: a navegação é pelo botão do mês (<MonthPicker>, que abre o
 * painel com ‹ ANO › e a grade Jan…Dez — ver MonthPicker.jsx) e pelo link "Hoje". Com o botão do mês
 * focado, as teclas ← e → também vão ao mês anterior/seguinte (atalho do MonthPicker).
 *
 * Props:
 *  - mes      {string}              mês selecionado, "AAAA-MM".
 *  - onChange {(mes: string) => void}  chamado com o novo mês (escolhido no painel, pelo atalho de
 *                                      teclado ou em "Hoje", que volta ao mês atual).
 *
 * O link "Hoje" só aparece quando o mês selecionado não é o atual. Nada antes de MES_INICIAL
 * (outubro/2026) pode ser escolhido. Componente controlado: o mês vive na página ("AAAA-MM").
 */
import { mesAtualDoPainel } from '../lib/mes.js';
import MonthPicker from './MonthPicker.jsx';

export default function SeletorMes({ mes, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {/* Nome do mês = botão do painel de escolha de mês/ano (sozinho, sem setas laterais). */}
      <MonthPicker mes={mes} onChange={onChange} />
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
