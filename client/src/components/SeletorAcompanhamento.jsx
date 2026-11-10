/**
 * SeletorAcompanhamento — escolhe o que uma META acompanha: o TOTAL GUARDADO (todas as caixinhas) ou
 * uma CAIXINHA específica. Usado no formulário de criar meta, na edição e no "trocar ▾" do card.
 *
 * - Controle segmentado "Total guardado | Caixinha específica"; ao escolher "Caixinha específica"
 *   aparece um <select> com as caixinhas do usuário (bolinha de cor ao lado do select).
 * - Sem caixinhas cadastradas, a opção "Caixinha específica" não aparece (só o total).
 *
 * Props:
 *  - valor     {string}  id da caixinha, ou '' = total guardado.
 *  - onChange  {(id: string) => void}
 *  - caixinhas {Array<{ _id, nome }>}  caixinhas do usuário (ordem de criação).
 *  - cores     {Map<string, string>}   _id → cor (a mesma da aba Porquinho).
 */
import CategoriaPonto from './CategoriaPonto.jsx';

const SEGMENTO = 'min-h-[40px] flex-1 px-3 text-sm transition-colors';

export default function SeletorAcompanhamento({ valor, onChange, caixinhas, cores }) {
  // "Caixinha específica" = há uma caixinha escolhida (derivado do valor: nada fica dessincronizado).
  const especifica = Boolean(valor);
  const temCaixinhas = caixinhas.length > 0;

  function escolherTotal() {
    onChange('');
  }
  function escolherEspecifica() {
    if (!valor && caixinhas[0]) onChange(String(caixinhas[0]._id)); // já escolhe a 1ª caixinha
  }

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="O que a meta acompanha" className="flex overflow-hidden rounded border border-border">
        <button
          type="button"
          role="radio"
          aria-checked={!especifica}
          onClick={escolherTotal}
          className={`${SEGMENTO} ${!especifica ? 'bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] font-medium text-accent' : 'text-muted hover:text-fg'}`}
        >
          Total guardado
        </button>
        {temCaixinhas && (
          <button
            type="button"
            role="radio"
            aria-checked={especifica}
            onClick={escolherEspecifica}
            className={`${SEGMENTO} border-l border-border ${especifica ? 'bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] font-medium text-accent' : 'text-muted hover:text-fg'}`}
          >
            Caixinha específica
          </button>
        )}
      </div>

      {especifica && temCaixinhas && (
        <div className="flex items-center gap-2">
          {valor && <CategoriaPonto cor={cores.get(String(valor))} grande />}
          <select
            aria-label="Caixinha acompanhada"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[44px] w-full rounded border border-border bg-bg px-3 text-base text-fg focus:border-accent focus:outline-none"
          >
            {caixinhas.map((c) => (
              <option key={c._id} value={String(c._id)}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
