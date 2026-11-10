/**
 * Tela de Metas (rota `/metas`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - mostrar, num card COMPACTO no topo, o "Total guardado" e a "Média guardada por mês" (vêm junto
 *    de GET /api/metas), com o link "Ver Porquinho". O total = SOMA DAS CAIXINHAS (calculado
 *    no servidor, services/guardado.js); é o ponto de partida do progresso e da previsão das metas.
 *    As caixinhas ficam na aba Porquinho
 *    (o antigo campo "Saldo inicial guardado" deu lugar às caixinhas);
 *  - listar as metas (GET /api/metas via useRecurso). Cada meta pode ter um
 *    valor (R$); as que têm mostram barra de progresso, porcentagem e
 *    "R$ saldo / R$ valor" (progresso = min(saldo acompanhado / valor, 100%) — caixinha ou total guardado);
 *  - criar meta (POST /api/metas) com título e valor OPCIONAL — botão
 *    "Adicionar" ou Enter (o campo está num <form>);
 *  - editar título e valor de uma meta existente (PATCH /api/metas/:id) — lápis;
 *  - marcar/desmarcar como concluída (PATCH) com ATUALIZAÇÃO OTIMISTA: o checkbox
 *    muda na hora; se a API falhar, volta ao estado anterior e mostra o erro.
 *    Além disso o SERVIDOR conclui sozinho a meta quando o total atinge o valor
 *    (sem impedir marcar/desmarcar à mão);
 *  - excluir meta (DELETE /api/metas/:id), também otimista, com reversão;
 *  - contador "X de Y concluídas"; ORDEM (regra única em lib/metas.js): pendentes primeiro,
 *    concluídas embaixo; em cada grupo, do menor para o maior valor (5 mil, 10 mil, 15 mil…),
 *    e as metas sem valor por último, a mais antiga primeiro. A lista se reorganiza sozinha
 *    ao marcar, desmarcar, editar ou adicionar (a ordem é derivada do estado);
 *  - PREVISÃO: abaixo da barra de cada meta com valor ainda não atingido, "No ritmo atual, chega em
 *    mar/2027" (ou "Sem previsão no ritmo atual" se a média mensal guardada é ≤ 0); sem mês
 *    fechado não mostra nada. Cálculo em lib/previsao.js, com a média que a API devolve;
 *  - mensagem amigável quando não há metas.
 *
 *  - META VINCULADA A CAIXINHA: cada meta acompanha o TOTAL GUARDADO (padrão; todas as antigas) ou uma
 *    CAIXINHA específica (`caixinhaId`). O servidor devolve em cada meta o `acompanhamento` pronto (saldo,
 *    progresso e previsão — services/metas.js) e a lista de caixinhas; aqui só exibimos e trocamos: no
 *    formulário (Total guardado | Caixinha específica) e no "trocar ▾" do card. A previsão de uma meta
 *    ligada a caixinha é APROXIMADA ("~"), porque a média mensal é do painel inteiro;
 *
 * Não recebe props. Autenticação já garantida pelo <Layout>.
 * Cores/tipografia: tokens do tema (ver `src/index.css`).
 */
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import Money from '../components/Money.jsx';
import MetaItem from '../components/MetaItem.jsx';
import SeletorAcompanhamento from '../components/SeletorAcompanhamento.jsx';
import { ordenarMetas } from '../lib/metas.js';
import { coresDasCaixinhas } from '../lib/caixinhas.js';

// 16px (`text-base`) evita o zoom automático do iOS; 44px = área de toque.
const INPUT =
  'min-h-[44px] w-full rounded border border-border bg-surface px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

const TITULO_MAX = 200; // mesmo limite do backend (models/Meta.js)

const mensagemDeErro = (err, padrao) => err.response?.data?.message || padrao;

