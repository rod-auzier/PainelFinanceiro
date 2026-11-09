/**
 * CategoriasDonut — "Despesas por categoria": gráfico de ROSCA (donut) + lista ordenada da
 * maior para a menor categoria. Substitui o antigo gráfico de colunas.
 *
 * Props:
 *  - despesas {Array<{ categoria: string, valor: number }>}  despesas do mês (as mesmas que a
 *             API já devolve; o agrupamento por categoria é feito em lib/resumo.js).
 *
 * O que mostra:
 *  - rosca SVG feita à mão (sem biblioteca de gráficos): uma fatia por categoria, cada uma
 *    com a cor da categoria do USUÁRIO (categorias personalizadas — useCategorias; a mesma em
 *    todo o app). Despesa com categoria sem correspondência entra em "Outros" (só na exibição).
 *    Há um VÃO de 2px entre as fatias, na cor do card, para separar tons parecidos.
 *    O buraco é grande para o texto central caber com folga: nele aparece o total de despesas
 *    (sem centavos) ou, com uma categoria em foco, NOME, VALOR e %;
 *  - ao lado, a legenda (da maior para a menor): bolinha da cor, NOME INTEIRO (quebra de linha
 *    em vez de reticências), valor logo abaixo e % do total de despesas à direita;
 *  - INTERAÇÃO: passar o mouse (ou tocar / usar Tab) numa fatia OU num item da lista destaca o
 *    outro — as demais fatias/itens ficam esmaecidas. Mouse = destaca enquanto o ponteiro está
 *    em cima; toque = liga/desliga (tocar de novo na mesma categoria desfaz o destaque);
 *  - ANIMAÇÃO: as fatias "preenchem" ao carregar (stroke-dasharray com transição CSS em
 *    `.donut-fatia`, escalonada), respeitando `prefers-reduced-motion`;
 *  - ESTADOS SIMPLES: sem despesas → aviso; só UMA categoria → frase simples (uma rosca de
 *    100% não diz nada).
 *
 * Layout: rosca e lista ficam lado a lado e, se o card for estreito, a lista desce
 * automaticamente (flex-wrap) — sem rolagem horizontal.
 * MUITAS CATEGORIAS (mais de 6): a legenda passa a DUAS COLUNAS (quando há largura, `sm`) e ganha
 * altura máxima com rolagem vertical própria — os nomes nunca são cortados (quebram de linha).
 */
import { useMemo, useState } from 'react';
import { useEntrada } from '../hooks/useEntrada.js';
import { useCategorias } from '../context/CategoriasContext.jsx';
import { agruparPorCategoria } from '../lib/resumo.js';
import CategoriaPonto from './CategoriaPonto.jsx';
import Money from './Money.jsx';

// Geometria da rosca (viewBox 120x120). Circunferência = 2πr.
const RAIO = 50; // raio do traço (linha central do anel)
const ESPESSURA = 14; // anel fino => buraco interno de raio 43 (antes 40): mais folga p/ o texto
const CIRC = 2 * Math.PI * RAIO;
const FOLGA = 2; // vão entre fatias: 2px no viewBox (≈2,5px na tela), na cor do card (trilho abaixo)

