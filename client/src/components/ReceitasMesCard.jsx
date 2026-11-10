/**
 * ReceitasMesCard — card do PAINEL LATERAL da tela de Receitas: "RECEITAS DO MÊS".
 *
 * Mostra o total do mês grande em verde e, embaixo, a divisão calculada a partir das receitas que já
 * existem (sem campo novo no banco): "Fixas (repetem todo mês)" = soma das marcadas como "Repete todo
 * mês" e "Avulsas (só este mês)" = soma das demais. Só apresentação.
 *
 * Props: receitas {Array<{ valor, recorrente }>}  — as receitas do mês.
 */
import Money from './Money.jsx';

export default function ReceitasMesCard({ receitas }) {
  const soma = (lista) => lista.reduce((s, r) => s + Number(r.valor || 0), 0);
  const fixas = soma(receitas.filter((r) => r.recorrente));
  const avulsas = soma(receitas.filter((r) => !r.recorrente));

  return (
    // Mesmo estilo do "Pagamento do mês" de Despesas: card sólido com 20px de padding.
    <section className="rounded border border-border bg-surface p-5" aria-label="Receitas do mês">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Receitas do mês</p>
      <Money value={fixas + avulsas} tone="positive" className="mt-1 block text-2xl font-semibold" />

      <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Fixas (repetem todo mês)</dt>
          <dd>
            <Money value={fixas} className="text-sm text-fg" />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Avulsas (só este mês)</dt>
          <dd>
            <Money value={avulsas} className="text-sm text-fg" />
          </dd>
        </div>
      </dl>
    </section>
  );
}
