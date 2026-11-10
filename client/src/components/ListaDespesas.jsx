/**
 * ListaDespesas — o CARD da lista de despesas da tela de Despesas (layout enxuto).
 *
 * ESTRUTURA DO CARD
 *  1) Barra do topo: filtros por cartão à esquerda (chip "Todas" + um chip por cartão, com a bolinha
 *     de cor); à direita "N de M pagas", o botão pequeno "Marcar todas como pagas" (com confirmação
 *     na própria barra) e o link discreto "Gerenciar categorias".
 *  2) Linhas com só 3 áreas: [caixa Paga] [bloco do nome] [valor] — mais os botões editar/excluir,
 *     que ficam escondidos e só aparecem ao passar o mouse na linha (em telas SEM hover — celular —
 *     aparecem sempre). O bloco do nome tem:
 *       linha 1: descrição + "↻" dourado (Repete todo mês) + pílula do cartão (bolinha + nome);
 *       linha 2: bolinha da cor da categoria + nome da categoria (pequeno, cinza).
 *     Despesa paga: nome, categoria e valor com opacidade ~50% (destaca o que falta pagar).
 *     Linha CALCULADA "Outras compras no cartão (nome)": selo "calculada", sem caixa e sem ações.
 *  3) Rodapé: só "Total" + o valor grande em vermelho, à direita.
 *
 * Editar troca a linha por campos (descrição, categoria, cartão, valor, Repete todo mês) — mesma
 * validação e mesma chamada de antes (`aoSalvarEdicao`, que lança Error com a mensagem). Excluir chama
 * `onExcluir` (a página decide: comum sai na hora; fixo abre a pergunta "só este mês / seguintes").
 * Nenhuma regra de negócio mora aqui: totais, filtros e chamadas à API vêm da página.
 *
 * Props:
 *  - itens         {Array}  linhas a mostrar (despesas + linhas calculadas), já filtradas.
 *  - total         {number} soma das linhas mostradas.
 *  - carregando / erro
 *  - filtro        {{ cartoes, valor, onChange }}  chips por cartão ('' = Todas).
 *  - pagas         {{ qtdPagas, qtdTotal, qtdPendentes, confirmando, setConfirmando, onMarcarTodas, erro }}
 *  - cartaoDe      {(despesa) => cartao | null}   cartão de exibição de uma linha.
 *  - resolverCategoria {(nome) => { nome, cor }}
 *  - onAlternarPaga {(despesa) => void} · onExcluir {(id) => void} · aoSalvarEdicao {(id, rascunho) => Promise}
 *  - cartoesApi    {{ cartoes, limite, criar }}  para o seletor de cartão da edição.
 *  - onGerenciarCategorias {() => void}
 */
import { useState } from 'react';
import CaixaCheck from './CaixaCheck.jsx';
import CategoriaPonto from './CategoriaPonto.jsx';
import Money from './Money.jsx';
import SeletorCartao from './SeletorCartao.jsx';
import SeletorCategoria from './SeletorCategoria.jsx';
import { IconeCartao } from './CartaoCard.jsx';
// Peças de layout compartilhadas com a lista de Receitas (card, linha, ações, estilos de edição).
import { AcoesLinha, CAMPO_EDICAO as CAMPO, CardLista, CLASSE_EDICAO, CLASSE_LINHA } from './PaginaLancamentos.jsx';

/** Pílula pequena (cartão, "calculada"). */
function Pilula({ children }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] leading-none text-muted">
      {children}
    </span>
  );
}