/** "52%" / "<1%" a partir de um percentual 0–100. */
const rotuloPct = (p) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`);

/** Moldura de card + título (compartilhada pelos estados vazio/simples/normal). */
function Cartao({ children }) {
  return (
    <section className="rounded border border-border bg-surface p-4 sm:p-5" aria-label="Despesas por categoria">
      <h2 className="mb-4 text-sm font-medium text-muted">Despesas por categoria</h2>
      {children}
    </section>
  );
}

export default function CategoriasDonut({ despesas }) {
  const { resolver } = useCategorias();
  const grupos = useMemo(() => agruparPorCategoria(despesas, resolver), [despesas, resolver]);
  const muitas = grupos.length > 6; // legenda em 2 colunas + rolagem
  const total = grupos.reduce((soma, g) => soma + g.total, 0);
  const [ativa, setAtiva] = useState(null); // categoria em destaque (hover/toque/foco)
  const pronto = useEntrada(despesas); // preenche as fatias depois do 1º frame

  // --- Estados simples ---
  if (grupos.length === 0) {
    return (
      <Cartao>
        <p className="text-sm text-muted">Sem despesas neste mês.</p>
      </Cartao>
    );
  }
  if (grupos.length === 1) {
    const [unica] = grupos;
    return (
      <Cartao>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-bg p-3 text-sm">
          <CategoriaPonto cor={unica.cor} />
          <span className="min-w-0 flex-1">
            Todas as despesas do mês estão em <span className="font-medium">{unica.categoria}</span>.
          </span>
          <Money value={unica.total} tone="negative" />
        </div>
      </Cartao>
    );
  }

  // Posição de cada fatia: comprimento proporcional ao valor e início = soma das anteriores.
  let acumulado = 0;
  const fatias = grupos.map((g) => {
    const comprimento = (g.total / total) * CIRC;
    const fatia = { ...g, inicio: acumulado, comprimento };
    acumulado += comprimento;
    return fatia;
  });

  const emFoco = grupos.find((g) => g.categoria === ativa) ?? null;

  // Eventos de PONTEIRO (não mouseenter/click): no celular, um toque dispara "mouseenter" e
  // "click" em sequência e o destaque se desfaria sozinho. Aqui o mouse só usa hover e o
  // toque/caneta liga e desliga o destaque.
  const destaque = (cat) => ({
    onPointerEnter: (e) => e.pointerType === 'mouse' && setAtiva(cat),
    onPointerLeave: (e) => e.pointerType === 'mouse' && setAtiva(null),
    onPointerDown: (e) => e.pointerType !== 'mouse' && setAtiva((atual) => (atual === cat ? null : cat)),
  });

  return (
    <Cartao>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5">
        {/* ---------- Rosca ---------- */}
        <div className="relative h-[148px] w-[148px] shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label="Gráfico de rosca das despesas por categoria">
            {/* Trilho de fundo na cor do CARD (surface): é ele que aparece nos vãos entre as
                fatias, separando bem cada categoria. */}
            <circle cx="60" cy="60" r={RAIO} fill="none" stroke="var(--color-surface)" strokeWidth={ESPESSURA} />
            {fatias.map((f, i) => {
              const esmaecida = ativa && ativa !== f.categoria;
              return (
                <circle
                  key={f.categoria}
                  className="donut-fatia cursor-pointer"
                  cx="60"
                  cy="60"
                  r={RAIO}
                  fill="none"
                  stroke={f.cor}
                  strokeWidth={ativa === f.categoria ? ESPESSURA + 3 : ESPESSURA}
                  // Começa "vazia" (0) e enche até o comprimento da fatia menos a folga.
                  strokeDasharray={pronto ? `${Math.max(f.comprimento - FOLGA, 0.5)} ${CIRC}` : `0 ${CIRC}`}
                  strokeDashoffset={-f.inicio}
                  transform="rotate(-90 60 60)" // a 1ª fatia começa no topo
                  opacity={esmaecida ? 0.3 : 1}
                  style={{ '--atraso': `${i * 90}ms` }}
                  {...destaque(f.categoria)}
                />
              );
            })}
          </svg>

          {/* Centro da rosca: total de despesas, ou a categoria em foco. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center">
            {emFoco ? (
              <>
                <span className="max-w-full truncate text-[11px] leading-tight text-muted">{emFoco.categoria}</span>
                <Money value={emFoco.total} semCentavos className="text-sm font-medium leading-tight" />
                <span className="num text-[11px] leading-tight text-muted">{rotuloPct(emFoco.percentual)}</span>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase leading-tight tracking-wide text-muted">Despesas</span>
                <Money value={total} semCentavos className="text-sm font-medium leading-tight" />
              </>
            )}
          </div>
        </div>

        {/* ---------- Legenda (da maior para a menor) ---------- */}
        {/* Com muitas categorias: 2 colunas (a partir de `sm`) e altura máxima com rolagem própria
            (`overscroll-contain` evita rolar a página junto no celular). */}
        <ul
          className={[
            'min-w-[210px] flex-1',
            muitas
              ? 'grid max-h-[320px] gap-x-2 gap-y-0.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2'
              : 'space-y-0.5',
          ].join(' ')}
        >
          {grupos.map((g) => {
            const esmaecido = ativa && ativa !== g.categoria;
            return (
              <li
                key={g.categoria}
                tabIndex={0}
                className={[
                  'flex min-h-[44px] cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none transition-[background-color,opacity] duration-150',
                  'focus-visible:ring-2',
                  ativa === g.categoria ? 'bg-bg' : '',
                  esmaecido ? 'opacity-40' : '',
                ].join(' ')}
                {...destaque(g.categoria)}
                onFocus={() => setAtiva(g.categoria)} // teclado (Tab) também destaca
                onBlur={() => setAtiva(null)}
              >
                <CategoriaPonto cor={g.cor} />
                {/* Nome em cima (inteiro; quebra de linha se faltar espaço) e valor embaixo: a
                    coluna do nome ocupa todo o espaço livre e nunca é cortada com "…". */}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm leading-tight">{g.categoria}</p>
                  <Money value={g.total} className="text-xs text-muted" />
                </div>
                <span className="num shrink-0 text-right text-xs text-muted">{rotuloPct(g.percentual)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Cartao>
  );
}
