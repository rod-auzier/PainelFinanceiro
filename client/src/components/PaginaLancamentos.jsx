/**
 * PaginaLancamentos — peças de LAYOUT compartilhadas pelas telas de Despesas e Receitas (só
 * apresentação; nenhuma regra de negócio). As duas páginas montam a mesma estrutura:
 *
 *   <div className="container-pagina">            ← contêiner único (index.css, até 1120px, centralizado)
 *     <CabecalhoPagina />                         ← título + "Mês · situação" | [mês ▾] Hoje [+ Nova …]
 *     <FaixaFormulario />                         ← formulário recolhido; abre com "+ Nova …"
 *     <CorpoComPainel painel={…} lista={…} />     ← lista (1fr) + painel lateral (340px), gap 20px
 *       <CardLista …>                             ← card da lista: barra opcional + linhas + "Total"
 *         <li className={CLASSE_LINHA}> … <AcoesLinha /> </li>
 *
 * Exporta também os estilos de campo (`CAMPO_FAIXA`, `CAMPO_EDICAO`) e `CLASSE_EDICAO` (linha em
 * modo edição), para os formulários das duas telas ficarem idênticos.
 */
import Money from './Money.jsx';
import SeletorMes from './SeletorMes.jsx';
import { mesAtual, rotuloMes } from '../lib/mes.js';

/** Campo da faixa "+ Nova …" (16px: sem zoom no iOS; 44px de altura). */
export const CAMPO_FAIXA =
  'min-h-[44px] w-full rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

/** Campo da edição na própria linha da lista. */
export const CAMPO_EDICAO = CAMPO_FAIXA;

/** Linha em modo EDIÇÃO: barra dourada à esquerda e fundo um pouco mais escuro. */
export const CLASSE_EDICAO =
  'space-y-2 border-l-2 border-accent bg-[color-mix(in_srgb,var(--color-bg)_60%,transparent)] px-3 py-3';

/**
 * Classes comuns de uma LINHA da lista: grade, espaçamento e o HOVER que clareia a linha inteira (o
 * <li> ocupa toda a largura do card), ajudando a seguir nome → valor. `group` liga as ações ao hover.
 * As colunas (grid-cols) ficam por conta de cada lista.
 */
export const CLASSE_LINHA =
  'group grid items-center gap-x-2 px-2 py-1.5 transition-colors sm:px-3 ' +
  'hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]';

/** "Novembro de 2026 · em andamento" / "· fechado" / "· futuro" — situação do mês no subtítulo. */
export function subtituloDoMes(mes) {
  const nome = rotuloMes(mes);
  const atual = mesAtual();
  const situacao = mes < atual ? 'fechado' : mes === atual ? 'em andamento' : 'futuro';
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} · ${situacao}`;
}

/** Ícone de lápis (editar). */
export function IconeLapis() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * Cabeçalho da página: título + subtítulo "Mês · situação" à esquerda; à direita o seletor de mês
 * (botão do mês ▾ + "Hoje") e o botão dourado "+ Nova …" que abre/fecha a faixa do formulário.
 * Fica dentro do contêiner, então termina exatamente na borda direita do painel lateral.
 */
export function CabecalhoPagina({ titulo, mes, onTrocarMes, rotuloNovo, formAberto, onAlternarForm }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div>
        <h1 className="text-lg font-semibold">{titulo}</h1>
        <p className="text-xs text-muted">{subtituloDoMes(mes)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SeletorMes mes={mes} onChange={onTrocarMes} />
        <button
          type="button"
          aria-expanded={formAberto}
          onClick={onAlternarForm}
          className="min-h-[44px] rounded bg-accent px-4 text-sm font-medium text-bg hover:opacity-90"
        >
          {rotuloNovo}
        </button>
      </div>
    </header>
  );
}

/**
 * Faixa do formulário "+ Nova …": borda dourada sutil, largura do contêiner. Os campos vêm como
 * `children`; `classeGrade` define as colunas (em telas largas, uma linha só). Esc fecha.
 */
export function FaixaFormulario({ rotulo, onSubmit, onFechar, classeGrade, children }) {
  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      aria-label={rotulo}
      className={`grid gap-2 rounded border border-[color-mix(in_srgb,var(--color-accent)_50%,transparent)] bg-surface p-3 ${classeGrade}`}
    >
      {children}
    </form>
  );
}

/** Botões "Adicionar" + ✕ (fechar) do fim da faixa do formulário. */
export function BotoesFaixa({ salvando, onFechar, className = '' }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <button disabled={salvando} className="min-h-[44px] flex-1 rounded bg-accent px-5 font-medium text-bg hover:opacity-90 disabled:opacity-60">
        {salvando ? 'Salvando…' : 'Adicionar'}
      </button>
      <button type="button" onClick={onFechar} aria-label="Fechar formulário" className="min-h-[44px] rounded border border-border px-3 text-muted hover:text-fg">
        ✕
      </button>
    </div>
  );
}

/**
 * Corpo: lista (1fr) + painel lateral (340px), gap de 20px, alinhados ao topo a partir de `lg`
 * (1024px de tela). No DOM o painel vem ANTES: em telas estreitas fica em cima da lista; no `lg` o
 * `order` põe a lista à esquerda e o painel à direita.
 */
export function CorpoComPainel({ painel, lista, rotuloPainel }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <aside className="space-y-4 lg:order-2" aria-label={rotuloPainel}>
        {painel}
      </aside>
      <div className="min-w-0 lg:order-1">{lista}</div>
    </div>
  );
}

/**
 * Card da lista: barra do topo opcional, as linhas (`children`) e o rodapé só com "Total" + o valor
 * grande (`tom`: 'negative' em Despesas, 'positive' em Receitas), à direita.
 */
export function CardLista({ rotulo, barra, total, tom, children }) {
  return (
    <section className="overflow-hidden rounded border border-border bg-surface" aria-label={rotulo}>
      {barra && <div className="space-y-2 border-b border-border p-3">{barra}</div>}
      {children}
      <div className="flex items-baseline justify-end gap-3 border-t border-border bg-[color-mix(in_srgb,var(--color-fg)_4%,var(--color-surface))] px-4 py-3">
        <span className="text-sm text-muted">Total</span>
        <Money value={total} tone={tom} className="text-xl font-bold" />
      </div>
    </section>
  );
}

/**
 * Botões editar (lápis) e excluir (✕) de uma linha: escondidos até o HOVER da linha em telas com
 * mouse; sempre visíveis em telas sem hover (celular), empilhados para sobrar largura para o nome.
 * `oculto` = a linha não tem ações (ex.: linha calculada), mas mantém o espaço para alinhar.
 */
export function AcoesLinha({ nome, onEditar, onExcluir, oculto = false }) {
  return (
    <div
      className={[
        'flex flex-col sm:flex-row',
        oculto ? 'invisible' : '',
        '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${nome}`}
        className="flex h-9 w-9 items-center justify-center rounded text-muted hover:text-accent sm:h-10 sm:w-10"
      >
        <IconeLapis />
      </button>
      <button
        type="button"
        onClick={onExcluir}
        aria-label={`Excluir ${nome}`}
        className="flex h-9 w-9 items-center justify-center rounded text-muted hover:text-negative sm:h-10 sm:w-10"
      >
        ✕
      </button>
    </div>
  );
}
