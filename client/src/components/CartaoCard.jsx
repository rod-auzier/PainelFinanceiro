/**
 * CartaoCard — card "Cartão de crédito" no topo da tela de Despesas.
 *
 * Ideia: o usuário lança uma a uma as despesas pagas no cartão que quiser detalhar (marcando
 * "Pago no cartão de crédito") e informa aqui só o TOTAL DA FATURA do mês. O servidor calcula a
 * parte da fatura que não foi detalhada ("Outras compras no cartão") e a soma ao total de despesas
 * — nada conta duas vezes (regra em server/src/services/cartao.js).
 *
 * Mostra:
 *  - "Detalhado nas despesas: R$ X" (soma das despesas marcadas como cartão no mês);
 *  - campo "Fatura total do mês (R$)" + Salvar (PUT /api/faturas/:mes) e "Remover" (DELETE);
 *  - "Outras compras no cartão (não detalhadas): R$ Y" em destaque, dizendo que entrou no total;
 *  - aviso discreto quando o detalhado passa da fatura (vale o detalhado);
 *  - caixa "Fatura paga" (PATCH /api/faturas/:mes/paga) — marca/desmarca também as despesas de cartão;
 *  - estado vazio: "Informe o total da fatura para contar também as compras que você não lançou".
 *
 * Props:
 *  - mes       {string}  "AAAA-MM" selecionado na tela.
 *  - cartao    {object|null}  situação do cartão no mês (GET /api/despesas?mes → `cartao`):
 *              `{ fatura: { valor, paga } | null, detalhado, naoDetalhado, excedeu }`.
 *  - aoAlterar {() => Promise<void>}  chamado depois de salvar/remover/marcar, para a tela recarregar
 *              as despesas (a linha virtual, o total e o status "paga" das despesas mudam).
 *
 * Tema Grafite: card sólido; no celular tudo em uma coluna; botões e caixa com ≥ 44px.
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import CaixaCheck from './CaixaCheck.jsx';
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

export default function CartaoCard({ mes, cartao, aoAlterar }) {
  const fatura = cartao?.fatura ?? null;
  const [campo, setCampo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  // O campo mostra o valor salvo da fatura (e é reiniciado ao trocar de mês ou após salvar).
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
    executar(() => api.put(`/faturas/${mes}`, { valor }), 'Não foi possível salvar a fatura.');
  }

  const detalhado = cartao?.detalhado ?? 0;

  return (
    <section className="space-y-3 rounded border border-border bg-surface p-4" aria-label="Cartão de crédito">
      <div className="flex items-center gap-2">
        <span className="text-accent">
          <IconeCartao size={18} />
        </span>
        <h2 className="text-sm font-medium">Cartão de crédito</h2>
      </div>

      <p className="flex items-baseline justify-between gap-3 text-sm text-muted">
        <span>Detalhado nas despesas</span>
        <Money value={detalhado} className="text-fg" />
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
              onClick={() => executar(() => api.delete(`/faturas/${mes}`), 'Não foi possível remover a fatura.')}
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
              <span>Outras compras no cartão (não detalhadas)</span>
              <Money value={cartao.naoDetalhado} className="font-semibold text-accent" />
            </p>
            <p className="mt-1 text-xs text-muted">
              {cartao.naoDetalhado > 0
                ? 'Somado ao total de despesas do mês como a linha "Outras compras no cartão".'
                : 'Tudo o que está na fatura já foi lançado nas despesas — nada a somar.'}
            </p>
          </div>

          {/* Aviso discreto: despesas de cartão passam do total da fatura (vale o detalhado). */}
          {cartao.excedeu && (
            <p role="status" className="text-xs text-accent">
              Suas despesas de cartão passam do total da fatura informado — o total usa as despesas lançadas.
            </p>
          )}

          {/* Fatura paga: marca também as despesas de cartão do mês (desmarcar desfaz só o que ela marcou). */}
          <div className="flex items-center gap-1">
            <CaixaCheck
              marcada={Boolean(fatura.paga)}
              onChange={(paga) =>
                !ocupado && executar(() => api.patch(`/faturas/${mes}/paga`, { paga }), 'Não foi possível atualizar a fatura.')
              }
              rotulo={fatura.paga ? 'Desmarcar fatura como paga' : 'Marcar fatura como paga'}
            />
            <span className="text-sm">Fatura paga</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">
          Informe o total da fatura para contar também as compras que você não lançou.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      )}
    </section>
  );
}
