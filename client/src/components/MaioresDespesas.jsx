/**
 * MaioresDespesas — "Maiores despesas do mês": as 5 maiores despesas, da maior para a menor.
 *
 * Props:
 *  - despesas {Array<{ _id: string, descricao: string, categoria: string, valor: number }>}
 *             despesas do mês (as que a API já devolve). A ordenação/corte em 5 é feita por
 *             `maioresDespesas` (lib/resumo.js).
 *
 * Cada linha mostra a posição (1–5), a descrição, a categoria (bolinha com a cor da categoria do
 * usuário + nome; sem correspondência aparece como "Outros") e o valor em fonte mono tabular, em vermelho. Sem despesas, mostra um
 * aviso simples. Descrições longas são truncadas (sem rolagem horizontal no celular).
 */
import { maioresDespesas } from '../lib/resumo.js';
import { useCategorias } from '../context/CategoriasContext.jsx';
import CategoriaPonto from './CategoriaPonto.jsx';
import Money from './Money.jsx';

export default function MaioresDespesas({ despesas }) {
  const top = maioresDespesas(despesas, 5);
  const { resolver } = useCategorias(); // nome/cor de exibição da categoria

  return (
    <section className="rounded border border-border bg-surface p-4 sm:p-5" aria-label="Maiores despesas do mês">
      <h2 className="mb-2 text-sm font-medium text-muted">Maiores despesas do mês</h2>

      {top.length === 0 ? (
        <p className="text-sm text-muted">Sem despesas neste mês.</p>
      ) : (
        <ol className="divide-y divide-border">
          {top.map((d, i) => (
            <li key={d._id} className="flex items-center gap-3 py-3">
              {/* Posição: cor secundária do tema (text-muted), nunca a cor de uma categoria. */}
              <span className="num w-4 shrink-0 text-xs text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{d.descricao}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <CategoriaPonto categoria={d.categoria} />
                  <span className="truncate">{resolver(d.categoria).nome}</span>
                </p>
              </div>
              <Money value={d.valor} tone="negative" className="shrink-0 text-sm" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
