/**
 * Tela de Receitas (rota `/receitas`, dentro do <Layout>) — mesma ESTRUTURA visual de Despesas, montada
 * com as peças compartilhadas de components/PaginaLancamentos.jsx (só apresentação):
 *
 *  ┌ Cabeçalho ──────────────────────────────────────────────────────────────────────────┐
 *  │ "Receitas" + "Novembro de 2026 · em andamento"       [mês ▾]  Hoje  [+ Nova receita] │
 *  └──────────────────────────────────────────────────────────────────────────────────────┘
 *  [faixa do formulário — recolhida; abre com "+ Nova receita", Esc fecha]
 *  ┌ Lista (1fr, ~760px) ──────────────────┐ ┌ Painel lateral (340px) ┐
 *  │ Salário ↻               R$ 4.255,00   │ │ RECEITAS DO MÊS         │
 *  │ Trabalho                              │ │ Fixas / Avulsas         │
 *  │ Total                    R$ 4.255,00  │ └─────────────────────────┘
 *  └──────────────────────────────────────┘
 *  - Contêiner único `.container-pagina` (até 1120px, centralizado — o mesmo de Despesas).
 *  - A partir de `lg` (1024px de tela): lista + painel lado a lado; abaixo, coluna única com o painel
 *    em cima da lista e o formulário com campos empilhados.
 *
 * O QUE A TELA FAZ (regras iguais às de antes):
 *  - receitas do MÊS selecionado (GET /api/receitas?mes=AAAA-MM); ao abrir um mês o servidor gera as
 *    receitas fixas ("Repete todo mês") e a tela avisa quantas ("N fixos adicionados");
 *  - criar (POST) pela faixa "+ Nova receita": Fonte | Valor | Descrição (opcional) | Repete todo mês.
 *    Depois de adicionar, limpa os campos e a faixa continua aberta;
 *  - editar na própria linha (PUT; uma receita fixa propaga fonte, descrição e "Repete todo mês" aos
 *    meses SEGUINTES no servidor — o valor não —, com o aviso "Aplicado também a N meses seguintes");
 *  - excluir (DELETE; fixa pergunta "só este mês / este e os meses seguintes");
 *  - total do mês no rodapé da lista e no painel "Receitas do mês" (com a divisão fixas / avulsas).
 * Inputs em 16px (sem zoom no iOS); botões com área de toque confortável.
 */
import { useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import { useMesSelecionado } from '../hooks/useMesSelecionado.js';
import { mensagemFixosGerados } from '../lib/mes.js';
import ConfirmarExclusaoFixo from '../components/ConfirmarExclusaoFixo.jsx';
import ListaReceitas from '../components/ListaReceitas.jsx';
import ReceitasMesCard from '../components/ReceitasMesCard.jsx';
// Layout compartilhado com Despesas: cabeçalho, faixa do formulário e corpo (lista + painel).
import {
  BotoesFaixa,
  CabecalhoPagina,
  CAMPO_FAIXA as INPUT,
  CorpoComPainel,
  FaixaFormulario,
} from '../components/PaginaLancamentos.jsx';

const FORM_VAZIO = { fonte: '', descricao: '', valor: '', recorrente: false };

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
  const [formAberto, setFormAberto] = useState(false); // faixa "+ Nova receita" (recolhida por padrão)

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
   * <ListaReceitas> exibe a mensagem na própria linha.
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

  return (
    // CONTÊINER ÚNICO da página (`.container-pagina` em index.css: até 1120px, centralizado — o mesmo
    // de Despesas), envolvendo cabeçalho, faixa do formulário e corpo.
    <div className="container-pagina space-y-5">
      {/* Cabeçalho (compartilhado): título + situação do mês | [mês ▾] Hoje [+ Nova receita]. */}
      <CabecalhoPagina
        titulo="Receitas"
        mes={mes}
        onTrocarMes={trocarMes}
        rotuloNovo="+ Nova receita"
        formAberto={formAberto}
        onAlternarForm={() => setFormAberto((v) => !v)}
      />

      {/* Faixa do formulário (recolhida até "+ Nova receita"). Uma linha no desktop largo:
          Fonte | Valor | Descrição (opcional) | Repete todo mês | Adicionar. No celular, empilhada. */}
      {formAberto && (
        <FaixaFormulario
          rotulo="Nova receita"
          onSubmit={adicionar}
          onFechar={() => setFormAberto(false)}
          classeGrade="sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_auto_auto] xl:items-center"
        >
          <input
            placeholder="Fonte"
            value={form.fonte}
            onChange={(e) => setCampo('fonte', e.target.value)}
            className={INPUT}
            autoFocus
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
          <input
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setCampo('descricao', e.target.value)}
            className={`${INPUT} sm:col-span-2 xl:col-span-1`}
          />
          {/* Receita fixa: o servidor a cria sozinho nos meses seguintes (ao abri-los). */}
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 whitespace-nowrap text-sm xl:px-1">
            <input
              type="checkbox"
              checked={form.recorrente}
              onChange={(e) => setCampo('recorrente', e.target.checked)}
              className="h-5 w-5 accent-accent"
            />
            Repete todo mês
          </label>
          <BotoesFaixa salvando={salvando} onFechar={() => setFormAberto(false)} className="xl:col-span-1" />
          {erroForm && <p className="text-sm text-negative sm:col-span-2 xl:col-span-full">{erroForm}</p>}
        </FaixaFormulario>
      )}

      {/* Avisos discretos: fixos gerados ao abrir o mês e propagação dos fixos. */}
      {(aviso || avisoFixos) && (
        <div className="space-y-1 text-sm text-muted" role="status">
          {aviso && <p>{aviso}</p>}
          {avisoFixos && <p>↻ {avisoFixos}</p>}
        </div>
      )}

      {/* Corpo (compartilhado): lista (1fr, ~760px) + painel lateral (340px). */}
      <CorpoComPainel
        rotuloPainel="Receitas do mês"
        painel={<ReceitasMesCard receitas={receitas} />}
        lista={
          <ListaReceitas
            itens={receitas}
            total={total}
            carregando={carregando}
            erro={erro}
            onExcluir={excluir}
            aoSalvarEdicao={salvarEdicao}
          />
        }
      />

      {/* Pergunta ao excluir uma receita FIXA: só este mês (padrão) ou também os meses seguintes. */}
      {excluindoFixo && (
        <ConfirmarExclusaoFixo
          nome={excluindoFixo.fonte}
          ocupado={excluindo}
          onEscolher={excluirFixo}
          onCancelar={() => setExcluindoFixo(null)}
        />
      )}
    </div>
  );
}
