/**
 * PREVISÃO das metas — "No ritmo atual, chega em mar/2027".
 *
 * Funções PURAS (sem rede nem estado). O CÁLCULO fica no servidor (services/metas.js); aqui só o texto.
 *
 * Base: a MÉDIA MENSAL GUARDADA que o servidor calcula (média de receitas − despesas dos
 * meses FECHADOS, sem o mês atual — ver server/src/services/guardado.js).
 *
 * Conta, para uma meta com valor ainda não atingido:
 *   faltam   = valorAlvo − saldo acompanhado   (PONTO DE PARTIDA: a caixinha da meta, ou o total
 *                                               guardado = soma das caixinhas)
 *   meses    = ceil(faltam ÷ média)            (RITMO: média dos meses fechados)
 *   previsão = mês atual + meses
 * Mesmo que a média cubra o que falta em 1 mês, a previsão é o mês seguinte ao atual (nunca o atual).
 */
// Meses abreviados em pt-BR, fixos (toLocaleString varia com o navegador e põe ponto: "mar.").
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2027-03" → "mar/2027". */
export function rotuloMesAbreviado(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return `${MESES_CURTOS[m - 1]}/${ano}`;
}

/**
 * Texto curto da PREVISÃO de uma meta (ou `null` para não mostrar nada). A conta é feita no SERVIDOR
 * (server/src/services/metas.js — `acompanhamento.previsao` de cada meta); aqui só vira texto:
 *   { tipo: 'data', mes: '2027-03' }                   → "No ritmo atual, chega em mar/2027"
 *   { tipo: 'data', mes: '2027-03', aproximada: true } → "No ritmo atual, chega em ~mar/2027 (aproximada)"
 *   { tipo: 'sem-previsao' }                           → "Sem previsão no ritmo atual"
 * A previsão é APROXIMADA nas metas ligadas a uma caixinha: o ritmo é a média do painel inteiro, não
 * daquela caixinha.
 * @param {null | { tipo: string, mes?: string, aproximada?: boolean }} previsao
 */
export function textoPrevisao(previsao) {
  if (!previsao) return null;
  if (previsao.tipo === 'sem-previsao') return 'Sem previsão no ritmo atual';
  const til = previsao.aproximada ? '~' : '';
  return `No ritmo atual, chega em ${til}${rotuloMesAbreviado(previsao.mes)}${previsao.aproximada ? ' (aproximada)' : ''}`;
}
