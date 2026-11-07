/**
 * Tela de Receitas (rota `/receitas`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - mostrar as receitas do MÊS selecionado (seletor ‹ mês › no topo →
 *    GET /api/receitas?mes=AAAA-MM via useRecurso);
 *  - criar receita (POST /api/receitas) com Fonte, Descrição, Valor e o
 *    checkbox "Repete todo mês" (`recorrente`). A receita é lançada no mês
 *    selecionado (`mes` no body);
 *  - "Copiar fixos do mês anterior" (POST /api/receitas/copiar-fixos): copia
 *    para o mês selecionado as receitas recorrentes do mês anterior, sem
 *    duplicar as que já existem, e avisa quantas foram copiadas;
 *  - editar receita inline (PUT /api/receitas/:id) — a validação em
 *    `salvarEdicao` repete a do formulário de criação. É por aqui que se
 *    ajusta o valor de uma receita fixa copiada;
 *  - excluir receita (DELETE /api/receitas/:id);
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
import { mensagemCopiaFixos } from '../lib/mes.js';
import Money from '../components/Money.jsx';
import ListaLancamentos from '../components/ListaLancamentos.jsx';
import SeletorMes from '../components/SeletorMes.jsx';

const FORM_VAZIO = { fonte: '', descricao: '', valor: '', recorrente: false };
const INPUT =
  'min-h-[44px] rounded border border-border bg-surface px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

export default function Receitas() {
  const [mes, setMes] = useMesSelecionado();
  const { itens: receitas, carregando, erro, recarregar } = useRecurso(
    `/receitas?mes=${mes}`,
    'receitas',
  );
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [copiando, setCopiando] = useState(false);
  const [aviso, setAviso] = useState('');

  const total = useMemo(
    () => receitas.reduce((soma, r) => soma + Number(r.valor || 0), 0),
    [receitas],
  );

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function trocarMes(novo) {
    setAviso('');
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

  /** Copia as receitas fixas do mês anterior para o mês selecionado. */
  async function copiarFixos() {
    setAviso('');
    setCopiando(true);
    try {
      const { data } = await api.post('/receitas/copiar-fixos', { mes });
      setAviso(mensagemCopiaFixos(data));
      await recarregar();
    } catch (err) {
      setAviso(err.response?.data?.message || 'Não foi possível copiar os fixos.');
    } finally {
      setCopiando(false);
    }
  }

  async function excluir(id) {
    await api.delete(`/receitas/${id}`);
    recarregar();
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
    await api.put(`/receitas/${id}`, {
      fonte,
      descricao: (rascunho.descricao ?? '').trim(),
      valor: valorNum,
      recorrente: Boolean(rascunho.recorrente),
    });
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

      {/* Formulário — 1 coluna no mobile, 2 colunas a partir de `sm`. */}
      <form
        onSubmit={adicionar}
        className="grid gap-3 rounded border border-border bg-surface p-4 sm:grid-cols-2"
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
          className={`${INPUT} sm:col-span-2`}
        />
        {/* Receita fixa: entra em "Copiar fixos do mês anterior". */}
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base sm:col-span-2">
          <input
            type="checkbox"
            checked={form.recorrente}
            onChange={(e) => setCampo('recorrente', e.target.checked)}
            className="h-5 w-5 accent-accent"
          />
          Repete todo mês
        </label>
        {erroForm && <p className="text-sm text-negative sm:col-span-2">{erroForm}</p>}
        <button
          disabled={salvando}
          className="min-h-[44px] rounded bg-accent px-4 font-medium text-bg hover:opacity-90 disabled:opacity-60 sm:col-span-2"
        >
          {salvando ? 'Salvando…' : 'Adicionar receita'}
        </button>
      </form>

      {/* Copiar fixos do mês anterior + mensagem com o resultado. */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={copiarFixos}
          disabled={copiando}
          className="min-h-[44px] w-full rounded border border-border px-4 text-sm text-fg hover:border-accent hover:text-accent disabled:opacity-60 sm:w-auto"
        >
          {copiando ? 'Copiando…' : 'Copiar fixos do mês anterior'}
        </button>
        {aviso && (
          <p role="status" className="text-sm text-muted">
            {aviso}
          </p>
        )}
      </div>

      <ListaLancamentos
        colunas={colunas}
        itens={receitas}
        getId={(r) => r._id}
        onExcluir={excluir}
        aoSalvarEdicao={salvarEdicao}
        total={<Money value={total} tone="positive" className="font-medium" />}
        vazio="Nenhuma receita neste mês."
        carregando={carregando}
        erro={erro}
      />
    </div>
  );
}
