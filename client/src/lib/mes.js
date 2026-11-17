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

// Fuso do painel — o MESMO do servidor (server/src/utils/mes.js): é nele que um lançamento
// "pertence" a um mês. Assim, "mês atual" vale o mesmo no navegador e na API, qualquer que seja
// o fuso do aparelho.
const FUSO_PAINEL = 'America/Fortaleza';
const formatadorMes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_PAINEL, year: 'numeric', month: '2-digit' });

/**
 * Mês de hoje no formato "AAAA-MM", no fuso America/Fortaleza (e não no horário do navegador).
 * É a função ÚNICA de "mês atual" do cliente: decide o mês inicial do seletor e quais meses já
 * estão FECHADOS (anteriores a ele) — ver `mesFechado`.
 */
export function mesAtual() {
  // "en-CA" formata como "2026-11"; formatToParts evita depender desse formato exato.
  const p = Object.fromEntries(formatadorMes.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}`;
}

/**
 * O mês já está FECHADO? Sim quando é anterior ao mês atual. O mês em andamento e os futuros
 * estão "abertos". Usado para só comparar com o mês anterior em meses fechados (Resumo).
 */
export function mesFechado(mes) {
  return mes < mesAtual();
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
 * Aviso discreto quando a SINCRONIZAÇÃO DOS FIXOS (no servidor) criou cópias que faltavam num mês:
 * "↻ 3 fixos adicionados em novembro/2026".
 * @param {number} n    quantidade criada (campo `fixosGerados` da API)
 * @param {string} mes  "AAAA-MM" do mês onde foram criados
 * @returns {string}    "" quando n = 0
 */
export function mensagemFixosGerados(n, mes) {
  if (!n) return '';
  return `↻ ${n} ${n === 1 ? 'fixo adicionado' : 'fixos adicionados'} em ${rotuloMesCurto(mes)}`;
}

/**
 * O mesmo aviso para vários meses de uma vez (criar ou ligar "Repete todo mês" num lançamento preenche os
 * meses seguintes): `{ "2026-11": 1, "2026-12": 1 }` → "↻ 1 fixo adicionado em novembro/2026 · 1 fixo…".
 * @param {Record<string, number> | undefined} porMes  campo `fixosPorMes` da API
 */
export function mensagemFixosPorMes(porMes) {
  return Object.entries(porMes ?? {})
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mes, n], i) => (i === 0 ? mensagemFixosGerados(n, mes) : mensagemFixosGerados(n, mes).replace('↻ ', '')))
    .join(' · ');
}

/** Quanto tempo (ms) os avisos discretos de fixos ficam na tela antes de sumir sozinhos. */
export const DURACAO_AVISO_FIXOS = 6000;
