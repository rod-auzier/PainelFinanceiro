/**
 * Tela de Despesas (rota `/despesas`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - mostrar as despesas do MÊS selecionado (seletor ‹ mês › no topo →
 *    GET /api/despesas?mes=AAAA-MM via useRecurso);
 *  - criar despesa (POST /api/despesas) com Descrição, Categoria, Valor e o
 *    checkbox "Repete todo mês" (`recorrente`). A despesa é lançada no mês
 *    selecionado (`mes` no body). Categoria usa o <SeletorCategoria>: as categorias PERSONALIZADAS
 *    do usuário (com a bolinha de cor) e "+ Nova categoria", que cria uma sem sair da tela e já a
 *    deixa selecionada. A mesma escolha aparece na edição inline;
 *  - CATEGORIAS: seção "Categorias" (<GerenciarCategorias>) abaixo da lista, para criar, editar e
 *    excluir categorias. Renomear/excluir muda o nome gravado nas despesas, então a lista recarrega;
 *  - despesa com categoria sem correspondência é EXIBIDA como "Outros" (o dado não muda);
 *  - FIXOS AUTOMÁTICOS: ao abrir um mês, o servidor cria sozinho (e sem duplicar) as
 *    despesas recorrentes ("Repete todo mês") do mês anterior — só até o mês atual; meses
 *    futuros não geram nada. A tela mostra um aviso discreto com quantas foram
 *    adicionadas ("N fixos adicionados"); depois é só editar o que mudou;
 *  - editar despesa inline (PUT /api/despesas/:id) — a validação em
 *    `salvarEdicao` repete a do formulário de criação. É por aqui que se
 *    ajusta o valor de uma conta fixa copiada (ex.: a conta de luz);
 *  - excluir despesa (DELETE /api/despesas/:id). Se for FIXA, pergunta antes (<ConfirmarExclusaoFixo>):
 *    só este mês (padrão) ou também os meses seguintes (`?escopo=seguintes`);
 *  - PROPAGAÇÃO DOS FIXOS: editar uma despesa fixa aplica descrição, categoria, cartão e "Repete todo
 *    mês" também aos meses SEGUINTES (no servidor, na mesma operação; valor e paga não). A tela só
 *    mostra o aviso discreto "Aplicado também a N meses seguintes". Na 1ª abertura, o servidor faz o
 *    ajuste único dos fixos já existentes e a tela avisa quantos foram ajustados;
 *  - MARCAR COMO PAGA: caixa de marcação grande em cada despesa (<CaixaCheck>, mesmo estilo das
 *    Metas; verde quando marcada). Atualização OTIMISTA: marca na hora e sincroniza com
 *    PATCH /api/despesas/:id (se falhar, desfaz e avisa). Paga = texto levemente apagado, valor
 *    continua visível. É só informativo: total e saldo contam TODAS as despesas. Fixos gerados
 *    automaticamente entram sempre como não pagos; editar não muda o status;
 *  - no topo, "X de Y pagas" e o botão "Marcar todas como pagas" (com confirmação), que age só
 *    nas pendentes do mês selecionado (PATCH /api/despesas/pagas);
 *  - CARTÕES DE CRÉDITO (vários): campo "Cartão" no formulário e na edição (<SeletorCartao>: "Nenhum",
 *    os cartões com a bolinha de cor e "+ Novo cartão"); selo com a cor e o nome do cartão na lista;
 *    filtro rápido por cartão; seção <CartoesSecao> no topo com um card por cartão, onde se informa o
 *    TOTAL DA FATURA do mês. A parte de cada fatura que não foi lançada vira uma linha CALCULADA
 *    "Outras compras no cartão (nome)" (vem pronta da API em `linhasVirtuais`; selo "calculada", sem
 *    editar/excluir), somada ao total — nada conta duas vezes (regra em server/src/services/cartao.js);
 *  - exibir o total do mês (das linhas mostradas, incluindo a linha calculada).
 *
 * Responsivo (breakpoints `sm` / `md`, padrões do Tailwind):
 *  - formulário: 1 coluna no mobile, 2 colunas a partir de `sm` (640px);
 *  - lista: cards empilhados no mobile, tabela a partir de `md` — via
 *    <ListaLancamentos>.
 * Inputs em `text-base` (16px) para não disparar zoom no iOS; botões com
 * altura mínima de 44px.
 */
import { useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { useMesSelecionado } from '../hooks/useMesSelecionado.js';
import { mensagemFixosGerados } from '../lib/mes.js';
import { NOME_OUTROS } from '../lib/constants.js';
import { useCategorias } from '../context/CategoriasContext.jsx';
import Money from '../components/Money.jsx';
import ListaLancamentos from '../components/ListaLancamentos.jsx';
import CategoriaPonto from '../components/CategoriaPonto.jsx';
import SeletorMes from '../components/SeletorMes.jsx';
import SeletorCategoria from '../components/SeletorCategoria.jsx';
import GerenciarCategorias from '../components/GerenciarCategorias.jsx';
import ConfirmarExclusaoFixo from '../components/ConfirmarExclusaoFixo.jsx';
import { IconeCartao } from '../components/CartaoCard.jsx';
import CartoesSecao from '../components/CartoesSecao.jsx';
import SeletorCartao from '../components/SeletorCartao.jsx';
import { useCartoes } from '../hooks/useCartoes.js';

const FORM_VAZIO = { descricao: '', categoria: NOME_OUTROS, valor: '', recorrente: false, cartaoId: '' }; // '' = sem cartão

/** Selo pequeno (ex.: "Cartão", "calculada") — discreto, no tema. */
function Selo({ children }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] leading-none text-muted">
      {children}
    </span>
  );
}
const INPUT =
  'min-h-[44px] rounded border border-border bg-surface px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

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
   * numérico ≥ 0). Lança Error com mensagem — o <ListaLancamentos> a exibe
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

  const colunas = [
    {
      chave: 'descricao',
      label: 'Descrição',
      editor: 'text',
      // A linha calculada do cartão leva o selo "calculada".
      render: (d) =>
        d.virtual ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            {d.descricao}
            <Selo>calculada</Selo>
          </span>
        ) : (
          d.descricao
        ),
    },
    {
      chave: 'categoria',
      label: 'Categoria',
      classe: 'text-muted',
      // Edição inline com o mesmo seletor do formulário (bolinhas de cor + "+ Nova categoria").
      editor: 'custom',
      editorCustom: (valor, onChange) => <SeletorCategoria valor={valor} onChange={onChange} className="bg-bg" />,
      valorEdicao: (d) => resolver(d.categoria).nome, // categoria sem correspondência começa em "Outros"
      // Bolinha com a cor da categoria do usuário (a mesma da rosca do Resumo); sem
      // correspondência, mostra "Outros".
      render: (d) => (
        <span className="inline-flex items-center gap-2">
          <CategoriaPonto categoria={d.categoria} />
          {resolver(d.categoria).nome}
        </span>
      ),
    },
    {
      chave: 'recorrente',
      label: 'Fixo',
      classe: 'text-muted',
      editor: 'checkbox',
      render: (d) => (d.recorrente ? <span className="text-accent">↻ Todo mês</span> : '—'),
    },
    {
      // Cartão de crédito: selo com a bolinha de cor e o nome do cartão; na edição, o mesmo seletor
      // do formulário. Despesas antigas do controle de um cartão só aparecem no cartão padrão.
      chave: 'cartao',
      label: 'Cartão',
      classe: 'text-muted',
      editor: 'custom',
      editorCustom: (valor, onChange) => (
        <SeletorCartao
          valor={valor}
          onChange={onChange}
          cartoes={cartoes.cartoes}
          limite={cartoes.limite}
          criar={cartoes.criar}
          className="bg-bg"
        />
      ),
      valorEdicao: (d) => (cartaoDaDespesa(d)?._id ? String(cartaoDaDespesa(d)._id) : ''),
      render: (d) => {
        const c = d.virtual ? cartoes.cartoes.find((x) => String(x._id) === String(d.cartaoId)) : cartaoDaDespesa(d);
        return c ? (
          <Selo>
            <CategoriaPonto cor={c.cor} />
            {c.nome}
          </Selo>
        ) : (
          '—'
        );
      },
    },
    {
      chave: 'valor',
      label: 'Valor',
      alinhar: 'right',
      editor: 'number',
      render: (d) => <Money value={d.valor} tone="negative" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Despesas</h1>
        {/* Seletor de mês: mês anterior / próximo (e "Hoje"). */}
        <SeletorMes mes={mes} onChange={trocarMes} />
      </div>

      {/* Cartões de crédito: um card por cartão (fatura do mês e parte não detalhada, somada ao total). */}
      {!carregando && !erro && (
        <CartoesSecao
          mes={mes}
          situacoes={situacoes}
          cartoes={cartoes}
          aoAlterar={() => recarregar({ silencioso: true })}
        />
      )}

      {/* Andamento dos pagamentos: "X de Y pagas" + "Marcar todas como pagas" (com confirmação). */}
      {despesas.length > 0 && (
        <div className="space-y-2 rounded border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm">
              <span className="num font-medium">
                {qtdPagas} de {despesas.length}
              </span>{' '}
              <span className="text-muted">pagas</span>
            </p>
            {qtdPendentes > 0 && !confirmandoTodas && (
              <button
                type="button"
                onClick={() => setConfirmandoTodas(true)}
                className="min-h-[44px] rounded border border-border px-3 text-sm text-accent hover:opacity-80"
              >
                Marcar todas como pagas
              </button>
            )}
          </div>

          {/* Confirmação inline (melhor no celular que um diálogo do navegador). */}
          {confirmandoTodas && (
            <div role="alert" className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
              <span className="flex-1 basis-full sm:basis-auto">
                Marcar as {qtdPendentes} {qtdPendentes === 1 ? 'despesa pendente' : 'despesas pendentes'} deste mês como pagas?
              </span>
              <button
                type="button"
                onClick={marcarTodasPagas}
                className="min-h-[44px] flex-1 rounded bg-accent px-3 font-medium text-bg hover:opacity-90 sm:flex-none"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoTodas(false)}
                className="min-h-[44px] flex-1 rounded border border-border px-3 text-muted hover:text-fg sm:flex-none"
              >
                Cancelar
              </button>
            </div>
          )}
          {erroPaga && (
            <p role="alert" className="text-sm text-negative">
              {erroPaga}
            </p>
          )}
        </div>
      )}

      {/* Formulário — 1 coluna no mobile, 2 colunas a partir de `sm` e, em telas largas (`xl`,
          1280px+), UMA LINHA só: Descrição | Categoria | Cartão | Valor | Repete | Adicionar. */}
      <form
        onSubmit={adicionar}
        className="grid gap-3 rounded border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto] xl:items-center"
      >
        {/* Descrição ocupa a linha inteira no layout de 2 colunas. */}
        <input
          placeholder="Descrição"
          value={form.descricao}
          onChange={(e) => setCampo('descricao', e.target.value)}
          className={`${INPUT} sm:col-span-2 xl:col-span-1`}
          required
        />
        {/* Categorias do usuário com bolinha de cor; a última opção cria uma nova sem sair da tela. */}
        <SeletorCategoria
          valor={form.categoria}
          onChange={(nome) => setCampo('categoria', nome)}
          className="bg-surface"
        />
        {/* Cartão de crédito: "Nenhum", os cartões (bolinha de cor) e "+ Novo cartão" sem sair da tela. */}
        <SeletorCartao
          valor={form.cartaoId}
          onChange={(id) => setCampo('cartaoId', id)}
          cartoes={cartoes.cartoes}
          limite={cartoes.limite}
          criar={cartoes.criar}
          className="bg-surface"
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
        {/* Despesa fixa: o servidor a cria sozinho nos meses seguintes (ao abri-los), no mesmo cartão. */}
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 whitespace-nowrap text-base xl:px-2">
          <input
            type="checkbox"
            checked={form.recorrente}
            onChange={(e) => setCampo('recorrente', e.target.checked)}
            className="h-5 w-5 accent-accent"
          />
          Repete todo mês
        </label>
        {erroForm && <p className="text-sm text-negative sm:col-span-2 xl:col-span-full">{erroForm}</p>}
        <button
          disabled={salvando}
          className="min-h-[44px] rounded bg-accent px-4 font-medium text-bg hover:opacity-90 disabled:opacity-60 sm:col-span-2 xl:col-span-1 xl:px-6"
        >
          {salvando ? 'Salvando…' : 'Adicionar despesa'}
        </button>
      </form>

      {/* Aviso discreto da geração automática de fixos (some ao trocar de mês). */}
      {aviso && (
        <p role="status" className="text-sm text-muted">
          {aviso}
        </p>
      )}
      {/* Aviso discreto da propagação dos fixos (editar/excluir/ajuste único). */}
      {avisoFixos && (
        <p role="status" className="text-sm text-muted">
          ↻ {avisoFixos}
        </p>
      )}

      {/* Pergunta ao excluir um FIXO: só este mês (padrão) ou também os meses seguintes. */}
      {excluindoFixo && (
        <ConfirmarExclusaoFixo
          nome={excluindoFixo.descricao}
          ocupado={excluindo}
          onEscolher={excluirFixo}
          onCancelar={() => setExcluindoFixo(null)}
        />
      )}

      {/* Filtro rápido por cartão: "Todas" ou um cartão (as despesas dele + a linha calculada dele). */}
      {cartoes.cartoes.length > 0 && (despesas.length > 0 || linhasVirtuais.length > 0) && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar despesas por cartão">
          {[{ _id: '', nome: 'Todas' }, ...cartoes.cartoes].map((c) => {
            const ativo = filtroCartao === String(c._id);
            return (
              <button
                key={c._id || 'todas'}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltroCartao(String(c._id))}
                className={[
                  'inline-flex min-h-[44px] items-center gap-2 rounded border px-3 text-sm',
                  ativo ? 'border-accent text-accent' : 'border-border bg-surface text-muted hover:text-fg',
                ].join(' ')}
              >
                {c._id ? <CategoriaPonto cor={c.cor} /> : <IconeCartao size={14} />}
                {c.nome}
              </button>
            );
          })}
        </div>
      )}

      <ListaLancamentos
        colunas={colunas}
        itens={itensExibidos}
        // A linha calculada do cartão não se edita, exclui nem marca (o "paga" vem da fatura).
        somenteLeitura={(d) => Boolean(d.virtual)}
        getId={(d) => d._id}
        onExcluir={excluir}
        aoSalvarEdicao={salvarEdicao}
        // Caixa "paga" em cada despesa; paga = texto apagado (o valor continua visível).
        marca={{
          marcada: (d) => Boolean(d.paga),
          aoAlternar: alternarPaga,
          rotulo: (d) => (d.paga ? `Desmarcar ${d.descricao} como paga` : `Marcar ${d.descricao} como paga`),
          titulo: 'Paga',
        }}
        apagado={(d) => Boolean(d.paga)}
        // Total: valor maior (1,25x), negrito, vermelho — a linha é montada pelo <ListaLancamentos>.
        total={<Money value={total} tone="negative" className="text-lg font-bold" />}
        // Indicadores compactos na mesma linha de total: "Pago" (secundário) e "Falta pagar" (amarelo).
        // Só informativos (somam as despesas marcadas/não marcadas); o total acima não muda.
        totalExtra={
          <>
            <span className="whitespace-nowrap text-muted">
              Pago: <Money value={totalPago} className="font-medium" />
            </span>
            <span className="whitespace-nowrap text-accent">
              Falta pagar: <Money value={Math.max(0, total - totalPago)} className="font-medium" />
            </span>
          </>
        }
        vazio={filtroCartao ? 'Nenhuma despesa neste cartão neste mês.' : 'Nenhuma despesa neste mês.'}
        carregando={carregando}
        erro={erro}
      />

      {/* Gerenciar categorias (criar/editar/excluir). Renomear/excluir altera o nome gravado nas
          despesas, então a lista recarrega em segundo plano. */}
      <GerenciarCategorias aoAlterar={() => recarregar({ silencioso: true })} />
    </div>
  );
}
