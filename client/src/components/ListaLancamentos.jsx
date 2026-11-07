/**
 * ListaLancamentos — coleção de lançamentos (receitas ou despesas), RESPONSIVA
 * e com EDIÇÃO INLINE.
 *
 * Breakpoint de virada: `md` (768px, padrão do Tailwind).
 *  - <  md (mobile) : cada lançamento vira um CARD empilhado. Um card final
 *                     mostra o Total.
 *  - >= md (desktop): TABELA — cabeçalho, linhas com divisórias hairline e
 *                     rodapé com o Total.
 *
 * Edição inline: cada linha/card tem um botão "editar" (lápis) ao lado do
 * "excluir" (✕). Ao clicar, os campos daquela linha viram inputs no lugar
 * e os botões passam a "Salvar" / "Cancelar". Só uma linha por vez.
 *
 * Props:
 *  - colunas   {Array<{
 *      chave, label,
 *      alinhar?: 'right',
 *      render?: (item) => node,     // exibição normal (ex.: <Money>)
 *      classe?: string,             // classes extras na célula (desktop)
 *      editor?: 'text' | 'number' | 'select' | 'checkbox',   // torna o campo editável
 *      opcoes?: string[],           // opções do <select> (editor 'select')
 *    }>}
 *      A ÚLTIMA coluna é tratada como a coluna de valor no rodapé de total.
 *  - itens          {Array<object>}          dados já carregados.
 *  - getId          {(item) => string}       key/id de cada item.
 *  - onExcluir      {(id) => void}            ação do botão ✕.
 *  - aoSalvarEdicao {(id, rascunho) => Promise<void>}
 *      Recebe o id e um objeto `{ [chave]: valor }` (string; booleano no 'checkbox'). Deve VALIDAR
 *      (mesma regra do formulário de criação) e chamar a API (PUT). Deve
 *      lançar `Error` com mensagem em caso de erro — a mensagem aparece
 *      inline na linha.
 *  - total          {ReactNode}               total já formatado (ex.: <Money>).
 *  - vazio          {string}                  texto quando não há itens.
 *  - carregando     {boolean} / erro {string}
 */
import { Fragment, useState } from 'react';

const CAMPO =
  'w-full min-h-[44px] rounded border border-border bg-bg px-2 py-1 text-base text-fg ' +
  'focus:border-accent focus:outline-none';

