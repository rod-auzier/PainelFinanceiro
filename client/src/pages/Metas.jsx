/**
 * Tela de Metas (rota `/metas`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - mostrar o TOTAL GUARDADO (GET /api/guardado): saldo inicial + (receitas −
 *    despesas de todos os meses), com o campo "Saldo inicial guardado"
 *    editável (PUT /api/guardado) — <GuardadoCard>;
 *  - listar as metas (GET /api/metas via useRecurso). Cada meta pode ter um
 *    valor (R$); as que têm mostram barra de progresso, porcentagem e
 *    "R$ X de R$ Y" (progresso = min(total guardado / valor, 100%));
 *  - criar meta (POST /api/metas) com título e valor OPCIONAL — botão
 *    "Adicionar" ou Enter (o campo está num <form>);
 *  - editar título e valor de uma meta existente (PATCH /api/metas/:id) — lápis;
 *  - marcar/desmarcar como concluída (PATCH) com ATUALIZAÇÃO OTIMISTA: o checkbox
 *    muda na hora; se a API falhar, volta ao estado anterior e mostra o erro.
 *    Além disso o SERVIDOR conclui sozinho a meta quando o total atinge o valor
 *    (sem impedir marcar/desmarcar à mão);
 *  - excluir meta (DELETE /api/metas/:id), também otimista, com reversão;
 *  - contador "X de Y concluídas"; pendentes primeiro, concluídas embaixo;
 *  - mensagem amigável quando não há metas.
 *
 * Não recebe props. Autenticação já garantida pelo <Layout>.
 * Cores/tipografia: tokens do tema (ver `src/index.css`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import GuardadoCard from '../components/GuardadoCard.jsx';
import MetaItem from '../components/MetaItem.jsx';

// 16px (`text-base`) evita o zoom automático do iOS; 44px = área de toque.
const INPUT =
  'min-h-[44px] w-full rounded border border-border bg-surface px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

const TITULO_MAX = 200; // mesmo limite do backend (models/Meta.js)

const mensagemDeErro = (err, padrao) => err.response?.data?.message || padrao;

export default function Metas() {
  const { itens: metas, setItens: setMetas, carregando, erro, recarregar } = useRecurso('/metas', 'metas');
  const [guardado, setGuardado] = useState(null); // { saldoInicial, saldoAcumulado, total }
  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [erroAcao, setErroAcao] = useState('');

  /** Busca o total guardado (saldo inicial + receitas − despesas). */
  const carregarGuardado = useCallback(async () => {
    try {
      const { data } = await api.get('/guardado');
      setGuardado(data);
    } catch (err) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível carregar o total guardado.'));
    }
  }, []);

  useEffect(() => {
    carregarGuardado();
  }, [carregarGuardado]);

  // Pendentes primeiro, concluídas embaixo. A ordem dentro de cada grupo
  // segue a da API (mais recentes primeiro).
  const { pendentes, concluidas } = useMemo(
    () => ({
      pendentes: metas.filter((m) => !m.concluida),
      concluidas: metas.filter((m) => m.concluida),
    }),
    [metas],
  );

  /** Cria a meta (valor opcional). Espera a resposta (precisa do `_id` real) e põe no topo. */
  async function adicionar(e) {
    e.preventDefault();
    const texto = titulo.trim();
    if (!texto || adicionando) return;

    const corpo = { titulo: texto };
    if (valor.trim() !== '') {
      const n = Number(valor);
      if (Number.isNaN(n) || n <= 0) {
        setErroAcao('O valor da meta deve ser maior que zero (ou deixe em branco).');
        return;
      }
      corpo.valorAlvo = n;
    }

    setErroAcao('');
    setAdicionando(true);
    try {
      const { data } = await api.post('/metas', corpo);
      setMetas((atual) => [data.meta, ...atual]); // já vem sincronizada (pode nascer concluída)
      setTitulo('');
      setValor('');
    } catch (err) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível adicionar a meta.'));
    } finally {
      setAdicionando(false);
    }
  }

  /** Marca/desmarca. OTIMISTA: muda na hora e sincroniza com a API. */
  async function alternar(meta) {
    const novo = !meta.concluida;
    const aplicar = (v) => (atual) => atual.map((m) => (m._id === meta._id ? { ...m, concluida: v } : m));

    setErroAcao('');
    setMetas(aplicar(novo)); // 1) atualiza a tela imediatamente
    try {
      await api.patch(`/metas/${meta._id}`, { concluida: novo }); // 2) sincroniza
    } catch (err) {
      setMetas(aplicar(!novo)); // 3) falhou: volta ao estado anterior
      setErroAcao(mensagemDeErro(err, 'Não foi possível atualizar a meta.'));
    }
  }

  /** Exclui. OTIMISTA: some na hora; se falhar, a meta reaparece. */
  async function excluir(meta) {
    setErroAcao('');
    setMetas((atual) => atual.filter((m) => m._id !== meta._id));
    try {
      await api.delete(`/metas/${meta._id}`);
    } catch (err) {
      // Reinsere na posição certa (mais recentes primeiro, como a API devolve).
      setMetas((atual) => [...atual, meta].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setErroAcao(mensagemDeErro(err, 'Não foi possível excluir a meta.'));
    }
  }

  /**
   * Salva título e valor editados (PATCH). Lança Error em caso de falha — o
   * <MetaItem> mostra a mensagem dentro do item. A resposta já vem sincronizada
   * (se o total atinge o novo valor, a meta volta concluída).
   */
  async function salvarEdicao(meta, { titulo: novoTitulo, valorAlvo }) {
    const { data } = await api.patch(`/metas/${meta._id}`, { titulo: novoTitulo, valorAlvo });
    setMetas((atual) => atual.map((m) => (m._id === meta._id ? data.meta : m)));
  }

  /**
   * Salva o "Saldo inicial guardado" (PUT). O total muda, então o servidor pode
   * ter concluído metas — recarregamos a lista em silêncio para refletir isso.
   */
  async function salvarSaldoInicial(saldoInicial) {
    const { data } = await api.put('/guardado', { saldoInicial });
    setGuardado(data);
    await recarregar({ silencioso: true });
  }

  const total = guardado?.total ?? 0;

  const renderItem = (m) => (
    <MetaItem
      key={m._id}
      meta={m}
      total={total}
      onAlternar={alternar}
      onExcluir={excluir}
      onSalvarEdicao={salvarEdicao}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">Metas</h1>

        {/* Contador "X de Y concluídas" (só quando há metas). */}
        {metas.length > 0 && (
          <p className="text-sm text-muted" aria-live="polite">
            <span className="num text-fg">{concluidas.length}</span> de{' '}
            <span className="num text-fg">{metas.length}</span> concluídas
          </p>
        )}
      </div>

      {/* Total guardado + saldo inicial editável */}
      <GuardadoCard guardado={guardado} onSalvarSaldoInicial={salvarSaldoInicial} />

      {/* Título + valor opcional + botão. Enter dentro de um input envia o <form>. */}
      <form onSubmit={adicionar} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Escreva uma meta…"
          maxLength={TITULO_MAX}
          aria-label="Nova meta"
          className={INPUT}
        />
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Valor (R$)"
          aria-label="Valor da meta em reais (opcional)"
          className={`${INPUT} num sm:w-56 sm:shrink-0`}
        />
        <button
          disabled={adicionando || !titulo.trim()}
          className="min-h-[44px] shrink-0 rounded bg-accent px-5 font-medium text-bg hover:opacity-90 disabled:opacity-60"
        >
          {adicionando ? 'Adicionando…' : 'Adicionar'}
        </button>
      </form>

      {erroAcao && (
        <p role="alert" className="text-sm text-negative">
          {erroAcao}
        </p>
      )}

      {carregando ? (
        <p className="text-muted">Carregando…</p>
      ) : erro ? (
        <p className="text-negative">{erro}</p>
      ) : metas.length === 0 ? (
        /* Estado vazio amigável */
        <div className="rounded border border-border bg-surface p-6 text-center">
          <p className="font-medium">Nenhuma meta por aqui ainda</p>
          <p className="mt-1 text-sm text-muted">
            Escreva sua primeira meta acima — com um valor, ela ganha barra de progresso — e
            marque o quadradinho quando concluir.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendentes.length > 0 && <ul className="space-y-2">{pendentes.map(renderItem)}</ul>}

          {/* Concluídas ficam embaixo, sob um rótulo discreto. */}
          {concluidas.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">Concluídas</h2>
              <ul className="space-y-2">{concluidas.map(renderItem)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
