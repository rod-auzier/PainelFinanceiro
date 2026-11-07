/**
 * "Total guardado" e conclusão automática das Metas.
 *
 * REGRA DOS MESES FECHADOS
 *   TOTAL GUARDADO = saldo inicial guardado (campo do usuário)
 *                  + Σ (receitas − despesas) de cada mês FECHADO
 *   Mês fechado = de MES_INICIAL (outubro/2026) até o mês ANTERIOR ao mês atual. O mês
 *   atual (em andamento) e os futuros NÃO entram. Exemplo: hoje é 07/11/2026 → só
 *   outubro conta; novembro passa a entrar em 01/12/2026, dezembro em 01/01/2027…
 *   "Hoje" é a data em America/Fortaleza (utils/mes.js → mesAtual), nunca a do servidor.
 *   O resultado PARCIAL do mês em andamento é devolvido à parte (`emAndamento`) só para
 *   a tela mostrar — ele ainda não está somado ao total.
 *
 * MÉDIA MENSAL GUARDADA (base da PREVISÃO das metas)
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
import { Despesa } from '../models/Despesa.js';
import { Meta } from '../models/Meta.js';
import { User } from '../models/User.js';
import { garantirFixosAteMesAtual } from './fixos.js';
import { somarMesesFechados, somarValor } from './totais.js';
import { MES_INICIAL, mesAtual, mesSeguinte, mesesEntre } from '../utils/mes.js';

/** Arredonda para centavos (evita 4999.999999… em somas de ponto flutuante). */
export const arredondar = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Calcula o total guardado do usuário (só MESES FECHADOS) e o parcial do mês em andamento,
 * gerando antes os fixos pendentes até o mês atual.
 *
 * @param   {string} userId
 * @param   {string} [hoje]  mês atual "AAAA-MM" (padrão: `mesAtual()`, fuso America/Fortaleza).
 *                           Parâmetro para testes.
 * @returns {Promise<{
 *   saldoInicial: number,
 *   saldoAcumulado: number,
 *   total: number,
 *   mesesFechados: number,
 *   mediaMensal: number | null,
 *   emAndamento: null | { mes: string, receitas: number, despesas: number, saldo: number, entraEm: string }
 * }>}
 *   - `saldoAcumulado` = receitas − despesas dos meses FECHADOS (de MES_INICIAL ao mês anterior ao atual);
 *   - `total`          = saldoInicial + saldoAcumulado (o mês em andamento NÃO está incluído);
 *   - `mesesFechados`  = quantos meses fechados existem (de MES_INICIAL ao mês anterior ao atual; 0 no 1º mês);
 *   - `mediaMensal`    = saldoAcumulado ÷ mesesFechados (média guardada por mês; negativa se gastou
 *                        mais do que recebeu), ou `null` quando `mesesFechados` é 0;
 *   - `emAndamento`    = resultado parcial do mês atual, que ainda NÃO está no total: `mes` ("AAAA-MM"),
 *                        `receitas`, `despesas`, `saldo` e `entraEm` (data "AAAA-MM-DD" em que passa a
 *                        entrar: dia 1 do mês seguinte). `null` se o painel ainda não começou (hoje <
 *                        MES_INICIAL).
 */
export async function calcularGuardado(userId, hoje = mesAtual()) {
  await garantirFixosAteMesAtual(userId, hoje);

  const painelComecou = hoje >= MES_INICIAL;
  const [usuario, receitasFechadas, despesasFechadas, receitasMes, despesasMes] = await Promise.all([
    User.findById(userId).select('saldoInicial'),
    somarMesesFechados(Receita, userId, hoje),
    somarMesesFechados(Despesa, userId, hoje),
    painelComecou ? somarValor(Receita, userId, hoje) : 0,
    painelComecou ? somarValor(Despesa, userId, hoje) : 0,
  ]);

  const saldoInicial = arredondar(usuario?.saldoInicial ?? 0);
  const saldoAcumulado = arredondar(receitasFechadas - despesasFechadas);
  // Meses fechados: de MES_INICIAL (inclusive) até o mês atual (exclusive). 0 em outubro/2026.
  const mesesFechados = mesesEntre(MES_INICIAL, hoje);
  const mediaMensal = mesesFechados > 0 ? arredondar(saldoAcumulado / mesesFechados) : null;

  return {
    saldoInicial,
    saldoAcumulado,
    total: arredondar(saldoInicial + saldoAcumulado),
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
