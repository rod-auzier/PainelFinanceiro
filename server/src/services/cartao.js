/**
 * CARTÃO DE CRÉDITO — cálculo CENTRAL, sem contar nada duas vezes.
 *
 * O PROBLEMA
 *   Algumas despesas (ex.: Internet R$ 130) são pagas no cartão e lançadas uma a uma, marcadas com
 *   `cartao: true`. A FATURA do mês (ex.: R$ 500) já INCLUI essas despesas. Se a fatura inteira
 *   fosse lançada como despesa, a Internet contaria duas vezes. Por isso o usuário informa só o
 *   TOTAL da fatura (model FaturaCartao) e o painel calcula o resto.
 *
 * A CONTA (por mês)
 *   detalhado    = soma das despesas do mês marcadas como cartão (o que já está lançado);
 *   SEM fatura informada → nada muda: as despesas de cartão contam normalmente, cada uma UMA vez;
 *   COM fatura informada:
 *     naoDetalhado = max(0, fatura − detalhado)
 *         → a parte da fatura que NÃO foi lançada como despesa ("outras compras no cartão").
 *           O `max(0, …)` evita um valor negativo quando o detalhado passa da fatura;
 *     total do cartão no mês = max(fatura, detalhado)
 *         → normalmente é a fatura (ela já contém o detalhado). Se o detalhado for MAIOR que a fatura
 *           informada (valor desatualizado, compra que só cai na próxima fatura…), usamos o detalhado —
 *           nunca "somem" despesas lançadas — e a tela mostra um aviso discreto (`excedeu`);
 *     total de despesas do mês = despesas que NÃO são cartão + max(fatura, detalhado)
 *                              = TODAS as despesas lançadas + naoDetalhado.
 *   A segunda forma é a usada no código: basta SOMAR `naoDetalhado` ao total de sempre.
 *
 * A LINHA VIRTUAL "Outras compras no cartão"
 *   `naoDetalhado` aparece nas telas como uma linha de despesa CALCULADA (não é um registro salvo,
 *   é montada na hora por `linhaVirtualCartao`), na categoria "Outros". Ela conta como paga quando a
 *   fatura está paga ("Pago / Falta pagar").
 *
 * ONDE É USADO (para os números nunca divergirem entre telas): Resumo (saldo, total, pago/falta
 * pagar), lista de Despesas do mês (linha virtual, rosca e maiores despesas do Resumo) e o Total
 * guardado / média / previsão (Porquinho e Metas — meses fechados e mês em andamento).
 *
 * Isolamento: tudo filtrado por `userId`.
 */
import mongoose from 'mongoose';
import { Despesa } from '../models/Despesa.js';
import { FaturaCartao } from '../models/FaturaCartao.js';
import { MES_INICIAL, filtroDoMes, limitesDoMes, mesSeguinte } from '../utils/mes.js';
import { somarComFiltro } from './totais.js';

/** Categoria e descrição da linha virtual. */
export const CATEGORIA_LINHA_VIRTUAL = 'Outros';
export const DESCRICAO_LINHA_VIRTUAL = 'Outras compras no cartão';

/** Arredonda para centavos (evita 369.99999999 em somas de ponto flutuante). */
const centavos = (n) => Math.round(Number(n) * 100) / 100;

/**
 * NÚCLEO PURO da regra (sem banco) — toda conta de cartão passa por aqui.
 *
 * @param   {number|null|undefined} valorFatura  total da fatura informada; `null`/`undefined` = não informada
 * @param   {number} detalhado                   soma das despesas de cartão do mês
 * @returns {{ temFatura: boolean, detalhado: number, naoDetalhado: number, totalCartao: number, excedeu: boolean }}
 *   - `naoDetalhado` = max(0, fatura − detalhado), ou 0 sem fatura — é o que se SOMA ao total de despesas;
 *   - `totalCartao`  = max(fatura, detalhado), ou o detalhado sem fatura;
 *   - `excedeu`      = com fatura, o detalhado passou dela (a tela avisa e o detalhado prevalece).
 */
export function calcularCartao(valorFatura, detalhado) {
  const det = centavos(detalhado || 0);
  if (valorFatura == null) {
    return { temFatura: false, detalhado: det, naoDetalhado: 0, totalCartao: det, excedeu: false };
  }
  const fatura = centavos(valorFatura);
  return {
    temFatura: true,
    detalhado: det,
    naoDetalhado: centavos(Math.max(0, fatura - det)),
    totalCartao: Math.max(fatura, det),
    excedeu: det > fatura,
  };
}

/** Soma das despesas de cartão (`cartao: true`) de um mês. */
async function somarDetalhado(userId, mes) {
  const [r] = await Despesa.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), cartao: true, ...filtroDoMes(mes) } },
    { $group: { _id: null, total: { $sum: '$valor' } } },
  ]);
  return r?.total ?? 0;
}

/**
 * Situação do cartão em UM mês: a fatura informada (se houver) + o resultado de `calcularCartao`.
 *
 * @param   {string} userId
 * @param   {string} mes  "AAAA-MM"
 * @returns {Promise<{ fatura: null | { mes, valor, paga }, temFatura, detalhado, naoDetalhado, totalCartao, excedeu }>}
 */