export default function Metas() {
  const [guardado, setGuardado] = useState(null); // { totalCaixinhas, saldoAcumulado, total, mesesFechados, mediaMensal, emAndamento }
  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('');
  const [vinculo, setVinculo] = useState(''); // nova meta: '' = total guardado; senão id da caixinha
  const [caixinhas, setCaixinhas] = useState([]); // caixinhas do usuário (vêm junto de GET /api/metas)
  const [adicionando, setAdicionando] = useState(false);
  const [erroAcao, setErroAcao] = useState('');

  /** Busca o total guardado em GET /api/guardado (usado só como reserva, ver abaixo). */
  const carregarGuardado = useCallback(async () => {
    try {
      const { data } = await api.get('/guardado');
      setGuardado(data);
    } catch (err) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível carregar o total guardado.'));
    }
  }, []);

  // UMA chamada só: GET /api/metas já devolve as metas E o total guardado (meses fechados).
  // (Duas chamadas simultâneas — metas + guardado — disputavam a geração de fixos no servidor.)
  // Só se o servidor não conseguiu calcular o total (`guardado: null`) buscamos em separado.
  const { itens: metas, setItens: setMetas, carregando, erro, recarregar } = useRecurso(
    '/metas',
    'metas',
    (data) => {
      if (data.guardado) setGuardado(data.guardado);
      else carregarGuardado();
      setCaixinhas(data.caixinhas ?? []);
    },
  );

  // Pendentes primeiro, concluídas embaixo; em cada grupo, do menor para o maior valor (metas
  // sem valor por último, a mais antiga primeiro). A regra mora em lib/metas.js e é DERIVADA do
  // estado (`metas`): qualquer mudança — marcar, desmarcar, editar, adicionar, inclusive as
  // atualizações otimistas — reorganiza a lista automaticamente.
  const { pendentes, concluidas } = useMemo(() => ordenarMetas(metas), [metas]);

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
    if (vinculo) corpo.caixinhaId = vinculo; // meta que acompanha uma caixinha específica

    setErroAcao('');
    setAdicionando(true);
    try {
      const { data } = await api.post('/metas', corpo);
      setMetas((atual) => [data.meta, ...atual]); // já vem sincronizada (pode nascer concluída)
      setTitulo('');
      setValor('');
      setVinculo('');
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
  async function salvarEdicao(meta, { titulo: novoTitulo, valorAlvo, caixinhaId }) {
    const { data } = await api.patch(`/metas/${meta._id}`, { titulo: novoTitulo, valorAlvo, caixinhaId: caixinhaId || null });
    setMetas((atual) => atual.map((m) => (m._id === meta._id ? data.meta : m)));
  }

  /** "trocar ▾" do card: muda SÓ o que a meta acompanha ('' = total guardado). A resposta já vem recalculada. */
  async function trocarCaixinha(meta, caixinhaId) {
    const { data } = await api.patch(`/metas/${meta._id}`, { caixinhaId: caixinhaId || null });
    setMetas((atual) => atual.map((m) => (m._id === meta._id ? data.meta : m)));
  }

  // Cor de cada caixinha (pela ordem de criação — a mesma da aba Porquinho).
  const cores = useMemo(() => coresDasCaixinhas(caixinhas), [caixinhas]);

  const renderItem = (m) => (
    <MetaItem
      key={m._id}
      meta={m} // traz `acompanhamento` (saldo, progresso, previsão) calculado no servidor
      caixinhas={caixinhas}
      cores={cores}
      onAlternar={alternar}
      onExcluir={excluir}
      onSalvarEdicao={salvarEdicao}
      onTrocarCaixinha={trocarCaixinha}
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

      {/* Card COMPACTO do total guardado (base das barras de progresso e da previsão). A composição
          completa e as caixinhas ficam no Porquinho. Some se a carga falhou. */}
      {guardado && (
        <section
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded border border-border bg-surface p-4"
          aria-label="Total guardado"
        >
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted">Total guardado: </span>
              <Money value={guardado.total} tone="auto" className="text-base font-semibold" />
            </p>
            {/* Média: só existe com ao menos 1 mês fechado. */}
            {guardado.mediaMensal != null && guardado.mesesFechados > 0 && (
              <p className="text-muted">
                Média guardada por mês: <Money value={guardado.mediaMensal} tone="auto" />{' '}
                <span className="text-xs">
                  (base: {guardado.mesesFechados} {guardado.mesesFechados === 1 ? 'mês' : 'meses'})
                </span>
              </p>
            )}
          </div>
          <Link
            to="/porquinho"
            className="flex min-h-[44px] items-center text-sm font-medium text-accent hover:opacity-80"
          >
            Ver Porquinho →
          </Link>
        </section>
      )}

      {/* Título + valor opcional + botão. Enter dentro de um input envia o <form>. */}
      <form onSubmit={adicionar} className="space-y-3">
       <div className="flex flex-col gap-3 sm:flex-row">
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
       </div>
        {/* O que a nova meta acompanha (padrão: total guardado). Só faz diferença em meta com valor. */}
        <div className="flex flex-col gap-1 sm:max-w-md">
          <span className="text-xs text-muted">Acompanha</span>
          <SeletorAcompanhamento valor={vinculo} onChange={setVinculo} caixinhas={caixinhas} cores={cores} />
        </div>
      </form>

      {erroAcao && (
        <p role="alert" className="text-sm text-negative">
          {erroAcao}
        </p>
      )}

      {carregando ? (
        <p className="text-muted">Carregando…</p>
      ) : erro ? (
        <div className="space-y-2">
          <p role="alert" className="text-negative">
            {erro}
          </p>
          <button
            type="button"
            onClick={() => recarregar()}
            className="min-h-[44px] rounded border border-border bg-surface px-4 text-sm text-fg hover:border-accent hover:text-accent"
          >
            Tentar de novo
          </button>
        </div>
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
          {/* Em telas largas (`xl`, 1280px+) as metas ficam em 2 colunas (a ordem segue linha a linha);
              abaixo disso, uma coluna. `items-start`: cada meta mantém a própria altura. */}
          {pendentes.length > 0 && (
            <ul className="grid gap-2 xl:grid-cols-2 xl:items-start">{pendentes.map(renderItem)}</ul>
          )}

          {/* Concluídas ficam embaixo, sob um rótulo discreto. */}
          {concluidas.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">Concluídas</h2>
              <ul className="grid gap-2 xl:grid-cols-2 xl:items-start">{concluidas.map(renderItem)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
