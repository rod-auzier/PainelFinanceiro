/**
 * Utilitários de MÊS ("AAAA-MM") para Receitas e Despesas.
 *
 * Padrão do projeto: receitas e despesas só têm a data `createdAt` (timestamps
 * do Mongoose) — não existe um campo separado de mês. Então "o mês de um
 * lançamento" é o mês do seu `createdAt`, e filtrar por mês é filtrar um
 * intervalo de `createdAt`.
 *
 * Fuso: tudo é calculado em `America/Fortaleza` (UTC-3 fixo, o mesmo horário de
 * Brasília, sem horário de verão) e NUNCA no fuso do servidor (que na Vercel é
 * UTC e viraria o mês 3 horas antes). Assim, um lançamento feito às 22h do dia 31
 * não "vaza" para o mês seguinte, e "o mês atual" vira à meia-noite daqui.
 */

/**
 * MES_INICIAL — primeiro mês em que o painel "existe" ("AAAA-MM").
 *
 * É a ÚNICA definição desse limite no backend; tudo o que depende dele usa esta
 * constante:
 *  - `lerMesOpcional` recusa meses anteriores (400) em listas, resumo e criação;
 *  - listas e somas SEM `mes` só enxergam lançamentos desta data em diante
 *    (`filtroDesdeInicio`), inclusive o "total guardado" das Metas;
 *  - a geração automática de fixos nunca olha para trás deste mês.
 * O frontend tem a sua própria cópia em client/src/lib/mes.js — mantenha as duas
 * iguais ao mudar.
 */
export const MES_INICIAL = '2026-10';

/** Fuso oficial do painel. */
export const FUSO = 'America/Fortaleza';

// America/Fortaleza é UTC-3 o ano todo (sem horário de verão), então os limites de mês
// podem ser calculados com um deslocamento fixo — equivalente ao fuso acima.
const OFFSET_MS = 3 * 60 * 60 * 1000;

// Formatador no fuso do painel (independe do fuso do servidor).
const formatadorData = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const FORMATO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

const doisDigitos = (n) => String(n).padStart(2, '0');

/** `true` se `valor` é uma string "AAAA-MM" válida (mês 01–12). */
export function mesValido(valor) {
  return typeof valor === 'string' && FORMATO_MES.test(valor);
}

/**
 * Lê o parâmetro opcional `mes` (query ou body).
 * @param   {unknown} valor
 * @returns {{ mes?: string, erro?: string }}  `{}` quando ausente/vazio. Erro se o formato
 *          não for "AAAA-MM" ou se o mês for anterior a MES_INICIAL.
 */
export function lerMesOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return {};
  if (!mesValido(valor)) return { erro: 'mes deve estar no formato AAAA-MM' };
  if (valor < MES_INICIAL) return { erro: `mes não pode ser anterior a ${MES_INICIAL}` };
  return { mes: valor };
}

const partes = (mes) => {
  const [ano, m] = mes.split('-').map(Number);
  return { ano, mes: m };
};

/** Ano, mês e dia de um instante, vistos no fuso do painel (America/Fortaleza). */
function dataNoFuso(data) {
  const p = Object.fromEntries(formatadorData.formatToParts(data).map((x) => [x.type, x.value]));
  return { ano: p.year, mes: p.month, dia: Number(p.day) };
}

/** "AAAA-MM" em que cai o instante `data`, no fuso do painel. */
export function mesDe(data) {
  const { ano, mes } = dataNoFuso(data);
  return `${ano}-${mes}`;
}

/**
 * MÊS ATUAL do painel ("AAAA-MM") — a ÚNICA função que responde "em que mês estamos?".
 * Usa a data de hoje em America/Fortaleza, não a do servidor. É reutilizada por tudo que
 * depende do mês corrente: a geração automática de fixos, o "total guardado" (só meses
 * fechados) e a criação de lançamentos.
 * @param {Date} [agora]  instante de referência (padrão: agora). Parâmetro para testes.
 */
export function mesAtual(agora = new Date()) {
  return mesDe(agora);
}

/** Dia do mês (1–31) do instante `data`, no fuso do painel. */
export function diaDe(data) {
  return dataNoFuso(data).dia;
}

/** Mês anterior a "AAAA-MM" (ex.: "2026-01" → "2025-12"). */
export function mesAnterior(mes) {
  const { ano, mes: m } = partes(mes);
  const d = new Date(Date.UTC(ano, m - 2, 1));
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}`;
}

/** Mês seguinte a "AAAA-MM" (ex.: "2026-12" → "2027-01"). */
export function mesSeguinte(mes) {
  const { ano, mes: m } = partes(mes);
  const d = new Date(Date.UTC(ano, m, 1));
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}`;
}

/**
 * Intervalo [inicio, fim) do mês, para usar em `createdAt: { $gte, $lt }`.
 * @param   {string} mes "AAAA-MM" (já validado)
 * @returns {{ inicio: Date, fim: Date }}
 */
export function limitesDoMes(mes) {
  const { ano, mes: m } = partes(mes);
  return {
    inicio: new Date(Date.UTC(ano, m - 1, 1) + OFFSET_MS),
    fim: new Date(Date.UTC(ano, m, 1) + OFFSET_MS),
  };
}

/**
 * Filtro Mongo `{ createdAt: { $gte: início de MES_INICIAL } }` — usado quando NÃO
 * há `mes` na requisição: lançamentos anteriores ao início do painel (lixo de testes,
 * cópias antigas) nunca aparecem nem entram em soma alguma.
 */
export function filtroDesdeInicio() {
  return { createdAt: { $gte: limitesDoMes(MES_INICIAL).inicio } };
}

/** Filtro Mongo `{ createdAt: { $gte, $lt } }` para o mês dado. */
export function filtroDoMes(mes) {
  const { inicio, fim } = limitesDoMes(mes);
  return { createdAt: { $gte: inicio, $lt: fim } };
}

/**
 * Data (meio-dia de Brasília) no mês `mes`, no dia `dia` — o dia é "encaixado"
 * no tamanho do mês (dia 31 em fevereiro vira 28/29). Meio-dia evita que
 * variações de fuso empurrem o lançamento para outro mês.
 */
export function dataNoMes(mes, dia) {
  const { ano, mes: m } = partes(mes);
  const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const d = Math.min(Math.max(dia, 1), ultimoDia);
  return new Date(Date.UTC(ano, m - 1, d, 12) + OFFSET_MS);
}

/**
 * `createdAt` a usar ao CRIAR um lançamento "dentro" do mês escolhido na tela.
 * - sem `mes`, ou `mes` = mês atual → `undefined` (o Mongoose usa "agora");
 * - outro mês → mesmo dia de hoje naquele mês (encaixado), ao meio-dia.
 */
export function createdAtParaMes(mes) {
  if (!mes || mes === mesAtual()) return undefined;
  return dataNoMes(mes, diaDe(new Date()));
}