export async function cartaoDoMes(userId, mes) {
  const [fatura, detalhado] = await Promise.all([
    FaturaCartao.findOne({ userId, mes }).select('mes valor paga').lean(),
    somarDetalhado(userId, mes),
  ]);
  return {
    fatura: fatura ? { mes: fatura.mes, valor: fatura.valor, paga: fatura.paga } : null,
    ...calcularCartao(fatura?.valor, detalhado),
  };
}

/**
 * Soma das "outras compras no cartão" (naoDetalhado) de um INTERVALO de meses — para os totais que
 * juntam vários meses (Total guardado dos meses fechados, Resumo sem `mes`).
 * Só meses COM fatura importam (sem fatura, naoDetalhado = 0), então percorremos as faturas.
 *
 * @param   {string} userId
 * @param   {{ desde?: string, ate?: string }} intervalo  "AAAA-MM"; `desde` inclusivo, `ate` EXCLUSIVO
 * @returns {Promise<{ naoDetalhado: number, naoDetalhadoPago: number }>}
 *          `naoDetalhadoPago` = a parte cujas faturas estão pagas (para o "Pago" do Resumo).
 */
export async function somarOutrasComprasCartao(userId, { desde, ate } = {}) {
  const filtroMes = {};
  if (desde) filtroMes.$gte = desde;
  if (ate) filtroMes.$lt = ate;
  const faturas = await FaturaCartao.find({ userId, ...(desde || ate ? { mes: filtroMes } : {}) })
    .select('mes valor paga')
    .lean();

  const porMes = await Promise.all(
    faturas.map(async (f) => ({ paga: f.paga, ...calcularCartao(f.valor, await somarDetalhado(userId, f.mes)) })),
  );
  return {
    naoDetalhado: centavos(porMes.reduce((s, c) => s + c.naoDetalhado, 0)),
    naoDetalhadoPago: centavos(porMes.reduce((s, c) => s + (c.paga ? c.naoDetalhado : 0), 0)),
  };
}

/**
 * Monta a LINHA VIRTUAL "Outras compras no cartão" de um mês (não é salva no banco).
 * Tem o mesmo formato de uma despesa, com `virtual: true` para as telas a tratarem como
 * somente leitura (selo "calculada", sem editar/excluir/marcar).
 *
 * @param   {string} mes
 * @param   {Awaited<ReturnType<typeof cartaoDoMes>>} cartao
 * @returns {null | { _id, descricao, categoria, valor, cartao, paga, recorrente, virtual }}
 *          `null` quando não há nada a acrescentar (sem fatura ou naoDetalhado = 0).
 */
export function linhaVirtualCartao(mes, cartao) {
  if (!cartao.temFatura || cartao.naoDetalhado <= 0) return null;
  return {
    _id: `cartao-${mes}`, // id fixo e reconhecível (não é um ObjectId)
    descricao: DESCRICAO_LINHA_VIRTUAL,
    categoria: CATEGORIA_LINHA_VIRTUAL,
    valor: cartao.naoDetalhado,
    cartao: true,
    paga: Boolean(cartao.fatura?.paga),
    recorrente: false,
    virtual: true,
  };
}

/**
 * TOTAL DE DESPESAS CORRIGIDO — a função ÚNICA que todas as telas usam para o total de despesas de
 * um período (mês ou intervalo de meses):
 *
 *   total = despesas LANÇADAS do período + Σ naoDetalhado dos meses do período
 *
 * (equivale a "despesas que não são cartão + max(fatura, detalhado)" em cada mês — ver o topo do
 * arquivo). Usada pelo Resumo e pelo Total guardado (meses fechados e mês em andamento).
 *
 * @param   {string} userId
 * @param   {{ mes?: string, desde?: string, ate?: string }} periodo
 *          `{ mes }` = um mês; `{ desde, ate }` = de `desde` (inclusivo; padrão MES_INICIAL) até `ate`
 *          (EXCLUSIVO; sem `ate`, até hoje e além). Nunca conta nada antes de MES_INICIAL.
 * @returns {Promise<{ lancadas: number, total: number, pago: number, naoDetalhado: number }>}
 *   - `lancadas`     = soma das despesas registradas (como antes);
 *   - `total`        = lancadas + naoDetalhado (o total que as telas mostram);
 *   - `pago`         = despesas marcadas como pagas + a parte não detalhada das faturas PAGAS;
 *   - `naoDetalhado` = soma das "outras compras no cartão" do período.
 */
export async function totalDespesasCorrigido(userId, { mes, desde, ate } = {}) {
  const inicio = mes ?? (desde && desde > MES_INICIAL ? desde : MES_INICIAL);
  const fim = mes ? mesSeguinte(mes) : ate; // exclusivo (pode ser undefined = sem limite)
  const filtroData = {
    createdAt: { $gte: limitesDoMes(inicio).inicio, ...(fim ? { $lt: limitesDoMes(fim).inicio } : {}) },
  };

  const [lancadas, pagas, outras] = await Promise.all([
    somarComFiltro(Despesa, userId, filtroData),
    somarComFiltro(Despesa, userId, { paga: true, ...filtroData }),
    somarOutrasComprasCartao(userId, { desde: inicio, ate: fim }),
  ]);
  return {
    lancadas: centavos(lancadas),
    total: centavos(lancadas + outras.naoDetalhado),
    pago: centavos(pagas + outras.naoDetalhadoPago),
    naoDetalhado: outras.naoDetalhado,
  };
}
