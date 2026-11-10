/**
 * ListaReceitas — o CARD da lista de receitas da tela de Receitas (mesmo visual da lista de Despesas,
 * com as peças compartilhadas de PaginaLancamentos.jsx: <CardLista>, CLASSE_LINHA, <AcoesLinha>).
 *
 * Cada linha tem 2 áreas: [bloco do nome] [valor] (+ editar/excluir, que só aparecem no hover):
 *   linha 1: a FONTE (ex.: Salário) + "↻" dourado quando é "Repete todo mês";
 *   linha 2: a DESCRIÇÃO, pequena e cinza (sem descrição, não mostra nada);
 *   valor em verde, mono, numa coluna estreita (~130px, 24px de folga à direita) perto do nome.
 * Sem linha de cabeçalhos de coluna. Rodapé: "Total" + valor grande em verde. Mesma ordem da API.
 *
 * Editar troca a linha pelos campos Fonte | Descrição | Valor | Repete todo mês (mesma validação e
 * chamada de antes — `aoSalvarEdicao` lança Error com a mensagem). Excluir chama `onExcluir` (a página
 * decide: comum sai na hora; fixa pergunta "só este mês / meses seguintes").
 *
 * Props: itens · total · carregando · erro · onExcluir(id) · aoSalvarEdicao(id, rascunho)
 */
import { useState } from 'react';
import Money from './Money.jsx';
import { AcoesLinha, CAMPO_EDICAO, CardLista, CLASSE_EDICAO, CLASSE_LINHA } from './PaginaLancamentos.jsx';

/** Edição de UMA receita no lugar da linha. */
function EdicaoReceita({ receita, aoSalvar, aoCancelar }) {
  const [rascunho, setRascunho] = useState({
    fonte: receita.fonte ?? '',
    descricao: receita.descricao ?? '',
    valor: String(receita.valor ?? ''),
    recorrente: Boolean(receita.recorrente),
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (campo, valor) => setRascunho((r) => ({ ...r, [campo]: valor }));

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar(receita._id, rascunho); // valida e chama a API (lança Error se falhar)
      aoCancelar();
    } catch (err) {
      setErro(err.response?.data?.message || err.message || 'Não foi possível salvar.');
      setSalvando(false);
    }
  }

  return (
    <li className={CLASSE_EDICAO} onKeyDown={(e) => e.key === 'Escape' && aoCancelar()}>
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Fonte" value={rascunho.fonte} onChange={(e) => mudar('fonte', e.target.value)} className={CAMPO_EDICAO} />
        <input
          aria-label="Valor"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={rascunho.valor}
          onChange={(e) => mudar('valor', e.target.value)}
          className={`${CAMPO_EDICAO} num`}
        />
        <input
          aria-label="Descrição"
          placeholder="Descrição (opcional)"
          value={rascunho.descricao}
          onChange={(e) => mudar('descricao', e.target.value)}
          className={CAMPO_EDICAO}
        />
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={rascunho.recorrente} onChange={(e) => mudar('recorrente', e.target.checked)} className="h-5 w-5 accent-accent" />
          Repete todo mês
        </label>
      </div>
      {erro && <p className="text-sm text-negative">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="min-h-[44px] rounded bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={aoCancelar} className="min-h-[44px] rounded border border-border px-4 text-sm text-muted hover:text-fg">
          Cancelar
        </button>
      </div>
    </li>
  );
}

export default function ListaReceitas({ itens, total, carregando, erro, onExcluir, aoSalvarEdicao }) {
  const [editandoId, setEditandoId] = useState(null);

  return (
    <CardLista rotulo="Lista de receitas" total={total} tom="positive">
      {carregando ? (
        <p className="p-4 text-sm text-muted">Carregando…</p>
      ) : erro ? (
        <p className="p-4 text-sm text-negative">{erro}</p>
      ) : itens.length === 0 ? (
        <p className="p-4 text-sm text-muted">Nenhuma receita neste mês.</p>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((r) =>
            editandoId === r._id ? (
              <EdicaoReceita key={r._id} receita={r} aoSalvar={aoSalvarEdicao} aoCancelar={() => setEditandoId(null)} />
            ) : (
              <li
                key={r._id}
                // Colunas: nome (flexível) | valor (~130px, perto do nome) | ações (hover).
                className={`${CLASSE_LINHA} grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_130px_auto]`}
              >
                {/* Área 1: fonte (+ ↻ se fixa) e, embaixo, a descrição — só se houver. */}
                <div className="min-w-0 py-1.5 pl-1">
                  <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
                    <span className="break-words">{r.fonte}</span>
                    {r.recorrente && (
                      <span className="text-xs text-accent" title="Repete todo mês" aria-label="Repete todo mês">
                        ↻
                      </span>
                    )}
                  </p>
                  {r.descricao?.trim() && <p className="mt-0.5 break-words text-xs text-muted">{r.descricao}</p>}
                </div>

                {/* Área 2: valor (verde, mono, à direita, 24px de folga antes das ações). */}
                <Money value={r.valor} tone="positive" className="text-right text-sm sm:pr-6" />

                <AcoesLinha nome={r.fonte} onEditar={() => setEditandoId(r._id)} onExcluir={() => onExcluir(r._id)} />
              </li>
            ),
          )}
        </ul>
      )}
    </CardLista>
  );
}
