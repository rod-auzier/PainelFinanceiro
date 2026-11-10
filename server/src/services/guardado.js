/**
 * "Total guardado" e conclusão automática das Metas.
 *
 * REGRA DO TOTAL GUARDADO (única fonte: `calcularGuardado`, usada por Porquinho e Metas)
 *   TOTAL GUARDADO = Σ valores das CAIXINHAS do usuário (aba Porquinho). SÓ ISSO.
 *   As caixinhas são o dinheiro realmente guardado (o usuário atualiza os valores ao conferir os
 *   saldos), então o resultado dos meses (receitas − despesas) NÃO é somado — senão contaria de novo
 *   o que já está nelas. Fechar um mês não muda o total.
 *   (O campo `User.caixinhasReferencia`, de uma regra anterior, ficou LEGADO: continua no banco mas
 *   não é lido. As caixinhas substituíram o antigo "saldo inicial guardado" — transição em
 *   services/caixinhas.js.)
 *
 * RESULTADO DOS MESES (só INFORMATIVO, fora do total)
 *   Mês fechado = de MES_INICIAL (outubro/2026) até o mês ANTERIOR ao mês atual; "hoje" é a data em
 *   America/Fortaleza (utils/mes.js → mesAtual), nunca a do servidor. As despesas de cada mês vêm
 *   CORRIGIDAS pelo cartão de crédito (services/cartao.js → totalDespesasCorrigido), igual ao Resumo.
 *   `saldoAcumulado` (meses fechados) alimenta a MÉDIA; `emAndamento` é o parcial do mês atual.
 *
 * MÉDIA MENSAL GUARDADA (o RITMO da PREVISÃO das metas)
 *   média = (receitas − despesas dos meses FECHADOS) ÷ quantidade de meses fechados — ou seja,
 *   a média de (receitas − despesas) por mês fechado (o mês atual não entra; fuso America/Fortaleza).
 *   A previsão parte do TOTAL GUARDADO (soma das caixinhas) e avança nesse ritmo. Sem nenhum mês fechado não há média (`null`). A API
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
import { garantirMigracaoCaixinhas, somarCaixinhas } from './caixinhas.js';
import { garantirFixosAteMesAtual } from './fixos.js';
import { somarMesesFechados, somarValor } from './totais.js';
import { totalDespesasCorrigido } from './cartao.js';
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
 *   totalCaixinhas: number,
 *   saldoAcumulado: number,
 *   total: number,
 *   mesesFechados: number,
 *   mediaMensal: number | null,
 *   emAndamento: null | { mes: string, receitas: number, despesas: number, saldo: number, entraEm: string }
 * }>}
 *   - `totalCaixinhas` = soma dos valores das caixinhas;
 *   - `total`          = o TOTAL GUARDADO = totalCaixinhas (só isso; nada dos meses é somado);
 *   - `saldoAcumulado` = receitas − despesas dos meses FECHADOS (INFORMATIVO, fora do total; base da média);
 *   - `mesesFechados`  = quantos meses fechados existem (de MES_INICIAL ao mês anterior ao atual; 0 no 1º mês);
 *   - `mediaMensal`    = saldoAcumulado ÷ mesesFechados (média guardada por mês; negativa se gastou
 *                        mais do que recebeu), ou `null` quando `mesesFechados` é 0;
 *   - `emAndamento`    = resultado parcial do mês atual (informativo, fora do total): `mes` ("AAAA-MM"),
 *                        `receitas`, `despesas`, `saldo` e `entraEm` (data "AAAA-MM-DD" em que passa a
 *                        entrar: dia 1 do mês seguinte). `null` se o painel ainda não começou (hoje <
 *                        MES_INICIAL).
 */
export async function calcularGuardado(userId, hoje = mesAtual()) {
  await garantirFixosAteMesAtual(userId, hoje);
  await garantirMigracaoCaixinhas(userId); // 1ª vez: saldo inicial antigo → caixinha "Saldo inicial"

  const painelComecou = hoje >= MES_INICIAL;
  const [somaCaixinhas, receitasFechadas, despesasFechadas, receitasMes, despesasMes] = await Promise.all([
    somarCaixinhas(userId),
    somarMesesFechados(Receita, userId, hoje),
    // Despesas CORRIGIDAS pelo cartão (mesma função do Resumo): meses fechados = de MES_INICIAL até o
    // mês atual (exclusivo). Sem mês fechado ainda, 0.
    hoje > MES_INICIAL ? totalDespesasCorrigido(userId, { desde: MES_INICIAL, ate: hoje }).then((d) => d.total) : 0,
    painelComecou ? somarValor(Receita, userId, hoje) : 0,
    painelComecou ? totalDespesasCorrigido(userId, { mes: hoje }).then((d) => d.total) : 0,
  ]);

  const totalCaixinhas = arredondar(somaCaixinhas);
  const saldoAcumulado = arredondar(receitasFechadas - despesasFechadas);
  // Meses fechados: de MES_INICIAL (inclusive) até o mês atual (exclusive). 0 em outubro/2026.
  const mesesFechados = mesesEntre(MES_INICIAL, hoje);
  const mediaMensal = mesesFechados > 0 ? arredondar(saldoAcumulado / mesesFechados) : null;

  return {
    totalCaixinhas,
    saldoAcumulado,
    // REGRA: total guardado = soma das caixinhas. O resultado dos meses NÃO entra (já está nas caixinhas).
    total: totalCaixinhas,
    mesesFechados,
    mediaMensal,
    emAndamento: painelComecou
      ? {
          mes: hoje,
          receitas: arredondar(receitasMes),
          despesas: arredondar(despesasMes),
          saldo: arredondar(receitasMes - despesasMes),
          entraEm: `${mesSeguinte(hoje)}-01`, // dia em que o mês fecha (passa a contar na média)
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
