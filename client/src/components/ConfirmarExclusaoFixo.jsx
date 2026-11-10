/**
 * ConfirmarExclusaoFixo — pergunta exibida ao excluir um lançamento FIXO ("Repete todo mês"),
 * em Despesas e Receitas: excluir só deste mês (PADRÃO, botão principal) ou também dos meses
 * seguintes (cópias do mesmo fixo; meses anteriores nunca são tocados). Excluir é delicado, então
 * aqui há confirmação — ao contrário da edição, que se propaga sozinha.
 *
 * Fica FIXA na parte de baixo da tela (acima da barra inferior no celular), para aparecer mesmo se a
 * linha excluída estiver no fim de uma lista longa.
 *
 * Props:
 *  - nome      {string}  o que está sendo excluído (ex.: "Energia").
 *  - ocupado   {boolean} desabilita os botões enquanto a API responde.
 *  - onEscolher {(escopo: 'mes' | 'seguintes') => void}
 *  - onCancelar {() => void}
 */
export default function ConfirmarExclusaoFixo({ nome, ocupado, onEscolher, onCancelar }) {
  return (
    <div
      role="alertdialog"
      aria-label={`Excluir lançamento fixo ${nome}`}
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
      className="fixed inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg space-y-3 rounded border border-border bg-surface p-4 shadow-lg shadow-black/50 md:bottom-6"
    >
      <p className="text-sm">
        Excluir <span className="font-medium">"{nome}"</span>? É um lançamento fixo (repete todo mês).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          autoFocus
          disabled={ocupado}
          onClick={() => onEscolher('mes')}
          className="min-h-[44px] flex-1 rounded bg-accent px-3 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60"
        >
          Só este mês
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => onEscolher('seguintes')}
          className="min-h-[44px] flex-1 rounded border border-negative px-3 text-sm text-negative hover:opacity-80 disabled:opacity-60"
        >
          Este e os meses seguintes
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="min-h-[44px] rounded border border-border px-3 text-sm text-muted hover:text-fg"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