/** Edição de UMA despesa no lugar da linha (mesmos campos do formulário de criação). */
function EdicaoDespesa({ despesa, cartaoInicial, cartoesApi, aoSalvar, aoCancelar }) {
  const [rascunho, setRascunho] = useState({
    descricao: despesa.descricao ?? '',
    categoria: despesa.categoriaExibida,
    cartao: cartaoInicial,
    valor: String(despesa.valor ?? ''),
    recorrente: Boolean(despesa.recorrente),
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (campo, valor) => setRascunho((r) => ({ ...r, [campo]: valor }));

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar(despesa._id, rascunho); // valida e chama a API (lança Error se falhar)
      aoCancelar();
    } catch (err) {
      setErro(err.response?.data?.message || err.message || 'Não foi possível salvar.');
      setSalvando(false);
    }
  }

  return (
    <li className={CLASSE_EDICAO} onKeyDown={(e) => e.key === 'Escape' && aoCancelar()}>
      <input aria-label="Descrição" value={rascunho.descricao} onChange={(e) => mudar('descricao', e.target.value)} className={CAMPO} />
      <div className="grid gap-2 sm:grid-cols-2">
        <SeletorCategoria valor={rascunho.categoria} onChange={(v) => mudar('categoria', v)} className="bg-bg" />
        <SeletorCartao
          valor={rascunho.cartao}
          onChange={(v) => mudar('cartao', v)}
          cartoes={cartoesApi.cartoes}
          limite={cartoesApi.limite}
          criar={cartoesApi.criar}
          className="bg-bg"
        />
        <input
          aria-label="Valor"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={rascunho.valor}
          onChange={(e) => mudar('valor', e.target.value)}
          className={`${CAMPO} num`}
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

export default function ListaDespesas({
  itens,
  total,
  carregando,
  erro,
  filtro,
  pagas,
  cartaoDe,
  resolverCategoria,
  onAlternarPaga,
  onExcluir,
  aoSalvarEdicao,
  cartoesApi,
  onGerenciarCategorias,
}) {
  const [editandoId, setEditandoId] = useState(null);

  return (
    <CardLista
      rotulo="Lista de despesas"
      total={total}
      tom="negative"
      // ---------- 1) Barra do topo: filtros | pagas + marcar todas + gerenciar categorias ----------
      barra={
        <>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Filtros por cartão (só quando há cartões). */}
          {filtro.cartoes.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar despesas por cartão">
              {[{ _id: '', nome: 'Todas' }, ...filtro.cartoes].map((c) => {
                const ativo = filtro.valor === String(c._id);
                return (
                  <button
                    key={c._id || 'todas'}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => filtro.onChange(String(c._id))}
                    className={[
                      'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs',
                      ativo ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg',
                    ].join(' ')}
                  >
                    {c._id ? <CategoriaPonto cor={c.cor} /> : <IconeCartao size={12} />}
                    {c.nome}
                  </button>
                );
              })}
            </div>
          )}

          {/* À direita: andamento dos pagamentos e ações. */}
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
            {pagas.qtdTotal > 0 && (
              <p className="text-xs text-muted">
                <span className="num font-semibold text-fg">{pagas.qtdPagas}</span> de{' '}
                <span className="num font-semibold text-fg">{pagas.qtdTotal}</span> pagas
              </p>
            )}
            {pagas.qtdPendentes > 0 && !pagas.confirmando && (
              <button
                type="button"
                onClick={() => pagas.setConfirmando(true)}
                className="min-h-[36px] rounded border border-border px-2.5 text-xs text-fg hover:border-accent hover:text-accent"
              >
                Marcar todas como pagas
              </button>
            )}
            <button type="button" onClick={onGerenciarCategorias} className="min-h-[36px] text-xs text-muted underline-offset-2 hover:text-accent hover:underline">
              Gerenciar categorias
            </button>
          </div>
        </div>

        {/* Confirmação do "Marcar todas como pagas" (mesma função de antes). */}
        {pagas.confirmando && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded border border-border bg-bg p-2 text-sm">
            <span className="flex-1 basis-full sm:basis-auto">
              Marcar as {pagas.qtdPendentes} {pagas.qtdPendentes === 1 ? 'despesa pendente' : 'despesas pendentes'} deste mês como pagas?
            </span>
            <button type="button" onClick={pagas.onMarcarTodas} className="min-h-[40px] rounded bg-accent px-3 text-sm font-medium text-bg hover:opacity-90">
              Confirmar
            </button>
            <button type="button" onClick={() => pagas.setConfirmando(false)} className="min-h-[40px] rounded border border-border px-3 text-sm text-muted hover:text-fg">
              Cancelar
            </button>
          </div>
        )}
        {pagas.erro && <p role="alert" className="text-sm text-negative">{pagas.erro}</p>}
        </>
      }
    >
      {/* ---------- 2) Linhas ---------- */}
      {carregando ? (
        <p className="p-4 text-sm text-muted">Carregando…</p>
      ) : erro ? (
        <p className="p-4 text-sm text-negative">{erro}</p>
      ) : itens.length === 0 ? (
        <p className="p-4 text-sm text-muted">{filtro.valor ? 'Nenhuma despesa neste cartão neste mês.' : 'Nenhuma despesa neste mês.'}</p>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((d) => {
            const cartao = cartaoDe(d);
            const categoria = resolverCategoria(d.categoria); // sem correspondência → "Outros"

            if (editandoId === d._id) {
              return (
                <EdicaoDespesa
                  key={d._id}
                  despesa={{ ...d, categoriaExibida: categoria.nome }}
                  cartaoInicial={cartao?._id ? String(cartao._id) : ''}
                  cartoesApi={cartoesApi}
                  aoSalvar={aoSalvarEdicao}
                  aoCancelar={() => setEditandoId(null)}
                />
              );
            }

            const apagada = d.paga ? 'opacity-50' : ''; // paga: destaca o que falta pagar
            return (
              <li
                key={d._id}
                // Colunas: caixa | nome (flexível) | valor (estreita, ~130px, perto do nome) | ações.
                // O hover clareia a LINHA INTEIRA (o <li> ocupa toda a largura), ajudando a seguir nome → valor.
                className={`${CLASSE_LINHA} grid-cols-[44px_minmax(0,1fr)_auto_auto] sm:grid-cols-[44px_minmax(0,1fr)_130px_auto]`}
              >
                {/* Área 1: caixa "Paga" (a linha calculada não tem — o pago dela vem da fatura). */}
                <div>
                  {!d.virtual && (
                    <CaixaCheck
                      marcada={Boolean(d.paga)}
                      onChange={() => onAlternarPaga(d)}
                      rotulo={d.paga ? `Desmarcar ${d.descricao} como paga` : `Marcar ${d.descricao} como paga`}
                    />
                  )}
                </div>

                {/* Área 2: bloco do nome (linha 1: descrição + ↻ + cartão; linha 2: categoria). */}
                <div className={`min-w-0 py-1 ${apagada}`}>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                    <span className="break-words">{d.descricao}</span>
                    {d.recorrente && (
                      <span className="text-xs text-accent" title="Repete todo mês" aria-label="Repete todo mês">
                        ↻
                      </span>
                    )}
                    {d.virtual && <Pilula>calculada</Pilula>}
                    {cartao && (
                      <Pilula>
                        <CategoriaPonto cor={cartao.cor} />
                        {cartao.nome}
                      </Pilula>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <CategoriaPonto cor={categoria.cor} />
                    {categoria.nome}
                  </p>
                </div>

                {/* Área 3: valor (vermelho, mono, à direita). */}
                {/* `sm:pr-6` (24px): o valor não fica colado nos botões de ação. */}
                <Money value={d.valor} tone="negative" className={`text-right text-sm sm:pr-6 ${apagada}`} />

                {/* Ações (editar/excluir): aparecem no hover; a linha calculada não tem (espaço mantido). */}
                <AcoesLinha
                  nome={d.descricao}
                  oculto={d.virtual}
                  onEditar={() => setEditandoId(d._id)}
                  onExcluir={() => onExcluir(d._id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* 3) Rodapé (só o Total) — montado pelo <CardLista>. */}
    </CardLista>
  );
}
