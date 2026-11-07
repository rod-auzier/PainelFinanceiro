/**
 * Utilitários de MÊS ("AAAA-MM") para Receitas e Despesas.
 *
 * Padrão do projeto: receitas e despesas só têm a data `createdAt` (timestamps
 * do Mongoose) — não existe um campo separado de mês. Então "o mês de um
 * lançamento" é o mês do seu `createdAt`, e filtrar por mês é filtrar um
 * intervalo de `createdAt`.
 *
 * Fuso: os limites do mês são calculados no horário de Brasília (UTC-3, sem
 * horário de verão desde 2019), para que um lançamento feito às 22h do dia 31
 * não "vaze" para o mês seguinte por causa do UTC.
 */

const OFFSET_MS = 3 * 60 * 60 * 1000; // Brasília = UTC-3
const FORMATO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

const doisDigitos = (n) => String(n).padStart(2, '0');

/** `true` se `valor` é uma string "AAAA-MM" válida (mês 01–12). */
export function mesValido(valor) {
  return typeof valor === 'string' && FORMATO_MES.test(valor);
}

/**
 * Lê o parâmetro opcional `mes` (query ou body).
 * @param   {unknown} valor
 * @returns {{ mes?: string, erro?: string }}  `{}` quando ausente/vazio.
 */
export function lerMesOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return {};
  if (!mesValido(valor)) return { erro: 'mes deve estar no formato AAAA-MM' };
  return { mes: valor };
}

const partes = (mes) => {
  const [ano, m] = mes.split('-').map(Number);
  return { ano, mes: m };
};

/** "AAAA-MM" do instante `data` no fuso de Brasília (padrão: agora). */
export function mesDe(data = new Date()) {
  const local = new Date(data.getTime() - OFFSET_MS);
  return `${local.getUTCFullYear()}-${doisDigitos(local.getUTCMonth() + 1)}`;
}

/** Dia do mês (1–31) do instante `data` no fuso de Brasília. */
export function diaDe(data) {
  return new Date(data.getTime() - OFFSET_MS).getUTCDate();
}

/** Mês anterior a "AAAA-MM" (ex.: "2026-01" → "2025-12"). */
export function mesAnterior(mes) {
  const { ano, mes: m } = partes(mes);
  const d = new Date(Date.UTC(ano, m - 2, 1));
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
  if (!mes || mes === mesDe()) return undefined;
  return dataNoMes(mes, diaDe(new Date()));
}
