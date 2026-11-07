/**
 * GuardadoCard — "Total guardado" da aba Metas + campo "Saldo inicial guardado".
 *
 * Total guardado = saldo inicial + (receitas − despesas) dos MESES FECHADOS, de outubro/2026
 * até o mês anterior ao atual. O mês em andamento NÃO entra no total: ele aparece numa linha
 * discreta à parte ("Mês em andamento (novembro/2026): R$ X, entra em 01/12/2026").
 * O saldo inicial é um único número por usuário: serve para acertar o que
 * você já tinha guardado antes de começar a usar o painel.
 *
 * Props:
 *  - guardado {{ saldoInicial, saldoAcumulado, total, emAndamento: { mes, saldo, entraEm } | null } | null}
 *      Dados vindos de GET /api/guardado (null enquanto carrega). `emAndamento` é o parcial do
 *      mês atual (ainda fora do total); o nome do mês e a data em que entra vêm dele (dinâmicos).
 *  - onSalvarSaldoInicial {(valor: number) => Promise<void>}
 *      Chamado ao salvar o saldo inicial. Deve lançar Error com mensagem se
 *      falhar (a mensagem aparece abaixo do campo).
 *
 * Responsabilidades:
 *  - exibir o total em destaque (fonte mono, verde se ≥ 0 / vermelho se < 0) e
 *    a composição (saldo inicial + resultado dos lançamentos);
 *  - editar o saldo inicial: input numérico (16px, evita zoom do iOS) +
 *    botão "Salvar saldo" de 44px. Valida número ≥ 0 antes de chamar a API.
 *
 * Valores monetários em <Money> (mono + tabular-nums); cores pelos tokens do tema.
 */
import { useEffect, useState } from 'react';
import { formatarDataIso, rotuloMesCurto } from '../lib/mes.js';
import Money from './Money.jsx';

const INPUT =
  'min-h-[44px] w-full rounded border border-border bg-bg px-3 py-2 text-base text-fg num ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

export default function GuardadoCard({ guardado, onSalvarSaldoInicial }) {
  const [campo, setCampo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  // Quando os dados chegam/atualizam, o campo mostra o saldo inicial atual.
  useEffect(() => {
    if (guardado) setCampo(String(guardado.saldoInicial));
  }, [guardado]);

  async function salvar(e) {
    e.preventDefault();
    const valor = Number(campo);
    if (campo.trim() === '' || Number.isNaN(valor) || valor < 0) {
      setErro('Informe um valor maior ou igual a zero.');
      return;
    }
    setErro('');
    setSalvo(false);
    setSalvando(true);
    try {
      await onSalvarSaldoInicial(valor);
      setSalvo(true);
    } catch (err) {
      setErro(err.response?.data?.message || err.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (!guardado) {
    return <div className="rounded border border-border bg-surface p-4 text-muted">Carregando total guardado…</div>;
  }

  return (
    <section className="rounded border border-border bg-surface p-4 sm:p-5" aria-label="Total guardado">
      <p className="text-xs uppercase tracking-wide text-muted">Total guardado</p>
      <Money value={guardado.total} tone="auto" className="mt-1 block text-[2rem] sm:text-4xl" />

      {/* Composição do total */}
      <dl className="mt-3 space-y-1 text-sm text-muted">
        <div className="flex items-baseline justify-between gap-3">
          <dt>Saldo inicial guardado</dt>
          <dd>
            <Money value={guardado.saldoInicial} tone="plain" className="text-fg" />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Receitas − despesas (meses fechados, desde out/2026)</dt>
          <dd>
            <Money value={guardado.saldoAcumulado} tone="auto" />
          </dd>
        </div>
        {/* Parcial do mês em andamento: informativo, AINDA NÃO somado ao total. */}
        {guardado.emAndamento && (
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <dt>
              Mês em andamento ({rotuloMesCurto(guardado.emAndamento.mes)}), entra em{' '}
              {formatarDataIso(guardado.emAndamento.entraEm)}
            </dt>
            <dd>
              <Money value={guardado.emAndamento.saldo} tone="auto" />
            </dd>
          </div>
        )}
      </dl>

      {/* Edição do saldo inicial */}
      <form onSubmit={salvar} className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm text-muted">
          Saldo inicial guardado (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={campo}
            onChange={(e) => {
              setCampo(e.target.value);
              setSalvo(false);
            }}
            className={`${INPUT} mt-1`}
          />
        </label>
        <button
          disabled={salvando}
          className="min-h-[44px] shrink-0 rounded border border-border px-5 text-sm font-medium text-fg hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : 'Salvar saldo'}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Some aqui o que você já tinha guardado antes de usar o painel.
      </p>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-negative">
          {erro}
        </p>
      )}
      {salvo && !erro && (
        <p role="status" className="mt-2 text-sm text-positive">
          Saldo inicial salvo.
        </p>
      )}
    </section>
  );
}