/** Renderiza o input adequado ao `col.editor`. */
function EditorCampo({ col, valor, onChange }) {
  if (col.editor === 'checkbox') {
    // Caixa de marcação (ex.: "Repete todo mês"); `valor` é booleano.
    return (
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={Boolean(valor)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
        Todo mês
      </label>
    );
  }
  if (col.editor === 'select') {
    return (
      <select className={CAMPO} value={valor} onChange={(e) => onChange(e.target.value)}>
        {(col.opcoes ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  const numero = col.editor === 'number';
  return (
    <input
      className={`${CAMPO} ${numero ? 'num md:text-right' : ''}`}
      type={numero ? 'number' : 'text'}
      inputMode={numero ? 'decimal' : undefined}
      step={numero ? '0.01' : undefined}
      min={numero ? '0' : undefined}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Ícone de lápis (editar). */
function IconeLapis() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function valorCelula(item, col) {
  if (col.render) return col.render(item);
  const v = item[col.chave];
  return v === '' || v == null ? '—' : v;
}

export default function ListaLancamentos({
  colunas,
  itens,
  getId,
  onExcluir,
  aoSalvarEdicao,
  total,
  vazio,
  carregando,
  erro,
}) {
  // Estado da edição inline (uma linha por vez).
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroEdicao, setErroEdicao] = useState('');

  function iniciarEdicao(item) {
    const inicial = {};
    for (const col of colunas) {
      if (!col.editor) continue;
      const v = item[col.chave];
      inicial[col.chave] = col.editor === 'checkbox' ? Boolean(v) : v == null ? '' : String(v);
    }
    setRascunho(inicial);
    setEditandoId(getId(item));
    setErroEdicao('');
  }

  function cancelar() {
    setEditandoId(null);
    setRascunho({});
    setErroEdicao('');
    setSalvando(false);
  }

  function mudarCampo(chave, valor) {
    setRascunho((r) => ({ ...r, [chave]: valor }));
  }

  async function salvar() {
    setSalvando(true);
    setErroEdicao('');
    try {
      await aoSalvarEdicao(editandoId, rascunho);
      cancelar();
    } catch (err) {
      setErroEdicao(
        err.response?.data?.message || err.message || 'Não foi possível salvar.',
      );
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-muted">Carregando…</p>;
  if (erro) return <p className="text-negative">{erro}</p>;

  const botoesEdicao = (
    <>
      <button
        onClick={salvar}
        disabled={salvando}
        className="min-h-[44px] rounded bg-accent px-3 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
      <button
        type="button"
        onClick={cancelar}
        className="min-h-[44px] rounded border border-border px-3 text-sm text-muted hover:text-fg"
      >
        Cancelar
      </button>
    </>
  );

  return (
    <>
      {/* ---------------- MOBILE (< md): cards empilhados ---------------- */}
      <ul className="space-y-3 md:hidden">
        {itens.length === 0 && (
          <li className="rounded border border-border bg-surface p-4 text-muted">{vazio}</li>
        )}

        {itens.map((item) => {
          const id = getId(item);
          const editando = id === editandoId;

          return (
            <li
              key={id}
              className={`rounded border bg-surface p-4 ${editando ? 'border-accent' : 'border-border'}`}
            >
              {editando ? (
                <>
                  <dl className="space-y-3">
                    {colunas
                      .filter((col) => col.editor)
                      .map((col) => (
                        <div key={col.chave}>
                          <dt className="mb-1 text-xs uppercase tracking-wide text-muted">
                            {col.label}
                          </dt>
                          <dd>
                            <EditorCampo
                              col={col}
                              valor={rascunho[col.chave] ?? ''}
                              onChange={(v) => mudarCampo(col.chave, v)}
                            />
                          </dd>
                        </div>
                      ))}
                  </dl>
                  {erroEdicao && <p className="mt-2 text-sm text-negative">{erroEdicao}</p>}
                  <div className="mt-3 flex gap-2 [&>button]:flex-1">{botoesEdicao}</div>
                </>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <dl className="min-w-0 flex-1 space-y-2">
                    {colunas.map((col) => (
                      <div key={col.chave}>
                        <dt className="text-xs uppercase tracking-wide text-muted">{col.label}</dt>
                        <dd className="mt-0.5 break-words text-base">{valorCelula(item, col)}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* Ações: editar (lápis) + excluir (✕), 44x44 cada. */}
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => iniciarEdicao(item)}
                      aria-label="Editar"
                      className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-accent"
                    >
                      <IconeLapis />
                    </button>
                    <button
                      onClick={() => onExcluir(id)}
                      aria-label="Excluir"
                      className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-negative"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}

        {/* Total (card) */}
        <li className="flex items-center justify-between rounded border border-border bg-surface px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-muted">Total</span>
          {total}
        </li>
      </ul>

      {/* ---------------- DESKTOP (>= md): tabela ---------------- */}
      <div className="hidden overflow-x-auto rounded border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              {colunas.map((col) => (
                <th
                  key={col.chave}
                  className={`p-3 font-medium ${col.alinhar === 'right' ? 'text-right' : ''}`}
                >
                  {col.label}
                </th>
              ))}
              <th className="p-3" />
            </tr>
          </thead>

          {/* Divisórias finas (hairline) entre linhas: divide-border. */}
          <tbody className="divide-y divide-border">
            {itens.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 1} className="p-4 text-muted">
                  {vazio}
                </td>
              </tr>
            )}

            {itens.map((item) => {
              const id = getId(item);
              const editando = id === editandoId;

              return (
                <Fragment key={id}>
                  <tr>
                    {colunas.map((col) => (
                      <td
                        key={col.chave}
                        className={[
                          editando ? 'p-2' : 'p-3',
                          'align-middle',
                          col.alinhar === 'right' ? 'text-right' : '',
                          editando ? '' : (col.classe ?? ''),
                        ].join(' ')}
                      >
                        {editando && col.editor ? (
                          <EditorCampo
                            col={col}
                            valor={rascunho[col.chave] ?? ''}
                            onChange={(v) => mudarCampo(col.chave, v)}
                          />
                        ) : (
                          valorCelula(item, col)
                        )}
                      </td>
                    ))}

                    <td className="whitespace-nowrap p-2 text-right">
                      {editando ? (
                        <div className="flex justify-end gap-2">{botoesEdicao}</div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => iniciarEdicao(item)}
                            aria-label="Editar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded text-muted hover:text-accent"
                          >
                            <IconeLapis />
                          </button>
                          <button
                            onClick={() => onExcluir(id)}
                            aria-label="Excluir"
                            className="inline-flex h-9 w-9 items-center justify-center rounded text-muted hover:text-negative"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {editando && erroEdicao && (
                    <tr>
                      <td
                        colSpan={colunas.length + 1}
                        className="px-3 pb-2 text-sm text-negative"
                      >
                        {erroEdicao}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-border bg-surface">
              <td className="p-3 font-medium" colSpan={Math.max(1, colunas.length - 1)}>
                Total
              </td>
              <td className="p-3 text-right">{total}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
