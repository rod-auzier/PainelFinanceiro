/**
 * PREVISÃO das metas — "No ritmo atual, chega em mar/2027".
 *
 * Funções PURAS (sem rede nem estado); a tela só chama `textoPrevisao` para cada meta.
 *
 * Base: a MÉDIA MENSAL GUARDADA que o servidor calcula (média de receitas − despesas dos
 * meses FECHADOS, sem o mês atual — ver server/src/services/guardado.js).
 *
 * Conta, para uma meta com valor ainda não atingido:
 *   faltam   = valorAlvo − total guardado
 *   meses    = ceil(faltam ÷ média)
 *   previsão = mês atual + meses
 * O total guardado só cresce quando um mês FECHA, então o primeiro fechamento é o mês atual + 1:
 * se a média cobrir o que falta em 1 mês, a previsão é o mês seguinte ao atual (nunca o atual).
 */
import { deslocarMes } from './mes.js';

// Meses abreviados em pt-BR, fixos (toLocaleString varia com o navegador e põe ponto: "mar.").
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2027-03" → "mar/2027". */
export function rotuloMesAbreviado(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return `${MESES_CURTOS[m - 1]}/${ano}`;
}

/**
 * Calcula a previsão de UMA meta.
 *
 * @param   {{ valorAlvo: number|null, concluida: boolean }} meta
 * @param   {{ total: number, mediaMensal: number|null, mesesFechados: number,
 *            emAndamento: { mes: string } | null } | null} guardado  dados de GET /api/guardado
 * @returns {null | { tipo: 'sem-previsao' } | { tipo: 'data', mes: string, meses: number }}
 *   - `null`            → não mostra nada: meta sem valor, já concluída/atingida, dados ausentes ou
 *                          nenhum mês fechado ainda (sem base para estimar);
 *   - `sem-previsao`    → a média é zero ou negativa: no ritmo atual a meta não chega;
 *   - `data`            → `mes` ("AAAA-MM") em que o total deve alcançar o alvo e `meses` a partir do atual.
 */
export function previsaoMeta(meta, guardado) {
  const alvo = meta.valorAlvo;
  if (typeof alvo !== 'number' || alvo <= 0) return null; // sem valor: só checklist
  if (meta.concluida) return null; // já atingida
  if (!guardado || !guardado.emAndamento) return null; // sem dados / painel ainda não começou
  if (!guardado.mesesFechados || guardado.mediaMensal == null) return null; // nenhum mês fechado

  const faltam = alvo - guardado.total;
  if (faltam <= 0) return null; // o total já alcançou o alvo (o servidor conclui a meta em seguida)

  if (guardado.mediaMensal <= 0) return { tipo: 'sem-previsao' };

  const meses = Math.ceil(faltam / guardado.mediaMensal); // ≥ 1, pois faltam > 0
  return { tipo: 'data', mes: deslocarMes(guardado.emAndamento.mes, meses), meses };
}

/**
 * Texto curto da previsão (ou `null` para não mostrar nada).
 * Ex.: "No ritmo atual, chega em mar/2027" / "Sem previsão no ritmo atual".
 */
export function textoPrevisao(meta, guardado) {
  const p = previsaoMeta(meta, guardado);
  if (!p) return null;
  if (p.tipo === 'sem-previsao') return 'Sem previsão no ritmo atual';
  return `No ritmo atual, chega em ${rotuloMesAbreviado(p.mes)}`;
}
