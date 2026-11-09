/**
 * "Total guardado" e conclusão automática das Metas.
 *
 * REGRA DOS MESES FECHADOS + MÊS DE REFERÊNCIA DAS CAIXINHAS
 *   TOTAL GUARDADO = Σ valores das CAIXINHAS do usuário (aba Porquinho)
 *                  + Σ (receitas − despesas) de cada mês FECHADO com mês ≥ REFERÊNCIA
 *   REFERÊNCIA = `User.caixinhasReferencia` ("AAAA-MM"): o mês em que o usuário conferiu os saldos das
 *   caixinhas. Os meses fechados ANTES dela já estão dentro desses valores e NÃO são somados de novo.
 *   Padrão MES_INICIAL (2026-10) — quem nunca escolheu fica exatamente como antes.
 *   Ex.: referência 2026-11 e caixinha de R$ 3.870 → total R$ 3.870 em novembro; em 01/12 entra o
 *   resultado de novembro.
 *   As despesas de cada mês já vêm CORRIGIDAS pelo cartão de crédito (fatura informada − parte já
 *   detalhada; ver services/cartao.js -> totalDespesasCorrigido), igual ao Resumo.
 *   (As caixinhas substituíram o antigo campo único "saldo inicial guardado"; a transição é feita
 *   em services/caixinhas.js, antes de somar, para o total não mudar.)
 *   Mês fechado = de MES_INICIAL (outubro/2026) até o mês ANTERIOR ao mês atual. O mês
 *   atual (em andamento) e os futuros NÃO entram. Exemplo: hoje é 07/11/2026 → só
 *   outubro conta; novembro passa a entrar em 01/12/2026, dezembro em 01/01/2027…
 *   "Hoje" é a data em America/Fortaleza (utils/mes.js → mesAtual), nunca a do servidor.
 *   O resultado PARCIAL do mês em andamento é devolvido à parte (`emAndamento`) só para
 *   a tela mostrar — ele ainda não está somado ao total.
 *
 * MÉDIA MENSAL GUARDADA (base da PREVISÃO das metas)
 *   NÃO depende da referência: usa o histórico de TODOS os meses fechados desde MES_INICIAL (a
 *   previsão, porém, parte do total acima, que depende dela).
 *   média = (receitas − despesas dos meses FECHADOS) ÷ quantidade de meses fechados — ou seja,
 *   a média de (receitas − despesas) por mês fechado, com a MESMA regra do total (o mês atual
 *   não entra; fuso America/Fortaleza). Sem nenhum mês fechado não há média (`null`). A API
 *   devolve também `mesesFechados` (a "base" da média) para a tela dizer em quantos meses ela se
 *   apoia — com 1 só, a estimativa é fraca. A previsão em si ("chega em mar/2027") é calculada
 *   na tela (client/src/lib/previsao.js) a partir desses números.
 *
 * Antes de somar, garante que os fixos de todos os meses até o mês atual já foram
 * gerados (services/fixos.js) — senão o total mudaria só depois de abrir cada mês e o
 * parcial do mês atual ficaria sem os recorrentes.
 *
 * CONCLUSÃO AUTOMÁTICA: quando o total guardado atinge o `valorAlvo` de uma
 * meta, ela é marcada como concluída sozinha — sem impedir o usuário de
 * marcar/desmarcar à mão. Para isso usamos a flag interna `alvoAtingido`:
 *   1) meta com alvo, `alvoAtingido: false` e total ≥ alvo  → `concluida: true`
 *      e `alvoAtingido: true` (dispara UMA vez);
 *   2) meta com `alvoAtingido: true` e total < alvo         → `alvoAtingido: false`
 *      (rearma, para disparar de novo se o total voltar a subir). A meta NÃO é
 *      desmarcada automaticamente.
 * Como a flag continua `true` depois do disparo, se o usuário desmarcar a meta
 * à mão ela NÃO é remarcada na próxima sincronização.
 *
 * Isolamento: tudo é filtrado por `userId`.
 */
