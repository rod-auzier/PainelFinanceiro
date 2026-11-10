/**
 * CartaoCard — bloco de UM cartão de crédito dentro do card "Cartões de crédito" do PAINEL LATERAL da
 * tela de Despesas (fundo um pouco mais escuro que o card, borda fina).
 *
 * Ideia: o usuário lança as despesas daquele cartão que quiser detalhar e informa aqui só o TOTAL DA
 * FATURA do mês. O servidor calcula a parte não detalhada ("Outras compras no cartão") e a soma ao
 * total de despesas — nada conta duas vezes (regra em server/src/services/cartao.js; nada muda aqui).
 *
 * Conteúdo, de cima para baixo:
 *  - bolinha + nome do cartão, com editar/excluir o CARTÃO à direita;
 *  - "Detalhado nas despesas" ............ valor (mono, à direita, com espaço entre texto e valor);
 *  - label "Fatura total do mês" + input (mostra o valor já salvo) + botão dourado "Salvar";
 *  - sem fatura: ajuda "Informe o total da fatura para contar também as compras que você não lançou.";
 *  - botão "Marcar fatura como paga" (borda fina, texto dourado): marca como PAGAS, de uma vez, todas as
 *    despesas deste cartão no mês (e a fatura, se informada — a linha calculada conta como paga junto).
 *    Com tudo já pago vira "Desmarcar fatura"; sem despesas do cartão no mês fica desabilitado. Ao lado do
 *    nome aparece o selo verde "paga" quando todas as despesas do cartão no mês estão pagas;
 *  - com fatura: "Outras compras no cartão" (o que entrou no total), aviso se o detalhado passa da
 *    fatura e o link "Remover fatura".
 *
 * Props:
 *  - mes       {string}  "AAAA-MM".
 *  - situacao  {{ cartao: { _id, nome, cor }, fatura: { valor, paga } | null, detalhado, naoDetalhado, excedeu }}
 *  - aoAlterar {() => Promise<void>}  depois de salvar/remover/marcar: a tela recarrega as despesas.
 *  - onEditar / onExcluir {() => void}  ações sobre o cartão (a seção cuida delas).
 *  - pagamento {{ total, pagas }}  despesas deste cartão no mês e quantas já estão pagas.
 *  - onPagarFatura {(paga: boolean) => void}  pagar/despagar em lote (a página chama a API e mostra o
 *              aviso com "Desfazer").
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import CategoriaPonto from './CategoriaPonto.jsx';
import Money from './Money.jsx';

const INPUT =
  'min-h-[40px] w-full min-w-0 rounded border border-border bg-surface px-2.5 py-1.5 text-base text-fg num ' +
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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconeLixeira = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </svg>
);

export default function CartaoCard({ mes, situacao, aoAlterar, onEditar, onExcluir, pagamento = { total: 0, pagas: 0 }, onPagarFatura }) {
  // Todas as despesas do cartão no mês já pagas? (sem despesas, não conta como paga)
  const tudoPago = pagamento.total > 0 && pagamento.pagas === pagamento.total;
  const { cartao, fatura } = situacao;
  const [campo, setCampo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  // O campo mostra o valor SALVO da fatura (reiniciado ao trocar de mês ou depois de salvar).
  useEffect(() => {
    setCampo(fatura ? String(fatura.valor) : '');
    setErro('');
  }, [mes, fatura?.valor]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Executa uma ação da API e recarrega a tela; mostra o erro no bloco se falhar. */
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
    <div className="space-y-2.5 rounded border border-border bg-bg p-3" aria-label={`Cartão ${cartao.nome}`}>
      {/* Nome + editar/excluir o cartão. */}
      <div className="flex items-center gap-2">
        <CategoriaPonto cor={cartao.cor} grande />
        <h3 className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 break-words text-sm font-medium">
          {cartao.nome}
          {/* Selo discreto: todas as despesas deste cartão no mês estão pagas. */}
          {tudoPago && (
            <span className="rounded-full border border-[color-mix(in_srgb,var(--color-positive)_45%,transparent)] px-1.5 py-0.5 text-[10px] font-normal leading-none text-positive">
              paga
            </span>
          )}
        </h3>
        <button type="button" onClick={onEditar} aria-label={`Editar cartão ${cartao.nome}`} className="flex h-8 w-8 items-center justify-center rounded text-muted hover:text-accent">
          <IconeLapis />
        </button>
        <button type="button" onClick={onExcluir} aria-label={`Excluir cartão ${cartao.nome}`} className="flex h-8 w-8 items-center justify-center rounded text-muted hover:text-negative">
          <IconeLixeira />
        </button>
      </div>

      {/* Detalhado: texto à esquerda, valor à direita (gap garante o espaço entre os dois). */}
      <p className="flex items-baseline justify-between gap-4 text-xs text-muted">
        <span className="whitespace-nowrap">Detalhado nas despesas</span>
        <Money value={situacao.detalhado} className="text-sm text-fg" />
      </p>

      {/* Total da fatura: <form> para o Enter também salvar. */}
      <form onSubmit={salvar}>
        <label className="block text-xs text-muted">
          Fatura total do mês
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
              placeholder="R$ 0,00"
              className={INPUT}
            />
            <button disabled={ocupado} className="min-h-[40px] shrink-0 rounded bg-accent px-3 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60">
              Salvar
            </button>
          </div>
        </label>
      </form>

      {/* Pagar a fatura em lote: todas as despesas deste cartão no mês (uma chamada só). */}
      <button
        type="button"
        disabled={pagamento.total === 0}
        onClick={() => onPagarFatura?.(!tudoPago)}
        title={pagamento.total === 0 ? 'Nenhuma despesa deste cartão neste mês' : undefined}
        className="min-h-[40px] w-full rounded border border-border px-3 text-sm text-accent hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-border"
      >
        {tudoPago ? 'Desmarcar fatura' : 'Marcar fatura como paga'}
      </button>

      {fatura ? (
        <>
          {/* O que ENTROU no total de despesas como linha calculada. */}
          <p className="flex items-baseline justify-between gap-4 text-xs">
            <span className="whitespace-nowrap text-muted">Outras compras no cartão</span>
            <Money value={situacao.naoDetalhado} className="text-sm font-semibold text-accent" />
          </p>
          {situacao.excedeu && (
            <p role="status" className="text-xs text-accent">
              As despesas deste cartão passam do total da fatura informado — vale o que foi lançado.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(() => api.delete(`/faturas/${mes}/${cartao._id}`), 'Não foi possível remover a fatura.')}
              className="min-h-[36px] text-xs text-muted hover:text-fg disabled:opacity-60"
            >
              Remover fatura
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">Informe o total da fatura para contar também as compras que você não lançou.</p>
      )}

      {erro && (
        <p role="alert" className="text-xs text-negative">
          {erro}
        </p>
      )}
    </div>
  );
}
