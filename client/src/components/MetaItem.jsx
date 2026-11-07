/**
 * MetaItem — uma meta da lista: checkbox grande + título + (opcional) barra de
 * progresso + botões de editar e excluir.
 *
 * Props:
 *  - meta       {{ _id, titulo, concluida, valorAlvo: number|null }}
 *  - total      {number}  total guardado atual (saldo inicial + receitas − despesas),
 *                         usado para calcular o progresso das metas com valor.
 *  - onAlternar {(meta) => void}  marcar/desmarcar o checkbox.
 *  - onExcluir  {(meta) => void}  clicar na lixeira.
 *  - onSalvarEdicao {(meta, { titulo: string, valorAlvo: number|null }) => Promise<void>}
 *      Salva a edição inline. Deve lançar Error com mensagem se falhar (a mensagem
 *      aparece dentro do item).
 *
 * Responsabilidades:
 *  - checkbox GRANDE: o <label> inteiro (caixa + texto) é a área clicável, com
 *    56px de altura. Marcada → caixa verde (`positive`) com "✓" e texto riscado
 *    em `muted` (--color-muted); pendente → só contorno e texto normal;
 *  - acessibilidade: <input type="checkbox"> real oculto só visualmente (`sr-only`);
 *  - META COM VALOR: barra de progresso verde + porcentagem + "R$ X de R$ Y".
 *    Progresso = min(total / valorAlvo, 100%) (nunca abaixo de 0%). Metas sem valor
 *    continuam sendo um checklist simples (sem barra);
 *  - EDIÇÃO inline (lápis): título e valor viram inputs, com Salvar/Cancelar.
 *    Valor vazio = meta sem valor;
 *  - botões de 44x44 fora do <label>, para não marcar a meta sem querer.
 *
 * Sem estado de negócio — a página cuida da atualização otimista e da API.
 * Valores monetários em <Money> (mono + tabular-nums).
 */
import { useState } from 'react';
import Money from './Money.jsx';

const BOTAO_ICONE =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted';

const CAMPO =
  'min-h-[44px] w-full rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

function IconeLixeira() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function IconeLapis() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Fração 0–1 do progresso: min(total / valorAlvo, 1), nunca abaixo de 0. */
export function fracaoProgresso(total, valorAlvo) {
  if (!valorAlvo || valorAlvo <= 0) return 0;
  return Math.max(0, Math.min(total / valorAlvo, 1));
}

export default function MetaItem({ meta, total, onAlternar, onExcluir, onSalvarEdicao }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const temValor = meta.valorAlvo != null && meta.valorAlvo > 0;
  const fracao = fracaoProgresso(total, meta.valorAlvo);
  // floor: 99,6% aparece como 99%, só mostra 100% quando o alvo foi realmente atingido.
  const porcentagem = Math.floor(fracao * 100);

  function iniciarEdicao() {
    setTitulo(meta.titulo);
    setValor(temValor ? String(meta.valorAlvo) : '');
    setErro('');
    setEditando(true);
  }

  async function salvar(e) {
    e.preventDefault();
    const tituloLimpo = titulo.trim();
    if (!tituloLimpo) {
      setErro('Escreva o título da meta.');
      return;
    }
    let valorAlvo = null; // vazio = meta sem valor (checklist comum)
    if (valor.trim() !== '') {
      valorAlvo = Number(valor);
      if (Number.isNaN(valorAlvo) || valorAlvo <= 0) {
        setErro('O valor deve ser maior que zero (ou deixe em branco).');
        return;
      }
    }
    setErro('');
    setSalvando(true);
    try {
      await onSalvarEdicao(meta, { titulo: tituloLimpo, valorAlvo });
      setEditando(false);
    } catch (err) {
      setErro(err.response?.data?.message || err.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  // ---------- Modo edição ----------
  if (editando) {
    return (
      <li className="rounded border border-accent bg-surface p-3">
        <form onSubmit={salvar} className="space-y-3">
          <label className="block text-xs uppercase tracking-wide text-muted">
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} className={`${CAMPO} mt-1 normal-case`} />
          </label>
          <label className="block text-xs uppercase tracking-wide text-muted">
            Valor (R$) — opcional
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex.: 5000"
              className={`${CAMPO} num mt-1 normal-case`}
            />
          </label>
          {erro && (
            <p role="alert" className="text-sm text-negative">
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <button disabled={salvando} className="min-h-[44px] flex-1 rounded bg-accent px-3 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setEditando(false)} className="min-h-[44px] flex-1 rounded border border-border px-3 text-sm text-muted hover:text-fg">
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  // ---------- Modo normal ----------
  return (
    <li className="rounded border border-border bg-surface pr-1">
      <div className="flex items-center gap-1">
        {/* Área de toque principal: caixa + título. */}
        <label className="flex min-h-[56px] min-w-0 flex-1 cursor-pointer items-center gap-3 pl-3">
          <input type="checkbox" checked={meta.concluida} onChange={() => onAlternar(meta)} className="peer sr-only" />

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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-bg">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>

          <span className={['min-w-0 flex-1 break-words py-2 text-base', meta.concluida ? 'text-muted line-through' : 'text-fg'].join(' ')}>
            {meta.titulo}
          </span>
        </label>

        <button type="button" onClick={iniciarEdicao} aria-label={`Editar meta: ${meta.titulo}`} className={`${BOTAO_ICONE} hover:text-accent`}>
          <IconeLapis />
        </button>
        <button type="button" onClick={() => onExcluir(meta)} aria-label={`Excluir meta: ${meta.titulo}`} className={`${BOTAO_ICONE} hover:text-negative`}>
          <IconeLixeira />
        </button>
      </div>

      {/* Meta com valor: barra de progresso + "R$ X de R$ Y" + porcentagem. */}
      {temValor && (
        <div className="pb-3 pl-3 pr-2">
          <div
            role="progressbar"
            aria-label={`Progresso da meta ${meta.titulo}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentagem}
            className="h-2 w-full overflow-hidden rounded-full bg-border"
          >
            <div className="h-full rounded-full bg-positive transition-[width] duration-500" style={{ width: `${fracao * 100}%` }} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3 text-sm text-muted">
            <span>
              <Money value={Math.max(0, Math.min(total, meta.valorAlvo))} className="text-fg" /> de{' '}
              <Money value={meta.valorAlvo} />
            </span>
            <span className="num text-fg">{porcentagem}%</span>
          </div>
        </div>
      )}
    </li>
  );
}
