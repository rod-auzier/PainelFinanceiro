/**
 * Tela de Metas (rota `/metas`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - listar as metas do usuário (GET /api/metas via useRecurso);
 *  - criar meta (POST /api/metas) pelo campo de texto — botão "Adicionar" ou
 *    Enter (o campo está dentro de um <form>, então Enter já dispara o submit);
 *  - marcar/desmarcar como concluída (PATCH /api/metas/:id) com ATUALIZAÇÃO
 *    OTIMISTA: o checkbox muda na hora; se a API falhar, volta ao estado
 *    anterior e mostra o erro;
 *  - excluir meta (DELETE /api/metas/:id), também otimista, com reversão;
 *  - mostrar o contador "X de Y concluídas";
 *  - ordenar: pendentes primeiro, concluídas embaixo;
 *  - exibir mensagem amigável quando não há metas.
 *
 * Não recebe props. Autenticação já garantida pelo <Layout>.
 * Cores/tipografia: tokens do tema (ver `src/index.css`).
 */
import { useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import MetaItem from '../components/MetaItem.jsx';

// 16px (`text-base`) evita o zoom automático do iOS; 44px = área de toque.
const INPUT =
  'min-h-[44px] w-full rounded border border-border bg-surface px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

const TITULO_MAX = 200; // mesmo limite do backend (models/Meta.js)

const mensagemDeErro = (err, padrao) => err.response?.data?.message || padrao;

export default function Metas() {
  const { itens: metas, setItens: setMetas, carregando, erro } = useRecurso('/metas', 'metas');
  const [titulo, setTitulo] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [erroAcao, setErroAcao] = useState('');

  // Pendentes primeiro, concluídas embaixo. A ordem dentro de cada grupo
  // segue a da API (mais recentes primeiro).
  const { pendentes, concluidas } = useMemo(
    () => ({
      pendentes: metas.filter((m) => !m.concluida),
      concluidas: metas.filter((m) => m.concluida),
    }),
    [metas],
  );

  /** Cria a meta. Espera a resposta (precisa do `_id` real) e põe no topo. */
  async function adicionar(e) {
    e.preventDefault();
    const texto = titulo.trim();
    if (!texto || adicionando) return;

    setErroAcao('');
    setAdicionando(true);
    try {
      const { data } = await api.post('/metas', { titulo: texto });
      setMetas((atual) => [data.meta, ...atual]);
      setTitulo('');
    } catch (err) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível adicionar a meta.'));
    } finally {
      setAdicionando(false);
    }
  }

  /** Marca/desmarca. OTIMISTA: muda na hora e sincroniza com a API. */
  async function alternar(meta) {
    const novo = !meta.concluida;
    const aplicar = (valor) => (atual) =>
      atual.map((m) => (m._id === meta._id ? { ...m, concluida: valor } : m));

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
      setMetas((atual) =>
        [...atual, meta].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      );
      setErroAcao(mensagemDeErro(err, 'Não foi possível excluir a meta.'));
    }
  }

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

      {/* Campo + botão. Enter dentro do input envia o <form>. */}
      <form onSubmit={adicionar} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Escreva uma meta…"
          maxLength={TITULO_MAX}
          aria-label="Nova meta"
          className={INPUT}
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
            Escreva sua primeira meta acima e marque o quadradinho quando concluir.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendentes.length > 0 && (
            <ul className="space-y-2">
              {pendentes.map((m) => (
                <MetaItem key={m._id} meta={m} onAlternar={alternar} onExcluir={excluir} />
              ))}
            </ul>
          )}

          {/* Concluídas ficam embaixo, sob um rótulo discreto. */}
          {concluidas.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">Concluídas</h2>
              <ul className="space-y-2">
                {concluidas.map((m) => (
                  <MetaItem key={m._id} meta={m} onAlternar={alternar} onExcluir={excluir} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