import { Receita } from '../models/Receita.js';
import { Meta } from '../models/Meta.js';
import { User } from '../models/User.js';
import { garantirMigracaoCaixinhas, somarCaixinhas } from './caixinhas.js';
import { garantirFixosAteMesAtual } from './fixos.js';
import { somarComFiltro, somarMesesFechados, somarValor } from './totais.js';
import { totalDespesasCorrigido } from './cartao.js';
import { MES_INICIAL, limitesDoMes, mesAtual, mesSeguinte, mesValido, mesesEntre } from '../utils/mes.js';

/** Arredonda para centavos (evita 4999.999999… em somas de ponto flutuante). */
export const arredondar = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Mês de REFERÊNCIA das caixinhas de um usuário (o mês em que os saldos foram conferidos).
 * Usuários que nunca escolheram (campo ausente) ou com valor inválido → MES_INICIAL, o que mantém o
 * total exatamente como era antes desta regra.
 * @param   {{ caixinhasReferencia?: string } | null} usuario
 * @returns {string} "AAAA-MM"
 */
export function referenciaDasCaixinhas(usuario) {
  const ref = usuario?.caixinhasReferencia;
  return ref && mesValido(ref) && ref >= MES_INICIAL ? ref : MES_INICIAL;
}

/**
 * Calcula o total guardado do usuário (só MESES FECHADOS) e o parcial do mês em andamento,
 * gerando antes os fixos pendentes até o mês atual.
 *
 * @param   {string} userId
 * @param   {string} [hoje]  mês atual "AAAA-MM" (padrão: `mesAtual()`, fuso America/Fortaleza).
 *                           Parâmetro para testes.
 * @returns {Promise<{
 *   totalCaixinhas: number,
 *   caixinhasReferencia: string,
 *   saldoAcumulado: number,
 *   saldoHistorico: number,
 *   total: number,
 *   mesesFechados: number,
 *   mediaMensal: number | null,
 *   emAndamento: null | { mes: string, receitas: number, despesas: number, saldo: number, entraEm: string }
 * }>}
 *   - `saldoAcumulado` = receitas − despesas dos meses FECHADOS a partir da REFERÊNCIA (inclusive) até o
 *                        mês anterior ao atual — o que se soma às caixinhas;
 *   - `saldoHistorico` = receitas − despesas de TODOS os meses fechados desde MES_INICIAL (base da média);
 *   - `caixinhasReferencia` = o mês de referência das caixinhas ("AAAA-MM");
 *   - `totalCaixinhas` = soma dos valores das caixinhas (antes: o "saldo inicial guardado");
 *   - `total`          = totalCaixinhas + saldoAcumulado (o mês em andamento NÃO está incluído);
 *   - `mesesFechados`  = quantos meses fechados existem (de MES_INICIAL ao mês anterior ao atual; 0 no 1º mês);
 *   - `mediaMensal`    = saldoHistorico ÷ mesesFechados (média guardada por mês; negativa se gastou
 *                        mais do que recebeu), ou `null` quando `mesesFechados` é 0;
 *   - `emAndamento`    = resultado parcial do mês atual, que ainda NÃO está no total: `mes` ("AAAA-MM"),
 *                        `receitas`, `despesas`, `saldo` e `entraEm` (data "AAAA-MM-DD" em que passa a
 *                        entrar: dia 1 do mês seguinte). `null` se o painel ainda não começou (hoje <
 *                        MES_INICIAL).
 */
