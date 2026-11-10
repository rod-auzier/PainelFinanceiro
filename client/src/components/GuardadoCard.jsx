/**
 * GuardadoCard — card principal "Total guardado" da aba PORQUINHO (somente leitura).
 *
 * REGRA: Total guardado = SOMA DAS CAIXINHAS. Só isso (a mesma regra do servidor, em
 * server/src/services/guardado.js → `calcularGuardado`). O resultado dos meses (receitas − despesas)
 * não é somado: as caixinhas já são o dinheiro guardado. Fechar um mês não muda o total.
 *
 * Props:
 *  - guardado {{ mesesFechados, mediaMensal, emAndamento: { mes, saldo, entraEm } | null } | null}
 *      Dados da API (GET /api/caixinhas → `guardado`; null enquanto carrega).
 *  - totalCaixinhas {number}  soma ATUAL das caixinhas na tela — é o próprio total. Vem da lista local
 *      (e não de `guardado.total`) só para acompanhar na hora as mudanças otimistas; é o mesmo valor
 *      que a API devolve em `guardado.total` depois de sincronizar.
 *
 * À direita, só informações de ritmo (fora do total): "Média guardada por mês (base: N meses)" (só com
 * ao menos 1 mês fechado) e o mês em andamento. Valor grande em verde; valores em <Money>.
 */
import { formatarDataIso, rotuloMesCurto } from '../lib/mes.js';
import Money from './Money.jsx';

export default function GuardadoCard({ guardado, totalCaixinhas }) {
  if (!guardado) {
    return <div className="rounded border border-border bg-surface p-4 text-muted">Carregando total guardado…</div>;
  }
  const total = totalCaixinhas; // total guardado = soma das caixinhas

  return (
    <section className="rounded border border-border bg-surface p-4 sm:p-5" aria-label="Total guardado">
      <p className="text-xs uppercase tracking-wide text-muted">Total guardado</p>
      <Money value={total} tone="auto" className="mt-1 block text-[2rem] sm:text-4xl" />

      {/* Ritmo (informativo, fora do total): média mensal e mês em andamento. */}
      <dl className="mt-3 space-y-1 text-sm text-muted">
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
        {/* Parcial do mês em andamento: informativo (o total é só a soma das caixinhas). */}
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
