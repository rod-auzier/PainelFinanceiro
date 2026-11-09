/**
 * BarraCaixinhas — barra EMPILHADA horizontal com a proporção de cada caixinha no total delas,
 * mais a legenda (bolinha da cor, nome e %).
 *
 * Props:
 *  - caixinhas {Array<{ _id, nome, valor }>}  já ordenadas (maior → menor).
 *  - cores     {Map<string, string>}          _id → cor (lib/caixinhas.js → coresDasCaixinhas).
 *  - total     {number}                       soma das caixinhas.
 *
 * Cada caixinha é um segmento com largura proporcional ao valor e um vão de 2px (na cor do card)
 * entre os segmentos, para separar tons parecidos. Caixinhas com valor 0 ficam só na legenda (0%).
 * Sem valor nenhum (total 0) a barra não faz sentido e mostra um aviso curto.
 * A largura anima ao mudar (transição CSS), desligada para quem prefere menos movimento.
 */
import { rotuloPercentual } from '../lib/caixinhas.js';
import CategoriaPonto from './CategoriaPonto.jsx';

export default function BarraCaixinhas({ caixinhas, cores, total }) {
  if (total <= 0) {
    return <p className="text-sm text-muted">Informe os valores das caixinhas para ver a proporção de cada uma.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Barra: 12px de altura, cantos arredondados; `gap-0.5` = vão de 2px entre os segmentos. */}
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-bg"
        role="img"
        aria-label={`Proporção das caixinhas: ${caixinhas
          .map((c) => `${c.nome} ${rotuloPercentual((c.valor / total) * 100)}`)
          .join(', ')}`}
      >
        {caixinhas
          .filter((c) => c.valor > 0)
          .map((c) => (
            <span
              key={c._id}
              className="h-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${(c.valor / total) * 100}%`, backgroundColor: cores.get(c._id) }}
              title={c.nome}
            />
          ))}
      </div>

      {/* Legenda: nome + %; quebra em várias linhas, sem cortar nomes. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {caixinhas.map((c) => (
          <li key={c._id} className="flex items-center gap-1.5">
            <CategoriaPonto cor={cores.get(c._id)} />
            <span className="break-words text-fg">{c.nome}</span>
            <span className="num">{rotuloPercentual((c.valor / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
