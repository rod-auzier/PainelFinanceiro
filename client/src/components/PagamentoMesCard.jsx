/**
 * PagamentoMesCard — 1º card do painel lateral da tela de Despesas: "PAGAMENTO DO MÊS".
 *
 * Mostra o total do mês grande em vermelho, uma barra de progresso verde com a fração já paga e,
 * embaixo, "Pago R$ x" (verde) à esquerda e "Falta R$ y" (dourado) à direita. Os números vêm prontos
 * da página (mesmos cálculos de Pago / Falta pagar de antes; a linha calculada do cartão conta como
 * paga quando a fatura está paga). Só apresentação.
 *
 * Props: total {number} · pago {number}
 */
import Money from './Money.jsx';

export default function PagamentoMesCard({ total, pago }) {
  const falta = Math.max(0, total - pago);
  const fracao = total > 0 ? Math.min(Math.max(pago / total, 0), 1) : 0;

  return (
    <section className="rounded border border-border bg-surface p-4" aria-label="Pagamento do mês">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Pagamento do mês</p>
      <Money value={total} tone="negative" className="mt-1 block text-2xl font-semibold" />

      {/* Barra: fração já paga (verde) sobre o trilho. */}
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-bg"
        role="progressbar"
        aria-label="Fração do mês já paga"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fracao * 100)}
      >
        <div className="h-full rounded-full bg-positive transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${fracao * 100}%` }} />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">
          Pago <Money value={pago} tone="positive" className="font-medium" />
        </span>
        <span className="text-muted">
          Falta <Money value={falta} className="font-medium text-accent" />
        </span>
      </div>
    </section>
  );
}
