/**
 * CartaoCard — card de UM cartão de crédito na seção "Cartões de crédito" da tela de Despesas.
 *
 * Ideia: o usuário lança as despesas daquele cartão que quiser detalhar (campo "Cartão") e informa
 * aqui só o TOTAL DA FATURA do mês. O servidor calcula a parte da fatura que não foi detalhada
 * ("Outras compras no cartão") e a soma ao total de despesas — nada conta duas vezes (regra em
 * server/src/services/cartao.js).
 *
 * Mostra: bolinha de cor + nome, botões editar/excluir do CARTÃO, "Detalhado nas despesas: R$ X",
 * campo "Fatura total do mês (R$)" + Salvar (PUT /api/faturas/:mes/:cartaoId) e Remover (DELETE),
 * "Outras compras no cartão: R$ Y" em destaque, aviso se o detalhado passa da fatura e a caixa
 * "Fatura paga" (PATCH …/paga — marca/desmarca também as despesas DESTE cartão no mês).
 *
 * Props:
 *  - mes       {string}  "AAAA-MM".
 *  - situacao  {{ cartao: { _id, nome, cor }, fatura: { valor, paga } | null, detalhado, naoDetalhado,
 *                excedeu }}  um item de `cartoes` de GET /api/despesas?mes.
 *  - aoAlterar {() => Promise<void>}  depois de salvar/remover/marcar: a tela recarrega as despesas.
 *  - onEditar  {() => void} / onExcluir {() => void}  ações sobre o cartão (a seção cuida delas).
 *
 * Tema Grafite: card sólido; botões e caixa com ≥ 44px.
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import CaixaCheck from './CaixaCheck.jsx';
import CategoriaPonto from './CategoriaPonto.jsx';
import Money from './Money.jsx';

const INPUT =
  'min-h-[44px] w-full rounded border border-border bg-bg px-3 py-2 text-base text-fg num ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

/** Ícone de cartão de crédito (linha), herdando a cor do texto. */
export function IconeCartao({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6 15h4" />
    </svg>
  );
}

/** Ícones pequenos de editar/excluir. */
const IconeLapis = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconeLixeira = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </svg>
);

export default function CartaoCard({ mes, situacao, aoAlterar, onEditar, onExcluir }) {
  const { cartao, fatura } = situacao;
  const [campo, setCampo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  // O campo mostra o valor salvo da fatura (reiniciado ao trocar de mês ou depois de salvar).
  useEffect(() => {
    setCampo(fatura ? String(fatura.valor) : '');
    setErro('');
  }, [mes, fatura?.valor]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Executa uma ação da API e recarrega a tela; mostra o erro no card se falhar. */
  async function executar(acao, mensagemPadrao) {
    setErro('');
    setOcupado(true);
    try {
      await acao();
      await aoAlterar();
    } catch (err) {
      setErro(err.response?.data?.message || mensagemPadrao);
    } finally {
      setOcupado(false);
    }
  }

  function salvar(e) {
    e.preventDefault();
    const valor = Number(String(campo).replace(',', '.'));
    if (campo.trim() === '' || !Number.isFinite(valor) || valor < 0) {
      setErro('Informe o total da fatura (um valor maior ou igual a zero).');
      return;
    }
    executar(() => api.put(`/faturas/${mes}/${cartao._id}`, { valor }), 'Não foi possível salvar a fatura.');
  }

  return (
    <section className="space-y-3 rounded border border-border bg-surface p-4" aria-label={`Cartão ${cartao.nome}`}>
      {/* Cabeçalho: cor + nome + editar/excluir o cartão. */}
      <div className="flex items-center gap-2">
        <CategoriaPonto cor={cartao.cor} grande />
        <h3 className="min-w-0 flex-1 break-words text-sm font-medium">{cartao.nome}</h3>
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar cartão ${cartao.nome}`}
          className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-accent"
        >
          <IconeLapis />
        </button>
        <button
          type="button"
          onClick={onExcluir}
          aria-label={`Excluir cartão ${cartao.nome}`}
          className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-negative"
        >
          <IconeLixeira />
        </button>
      </div>

      <p className="flex items-baseline justify-between gap-3 text-sm text-muted">
        <span>Detalhado nas despesas</span>
        <Money value={situacao.detalhado} className="text-fg" />
      </p>

      {/* Total da fatura: <form> para o Enter também salvar. */}
      <form onSubmit={salvar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm text-muted">
          Fatura total do mês (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={campo}
            onChange={(e) => setCampo(e.target.value)}
            placeholder="Ex.: 500"
            className={`${INPUT} mt-1`}
          />
        </label>
        <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          <button
            disabled={ocupado}
            className="min-h-[44px] rounded bg-accent px-5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60"
          >
            Salvar
          </button>
          {fatura && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(() => api.delete(`/faturas/${mes}/${cartao._id}`), 'Não foi possível remover a fatura.')}
              className="min-h-[44px] rounded border border-border px-4 text-sm text-muted hover:text-fg disabled:opacity-60"
            >
              Remover
            </button>
          )}
        </div>
      </form>

      {fatura ? (
        <>
          {/* Destaque: a parte da fatura que não foi lançada e que ENTROU no total de despesas. */}
          <div className="rounded border border-border bg-bg p-3">
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span>Outras compras no cartão</span>
              <Money value={situacao.naoDetalhado} className="font-semibold text-accent" />
            </p>
            <p className="mt-1 text-xs text-muted">
              {situacao.naoDetalhado > 0
                ? 'Somado ao total de despesas do mês como uma linha calculada.'
                : 'Tudo o que está na fatura já foi lançado nas despesas — nada a somar.'}
            </p>
          </div>

          {/* Aviso discreto: as despesas deste cartão passam do total da fatura (vale o detalhado). */}
          {situacao.excedeu && (
            <p role="status" className="text-xs text-accent">
              Suas despesas deste cartão passam do total da fatura informado — o total usa as despesas lançadas.
            </p>
          )}

          {/* Fatura paga: marca também as despesas deste cartão no mês (desmarcar desfaz só o que ela marcou). */}
          <div className="flex items-center gap-1">
            <CaixaCheck
              marcada={Boolean(fatura.paga)}
              onChange={(paga) =>
                !ocupado &&
                executar(() => api.patch(`/faturas/${mes}/${cartao._id}/paga`, { paga }), 'Não foi possível atualizar a fatura.')
              }
              rotulo={fatura.paga ? `Desmarcar fatura do ${cartao.nome} como paga` : `Marcar fatura do ${cartao.nome} como paga`}
            />
            <span className="text-sm">Fatura paga</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Informe o total da fatura para contar também as compras que você não lançou.</p>
      )}

      {erro && (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      )}
    </section>
  );
}
