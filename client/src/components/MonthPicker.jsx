/**
 * MonthPicker — botão com o NOME DO MÊS (borda fina + ▾) que abre um painel flutuante para pular
 * direto para qualquer mês. Usado pelo <SeletorMes> (Despesas, Receitas e Resumo) — sozinho, sem
 * setas laterais: o botão do mês (e o link "Hoje") são a navegação.
 *
 * O PAINEL
 *  - Topo: ‹ ANO › — troca o ano mostrado. ‹ fica desabilitada no ano de MES_INICIAL (2026); › vai até
 *    o ano atual (ou até o ano do mês selecionado, se as setas ‹ › da página já levaram a um ano à
 *    frente). Ao abrir, o ano mostrado é o do mês selecionado.
 *  - Grade 4×3 com Jan…Dez. Meses antes de MES_INICIAL ficam APAGADOS e não clicáveis — é o único
 *    limite que o seletor já aplicava (meses futuros continuam permitidos, como pelas setas).
 *  - Mês selecionado: dourado (borda + fundo suave). Mês atual (hoje): pontinho verde.
 *  - Rodapé: "● mês atual" e o link dourado "Ir para hoje" (mesma função do "Hoje").
 *  - Clicar num mês navega e fecha. Fecha também com Esc ou clique fora.
 *  - TECLADO: o foco vai para o mês selecionado ao abrir; setas ←/→ andam 1 mês, ↑/↓ andam 4 (uma
 *    linha da grade), Enter/Espaço escolhe, PageUp/PageDown trocam o ano, Esc fecha e devolve o foco
 *    ao botão. Meses apagados são pulados.
 *  - CELULAR (< 640px): o painel abre centralizado na tela, com ~90% da largura.
 *
 * ATALHO NO BOTÃO (painel fechado, botão focado): ← vai ao mês anterior (não antes de MES_INICIAL) e
 * → ao mês seguinte (só até o mês atual). Fora desses limites a tecla não faz nada.
 *
 * Props (mesmo contrato do seletor):
 *  - mes      {string}                mês selecionado, "AAAA-MM".
 *  - onChange {(mes: string) => void}  chamado com o mês escolhido.
 *
 * Tema Grafite: card #111418 (`bg-surface`), borda #2a3139, sombra suave, dourado #D4A24C (`accent`),
 * verde #3ECF8E (`positive`), apagado #3b434b. Só interface — nenhuma regra de dados.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { MES_INICIAL, deslocarMes, mesAtual, rotuloMes } from '../lib/mes.js';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ANO_INICIAL = Number(MES_INICIAL.slice(0, 4));

/** "2026", 3 → "2026-03". */
const chave = (ano, indiceMes) => `${ano}-${String(indiceMes + 1).padStart(2, '0')}`;
/** "novembro de 2026" → "Novembro de 2026" (`capitalize` do CSS poria "De"). */
const primeiraMaiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Seta pequena (‹ ou ›) do topo do painel. */
function SetaAno({ direcao, ...props }) {
  return (
    <button
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded text-lg text-muted hover:bg-bg hover:text-fg disabled:cursor-not-allowed disabled:text-[#3b434b] disabled:hover:bg-transparent"
      {...props}
    >
      {direcao === 'anterior' ? '‹' : '›'}
    </button>
  );
}

export default function MonthPicker({ mes, onChange }) {
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(Number(mes.slice(0, 4))); // ano MOSTRADO no painel
  const [foco, setFoco] = useState(Number(mes.slice(5, 7)) - 1); // índice (0–11) do mês com foco
  const raiz = useRef(null);
  const botao = useRef(null);
  const celulas = useRef([]);
  const idPainel = useId();

  const hoje = mesAtual();
  const anoHoje = Number(hoje.slice(0, 4));
  const anoMaximo = Math.max(anoHoje, Number(mes.slice(0, 4))); // não "prende" quem já está à frente
  const permitido = (a, i) => chave(a, i) >= MES_INICIAL; // único limite: não antes do início

  /** Abre já no ano do mês selecionado, com o foco nele. */
  function abrir() {
    setAno(Number(mes.slice(0, 4)));
    setFoco(Number(mes.slice(5, 7)) - 1);
    setAberto(true);
  }
  function fechar(devolverFoco = false) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }
  function escolher(a, i) {
    if (!permitido(a, i)) return;
    onChange(chave(a, i));
    fechar(true);
  }

  // Fecha ao clicar/tocar fora.
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => raiz.current && !raiz.current.contains(e.target) && fechar();
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  // Trocou de ano e o mês focado ficou APAGADO (ex.: jan/2026)? Passa o foco ao 1º mês permitido.
  useEffect(() => {
    if (!aberto || permitido(ano, foco)) return;
    const primeiro = MESES.findIndex((_, i) => permitido(ano, i));
    if (primeiro >= 0) setFoco(primeiro);
  }, [aberto, ano]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leva o foco do teclado para o mês "focado" sempre que ele (ou o ano) muda com o painel aberto.
  useEffect(() => {
    if (aberto) celulas.current[foco]?.focus();
  }, [aberto, foco, ano]);

  /** Próximo índice PERMITIDO andando `passo` (pula meses apagados); fica onde está se não houver. */
  function mover(passo) {
    let i = foco + passo;
    while (i >= 0 && i < 12) {
      if (permitido(ano, i)) return setFoco(i);
      i += passo;
    }
  }

  function teclas(e) {
    const mapa = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
    if (mapa[e.key] !== undefined) {
      e.preventDefault();
      mover(mapa[e.key]);
    } else if (e.key === 'PageUp' && ano > ANO_INICIAL) {
      e.preventDefault();
      setAno((a) => a - 1);
    } else if (e.key === 'PageDown' && ano < anoMaximo) {
      e.preventDefault();
      setAno((a) => a + 1);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      fechar(true);
    }
  }

  return (
    <div ref={raiz} className="relative">
      {/* Botão com o nome do mês (borda fina + ▾). */}
      <button
        ref={botao}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        aria-label={`Escolher mês — selecionado: ${rotuloMes(mes)}`}
        onClick={() => (aberto ? fechar() : abrir())}
        // Atalho: ← / → no botão focado (painel fechado) trocam o mês, dentro de MES_INICIAL..mês atual.
        onKeyDown={(e) => {
          if (aberto) return;
          if (e.key === 'ArrowLeft' && mes > MES_INICIAL) {
            e.preventDefault();
            onChange(deslocarMes(mes, -1));
          } else if (e.key === 'ArrowRight' && mes < hoje) {
            e.preventDefault();
            onChange(deslocarMes(mes, 1));
          }
        }}
        className={[
          'flex min-h-[44px] min-w-[170px] items-center justify-center gap-1.5 rounded border px-3 text-sm font-medium',
          aberto ? 'border-accent text-accent' : 'border-[#2a3139] text-fg hover:border-muted',
        ].join(' ')}
      >
        {primeiraMaiuscula(rotuloMes(mes))}
        <span aria-hidden="true" className="text-[10px] text-muted">
          ▾
        </span>
      </button>

      {/* Celular: fundo escurecido atrás do painel (tocar nele fecha). Some a partir de `sm`. */}
      {aberto && <div aria-hidden="true" onClick={() => fechar()} className="fixed inset-0 z-30 bg-black/50 sm:hidden" />}

      {aberto && (
        <div
          id={idPainel}
          role="dialog"
          aria-label="Escolher mês"
          onKeyDown={teclas}
          className={[
            'z-40 rounded border border-[#2a3139] bg-surface p-3 shadow-[0_12px_32px_rgba(0,0,0,0.45)]',
            // Celular: fixo e CENTRALIZADO na tela (vertical e horizontal), ~90% da largura.
            'fixed left-1/2 top-1/2 w-[90vw] -translate-x-1/2 -translate-y-1/2',
            // A partir de `sm`: flutua logo abaixo do botão, centralizado nele.
            'sm:absolute sm:top-full sm:mt-2 sm:w-72 sm:translate-y-0',
          ].join(' ')}
        >
          {/* Topo: ‹ ANO › */}
          <div className="mb-2 flex items-center justify-between">
            <SetaAno direcao="anterior" aria-label="Ano anterior" disabled={ano <= ANO_INICIAL} onClick={() => setAno((a) => a - 1)} />
            <span className="num text-sm font-semibold" aria-live="polite">
              {ano}
            </span>
            <SetaAno direcao="proximo" aria-label="Próximo ano" disabled={ano >= anoMaximo} onClick={() => setAno((a) => a + 1)} />
          </div>

          {/* Grade 4×3 de meses. */}
          <div className="grid grid-cols-4 gap-1.5" role="grid" aria-label={`Meses de ${ano}`}>
            {MESES.map((nome, i) => {
              const valor = chave(ano, i);
              const ok = permitido(ano, i);
              const selecionado = valor === mes;
              const atual = valor === hoje;
              return (
                <button
                  key={nome}
                  ref={(el) => (celulas.current[i] = el)}
                  type="button"
                  role="gridcell"
                  disabled={!ok}
                  aria-selected={selecionado}
                  aria-current={atual ? 'date' : undefined}
                  aria-label={`${primeiraMaiuscula(rotuloMes(valor))}${atual ? ' (mês atual)' : ''}`}
                  tabIndex={i === foco ? 0 : -1} // "roving tabindex": só o mês focado entra no Tab
                  onClick={() => escolher(ano, i)}
                  onFocus={() => setFoco(i)}
                  className={[
                    'relative flex h-11 items-center justify-center rounded border text-sm outline-none',
                    'focus-visible:ring-2 focus-visible:ring-accent',
                    !ok
                      ? 'cursor-not-allowed border-transparent text-[#3b434b]'
                      : selecionado
                        ? 'border-accent bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] font-semibold text-accent'
                        : 'border-transparent text-fg hover:border-[#2a3139] hover:bg-bg',
                  ].join(' ')}
                >
                  {nome}
                  {/* Pontinho verde no mês atual. */}
                  {atual && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-positive" />}
                </button>
              );
            })}
          </div>

          {/* Rodapé: legenda do mês atual + "Ir para hoje". */}
          <div className="mt-3 flex items-center justify-between border-t border-[#2a3139] pt-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-positive" />
              mês atual
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(hoje < MES_INICIAL ? MES_INICIAL : hoje); // o mesmo "Hoje" do seletor
                fechar(true);
              }}
              className="min-h-[32px] font-medium text-accent hover:opacity-80"
            >
              Ir para hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
