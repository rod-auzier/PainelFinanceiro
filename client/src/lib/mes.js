/**
 * Helpers de MÊS ("AAAA-MM") usados pelo seletor de mês e pelas telas.
 * O mês de um lançamento é o mês do seu `createdAt` (ver server/src/utils/mes.js).
 */

/**
 * MES_INICIAL — primeiro mês em que o painel "existe" ("AAAA-MM").
 *
 * É a ÚNICA definição desse limite no frontend: o seletor de mês bloqueia a seta
 * "anterior" neste mês e o hook do mês selecionado nunca sai dele. O backend tem a
 * sua própria cópia em server/src/utils/mes.js (e recusa meses anteriores) —
 * mantenha as duas iguais ao mudar.
 */
export const MES_INICIAL = '2026-10';

const doisDigitos = (n) => String(n).padStart(2, '0');

/** Mês de hoje no formato "AAAA-MM" (horário local do navegador). */
export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
}

/** Garante que um mês não seja anterior a MES_INICIAL (devolve MES_INICIAL se for). */
export function limitarAoInicio(mes) {
  return mes < MES_INICIAL ? MES_INICIAL : mes;
}

/** "Hoje" do painel: o mês atual, mas nunca antes de MES_INICIAL. */
export function mesAtualDoPainel() {
  return limitarAoInicio(mesAtual());
}

/** Soma `delta` meses (pode ser negativo) a um "AAAA-MM". */
export function deslocarMes(mes, delta) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
}

/** Rótulo legível: "2026-11" → "novembro de 2026". */
export function rotuloMes(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Nome (só o mês, em minúsculas) de um mês deslocado: `nomeDoMes('2026-11', -1)` → "outubro".
 * Usado em frases como "em relação a outubro" / "vs outubro".
 * @param {string} mes     "AAAA-MM"
 * @param {number} [delta] meses a somar (padrão 0; -1 = mês anterior)
 */
export function nomeDoMes(mes, delta = 0) {
  return rotuloMes(deslocarMes(mes, delta)).split(' de ')[0];
}

/** Rótulo curto: "2026-11" → "novembro/2026" (usado nas linhas discretas do card de Metas). */
export function rotuloMesCurto(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const nome = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${nome}/${ano}`;
}

/** "2026-12-01" → "01/12/2026" (troca de formato só no texto, sem passar por Date/fuso). */
export function formatarDataIso(iso) {
  const [ano, m, d] = iso.split('-');
  return `${d}/${m}/${ano}`;
}

/**
 * Aviso discreto quando o servidor gerou fixos automaticamente ao abrir o mês.
 * @param {number} n  quantidade gerada (campo `fixosGerados` da API)
 * @returns {string}  "" quando n = 0
 */
export function mensagemFixosGerados(n) {
  if (!n) return '';
  return `↻ ${n} ${n === 1 ? 'fixo adicionado' : 'fixos adicionados'} automaticamente (do mês anterior).`;
}
