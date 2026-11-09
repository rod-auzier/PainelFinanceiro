/**
 * Tela Porquinho (rota `/porquinho`, dentro do <Layout>): onde o dinheiro guardado está.
 *
 * O usuário cadastra CAIXINHAS — cada lugar onde guarda dinheiro, com nome e valor (ex.: "Caixinha
 * Nubank" R$ 10.000, "Carteira Binance" R$ 30.000). A soma delas substitui o antigo campo único
 * "Saldo inicial guardado" da aba Metas.
 *
 * Responsabilidades:
 *  - carregar, numa chamada só, as caixinhas E o total guardado (GET /api/caixinhas). Na 1ª vez,
 *    o servidor transforma o antigo saldo inicial numa caixinha "Saldo inicial" (o total não muda);
 *  - card "Total guardado" (<GuardadoCard>): total = soma das caixinhas + (receitas − despesas dos
 *    meses fechados), com a composição, a média mensal e o mês em andamento;
 *  - seção "Caixinhas": barra empilhada com a proporção de cada uma (<BarraCaixinhas>), lista da
 *    maior para a menor (<CaixinhaItem>, 2 colunas no desktop) com editar/excluir, formulário
 *    "Adicionar caixinha" (Enter também adiciona) e estado vazio amigável;
 *  - MÊS DE REFERÊNCIA dos saldos: seletor "Os valores das caixinhas são o saldo de: [mês]" (de
 *    out/2026 até o mês atual) → PATCH /api/caixinhas/referencia, que devolve o total recalculado.
 *    Os meses fechados ANTES da referência já estão nos valores e não são somados de novo;
 *  - ATUALIZAÇÃO OTIMISTA em criar, editar e excluir: a tela muda na hora e a API sincroniza; se a
 *    API falhar, volta ao estado anterior e mostra o erro. O total é DERIVADO da lista local
 *    (soma das caixinhas + resultado dos meses fechados), então acompanha cada mudança na hora.
 *
 * Responsivo: uma coluna no celular; botões e inputs com ≥ 44px; inputs em 16px (sem zoom no iOS).
 */
import { useMemo, useState } from 'react';
import { MES_INICIAL, deslocarMes, mesAtualDoPainel, rotuloMes, rotuloMesCurto } from '../lib/mes.js';
import { api } from '../services/api.js';
import { useRecurso } from '../hooks/useRecurso.js';
import GuardadoCard from '../components/GuardadoCard.jsx';
import BarraCaixinhas from '../components/BarraCaixinhas.jsx';
import CaixinhaItem from '../components/CaixinhaItem.jsx';
import {
  NOME_CAIXINHA_MAX,
  coresDasCaixinhas,
  ordenarCaixinhas,
  somarCaixinhas,
  validarCaixinha,
} from '../lib/caixinhas.js';

const INPUT =
  'min-h-[44px] w-full rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

const mensagemDeErro = (err, padrao) => err.response?.data?.message || padrao;

/** Meses que podem ser referência: de MES_INICIAL (out/2026) até o mês atual, do mais novo ao mais antigo. */
function mesesDeReferencia() {
  const lista = [];
  for (let m = mesAtualDoPainel(); m >= MES_INICIAL; m = deslocarMes(m, -1)) lista.push(m);
  return lista;
}

