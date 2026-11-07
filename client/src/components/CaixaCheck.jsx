/**
 * CaixaCheck — checkbox GRANDE (caixa de 28px dentro de uma área de toque de 44x44px), no mesmo
 * estilo do checkbox das Metas: marcada = caixa verde (`positive`) com "✓"; desmarcada = só o
 * contorno em `muted`.
 *
 * Props:
 *  - marcada  {boolean}             estado atual.
 *  - onChange {(marcada) => void}   chamado com o novo valor ao clicar/tocar.
 *  - rotulo   {string}              texto para leitores de tela (ex.: "Marcar Conta de luz como paga").
 *
 * Acessibilidade: o <input type="checkbox"> é real, só oculto visualmente (`sr-only`), então
 * teclado (Tab/Espaço) e leitores de tela funcionam; `peer-focus-visible` desenha o foco na caixa.
 * Sem estado próprio — quem usa cuida da atualização (otimista) e da API.
 */
export default function CaixaCheck({ marcada, onChange, rotulo }) {
  return (
    <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={rotulo}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          'flex h-7 w-7 items-center justify-center rounded border-2 transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
          marcada ? 'border-positive bg-positive' : 'border-muted',
        ].join(' ')}
      >
        {marcada && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-bg">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
    </label>
  );
}
