/**
 * ResumoSaldoCard — card PRINCIPAL do Resumo: o saldo do mês em destaque.
 *
 * Props:
 *  - mes      {string}   mês exibido, "AAAA-MM".
 *  - resumo   {{ totalReceitas: number, totalDespesas: number, saldo: number }}  totais do mês.
 *  - anterior {{ saldo: number } | null}  resumo do mês ANTERIOR, ou `null` quando não há
 *             comparação: outubro/2026 (MES_INICIAL — não existe mês anterior), mês em andamento
 *             ou futuro (a tela só compara meses FECHADOS) ou falha ao carregar. Sem ele, a
 *             linha de variação simplesmente não aparece (e nada fica no lugar dela).
 *
 * O que mostra:
 *  1. "Saldo final" grande (fonte mono tabular), verde se ≥ 0 e vermelho se < 0, com o selo
 *     ▲ Superávit / ▼ Déficit;
 *  2. variação do saldo em relação ao mês anterior, em texto pequeno
 *     ("+R$ 300,00 em relação a outubro") — só se existir mês anterior;
 *  3. UMA barra horizontal com "Você gastou N% da receita": parte VERMELHA = despesas, parte
 *     VERDE = o que sobrou. Se gastou mais que a receita, a barra fica toda vermelha e a
 *     legenda troca "Sobrou" por "Faltou". Sem lançamentos, mostra um aviso simples.
 *
 * A barra "enche" ao carregar (e ao trocar de mês) com uma transição CSS suave que respeita
 * `prefers-reduced-motion` (ver `.barra-anima` em index.css).
 * Só reaproveita os dados que a API já devolve; os cálculos estão em lib/resumo.js.
 */
import { useEntrada } from '../hooks/useEntrada.js';
import { brlComSinal } from '../lib/format.js';
import { nomeDoMes } from '../lib/mes.js';
import { comprometimento, variacao } from '../lib/resumo.js';
import Money from './Money.jsx';

export default function ResumoSaldoCard({ mes, resumo, anterior }) {
  const pronto = useEntrada(mes); // enche a barra depois do 1º frame
  const superavit = resumo.saldo >= 0;
  const comp = comprometimento(resumo.totalReceitas, resumo.totalDespesas);
  // Sem comparação quando não há mês anterior — e também quando os dois meses estão zerados
  // ("Igual a outubro" num mês sem nenhum lançamento seria só ruído).
  const varSaldo =
    anterior && !(resumo.saldo === 0 && anterior.saldo === 0) ? variacao(resumo.saldo, anterior.saldo) : null;
  const nomeAnterior = nomeDoMes(mes, -1);

  return (
    <section className="h-full rounded border border-border bg-surface p-5 sm:p-6 lg:p-8" aria-label="Saldo do mês">
      <p className="text-xs uppercase tracking-wide text-muted">Saldo final</p>
      {/* Número grande: 32px no celular → 36px (`sm`) → 48px (`md`), sem estourar telas estreitas. */}
      <Money value={resumo.saldo} tone="auto" className="mt-2 block text-[2rem] sm:text-4xl md:text-5xl lg:text-6xl" />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`text-sm font-medium ${superavit ? 'text-positive' : 'text-negative'}`}>
          {superavit ? '▲ Superávit' : '▼ Déficit'}
        </span>

        {/* Variação vs mês anterior — só quando existe mês anterior. */}
        {varSaldo && (
          <span className="text-xs text-muted">
            {varSaldo.delta === 0 ? (
              <>Igual a {nomeAnterior}</>
            ) : (
              <>
                <span className={`num ${varSaldo.delta > 0 ? 'text-positive' : 'text-negative'}`}>
                  {brlComSinal(varSaldo.delta)}
                </span>{' '}
                em relação a {nomeAnterior}
              </>
            )}
          </span>
        )}
      </div>

      {/* Barra: quanto da receita foi comprometido pelas despesas. */}
      <div className="mt-5">
        {comp.situacao === 'vazio' ? (
          <p className="text-sm text-muted">Sem lançamentos neste mês.</p>
        ) : (
          <>
            <p className="text-sm">
              {comp.situacao === 'sem-receita' ? (
                <>Despesas sem nenhuma receita neste mês</>
              ) : (
                <>
                  Você gastou <span className="num font-medium">{Math.round(comp.percentual)}%</span> da receita
                </>
              )}
            </p>

            <div
              role="img"
              aria-label={
                comp.situacao === 'sem-receita'
                  ? 'Barra: despesas sem receita'
                  : `Barra: despesas são ${Math.round(comp.percentual)}% da receita`
              }
              className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-border"
            >
              {/* vermelho = despesas */}
              <div
                className="barra-anima h-full bg-negative"
                style={{ width: pronto ? `${comp.parteDespesas}%` : '0%' }}
              />
              {/* verde = o que sobrou */}
              <div
                className="barra-anima h-full bg-positive"
                style={{ width: pronto ? `${comp.parteSobra}%` : '0%' }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <i aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-negative" />
                Despesas <Money value={resumo.totalDespesas} className="text-fg" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${comp.sobra >= 0 ? 'bg-positive' : 'bg-negative'}`} />
                {comp.sobra >= 0 ? 'Sobrou' : 'Faltou'} <Money value={Math.abs(comp.sobra)} className="text-fg" />
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