export async function calcularGuardado(userId, hoje = mesAtual()) {
  await garantirFixosAteMesAtual(userId, hoje);
  await garantirMigracaoCaixinhas(userId); // 1ª vez: saldo inicial antigo → caixinha "Saldo inicial"

  const painelComecou = hoje >= MES_INICIAL;
  const usuario = await User.findById(userId).select('caixinhasReferencia').lean();
  const referencia = referenciaDasCaixinhas(usuario);

  /**
   * Resultado (receitas − despesas CORRIGIDAS pelo cartão, a mesma função do Resumo) dos meses
   * FECHADOS a partir de `desde` (inclusive) até o mês atual (exclusivo). 0 se não há mês fechado.
   */
  const resultadoFechadosDesde = async (desde) => {
    if (desde >= hoje) return 0; // nenhum mês fechado a partir de `desde`
    const [receitas, despesas] = await Promise.all([
      desde === MES_INICIAL
        ? somarMesesFechados(Receita, userId, hoje)
        : somarComFiltro(Receita, userId, {
            createdAt: { $gte: limitesDoMes(desde).inicio, $lt: limitesDoMes(hoje).inicio },
          }),
      totalDespesasCorrigido(userId, { desde, ate: hoje }).then((d) => d.total),
    ]);
    return receitas - despesas;
  };

  const [somaCaixinhas, historico, desdeReferencia, receitasMes, despesasMes] = await Promise.all([
    somarCaixinhas(userId),
    // Todos os meses fechados desde MES_INICIAL: base da MÉDIA (não depende da referência).
    resultadoFechadosDesde(MES_INICIAL),
    // Só os meses fechados a partir da REFERÊNCIA: o que soma ao total (os anteriores já estão nas
    // caixinhas). Com a referência em MES_INICIAL é o mesmo valor — não consulta de novo.
    referencia === MES_INICIAL ? null : resultadoFechadosDesde(referencia),
    painelComecou ? somarValor(Receita, userId, hoje) : 0,
    painelComecou ? totalDespesasCorrigido(userId, { mes: hoje }).then((d) => d.total) : 0,
  ]);

  const totalCaixinhas = arredondar(somaCaixinhas);
  const saldoHistorico = arredondar(historico);
  const saldoAcumulado = arredondar(desdeReferencia ?? historico);
  // Meses fechados: de MES_INICIAL (inclusive) até o mês atual (exclusive). 0 em outubro/2026.
  const mesesFechados = mesesEntre(MES_INICIAL, hoje);
  const mediaMensal = mesesFechados > 0 ? arredondar(saldoHistorico / mesesFechados) : null;

  return {
    totalCaixinhas,
    caixinhasReferencia: referencia,
    saldoAcumulado,
    saldoHistorico,
    total: arredondar(totalCaixinhas + saldoAcumulado),
    mesesFechados,
    mediaMensal,
    emAndamento: painelComecou
      ? {
          mes: hoje,
          receitas: arredondar(receitasMes),
          despesas: arredondar(despesasMes),
          saldo: arredondar(receitasMes - despesasMes),
          entraEm: `${mesSeguinte(hoje)}-01`, // o mês em andamento entra no total no dia 1 do mês seguinte
        }
      : null,
  };
}

/**
 * Aplica a conclusão automática (e o rearme) nas metas do usuário.
 * @param   {string} userId
 * @param   {number} total  total guardado já calculado (ver `calcularGuardado`)
 * @returns {Promise<void>}
 */
export async function sincronizarMetas(userId, total) {
  // 1) Alvo alcançado agora → conclui e marca que o gatilho já disparou.
  await Meta.updateMany(
    { userId, valorAlvo: { $gt: 0, $lte: total }, alvoAtingido: false },
    { $set: { concluida: true, alvoAtingido: true } },
  );

  // 2) Total caiu abaixo do alvo → rearma o gatilho (sem desmarcar a meta).
  await Meta.updateMany(
    { userId, valorAlvo: { $gt: total }, alvoAtingido: true },
    { $set: { alvoAtingido: false } },
  );
}

/**
 * Atalho: calcula o total guardado (meses fechados), sincroniza as metas e devolve o resultado.
 * @param   {string} userId
 * @param   {string} [hoje]  mês atual "AAAA-MM" (padrão: `mesAtual()`); parâmetro para testes.
 */
export async function calcularESincronizar(userId, hoje = mesAtual()) {
  const guardado = await calcularGuardado(userId, hoje);
  await sincronizarMetas(userId, guardado.total);
  return guardado;
}
