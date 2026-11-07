/**
 * Money — exibe um valor monetário (R$) já formatado, em **fonte
 * monoespaçada com `tabular-nums`** (classe `.num`). Assim os dígitos têm
 * largura fixa e as colunas de valores das tabelas ficam alinhadas.
 *
 * Props:
 *  - value     {number}   Valor em reais.
 *  - tone      {'positive' | 'negative' | 'auto' | 'plain'}  Cor do texto:
 *      • 'positive' → verde   (token --color-positive)
 *      • 'negative' → vermelho (token --color-negative)
 *      • 'auto'     → verde se value >= 0, vermelho se value < 0
 *      • 'plain'    → herda a cor do texto ao redor (padrão)
 *  - semCentavos {boolean} Mostra o valor arredondado, sem centavos ("R$ 2.195"). Só muda a
 *      exibição — usado onde falta espaço (centro da rosca). Padrão: false.
 *  - className  {string}   Classes extras (ex.: tamanho da fonte no hero do Resumo).
 *
 * Componente puramente de apresentação.
 */
import { brl, brlInteiro } from '../lib/format.js';

const TONE_CLASS = {
  positive: 'text-positive',
  negative: 'text-negative',
  plain: '',
};

export default function Money({ value, tone = 'plain', semCentavos = false, className = '' }) {
  const cor =
    tone === 'auto'
      ? Number(value) >= 0
        ? TONE_CLASS.positive
        : TONE_CLASS.negative
      : TONE_CLASS[tone] ?? '';

  return <span className={`num ${cor} ${className}`.trim()}>{semCentavos ? brlInteiro(value) : brl(value)}</span>;
}
