/**
 * Tela de Resumo (rota `/resumo`, dentro do <Layout>).
 *
 * Responsabilidades:
 *  - mostrar o resumo do MÊS selecionado (seletor ‹ mês › no topo): totais
 *    do backend (GET /api/resumo?mes=AAAA-MM);
 *  - buscar as despesas do mesmo mês (GET /api/despesas?mes=AAAA-MM) para o gráfico;
 *  - destacar o **Saldo Final** como elemento visual principal (número grande,
 *    card `size="hero"`), com Total de Receitas e Total de Despesas como
 *    cards secundários menores ao lado;
 *  - indicador Superávit (verde, `saldo >= 0`) / Déficit (vermelho, `< 0`),
 *    exibido dentro do card do Saldo Final;
 *  - renderizar <DespesasPorCategoriaChart>.
 *
 * Não recebe props. Autenticação já garantida pelo <Layout>.
 * Cores/tipografia: tokens do tema (ver `src/index.css`).
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useMesSelecionado } from '../hooks/useMesSelecionado.js';
import { mensagemFixosGerados } from '../lib/mes.js';
import SeletorMes from '../components/SeletorMes.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import DespesasPorCategoriaChart from '../components/DespesasPorCategoriaChart.jsx';

export default function Resumo() {
  const [mes, setMes] = useMesSelecionado();
  const [resumo, setResumo] = useState(null); // { totalReceitas, totalDespesas, saldo }
  const [despesas, setDespesas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState(''); // "N fixos adicionados" (geração automática ao abrir o mês)
  const mesAtualRef = useRef(mes); // mês exibido agora (para não mostrar aviso de outro mês)
  mesAtualRef.current = mes;
  // Fixos gerados no mês exibido, SOMADOS entre respostas: duas requisições simultâneas (ex.:
  // dois aparelhos) dividem a geração — uma cria as receitas e a outra as despesas.
  const geradosRef = useRef({ mes: null, total: 0 });

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          api.get(`/resumo?mes=${mes}`),
          api.get(`/despesas?mes=${mes}`),
        ]);
        // O aviso só é ligado (nunca apagado por uma resposta posterior com 0 — o React em
        // desenvolvimento roda este efeito duas vezes) e só se ainda estamos no mesmo mês.
        // As DUAS chamadas abrem o mês e podem gerar fixos (/resumo gera receitas e despesas;
        // /despesas gera as despesas) — somamos o que cada uma criou.
        const geradosAgora = (r1.data.fixosGerados ?? 0) + (r2.data.fixosGerados ?? 0);
        if (geradosAgora > 0 && mesAtualRef.current === mes) {
          if (geradosRef.current.mes !== mes) geradosRef.current = { mes, total: 0 };
          geradosRef.current.total += geradosAgora;
          setAviso(mensagemFixosGerados(geradosRef.current.total));
        }
        if (!ativo) return;
        setResumo(r1.data);
        setDespesas(r2.data.despesas ?? []);
      } catch (err) {
        if (ativo) setErro(err.response?.data?.message || 'Falha ao carregar o resumo.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [mes]);

  // O cabeçalho com o seletor de mês fica SEMPRE visível (também durante o
  // carregamento), para não "piscar" ao trocar de mês.
  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-semibold">Resumo</h1>
      <SeletorMes
        mes={mes}
        onChange={(novo) => {
          setAviso(''); // o aviso é do mês que foi aberto; some ao trocar de mês
          setMes(novo);
        }}
      />
    </div>
  );

  if (carregando || erro || !resumo) {
    return (
      <div className="space-y-6">
        {cabecalho}
        {erro ? <p className="text-negative">{erro}</p> : <p className="text-muted">Carregando…</p>}
      </div>
    );
  }

  const superavit = resumo.saldo >= 0;

  return (
    <div className="space-y-6">
      {cabecalho}

      {/* Aviso discreto quando o servidor gerou os fixos do mês ao abri-lo. */}
      {aviso && (
        <p role="status" className="text-sm text-muted">
          {aviso}
        </p>
      )}

      {/* Saldo Final em destaque (2/3) + cards secundários (1/3) */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <SummaryCard titulo="Saldo Final" value={resumo.saldo} tone="auto" size="hero">
            {/* Indicador Superávit / Déficit */}
            <span
              className={`text-sm font-medium ${superavit ? 'text-positive' : 'text-negative'}`}
            >
              {superavit ? '▲ Superávit' : '▼ Déficit'}
            </span>
          </SummaryCard>
        </div>

        <div className="grid gap-4">
          <SummaryCard titulo="Total de Receitas" value={resumo.totalReceitas} tone="positive" />
          <SummaryCard titulo="Total de Despesas" value={resumo.totalDespesas} tone="negative" />
        </div>
      </div>

      {/* Gráfico */}
      <div className="rounded border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-muted">Despesas por categoria</h2>
        <DespesasPorCategoriaChart despesas={despesas} />
      </div>
    </div>
  );
}
