/**
 * ResumoTotalCard — card menor com o TOTAL de receitas ou de despesas do mês, um ícone
 * discreto e a comparação com o mês anterior.
 *
 * Props:
 *  - tipo     {'receita' | 'despesa'}  define título, ícone e cor do valor
 *             (receita = verde, seta de entrada; despesa = vermelho, seta de saída).
 *  - valor    {number}                 total do mês exibido.
 *  - anterior {number | null}          total do mesmo tipo no mês anterior, ou `null` quando não
 *             existe mês anterior (outubro/2026) ou não carregou — aí não há comparação.
 *  - nomeAnterior {string}             nome do mês anterior, ex.: "outubro" (para "vs outubro").
 *
 * Comparação ("▲ 12% vs outubro"): só aparece quando dá para calcular (o mês anterior existe e
 * não foi zero). A COR diz se foi bom ou ruim: para receita, subir é bom (verde) e cair é ruim
 * (vermelho); para despesa é o contrário. Valores em fonte mono tabular.
 */
import { variacao } from '../lib/resumo.js';
import Money from './Money.jsx';

// Ícones de 14px: entrada (receita) e saída (despesa). Decorativos.
const Seta = ({ d }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONE_ENTRADA = 'M17 7 7 17M17 17H7V7'; // seta ↙ (dinheiro entrando)
const ICONE_SAIDA = 'M7 17 17 7M7 7h10v10'; // seta ↗ (dinheiro saindo)

export default function ResumoTotalCard({ tipo, valor, anterior, nomeAnterior }) {
  const receita = tipo === 'receita';
  const v = anterior == null ? null : variacao(valor, anterior);
  const temPercentual = v && v.percentual !== null;

  // Bom ou ruim? Receita: subir é bom. Despesa: subir é ruim.
  const subiu = v && v.delta > 0;
  const bom = v && (receita ? subiu : !subiu);

  let textoPct = '';
  if (temPercentual) {
    const abs = Math.abs(v.percentual);
    textoPct = abs > 0 && abs < 1 ? '<1%' : `${Math.round(abs)}%`;
  }

  return (
    <section className="rounded border border-border bg-surface p-4" aria-label={receita ? 'Total de receitas' : 'Total de despesas'}>
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-bg ${receita ? 'text-positive' : 'text-negative'}`}
        >
          <Seta d={receita ? ICONE_ENTRADA : ICONE_SAIDA} />
        </span>
        <p className="text-[11px] uppercase tracking-wide text-muted">
          {receita ? 'Total de receitas' : 'Total de despesas'}
        </p>
      </div>

      <Money value={valor} tone={receita ? 'positive' : 'negative'} className="mt-2 block text-xl" />

      {/* Comparação com o mês anterior (quando houver). */}
      {temPercentual && (
        <p className="mt-1 text-xs text-muted">
          {v.delta === 0 ? (
            <>Igual a {nomeAnterior}</>
          ) : (
            <>
              <span className={`num font-medium ${bom ? 'text-positive' : 'text-negative'}`}>
                {subiu ? '▲' : '▼'} {textoPct}
              </span>{' '}
              vs {nomeAnterior}
            </>
          )}
        </p>
      )}
    </section>
  );
}
