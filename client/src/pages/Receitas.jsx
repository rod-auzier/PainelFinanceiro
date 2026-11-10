/**
 * Tela de Receitas (rota `/receitas`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - mostrar as receitas do MÊS selecionado (seletor ‹ mês › no topo →
 *    GET /api/receitas?mes=AAAA-MM via useRecurso);
 *  - criar receita (POST /api/receitas) com Fonte, Descrição, Valor e o
 *    checkbox "Repete todo mês" (`recorrente`). A receita é lançada no mês
 *    selecionado (`mes` no body);
 *  - FIXOS AUTOMÁTICOS: ao abrir um mês, o servidor cria sozinho (e sem duplicar) as
 *    receitas recorrentes ("Repete todo mês") do mês anterior — só até o mês atual; meses
 *    futuros não geram nada. A tela mostra um aviso discreto com quantas foram
 *    adicionadas ("N fixos adicionados"); depois é só editar o que mudou;
 *  - editar receita inline (PUT /api/receitas/:id) — a validação em
 *    `salvarEdicao` repete a do formulário de criação. É por aqui que se
 *    ajusta o valor de uma receita fixa copiada;
 *  - excluir receita (DELETE /api/receitas/:id). Se for FIXA, pergunta antes (<ConfirmarExclusaoFixo>):
 *    só este mês (padrão) ou também os meses seguintes (`?escopo=seguintes`);
 *  - PROPAGAÇÃO DOS FIXOS: editar uma receita fixa aplica fonte, descrição e "Repete todo mês" também
 *    aos meses SEGUINTES (no servidor, na mesma operação; o valor não). A tela só mostra o aviso
 *    discreto "Aplicado também a N meses seguintes";
 *  - exibir o total do mês.
 *
 * Responsivo (breakpoint `sm` / `md`, padrões do Tailwind):
 *  - formulário: 1 coluna no mobile, 2 colunas a partir de `sm` (640px);
 *  - lista: cards empilhados no mobile, tabela a partir de `md` — feito
 *    pelo <ListaLancamentos>.
 * Inputs em `text-base` (16px) para não disparar zoom automático no iOS;
 * botões com altura mínima de 44px.
 */
import { useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { useMesSelecionado } from '../hooks/useMesSelecionado.js';
import { mensagemFixosGerados } from '../lib/mes.js';
import Money from '../components/Money.jsx';
import ConfirmarExclusaoFixo from '../components/ConfirmarExclusaoFixo.jsx';
import ListaLancamentos from '../components/ListaLancamentos.jsx';
import SeletorMes from '../components/SeletorMes.jsx';

const FORM_VAZIO = { fonte: '', descricao: '', valor: '', recorrente: false };
const INPUT =
  'min-h-[44px] rounded border border-border bg-surface px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

export default function Receitas() {
  const [mes, setMes] = useMesSelecionado();
  const [aviso, setAviso] = useState(''); // "N fixos adicionados" (geração automática)
  const { itens: receitas, carregando, erro, recarregar } = useRecurso(
    `/receitas?mes=${mes}`,
    'receitas',
    // A API informa quantos fixos criou ao abrir o mês; só mostramos quando > 0.
    (data) => {
      if (data.fixosGerados > 0) setAviso(mensagemFixosGerados(data.fixosGerados));
    },
  );
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const total = useMemo(
    () => receitas.reduce((soma, r) => soma + Number(r.valor || 0), 0),
    [receitas],
  );

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function trocarMes(novo) {
    setAviso('');
    setAvisoFixos('');
    setExcluindoFixo(null);
    setMes(novo);
  }

  async function adicionar(e) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      await api.post('/receitas', {
        fonte: form.fonte,
        descricao: form.descricao,
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
    const item = receitas.find((x) => x._id === id);
    if (item?.recorrente) {
      setExcluindoFixo(item);
      return;
    }
    await api.delete(`/receitas/${id}`);
    recarregar();
  }

  /** Exclui o fixo com o escopo escolhido; avisa quantos meses seguintes também saíram. */
  async function excluirFixo(escopo) {
    const item = excluindoFixo;
    setExcluindo(true);
    try {
      const { data } = await api.delete(`/receitas/${item._id}`, { params: escopo === 'seguintes' ? { escopo } : {} });
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
   * Salva a edição inline de uma receita.
   * Mesma validação do formulário de criação (fonte obrigatória, valor
   * numérico ≥ 0). Lança Error com mensagem em caso de problema — o
   * <ListaLancamentos> exibe a mensagem na própria linha.
   */
  async function salvarEdicao(id, rascunho) {
    const fonte = (rascunho.fonte ?? '').trim();
    const valorNum = Number(rascunho.valor);
    if (!fonte) throw new Error('Fonte é obrigatória.');
    if (rascunho.valor === '' || Number.isNaN(valorNum) || valorNum < 0) {
      throw new Error('Valor deve ser um número maior ou igual a zero.');
    }
    const { data } = await api.put(`/receitas/${id}`, {
      fonte,
      descricao: (rascunho.descricao ?? '').trim(),
      valor: valorNum,
      recorrente: Boolean(rascunho.recorrente),
    });
    // O servidor já levou a mudança às receitas fixas dos meses seguintes (menos o valor).
    setAvisoFixos(data.propagadas > 0 ? `Aplicado também a ${mesesSeguintes(data.propagadas)}.` : '');
    await recarregar();
  }

  const colunas = [
    { chave: 'fonte', label: 'Fonte', editor: 'text' },
    { chave: 'descricao', label: 'Descrição', classe: 'text-muted', editor: 'text' },
    {
      chave: 'recorrente',
      label: 'Fixo',
      classe: 'text-muted',
      editor: 'checkbox',
      render: (r) => (r.recorrente ? <span className="text-accent">↻ Todo mês</span> : '—'),
    },
    {
      chave: 'valor',
      label: 'Valor',
      alinhar: 'right',
      editor: 'number',
      render: (r) => <Money value={r.valor} tone="positive" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Receitas</h1>
        {/* Seletor de mês: mês anterior / próximo (e "Hoje"). */}
        <SeletorMes mes={mes} onChange={trocarMes} />
      </div>

      {/* Formulário — 1 coluna no mobile, 2 colunas a partir de `sm` e, em telas largas (`xl`,
          1280px+), UMA LINHA só: Fonte | Valor | Descrição | Repete | Adicionar. As colunas de
          texto dividem o espaço (fr) e "Repete"/botão têm a largura do conteúdo (auto). */}
      <form
        onSubmit={adicionar}
        className="grid gap-3 rounded border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_auto_auto] xl:items-center"
      >
        <input
          placeholder="Fonte"
          value={form.fonte}
          onChange={(e) => setCampo('fonte', e.target.value)}
          className={INPUT}
          required
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
        {/* Descrição ocupa a linha inteira no layout de 2 colunas. */}
        <input
          placeholder="Descrição (opcional)"
          value={form.descricao}
          onChange={(e) => setCampo('descricao', e.target.value)}
          className={`${INPUT} sm:col-span-2 xl:col-span-1`}
        />
        {/* Receita fixa: o servidor a cria sozinho nos meses seguintes (ao abri-los). */}
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
          {salvando ? 'Salvando…' : 'Adicionar receita'}
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
          nome={excluindoFixo.fonte}
          ocupado={excluindo}
          onEscolher={excluirFixo}
          onCancelar={() => setExcluindoFixo(null)}
        />
      )}

      <ListaLancamentos
        colunas={colunas}
        itens={receitas}
        getId={(r) => r._id}
        onExcluir={excluir}
        aoSalvarEdicao={salvarEdicao}
        // Total: valor maior (1,25x), negrito, verde — a linha é montada pelo <ListaLancamentos>.
        total={<Money value={total} tone="positive" className="text-lg font-bold" />}
        vazio="Nenhuma receita neste mês."
        carregando={carregando}
        erro={erro}
      />
    </div>
  );
}
