/**
 * Tela de Resumo (rota `/resumo`, dentro do <Layout>).
 *
 * Só VISUAL: reaproveita os dados que a API já devolve (nada de rotas ou regras de cálculo
 * novas) e não exige preencher nada.
 *
 * Dados carregados ao abrir/trocar o mês:
 *  - GET /api/resumo?mes=AAAA-MM     → totais do mês (receitas, despesas, saldo);
 *  - GET /api/despesas?mes=AAAA-MM   → despesas do mês (rosca por categoria e "maiores");
 *  - GET /api/resumo?mes=<anterior>  → totais do mês anterior, para as comparações. Só é pedido
 *    quando existe mês anterior (nunca em outubro/2026 — MES_INICIAL) E o mês exibido já está
 *    FECHADO (anterior ao mês atual, fuso America/Fortaleza — `mesFechado` em lib/mes.js). No mês
 *    em andamento e nos futuros NÃO há comparação em nenhum card (o mês ainda não terminou, então
 *    comparar seria enganoso). Se a chamada falhar, as comparações simplesmente não aparecem.
 *
 * Layout:
 *  - cabeçalho com o seletor de mês — FIXO no topo no celular (sticky), com botões de 44px;
 *  - desktop (md+): card principal (saldo) em destaque no topo (2/3) com os cards de receitas
 *    e despesas ao lado (1/3); abaixo, em duas colunas, a rosca com a lista de categorias e as
 *    5 maiores despesas;
 *  - celular: tudo em UMA coluna, sem rolagem horizontal.
 *
 * No card de despesas, "Pago / Falta pagar" + barra fina (campos `totalPago` e `faltaPagar` de
 * GET /api/resumo; só informativo, o saldo usa todas as despesas).
 *
 * Componentes: ResumoSaldoCard, ResumoTotalCard, CategoriasDonut, MaioresDespesas.
 * Aviso discreto "N fixos adicionados" quando o servidor gerou os fixos do mês ao abri-lo.
 *
 * Não recebe props. Autenticação já garantida pelo <Layout>.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { brl } from '../lib/format.js';
import { useMesSelecionado } from '../hooks/useMesSelecionado.js';
import { MES_INICIAL, deslocarMes, mensagemFixosGerados, mesFechado, nomeDoMes } from '../lib/mes.js';
import CategoriasDonut from '../components/CategoriasDonut.jsx';
import MaioresDespesas from '../components/MaioresDespesas.jsx';
import ResumoSaldoCard from '../components/ResumoSaldoCard.jsx';
import ResumoTotalCard from '../components/ResumoTotalCard.jsx';
import SeletorMes from '../components/SeletorMes.jsx';

export default function Resumo() {
  const [mes, setMes] = useMesSelecionado();
  const [resumo, setResumo] = useState(null); // { totalReceitas, totalDespesas, saldo }
  const [anterior, setAnterior] = useState(null); // totais do mês anterior (ou null)
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
        // Comparação só em mês FECHADO e que tenha anterior (o painel começa em MES_INICIAL, então
        // outubro/2026 nunca tem). Mês em andamento/futuro → sem mês anterior → cards sem a linha.
        const mesAnterior = mes > MES_INICIAL && mesFechado(mes) ? deslocarMes(mes, -1) : null;
        const [r1, r2, r3] = await Promise.all([
          api.get(`/resumo?mes=${mes}`),
          api.get(`/despesas?mes=${mes}`),
          // Falha no mês anterior não derruba a tela: só some a comparação.
          mesAnterior ? api.get(`/resumo?mes=${mesAnterior}`).catch(() => null) : Promise.resolve(null),
        ]);
        // O aviso só é ligado (nunca apagado por uma resposta posterior com 0 — o React em
        // desenvolvimento roda este efeito duas vezes) e só se ainda estamos no mesmo mês.
        // As DUAS chamadas do mês abrem-no e podem gerar fixos (/resumo gera receitas e
        // despesas; /despesas gera as despesas) — somamos o que cada uma criou. (O resumo do
        // mês anterior não entra: o aviso é só do mês exibido.)
        const geradosAgora = (r1.data.fixosGerados ?? 0) + (r2.data.fixosGerados ?? 0);
        if (geradosAgora > 0 && mesAtualRef.current === mes) {
          if (geradosRef.current.mes !== mes) geradosRef.current = { mes, total: 0 };
          geradosRef.current.total += geradosAgora;
          setAviso(mensagemFixosGerados(geradosRef.current.total));
        }
        if (!ativo) return;
        setResumo(r1.data);
        // As linhas virtuais "Outras compras no cartão (nome)" (parte não detalhada de cada fatura,
        // categoria "Outros") entram na rosca e nas maiores despesas, como no total do Resumo.
        setDespesas([...(r2.data.despesas ?? []), ...(r2.data.linhasVirtuais ?? [])]);
        setAnterior(r3 ? r3.data : null);
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

  // O cabeçalho com o seletor de mês fica SEMPRE visível (também durante o carregamento), para
  // não "piscar" ao trocar de mês. No celular ele é FIXO no topo (sticky) enquanto se rola a
  // página; a margem negativa faz o fundo ocupar a largura toda. A partir de `md` volta ao normal.
  const cabecalho = (
    <div
      className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-2
                 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0"
    >
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

  const nomeAnterior = nomeDoMes(mes, -1);

  return (
    <div className="space-y-6">
      {cabecalho}

      {/* Aviso discreto quando o servidor gerou os fixos do mês ao abri-lo. */}
      {aviso && (
        <p role="status" className="text-sm text-muted">
          {aviso}
        </p>
      )}

      {/* Topo: card principal (2/3) + receitas e despesas (1/3). No celular, uma coluna.
          Em telas largas (`lg`, 1024px+) vira uma grade de 12 colunas: saldo 8 + cards 4. */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-12">
        <div className="md:col-span-2 lg:col-span-8">
          <ResumoSaldoCard mes={mes} resumo={resumo} anterior={anterior} />
        </div>

        <div className="grid gap-4 lg:col-span-4">
          <ResumoTotalCard
            tipo="receita"
            valor={resumo.totalReceitas}
            anterior={anterior ? anterior.totalReceitas : null}
            nomeAnterior={nomeAnterior}
          />
          <ResumoTotalCard
            tipo="despesa"
            valor={resumo.totalDespesas}
            anterior={anterior ? anterior.totalDespesas : null}
            nomeAnterior={nomeAnterior}
            // Pago / falta pagar (informativo; o total acima continua somando TODAS as despesas).
            pagamento={{ pago: resumo.totalPago ?? 0, faltaPagar: resumo.faltaPagar ?? resumo.totalDespesas }}
            // Total já CORRIGIDO pelos cartões: avisa quanto dele veio das partes não detalhadas das faturas.
            nota={
              resumo.outrasComprasCartao > 0
                ? `inclui ${brl(resumo.outrasComprasCartao)} de outras compras nos cartões`
                : resumo.cartaoExcedeu
                  ? 'despesas de cartão passam do total de uma fatura informada'
                  : undefined
            }
          />
        </div>
      </div>

      {/* Abaixo, em duas colunas no desktop (6 + 6 de 12): rosca + lista | maiores despesas. */}
      <div className="grid gap-4 md:grid-cols-2">
        <CategoriasDonut despesas={despesas} />
        <MaioresDespesas despesas={despesas} />
      </div>
    </div>
  );
}
