/**
 * Tela de Despesas (rota `/despesas`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - mostrar as despesas do MÊS selecionado (seletor ‹ mês › no topo →
 *    GET /api/despesas?mes=AAAA-MM via useRecurso);
 *  - criar despesa (POST /api/despesas) com Descrição, Categoria, Valor e o
 *    checkbox "Repete todo mês" (`recorrente`). A despesa é lançada no mês
 *    selecionado (`mes` no body). Categoria é um <select> de CATEGORIAS_DESPESA;
 *  - FIXOS AUTOMÁTICOS: ao abrir um mês, o servidor cria sozinho (e sem duplicar) as
 *    despesas recorrentes ("Repete todo mês") do mês anterior — só até o mês atual; meses
 *    futuros não geram nada. A tela mostra um aviso discreto com quantas foram
 *    adicionadas ("N fixos adicionados"); depois é só editar o que mudou;
 *  - editar despesa inline (PUT /api/despesas/:id) — a validação em
 *    `salvarEdicao` repete a do formulário de criação. É por aqui que se
 *    ajusta o valor de uma conta fixa copiada (ex.: a conta de luz);
 *  - excluir despesa (DELETE /api/despesas/:id);
 *  - MARCAR COMO PAGA: caixa de marcação grande em cada despesa (<CaixaCheck>, mesmo estilo das
 *    Metas; verde quando marcada). Atualização OTIMISTA: marca na hora e sincroniza com
 *    PATCH /api/despesas/:id (se falhar, desfaz e avisa). Paga = texto levemente apagado, valor
 *    continua visível. É só informativo: total e saldo contam TODAS as despesas. Fixos gerados
 *    automaticamente entram sempre como não pagos; editar não muda o status;
 *  - no topo, "X de Y pagas" e o botão "Marcar todas como pagas" (com confirmação), que age só
 *    nas pendentes do mês selecionado (PATCH /api/despesas/pagas);
 *  - exibir o total do mês.
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
import { CATEGORIAS_DESPESA } from '../lib/constants.js';
import Money from '../components/Money.jsx';
import ListaLancamentos from '../components/ListaLancamentos.jsx';
import CategoriaPonto from '../components/CategoriaPonto.jsx';
import SeletorMes from '../components/SeletorMes.jsx';

const FORM_VAZIO = { descricao: '', categoria: 'Outros', valor: '', recorrente: false };
const INPUT =
  'min-h-[44px] rounded border border-border bg-surface px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

export default function Despesas() {
  const [mes, setMes] = useMesSelecionado();
  const [aviso, setAviso] = useState(''); // "N fixos adicionados" (geração automática)
  const { itens: despesas, setItens: setDespesas, carregando, erro, recarregar } = useRecurso(
    `/despesas?mes=${mes}`,
    'despesas',
    // A API informa quantos fixos criou ao abrir o mês; só mostramos quando > 0.
    (data) => {
      if (data.fixosGerados > 0) setAviso(mensagemFixosGerados(data.fixosGerados));
    },
  );
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [confirmandoTodas, setConfirmandoTodas] = useState(false); // pergunta "marcar todas?" aberta
  const [erroPaga, setErroPaga] = useState(''); // falha ao sincronizar o status "paga"

  const total = useMemo(
    () => despesas.reduce((soma, d) => soma + Number(d.valor || 0), 0),
    [despesas],
  );
  // Andamento dos pagamentos do mês (só informativo; não altera o total).
  const qtdPagas = despesas.filter((d) => d.paga).length;
  const qtdPendentes = despesas.length - qtdPagas;
  // Soma das despesas pagas (só para os indicadores "Pago / Falta pagar" da linha de total).
  const totalPago = useMemo(
    () => despesas.reduce((soma, d) => soma + (d.paga ? Number(d.valor || 0) : 0), 0),
    [despesas],
  );

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function trocarMes(novo) {
    setAviso('');
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

  async function excluir(id) {
    await api.delete(`/despesas/${id}`);
    recarregar();
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
    await api.put(`/despesas/${id}`, {
      descricao,
      categoria: rascunho.categoria || 'Outros',
      valor: valorNum,
      recorrente: Boolean(rascunho.recorrente),
    });
    await recarregar();
  }

  const colunas = [
    { chave: 'descricao', label: 'Descrição', editor: 'text' },
    {
      chave: 'categoria',
      label: 'Categoria',
      classe: 'text-muted',
      editor: 'select',
      opcoes: CATEGORIAS_DESPESA,
      // Bolinha com a cor FIXA da categoria (a mesma da rosca do Resumo).
      render: (d) => (
        <span className="inline-flex items-center gap-2">
          <CategoriaPonto categoria={d.categoria} />
          {d.categoria}
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
          1280px+), UMA LINHA só: Descrição | Categoria | Valor | Repete | Adicionar. */}
      <form
        onSubmit={adicionar}
        className="grid gap-3 rounded border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto] xl:items-center"
      >
        {/* Descrição ocupa a linha inteira no layout de 2 colunas. */}
        <input
          placeholder="Descrição"
          value={form.descricao}
          onChange={(e) => setCampo('descricao', e.target.value)}
          className={`${INPUT} sm:col-span-2 xl:col-span-1`}
          required
        />
        <select
          value={form.categoria}
          onChange={(e) => setCampo('categoria', e.target.value)}
          className={INPUT}
        >
          {CATEGORIAS_DESPESA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
        {/* Despesa fixa: o servidor a cria sozinho nos meses seguintes (ao abri-los). */}
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 whitespace-nowrap text-base sm:col-span-2 xl:col-span-1 xl:px-2">
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

      <ListaLancamentos
        colunas={colunas}
        itens={despesas}
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
        vazio="Nenhuma despesa neste mês."
        carregando={carregando}
        erro={erro}
      />
    </div>
  );
}
