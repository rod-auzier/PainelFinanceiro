/**
 * Tela de Despesas (rota `/despesas`, dentro do <Layout>).
 *
 * LAYOUT (só apresentação — nenhuma regra de negócio mora aqui; os cálculos vêm da API)
 *  ┌ Cabeçalho ──────────────────────────────────────────────────────────────────────────────┐
 *  │ "Despesas" + "Novembro de 2026 · em andamento"     ‹ mês ›  Hoje   [+ Nova despesa]     │
 *  └─────────────────────────────────────────────────────────────────────────────────────────┘
 *  [faixa do formulário — recolhida; abre com "+ Nova despesa", Esc fecha]
 *  ┌ Lista (~600px) ──────────────────────┐ ┌ Painel lateral (~290px) ┐
 *  │ filtros | N de M pagas | marcar todas │ │ PAGAMENTO DO MÊS        │
 *  │ [paga] [nome / categoria]   [valor]   │ │ CARTÕES DE CRÉDITO      │
 *  │ Total                        R$ x     │ └─────────────────────────┘
 *  └──────────────────────────────────────┘
 *  - Desktop largo (`xl`, 1280px+): 2 colunas alinhadas ao topo (o resto à direita fica livre).
 *  - Abaixo disso (celular/tablet): coluna única — cabeçalho → painel (Pagamento, Cartões) → lista.
 *  - Todos os blocos em fundo SÓLIDO (card `surface`), sobre o fundo em grade do tema Grafite.
 *
 * O QUE A TELA FAZ (comportamento igual ao de antes, só reorganizado):
 *  - despesas do MÊS selecionado (GET /api/despesas?mes=AAAA-MM). O servidor gera os fixos do mês,
 *    faz as transições únicas (cartão padrão, ajuste dos fixos) e devolve a situação de cada cartão e
 *    as linhas CALCULADAS "Outras compras no cartão (nome)";
 *  - criar (POST) pela faixa "+ Nova despesa": Descrição | Categoria | Cartão | Valor | Repete todo mês.
 *    Depois de adicionar, os campos limpam e a faixa continua aberta para lançar várias seguidas;
 *  - editar na própria linha (PUT; fixo propaga para os meses seguintes no servidor, com aviso
 *    "Aplicado também a N meses seguintes"); excluir (DELETE; fixo pergunta "só este mês / seguintes");
 *  - marcar como paga (otimista, PATCH) e "Marcar todas como pagas" (com confirmação);
 *  - filtro rápido por cartão; total das linhas mostradas no rodapé da lista;
 *  - "Pagamento do mês" (total, pago e falta do mês) e os cartões (fatura do mês, fatura paga) no painel;
 *  - "Gerenciar categorias" abre a mesma tela de gerenciar categorias numa janela.
 * Inputs em 16px (sem zoom no iOS); botões com área de toque confortável.
 */
import { useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { useMesSelecionado } from '../hooks/useMesSelecionado.js';
import { mensagemFixosGerados, mesAtual, rotuloMes } from '../lib/mes.js';
import { NOME_OUTROS } from '../lib/constants.js';
import { useCategorias } from '../context/CategoriasContext.jsx';
import SeletorMes from '../components/SeletorMes.jsx';
import SeletorCategoria from '../components/SeletorCategoria.jsx';
import GerenciarCategorias from '../components/GerenciarCategorias.jsx';
import ConfirmarExclusaoFixo from '../components/ConfirmarExclusaoFixo.jsx';
import CartoesSecao from '../components/CartoesSecao.jsx';
import SeletorCartao from '../components/SeletorCartao.jsx';
import ListaDespesas from '../components/ListaDespesas.jsx';
import PagamentoMesCard from '../components/PagamentoMesCard.jsx';
import { useCartoes } from '../hooks/useCartoes.js';

const FORM_VAZIO = { descricao: '', categoria: NOME_OUTROS, valor: '', recorrente: false, cartaoId: '' }; // '' = sem cartão

const INPUT =
  'min-h-[44px] w-full rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

/** "Novembro de 2026 · em andamento" / "· fechado" / "· futuro" — situação do mês no subtítulo. */
function subtituloDoMes(mes) {
  const nome = rotuloMes(mes);
  const atual = mesAtual();
  const situacao = mes < atual ? 'fechado' : mes === atual ? 'em andamento' : 'futuro';
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} · ${situacao}`;
}

export default function Despesas() {
  const [mes, setMes] = useMesSelecionado();
  const { resolver } = useCategorias(); // nome/cor de exibição da categoria de cada despesa
  const [aviso, setAviso] = useState(''); // "N fixos adicionados" (geração automática)
  const { itens: despesas, setItens: setDespesas, carregando, erro, recarregar } = useRecurso(
    `/despesas?mes=${mes}`,
    'despesas',
    // A API informa quantos fixos criou ao abrir o mês; só mostramos quando > 0. Também traz a
    // situação do cartão no mês e a linha calculada "Outras compras no cartão" (ou null).
    (data) => {
      if (data.fixosGerados > 0) setAviso(mensagemFixosGerados(data.fixosGerados));
      // Ajuste único dos fixos existentes (cartão/categoria do mês anterior) — só na 1ª abertura.
      if (data.fixosAjustados > 0) {
        setAvisoFixos(
          `${data.fixosAjustados} ${data.fixosAjustados === 1 ? 'lançamento fixo ajustado' : 'lançamentos fixos ajustados'} com o cartão do mês anterior.`,
        );
      }
      setSituacoes(data.cartoes?.cartoes ?? []);
      setLinhasVirtuais(data.linhasVirtuais ?? []);
    },
  );
  const cartoes = useCartoes(); // cartões do usuário (lista, criar/editar/excluir, cartão de cada despesa)
  const { cartaoDaDespesa } = cartoes;
  const [situacoes, setSituacoes] = useState([]); // situação de cada cartão no mês (fatura, detalhado…)
  const [linhasVirtuais, setLinhasVirtuais] = useState([]); // linhas calculadas (não são registros salvos)
  const [filtroCartao, setFiltroCartao] = useState(''); // filtro rápido: '' = todas; senão o id do cartão
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [confirmandoTodas, setConfirmandoTodas] = useState(false); // pergunta "marcar todas?" aberta
  const [erroPaga, setErroPaga] = useState(''); // falha ao sincronizar o status "paga"
  const [formAberto, setFormAberto] = useState(false); // faixa "+ Nova despesa" (recolhida por padrão)
  const [gerenciandoCategorias, setGerenciandoCategorias] = useState(false); // janela de categorias

  // Painel "Pagamento do mês": SEMPRE o mês inteiro (despesas + linhas calculadas), sem o filtro de
  // cartão. Mesmos cálculos de Pago / Falta de antes (linha calculada é paga se a fatura está paga).
  const totalMes = useMemo(
    () => [...despesas, ...linhasVirtuais].reduce((soma, d) => soma + Number(d.valor || 0), 0),
    [despesas, linhasVirtuais],
  );
  const pagoMes = useMemo(
    () => [...despesas, ...linhasVirtuais].reduce((soma, d) => soma + (d.paga ? Number(d.valor || 0) : 0), 0),
    [despesas, linhasVirtuais],
  );


  // Linhas mostradas na lista: as despesas (todas ou só as de UM cartão) + as linhas calculadas dos
  // cartões no fim (no filtro por cartão, só a daquele cartão).
  const itensExibidos = useMemo(() => {
    if (!filtroCartao) return [...despesas, ...linhasVirtuais];
    const doCartao = (d) => String(d.virtual ? d.cartaoId : cartaoDaDespesa(d)?._id) === filtroCartao;
    return [...despesas.filter(doCartao), ...linhasVirtuais.filter(doCartao)];
  }, [despesas, linhasVirtuais, filtroCartao, cartaoDaDespesa]);

  // Total das linhas mostradas. Sem filtro = total de despesas do mês JÁ CORRIGIDO pelos cartões
  // (lançadas + outras compras nos cartões), o mesmo do Resumo; filtrado = total daquele cartão.
  const total = useMemo(
    () => itensExibidos.reduce((soma, d) => soma + Number(d.valor || 0), 0),
    [itensExibidos],
  );
  // Andamento dos pagamentos do mês (só informativo; não altera o total).
  const qtdPagas = despesas.filter((d) => d.paga).length;
  const qtdPendentes = despesas.length - qtdPagas;
  // Soma das despesas pagas (só para os indicadores "Pago / Falta pagar" da linha de total).
  // (Uma linha calculada conta como paga quando a fatura do cartão dela está paga.)
  const totalPago = useMemo(
    () => itensExibidos.reduce((soma, d) => soma + (d.paga ? Number(d.valor || 0) : 0), 0),
    [itensExibidos],
  );

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function trocarMes(novo) {
    setAviso('');
    setAvisoFixos('');
    setExcluindoFixo(null);
    setConfirmandoTodas(false);
    setErroPaga('');
    setMes(novo);
  }

  /**
   * Marca/desmarca UMA despesa como paga — atualização OTIMISTA: a caixa muda na hora e a API
   * (PATCH /api/despesas/:id) é chamada em seguida; se falhar, volta ao estado anterior.
   */
  async function alternarPaga(despesa) {
    const nova = !despesa.paga;
    setErroPaga('');
    setDespesas((lista) => lista.map((d) => (d._id === despesa._id ? { ...d, paga: nova } : d)));
    try {
      await api.patch(`/despesas/${despesa._id}`, { paga: nova });
    } catch {
      setDespesas((lista) => lista.map((d) => (d._id === despesa._id ? { ...d, paga: !nova } : d)));
      setErroPaga('Não foi possível atualizar o pagamento. Tente de novo.');
    }
  }

  /**
   * "Marcar todas como pagas" (já confirmado): marca na hora todas as pendentes do mês e chama
   * PATCH /api/despesas/pagas. Se falhar, recarrega a lista para voltar ao estado real.
   */
  async function marcarTodasPagas() {
    setConfirmandoTodas(false);
    setErroPaga('');
    setDespesas((lista) => lista.map((d) => ({ ...d, paga: true })));
    try {
      await api.patch('/despesas/pagas', { mes });
    } catch {
      setErroPaga('Não foi possível marcar todas como pagas. Tente de novo.');
      recarregar({ silencioso: true });
    }
  }

  async function adicionar(e) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      await api.post('/despesas', {
        descricao: form.descricao,
        categoria: form.categoria,
        valor: Number(form.valor),
        recorrente: form.recorrente,
        cartaoId: form.cartaoId || null, // cartão de crédito (ou nenhum)
        mes, // lança no mês selecionado
      });
      setForm(FORM_VAZIO);
      await recarregar();
    } catch (err) {
      setErroForm(err.response?.data?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const [excluindoFixo, setExcluindoFixo] = useState(null); // fixo aguardando "só este mês / seguintes"
  const [excluindo, setExcluindo] = useState(false);
  const [avisoFixos, setAvisoFixos] = useState(''); // "Aplicado também a N meses seguintes" etc.

  /** Texto discreto para quantos lançamentos dos meses seguintes foram alterados/excluídos. */
  const mesesSeguintes = (n) => `${n} ${n === 1 ? 'mês seguinte' : 'meses seguintes'}`;

  /**
   * Excluir: lançamento comum sai na hora; FIXO abre a pergunta <ConfirmarExclusaoFixo>
   * (padrão: só este mês; ou também os meses seguintes).
   */
  async function excluir(id) {
    const item = despesas.find((x) => x._id === id);
    if (item?.recorrente) {
      setExcluindoFixo(item);
      return;
    }
    await api.delete(`/despesas/${id}`);
    recarregar();
  }

  /** Exclui o fixo com o escopo escolhido; avisa quantos meses seguintes também saíram. */
  async function excluirFixo(escopo) {
    const item = excluindoFixo;
    setExcluindo(true);
    try {
      const { data } = await api.delete(`/despesas/${item._id}`, { params: escopo === 'seguintes' ? { escopo } : {} });
      const extras = (data?.removidas ?? 1) - 1;
      setAvisoFixos(extras > 0 ? `Excluído também de ${mesesSeguintes(extras)}.` : '');
      setExcluindoFixo(null);
      await recarregar();
    } catch (err) {
      setAvisoFixos(err.response?.data?.message || 'Não foi possível excluir.');
    } finally {
      setExcluindo(false);
    }
  }

  /**
   * Salva a edição inline de uma despesa.
   * Mesma validação do formulário de criação (descrição obrigatória, valor
   * numérico ≥ 0). Lança Error com mensagem — o <ListaDespesas> a exibe
   * na própria linha.
   */
  async function salvarEdicao(id, rascunho) {
    const descricao = (rascunho.descricao ?? '').trim();
    const valorNum = Number(rascunho.valor);
    if (!descricao) throw new Error('Descrição é obrigatória.');
    if (rascunho.valor === '' || Number.isNaN(valorNum) || valorNum < 0) {
      throw new Error('Valor deve ser um número maior ou igual a zero.');
    }
    const { data } = await api.put(`/despesas/${id}`, {
      descricao,
      categoria: rascunho.categoria || NOME_OUTROS,
      valor: valorNum,
      recorrente: Boolean(rascunho.recorrente),
      cartaoId: rascunho.cartao || null, // a coluna "Cartão" guarda o id escolhido ('' = nenhum)
    });
    // O servidor já levou a mudança aos fixos dos meses seguintes (menos valor e paga).
    setAvisoFixos(data.propagadas > 0 ? `Aplicado também a ${mesesSeguintes(data.propagadas)}.` : '');
    await recarregar();
  }

  /** Cartão de EXIBIÇÃO de uma linha: o da despesa (ou o padrão, nas antigas); na linha calculada, pelo id. */
  const cartaoDe = (d) =>
    d.virtual ? cartoes.cartoes.find((c) => String(c._id) === String(d.cartaoId)) ?? null : cartaoDaDespesa(d);

  return (
    <div className="space-y-5">
      {/* ================= CABEÇALHO: título + situação do mês | navegação do mês + "+ Nova despesa" ================= */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="text-lg font-semibold">Despesas</h1>
          <p className="text-xs text-muted">{subtituloDoMes(mes)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* ‹ mês › e "Hoje" (mesma lógica de antes: não volta antes de MES_INICIAL). */}
          <SeletorMes mes={mes} onChange={trocarMes} />
          <button
            type="button"
            aria-expanded={formAberto}
            onClick={() => setFormAberto((v) => !v)}
            className="min-h-[44px] rounded bg-accent px-4 text-sm font-medium text-bg hover:opacity-90"
          >
            + Nova despesa
          </button>
        </div>
      </header>

      {/* ================= FAIXA DO FORMULÁRIO (recolhida até "+ Nova despesa") =================
          Uma linha no desktop largo: Descrição | Categoria | Cartão | Valor | Repete todo mês | Adicionar.
          No celular, campos empilhados. Continua aberta depois de adicionar; Esc ou "Fechar" recolhe. */}
      {formAberto && (
        <form
          onSubmit={adicionar}
          onKeyDown={(e) => e.key === 'Escape' && setFormAberto(false)}
          className="grid gap-2 rounded border border-accent/50 bg-surface p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto_auto] xl:items-center"
          aria-label="Nova despesa"
        >
          <input
            placeholder="Descrição"
            value={form.descricao}
            onChange={(e) => setCampo('descricao', e.target.value)}
            className={`${INPUT} sm:col-span-2 xl:col-span-1`}
            autoFocus
            required
          />
          {/* Categoria com bolinha de cor (e "+ Nova categoria" no fim da lista). */}
          <SeletorCategoria valor={form.categoria} onChange={(nome) => setCampo('categoria', nome)} className="bg-bg" />
          {/* Cartão: "Sem cartão" por padrão, os cartões e "+ Novo cartão". */}
          <SeletorCartao
            valor={form.cartaoId}
            onChange={(id) => setCampo('cartaoId', id)}
            cartoes={cartoes.cartoes}
            limite={cartoes.limite}
            criar={cartoes.criar}
            className="bg-bg"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="Valor"
            value={form.valor}
            onChange={(e) => setCampo('valor', e.target.value)}
            className={`${INPUT} num`}
            required
          />
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 whitespace-nowrap text-sm xl:px-1">
            <input
              type="checkbox"
              checked={form.recorrente}
              onChange={(e) => setCampo('recorrente', e.target.checked)}
              className="h-5 w-5 accent-accent"
            />
            Repete todo mês
          </label>
          <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
            <button
              disabled={salvando}
              className="min-h-[44px] flex-1 rounded bg-accent px-5 font-medium text-bg hover:opacity-90 disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Adicionar'}
            </button>
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              aria-label="Fechar formulário"
              className="min-h-[44px] rounded border border-border px-3 text-muted hover:text-fg"
            >
              ✕
            </button>
          </div>
          {erroForm && <p className="text-sm text-negative sm:col-span-2 xl:col-span-full">{erroForm}</p>}
        </form>
      )}

      {/* Avisos discretos: fixos gerados ao abrir o mês e propagação/ajuste dos fixos. */}
      {(aviso || avisoFixos) && (
        <div className="space-y-1 text-sm text-muted" role="status">
          {aviso && <p>{aviso}</p>}
          {avisoFixos && <p>↻ {avisoFixos}</p>}
        </div>
      )}

      {/* ================= CORPO: lista (~600px) + painel lateral (~290px) =================
          No DOM o painel vem ANTES (celular: painel → lista). No `xl` vira grade de 2 colunas e o
          `order` põe a lista à esquerda e o painel à direita, ambos alinhados ao topo. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,600px)_290px] xl:items-start">
        {/* ---------- Painel lateral ---------- */}
        <aside className="space-y-4 xl:order-2" aria-label="Resumo do mês e cartões">
          <PagamentoMesCard total={totalMes} pago={pagoMes} />
          {!carregando && !erro && (
            <CartoesSecao mes={mes} situacoes={situacoes} cartoes={cartoes} aoAlterar={() => recarregar({ silencioso: true })} />
          )}
        </aside>

        {/* ---------- Lista ---------- */}
        <div className="min-w-0 xl:order-1">
          <ListaDespesas
            itens={itensExibidos}
            total={total}
            carregando={carregando}
            erro={erro}
            filtro={{ cartoes: cartoes.cartoes, valor: filtroCartao, onChange: setFiltroCartao }}
            pagas={{
              qtdPagas,
              qtdTotal: despesas.length,
              qtdPendentes,
              confirmando: confirmandoTodas,
              setConfirmando: setConfirmandoTodas,
              onMarcarTodas: marcarTodasPagas,
              erro: erroPaga,
            }}
            cartaoDe={cartaoDe}
            resolverCategoria={resolver}
            onAlternarPaga={alternarPaga}
            onExcluir={excluir}
            aoSalvarEdicao={salvarEdicao}
            cartoesApi={cartoes}
            onGerenciarCategorias={() => setGerenciandoCategorias(true)}
          />
        </div>
      </div>

      {/* Pergunta ao excluir um FIXO: só este mês (padrão) ou também os meses seguintes. */}
      {excluindoFixo && (
        <ConfirmarExclusaoFixo
          nome={excluindoFixo.descricao}
          ocupado={excluindo}
          onEscolher={excluirFixo}
          onCancelar={() => setExcluindoFixo(null)}
        />
      )}

      {/* "Gerenciar categorias": a mesma seção de antes, numa janela por cima da tela. Fundo e Esc fecham.
          Renomear/excluir muda o nome gravado nas despesas, então a lista recarrega em segundo plano. */}
      {gerenciandoCategorias && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16"
          onClick={(e) => e.target === e.currentTarget && setGerenciandoCategorias(false)}
          onKeyDown={(e) => e.key === 'Escape' && setGerenciandoCategorias(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Gerenciar categorias"
        >
          <div className="w-full max-w-2xl">
            <GerenciarCategorias
              inicialAberto
              onFechar={() => setGerenciandoCategorias(false)}
              aoAlterar={() => recarregar({ silencioso: true })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
