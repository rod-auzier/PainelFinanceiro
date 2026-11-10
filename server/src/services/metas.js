/**
 * SITUAÇÃO DAS METAS — cálculo ÚNICO (backend) do que cada meta acompanha, do progresso e da previsão.
 *
 * O QUE A META ACOMPANHA
 *   - `Meta.caixinhaId` preenchido E a caixinha existe (do MESMO usuário) → o SALDO DESSA CAIXINHA;
 *   - senão (campo ausente/null, ou a caixinha foi excluída) → o TOTAL GUARDADO (soma das caixinhas,
 *     services/guardado.js). Metas antigas, sem o campo, continuam assim — nada é migrado nem reescrito;
 *     um `caixinhaId` que não existe mais é tratado como null NA LEITURA, sem erro.
 *
 * AS CONTAS (por meta com valor)
 *   saldoAtual = caixinha ? valor da caixinha : total guardado
 *   progresso  = min(max(saldoAtual ÷ valorAlvo, 0), 1)                 (a barra vai até 100%)
 *   previsão   = mês atual + ceil((valorAlvo − saldoAtual) ÷ média guardada por mês)
 *     → a MESMA média que as Metas já usavam (média de receitas − despesas dos meses fechados). Sem mês
 *       fechado: sem previsão; média ≤ 0: "Sem previsão no ritmo atual"; meta concluída ou já atingida:
 *       sem previsão. Para meta ligada a uma CAIXINHA a previsão é marcada como APROXIMADA, porque a média
 *       é do painel inteiro, não daquela caixinha.
 *
 * Usado por: GET/POST/PATCH /api/metas (resposta com `acompanhamento`) e pela conclusão automática
 * (services/guardado.js → sincronizarMetas), para a barra e a conclusão nunca divergirem.
 * Isolamento: as caixinhas são sempre lidas filtrando pelo `userId`.
 */
import { Caixinha } from '../models/Caixinha.js';

/** Soma `n` meses a "AAAA-MM". */
function somarMeses(mes, n) {
  const [ano, m] = mes.split('-').map(Number);
  const total = ano * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Caixinhas do usuário, na ordem de criação (a mesma da aba Porquinho — define as cores na tela).
 * @returns {Promise<Array<{ _id, nome, valor }>>}
 */
export function caixinhasDoUsuario(userId) {
  return Caixinha.find({ userId }).sort({ createdAt: 1, _id: 1 }).select('nome valor').lean();
}

/**
 * Saldo que UMA meta acompanha: o valor da caixinha vinculada (se ainda existir) ou o total guardado.
 * @param {{ caixinhaId?: unknown }} meta
 * @param {number} totalGuardado
 * @param {Map<string, { _id, nome, valor }>} porId  caixinhas do usuário indexadas pelo id
 * @returns {{ saldoAtual: number, caixinha: null | { _id: string, nome: string } }}
 */
export function saldoDaMeta(meta, totalGuardado, porId) {
  const caixinha = meta.caixinhaId ? porId.get(String(meta.caixinhaId)) : null;
  if (!caixinha) return { saldoAtual: totalGuardado, caixinha: null }; // sem vínculo (ou caixinha excluída)
  return { saldoAtual: Number(caixinha.valor) || 0, caixinha: { _id: String(caixinha._id), nome: caixinha.nome } };
}

/**
 * Previsão de UMA meta (ver regras no topo).
 * @returns {null | { tipo: 'sem-previsao', aproximada: boolean } | { tipo: 'data', mes: string, meses: number, aproximada: boolean }}
 */
function previsaoDaMeta(meta, saldoAtual, guardado, aproximada) {
  const alvo = meta.valorAlvo;
  if (typeof alvo !== 'number' || alvo <= 0) return null; // sem valor: só checklist
  if (meta.concluida) return null; // já concluída
  if (!guardado?.emAndamento) return null; // painel ainda não começou / sem dados
  if (!guardado.mesesFechados || guardado.mediaMensal == null) return null; // sem mês fechado: sem base
  const faltam = alvo - saldoAtual;
  if (faltam <= 0) return null; // já atingida (a conclusão automática marca em seguida)
  if (guardado.mediaMensal <= 0) return { tipo: 'sem-previsao', aproximada };
  const meses = Math.ceil(faltam / guardado.mediaMensal); // ≥ 1
  return { tipo: 'data', mes: somarMeses(guardado.emAndamento.mes, meses), meses, aproximada };
}

/**
 * Situação completa de UMA meta — o objeto `acompanhamento` que a API devolve em cada meta.
 * @returns {{ caixinha: null | { _id, nome }, saldoAtual: number, progresso: number | null, previsao: object | null }}
 *          `progresso` (0–1) é `null` em meta sem valor.
 */
export function situacaoDaMeta(meta, guardado, porId) {
  const total = guardado?.total ?? 0;
  const { saldoAtual, caixinha } = saldoDaMeta(meta, total, porId);
  const alvo = meta.valorAlvo;
  const progresso = typeof alvo === 'number' && alvo > 0 ? Math.max(0, Math.min(saldoAtual / alvo, 1)) : null;
  return { caixinha, saldoAtual, progresso, previsao: previsaoDaMeta(meta, saldoAtual, guardado, Boolean(caixinha)) };
}

/**
 * Prepara metas para a resposta da API: cada uma ganha `acompanhamento` e o `caixinhaId` "limpo"
 * (`null` quando a caixinha vinculada não existe mais).
 * @param {Array} metas   documentos Mongoose ou objetos
 * @param {object|null} guardado  resultado de calcularGuardado (pode ser null se o cálculo falhou)
 * @param {Array} caixinhas  caixinhas do usuário (caixinhasDoUsuario)
 */
export function metasComAcompanhamento(metas, guardado, caixinhas) {
  const porId = new Map(caixinhas.map((c) => [String(c._id), c]));
  return metas.map((m) => {
    const obj = typeof m.toObject === 'function' ? m.toObject() : { ...m };
    const acompanhamento = situacaoDaMeta(obj, guardado, porId);
    return { ...obj, caixinhaId: acompanhamento.caixinha?._id ?? null, acompanhamento };
  });
}
