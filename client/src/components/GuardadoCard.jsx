/**
 * GuardadoCard — card principal "Total guardado" da aba PORQUINHO (somente leitura).
 *
 * Total guardado = soma das CAIXINHAS (saldo conferido no MÊS DE REFERÊNCIA) + (receitas − despesas)
 * dos MESES FECHADOS a partir da referência até o mês anterior ao atual — os meses fechados antes da
 * referência já estão nos valores das caixinhas (regra em server/src/services/guardado.js). O mês em andamento NÃO entra no total:
 * ele aparece numa linha discreta à parte ("Mês em andamento (novembro/2026), entra em 01/12/2026").
 * (Antes este card ficava na aba Metas, com o campo "Saldo inicial guardado"; esse campo deu lugar
 * às caixinhas.)
 *
 * Props:
 *  - guardado {{ saldoAcumulado, caixinhasReferencia, mesesFechados, mediaMensal,
 *                emAndamento: { mes, saldo, entraEm } | null } | null}
 *      Dados da API (GET /api/caixinhas → `guardado`; null enquanto carrega).
 *  - totalCaixinhas {number}  soma ATUAL das caixinhas, calculada na tela. Vem à parte (e não de
 *      `guardado.totalCaixinhas`) para o total acompanhar na hora as mudanças otimistas.
 *
 * Linhas (texto dinâmico pelo mês de referência): "Caixinhas (saldo em início de novembro/2026)",
 * "Receitas − despesas (meses fechados, desde novembro/2026)",
 * "Média guardada por mês: R$ X (base: N meses)" (só com ao menos 1 mês fechado) e o mês em andamento.
 * Valor grande em verde (vermelho só se o total ficar negativo); valores em <Money> (mono + tabular).
 */
import { formatarDataIso, rotuloMesCurto } from '../lib/mes.js';
import Money from './Money.jsx';

export default function GuardadoCard({ guardado, totalCaixinhas }) {
  if (!guardado) {
    return <div className="rounded border border-border bg-surface p-4 text-muted">Carregando total guardado…</div>;
  }
  const total = totalCaixinhas + guardado.saldoAcumulado;
  // Mês de referência das caixinhas (padrão 2026-10), por extenso: "novembro/2026".
  const referencia = rotuloMesCurto(guardado.caixinhasReferencia ?? '2026-10');

  return (
    <section className="rounded border border-border bg-surface p-4 sm:p-5" aria-label="Total guardado">
      <p className="text-xs uppercase tracking-wide text-muted">Total guardado</p>
      <Money value={total} tone="auto" className="mt-1 block text-[2rem] sm:text-4xl" />

      {/* Composição do total */}
      <dl className="mt-3 space-y-1 text-sm text-muted">
        <div className="flex items-baseline justify-between gap-3">
          <dt>Caixinhas (saldo em início de {referencia})</dt>
          <dd>
            <Money value={totalCaixinhas} tone="plain" className="text-fg" />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Receitas − despesas (meses fechados, desde {referencia})</dt>
          <dd>
            <Money value={guardado.saldoAcumulado} tone="auto" />
          </dd>
        </div>
        {/* Média guardada por mês (base da previsão das metas). Só existe com ao menos 1 mês fechado. */}
        {guardado.mediaMensal != null && guardado.mesesFechados > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt>
              Média guardada por mês{' '}
              <span className="text-xs">
                (base: {guardado.mesesFechados} {guardado.mesesFechados === 1 ? 'mês' : 'meses'})
              </span>
            </dt>
            <dd>
              <Money value={guardado.mediaMensal} tone="auto" />
            </dd>
          </div>
        )}
        {/* Parcial do mês em andamento: informativo, AINDA NÃO somado ao total. */}
        {guardado.emAndamento && (
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <dt>
              Mês em andamento ({rotuloMesCurto(guardado.emAndamento.mes)}), entra em{' '}
              {formatarDataIso(guardado.emAndamento.entraEm)}
            </dt>
            <dd>
              <Money value={guardado.emAndamento.saldo} tone="auto" />
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