export default function Porquinho() {
  const [guardado, setGuardado] = useState(null); // total guardado (formato de GET /api/guardado)
  const [limite, setLimite] = useState(20);
  const { itens: caixinhas, setItens: setCaixinhas, carregando, erro, recarregar } = useRecurso(
    '/caixinhas',
    'caixinhas',
    (data) => {
      setGuardado(data.guardado);
      if (data.limite) setLimite(data.limite);
    },
  );

  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [salvandoReferencia, setSalvandoReferencia] = useState(false);
  const referencia = guardado?.caixinhasReferencia ?? MES_INICIAL; // mês em que os saldos foram conferidos

  /** Troca o mês de referência; o servidor devolve o total já recalculado (e as metas reavaliadas). */
  async function trocarReferencia(mes) {
    setErroAcao('');
    setSalvandoReferencia(true);
    try {
      const { data } = await api.patch('/caixinhas/referencia', { mes });
      setGuardado(data.guardado);
    } catch (err) {
      setErroAcao(mensagemDeErro(err, 'Não foi possível salvar o mês de referência.'));
    } finally {
      setSalvandoReferencia(false);
    }
  }

  // Derivados da lista local (seguem as mudanças otimistas na hora).
  const cores = useMemo(() => coresDasCaixinhas(caixinhas), [caixinhas]); // pela ordem de criação
  const ordenadas = useMemo(() => ordenarCaixinhas(caixinhas), [caixinhas]); // maior → menor
  const totalCaixinhas = useMemo(() => somarCaixinhas(caixinhas), [caixinhas]);
  const noLimite = caixinhas.length >= limite;

  /** Adiciona — OTIMISTA: entra na hora com um id provisório, trocado pelo real quando a API responde. */
  async function adicionar(e) {
    e.preventDefault();
    const r = validarCaixinha(nome, valor);
    if (r.erro) return setErroAcao(r.erro);
    if (noLimite) return setErroAcao(`Limite de ${limite} caixinhas atingido.`);

    setErroAcao('');
    const provisoria = { _id: `tmp-${Date.now()}`, nome: r.nome, valor: r.valor };
    setCaixinhas((lista) => [...lista, provisoria]);
    setNome('');
    setValor('');
    try {
      const { data } = await api.post('/caixinhas', { nome: r.nome, valor: r.valor });
      setCaixinhas((lista) => lista.map((c) => (c._id === provisoria._id ? data.caixinha : c)));
    } catch (err) {
      setCaixinhas((lista) => lista.filter((c) => c._id !== provisoria._id)); // desfaz
      setNome(r.nome); // devolve o que foi digitado, para tentar de novo
      setValor(String(r.valor));
      setErroAcao(mensagemDeErro(err, 'Não foi possível adicionar a caixinha.'));
    }
  }

  /** Edita nome/valor — OTIMISTA; se falhar, volta ao valor anterior e o erro aparece no item. */
  async function salvar(caixinha, dados) {
    setErroAcao('');
    setCaixinhas((lista) => lista.map((c) => (c._id === caixinha._id ? { ...c, ...dados } : c)));
    try {
      const { data } = await api.patch(`/caixinhas/${caixinha._id}`, dados);
      setCaixinhas((lista) => lista.map((c) => (c._id === caixinha._id ? data.caixinha : c)));
    } catch (err) {
      setCaixinhas((lista) => lista.map((c) => (c._id === caixinha._id ? caixinha : c)));
      throw err; // o <CaixinhaItem> continua em edição e mostra a mensagem
    }
  }

  /** Exclui (já confirmado) — OTIMISTA; se falhar, a caixinha volta à mesma posição. */
  async function excluir(caixinha) {
    setErroAcao('');
    const indice = caixinhas.findIndex((c) => c._id === caixinha._id);
    setCaixinhas((lista) => lista.filter((c) => c._id !== caixinha._id));
    try {
      await api.delete(`/caixinhas/${caixinha._id}`);
    } catch (err) {
      setCaixinhas((lista) => [...lista.slice(0, indice), caixinha, ...lista.slice(indice)]);
      setErroAcao(mensagemDeErro(err, 'Não foi possível excluir a caixinha.'));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Porquinho</h1>

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
      ) : (
        <>
          {/* Card principal: total guardado e composição. Se o servidor não conseguiu calcular o
              total (`guardado: null`), o card não aparece — as caixinhas continuam disponíveis. */}
          {guardado && <GuardadoCard guardado={guardado} totalCaixinhas={totalCaixinhas} />}

          {/* ---------------- Caixinhas ---------------- */}
          <section className="space-y-4 rounded border border-border bg-surface p-4 sm:p-5" aria-label="Caixinhas">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">Caixinhas</h2>
              <p className="text-xs text-muted">
                <span className="num">
                  {caixinhas.length} de {limite}
                </span>
              </p>
            </div>

            {/* Mês de referência dos saldos: meses fechados ANTES dele já estão nos valores. */}
            <div className="rounded border border-border bg-bg p-3">
              <label className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
                <span>Os valores das caixinhas são o saldo de:</span>
                <select
                  value={referencia}
                  disabled={salvandoReferencia || !guardado}
                  onChange={(e) => trocarReferencia(e.target.value)}
                  className="min-h-[44px] rounded border border-border bg-surface px-3 text-base capitalize text-fg focus:border-accent focus:outline-none disabled:opacity-60 sm:w-56"
                >
                  {mesesDeReferencia().map((m) => (
                    <option key={m} value={m}>
                      {rotuloMes(m)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-muted">
                Escolha o mês em que você conferiu estes saldos. Meses fechados antes dele já estão incluídos nos
                valores e não são somados de novo.
              </p>
            </div>

            {caixinhas.length === 0 ? (
              /* Estado vazio amigável */
              <div className="rounded border border-dashed border-border bg-bg p-6 text-center">
                <p className="font-medium">Nenhuma caixinha ainda</p>
                <p className="mt-1 text-sm text-muted">
                  Cadastre cada lugar onde você guarda dinheiro — uma conta, uma corretora, a carteira — e
                  o total guardado passa a somar todas elas.
                </p>
              </div>
            ) : (
              <>
                <BarraCaixinhas caixinhas={ordenadas} cores={cores} total={totalCaixinhas} />
                {/* Lista da maior para a menor: 1 coluna no celular, 2 no desktop (`lg`). */}
                <ul className="grid gap-2 lg:grid-cols-2 lg:items-start">
                  {ordenadas.map((c) => (
                    <CaixinhaItem
                      key={c._id}
                      caixinha={c}
                      cor={cores.get(c._id)}
                      onSalvar={salvar}
                      onExcluir={excluir}
                      lembrete={`Confira o mês de referência: os valores devem ser o saldo de ${rotuloMesCurto(referencia)}.`}
                      pendente={String(c._id).startsWith('tmp-')} // ainda sem id real
                    />
                  ))}
                </ul>
              </>
            )}

            {/* Formulário "Adicionar caixinha" — <form>: Enter em qualquer campo também adiciona. */}
            <form onSubmit={adicionar} className="space-y-2 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted">Adicionar caixinha</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Caixinha Nubank"
                  maxLength={NOME_CAIXINHA_MAX}
                  aria-label="Nome da caixinha"
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
                  aria-label="Valor da caixinha em reais"
                  className={`${INPUT} num sm:w-48 sm:shrink-0`}
                />
                <button
                  disabled={noLimite}
                  className="min-h-[44px] shrink-0 rounded bg-accent px-6 font-medium text-bg hover:opacity-90 disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>
              {noLimite && <p className="text-xs text-muted">Limite de {limite} caixinhas atingido.</p>}
            </form>

            {erroAcao && (
              <p role="alert" className="text-sm text-negative">
                {erroAcao}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
