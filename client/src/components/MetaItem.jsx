/**
 * MetaItem — uma linha da lista de Metas: checkbox grande + título + lixeira.
 *
 * Props:
 *  - meta       {{ _id: string, titulo: string, concluida: boolean }}
 *  - onAlternar {(meta) => void}  chamado ao marcar/desmarcar o checkbox.
 *  - onExcluir  {(meta) => void}  chamado ao clicar na lixeira.
 *
 * Responsabilidades:
 *  - checkbox GRANDE e fácil de tocar: o <label> inteiro (caixa + texto) é a
 *    área clicável, com altura mínima de 56px — bem acima dos 44px
 *    recomendados para toque;
 *  - estado visual: marcada → caixa verde (`positive`) com "✓" e texto riscado
 *    em `muted` (#8B95A1); pendente → caixa só com contorno e texto normal;
 *  - acessibilidade: o <input type="checkbox"> real fica oculto só visualmente
 *    (`sr-only`), então teclado (Tab/Espaço) e leitores de tela funcionam;
 *  - botão de excluir (lixeira) de 44x44, fora do <label> para não marcar a
 *    meta por engano ao tentar apagar.
 *
 * Componente controlado e sem estado próprio — a página decide o que fazer
 * (atualização otimista + chamada à API).
 */
function IconeLixeira() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function MetaItem({ meta, onAlternar, onExcluir }) {
  return (
    <li className="flex items-center gap-1 rounded border border-border bg-surface pr-1">
      {/* Área de toque principal: caixa + título. */}
      <label className="flex min-h-[56px] min-w-0 flex-1 cursor-pointer items-center gap-3 pl-3">
        <input
          type="checkbox"
          checked={meta.concluida}
          onChange={() => onAlternar(meta)}
          className="peer sr-only"
        />

        {/* Caixa visual (28px). `peer-focus-visible` mostra o foco do teclado. */}
        <span
          aria-hidden="true"
          className={[
            'flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
            meta.concluida ? 'border-positive bg-positive' : 'border-muted',
          ].join(' ')}
        >
          {meta.concluida && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-bg"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </span>

        <span
          className={[
            'min-w-0 flex-1 break-words py-2 text-base',
            meta.concluida ? 'text-muted line-through' : 'text-fg',
          ].join(' ')}
        >
          {meta.titulo}
        </span>
      </label>

      <button
        type="button"
        onClick={() => onExcluir(meta)}
        aria-label={`Excluir meta: ${meta.titulo}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted hover:text-negative"
      >
        <IconeLixeira />
      </button>
    </li>
  );
}
