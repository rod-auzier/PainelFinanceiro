/**
 * CARTÕES DE CRÉDITO — cálculo CENTRAL (vários cartões), sem contar nada duas vezes.
 *
 * O PROBLEMA
 *   Algumas despesas (ex.: Internet R$ 130) são pagas num cartão e lançadas uma a uma, ligadas a ele
 *   (`Despesa.cartaoId`). A FATURA daquele cartão no mês (ex.: R$ 500) já INCLUI essas despesas. Se a
 *   fatura inteira fosse lançada como despesa, a Internet contaria duas vezes. Por isso o usuário
 *   informa só o TOTAL da fatura de cada cartão (FaturaCartao) e o painel calcula o resto.
 *
 * A CONTA — para cada cartão c, em cada mês:
 *   detalhado_c    = soma das despesas do mês ligadas ao cartão c (o que já está lançado);
 *   SEM fatura de c informada → total_c = detalhado_c (cada despesa conta UMA vez, como sempre);
 *   COM fatura de c informada:
 *     naoDetalhado_c = max(0, fatura_c − detalhado_c)
 *         → a parte da fatura que NÃO foi lançada ("Outras compras no cartão (nome)"). O `max(0, …)`
 *           evita um valor negativo quando o detalhado passa da fatura;
 *     total_c        = max(fatura_c, detalhado_c)
 *         → normalmente a fatura (ela já contém o detalhado). Se o detalhado for MAIOR (fatura
 *           desatualizada, compra que cai na próxima…), vale o detalhado — nunca "somem" despesas
 *           lançadas — e aquele cartão mostra um aviso discreto (`excedeu`).
 *   Total de despesas do mês = despesas que NÃO são cartão + Σ total_c
 *                            = TODAS as despesas lançadas + Σ naoDetalhado_c.
 *   A segunda forma é a usada no código: basta SOMAR os naoDetalhado ao total de sempre.
 *
 * LINHAS VIRTUAIS — cada naoDetalhado_c > 0 aparece nas telas como uma despesa CALCULADA
 *   "Outras compras no cartão (nome)", categoria "Outros" (`linhasVirtuaisCartoes`). Não são registros
 *   salvos: são montadas na hora. Contam como pagas quando a fatura daquele cartão está paga.
 *
 * TRANSIÇÃO DO CONTROLE ANTIGO (um cartão só), sem migração em massa e sem mudar os totais:
 *   - despesa com `cartao: true` e SEM `cartaoId` pertence ao CARTÃO PADRÃO;
 *   - fatura SEM `cartaoId` pertence ao CARTÃO PADRÃO;
 *   - o cartão padrão é um Cartao "Cartão" com `padrao: true`, criado por `garantirCartaoPadrao` na
 *     primeira vez que o usuário abre a tela de Despesas (só se houver dados antigos; uma única vez).
 *     Antes disso, o cálculo trata esses dados como um cartão "Cartão" provisório (chave 'padrao') —
 *     por isso os totais são os mesmos antes e depois.
 *   Nenhuma despesa ou fatura antiga é reescrita.
 *
 * ONDE É USADO (para os números nunca divergirem): Resumo (saldo, total, pago/falta pagar), lista de
 * Despesas (cards dos cartões, linhas virtuais, rosca e maiores despesas do Resumo) e o Total guardado /
 * média / previsão (Porquinho e Metas — meses fechados e mês em andamento).
 *
 * Isolamento: tudo filtrado por `userId`.
 */
import mongoose from 'mongoose';
import { Cartao } from '../models/Cartao.js';
import { Despesa } from '../models/Despesa.js';
import { FaturaCartao } from '../models/FaturaCartao.js';
import { User } from '../models/User.js';
import { MES_INICIAL, limitesDoMes, mesSeguinte } from '../utils/mes.js';
import { somarComFiltro } from './totais.js';

/** Categoria das linhas virtuais. */
export const CATEGORIA_LINHA_VIRTUAL = 'Outros';
/** Nome do cartão padrão criado na transição. */
export const NOME_CARTAO_PADRAO = 'Cartão';
/** Cor do cartão padrão (1ª da paleta: azul discreto). */
export const COR_CARTAO_PADRAO = '#3F78B0';
/** Máximo de cartões por usuário. */
export const LIMITE_CARTOES = 5;
/** Chave do cartão padrão PROVISÓRIO (dados antigos antes de o Cartao "Cartão" existir). */
export const CHAVE_PADRAO_PROVISORIO = 'padrao';

/** Fuso fixo usado para dizer a que mês uma despesa pertence (o mesmo de utils/mes.js: UTC−3). */
const FUSO_MES = '-03:00';

/** Arredonda para centavos (evita 369.99999999 em somas de ponto flutuante). */
const centavos = (n) => Math.round(Number(n) * 100) / 100;

/**
 * NÚCLEO PURO da regra para UM cartão em UM mês (sem banco) — toda conta passa por aqui.
 *
 * @param   {number|null|undefined} valorFatura  total da fatura informada; `null`/`undefined` = não informada
 * @param   {number} detalhado                   soma das despesas do mês ligadas a esse cartão
 * @returns {{ temFatura: boolean, detalhado: number, naoDetalhado: number, totalCartao: number, excedeu: boolean }}
 *   - `naoDetalhado` = max(0, fatura − detalhado), ou 0 sem fatura — é o que se SOMA ao total de despesas;
 *   - `totalCartao`  = max(fatura, detalhado), ou o detalhado sem fatura;
 *   - `excedeu`      = com fatura, o detalhado passou dela (aviso; o detalhado prevalece).
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

// ---------------------------------------------------------------------------------------------
// Filtros que traduzem "despesas/faturas DO CARTÃO X", incluindo os dados antigos do cartão padrão.
// ---------------------------------------------------------------------------------------------

/** Filtro de despesas de um cartão (o padrão também leva as antigas `cartao: true` sem `cartaoId`). */
export function filtroDespesasDoCartao(userId, cartao) {
  return cartao.padrao
    ? { userId, $or: [{ cartaoId: cartao._id }, { cartaoId: null, cartao: true }] }
    : { userId, cartaoId: cartao._id };
}

/** Filtro de faturas de um cartão (o padrão também leva as antigas, sem `cartaoId`). */
export function filtroFaturasDoCartao(userId, cartao) {
  return cartao.padrao
    ? { userId, $or: [{ cartaoId: cartao._id }, { cartaoId: null }] }
    : { userId, cartaoId: cartao._id };
}

// ---------------------------------------------------------------------------------------------
// Transição e índices
// ---------------------------------------------------------------------------------------------

let indicesProntos = null;
/**
 * Remove (uma vez por processo) o índice ANTIGO único de faturas (usuário + mês), que impediria dois
 * cartões terem fatura no mesmo mês, e garante o índice novo (usuário + cartão + mês).
 * Remover um índice não apaga nenhum documento.
 */
export function prepararIndicesFatura() {
  indicesProntos ??= (async () => {
    try {
      await FaturaCartao.collection.dropIndex('userId_1_mes_1');
    } catch {
      /* índice antigo já não existe (ou a coleção ainda não existe) — tudo certo */
    }
    await FaturaCartao.init();
  })().catch((erro) => {
    indicesProntos = null; // tenta de novo na próxima chamada
    throw erro;
  });
  return indicesProntos;
}

/**
 * TRANSIÇÃO PREGUIÇOSA (uma vez por usuário): se ele tem dados do controle antigo (despesas com
 * `cartao: true` sem `cartaoId` ou faturas sem `cartaoId`) e ainda não tem cartão padrão, cria o
 * Cartao "Cartão" (`padrao: true`). Grava `cartoesMigrados: true` no usuário para não repetir.
 * Idempotente e segura com requisições simultâneas (índice único parcial em `padrao`).
 * Não altera nenhuma despesa nem fatura.
 * @param {string} userId
 */
export async function garantirCartaoPadrao(userId) {
  const usuario = await User.findById(userId).select('cartoesMigrados').lean();
  if (!usuario || usuario.cartoesMigrados) return; // caminho rápido

  const [despesaAntiga, faturaAntiga, jaTemPadrao] = await Promise.all([
    Despesa.exists({ userId, cartao: true, cartaoId: null }),
    FaturaCartao.exists({ userId, cartaoId: null }),
    Cartao.exists({ userId, padrao: true }),
  ]);
  if ((despesaAntiga || faturaAntiga) && !jaTemPadrao) {
    await Cartao.init(); // índices únicos prontos antes de depender deles
    try {
      await Cartao.create({ userId, nome: NOME_CARTAO_PADRAO, cor: COR_CARTAO_PADRAO, padrao: true });
    } catch (erro) {
      if (erro?.code !== 11000) throw erro; // 11000: outra requisição criou primeiro
    }
  }
  await User.updateOne({ _id: userId }, { $set: { cartoesMigrados: true } });
}

// ---------------------------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------------------------

/**
 * Situação de TODOS os cartões em TODOS os meses de um intervalo — base de todas as outras funções.
 *
 * Junta (por mês e por cartão) as faturas informadas e a soma das despesas de cartão, e aplica
 * `calcularCartao` a cada par. As despesas/faturas antigas (sem `cartaoId`) caem na chave do cartão
 * padrão (o id dele, se já existe; senão a chave provisória 'padrao').
 *
 * @param   {string} userId
 * @param   {{ desde: string, ate?: string }} intervalo  "AAAA-MM"; `desde` inclusivo, `ate` EXCLUSIVO
 * @returns {Promise<{ cartoes: Array<{_id, nome, cor, padrao}>, entradas: Array<{
 *            mes: string, chave: string, fatura: null | { valor, paga },
 *            temFatura, detalhado, naoDetalhado, totalCartao, excedeu }> }>}
 */
async function situacaoDoIntervalo(userId, { desde, ate }) {
  const uid = new mongoose.Types.ObjectId(userId);
  const filtroData = {
    createdAt: { $gte: limitesDoMes(desde).inicio, ...(ate ? { $lt: limitesDoMes(ate).inicio } : {}) },
  };
  const filtroMes = { $gte: desde, ...(ate ? { $lt: ate } : {}) };

  const [cartoes, faturas, somas] = await Promise.all([
    Cartao.find({ userId }).sort({ createdAt: 1, _id: 1 }).select('nome cor padrao').lean(),
    FaturaCartao.find({ userId, mes: filtroMes }).select('mes valor paga cartaoId').lean(),
    // Soma das despesas de cartão por (mês, cartão). Despesa de cartão = tem `cartaoId` OU é antiga
    // com `cartao: true`. As antigas (sem `cartaoId`) vão para a chave 'padrao'.
    Despesa.aggregate([
      { $match: { userId: uid, ...filtroData, $or: [{ cartaoId: { $ne: null } }, { cartao: true }] } },
      {
        $group: {
          _id: {
            mes: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: FUSO_MES } },
            cartao: { $ifNull: ['$cartaoId', CHAVE_PADRAO_PROVISORIO] },
          },
          total: { $sum: '$valor' },
        },
      },
    ]),
  ]);

  // Chave de um cartão: o id dele; dados antigos (sem id) → o cartão padrão (ou o provisório).
  const padrao = cartoes.find((c) => c.padrao);
  const chaveDe = (id) =>
    id && String(id) !== CHAVE_PADRAO_PROVISORIO ? String(id) : padrao ? String(padrao._id) : CHAVE_PADRAO_PROVISORIO;

  const mapa = new Map(); // "mes|chave" → { mes, chave, fatura, detalhado }
  const entrada = (mes, chave) => {
    const k = `${mes}|${chave}`;
    if (!mapa.has(k)) mapa.set(k, { mes, chave, fatura: null, detalhado: 0 });
    return mapa.get(k);
  };
  for (const s of somas) entrada(s._id.mes, chaveDe(s._id.cartao)).detalhado += s.total;
  for (const f of faturas) entrada(f.mes, chaveDe(f.cartaoId)).fatura = { valor: f.valor, paga: f.paga };

  return {
    cartoes,
    entradas: [...mapa.values()].map((e) => ({ ...e, ...calcularCartao(e.fatura?.valor, e.detalhado) })),
  };
}

/**
 * Situação de cada cartão em UM mês — o que a tela de Despesas mostra nos cards.
 *
 * @param   {string} userId
 * @param   {string} mes "AAAA-MM"
 * @returns {Promise<{ cartoes: Array<{ cartao: { _id, nome, cor, padrao }, fatura: null | { valor, paga },
 *            temFatura, detalhado, naoDetalhado, totalCartao, excedeu }>, naoDetalhado: number, excedeu: boolean }>}
 *   Um item por cartão do usuário (na ordem de criação), mesmo sem movimento no mês. Se ainda houver
 *   dados antigos sem o cartão padrão criado, entra um cartão provisório `{ _id: 'padrao', nome: 'Cartão' }`.
 *   `naoDetalhado` = soma das partes não detalhadas; `excedeu` = algum cartão passou da fatura.
 */
export async function cartoesDoMes(userId, mes) {
  const { cartoes, entradas } = await situacaoDoIntervalo(userId, { desde: mes, ate: mesSeguinte(mes) });
  const porChave = new Map(entradas.map((e) => [e.chave, e]));
  const vazio = calcularCartao(null, 0);

  const lista = cartoes.map((c) => {
    const e = porChave.get(String(c._id));
    return { cartao: { _id: String(c._id), nome: c.nome, cor: c.cor, padrao: c.padrao }, fatura: e?.fatura ?? null, ...(e ?? vazio) };
  });
  const provisorio = porChave.get(CHAVE_PADRAO_PROVISORIO);
  if (provisorio) {
    lista.unshift({
      cartao: { _id: CHAVE_PADRAO_PROVISORIO, nome: NOME_CARTAO_PADRAO, cor: COR_CARTAO_PADRAO, padrao: true },
      ...provisorio,
    });
  }
  // (Remove os campos internos de agrupamento.)
  const limpos = lista.map(({ mes: _m, chave: _c, ...resto }) => resto); // eslint-disable-line no-unused-vars

  return {
    cartoes: limpos,
    naoDetalhado: centavos(limpos.reduce((s, c) => s + c.naoDetalhado, 0)),
    excedeu: limpos.some((c) => c.excedeu),
  };
}

/**
 * Monta as LINHAS VIRTUAIS "Outras compras no cartão (nome)" de um mês (não são salvas no banco).
 * Mesmo formato de uma despesa, com `virtual: true` para as telas as tratarem como somente leitura.
 *
 * @param   {string} mes
 * @param   {Awaited<ReturnType<typeof cartoesDoMes>>} situacao
 * @returns {Array<{ _id, descricao, categoria, valor, cartao, cartaoId, paga, recorrente, virtual }>}
 *          uma por cartão com naoDetalhado > 0 (lista vazia se nenhuma).
 */
export function linhasVirtuaisCartoes(mes, situacao) {
  return situacao.cartoes
    .filter((c) => c.temFatura && c.naoDetalhado > 0)
    .map((c) => ({
      _id: `cartao-${mes}-${c.cartao._id}`, // id fixo e reconhecível (não é um ObjectId)
      descricao: `Outras compras no cartão (${c.cartao.nome})`,
      categoria: CATEGORIA_LINHA_VIRTUAL,
      valor: c.naoDetalhado,
      cartao: true,
      cartaoId: c.cartao._id,
      paga: Boolean(c.fatura?.paga),
      recorrente: false,
      virtual: true,
    }));
}

/**
 * TOTAL DE DESPESAS CORRIGIDO — a função ÚNICA que todas as telas usam para o total de despesas de
 * um período (um mês ou um intervalo de meses):
 *
 *   total = despesas LANÇADAS do período + Σ naoDetalhado de cada cartão em cada mês do período
 *
 * (equivale a "despesas que não são cartão + Σ max(fatura_c, detalhado_c)" — ver o topo do arquivo).
 * Usada pelo Resumo e pelo Total guardado (meses fechados e mês em andamento).
 *
 * @param   {string} userId
 * @param   {{ mes?: string, desde?: string, ate?: string }} periodo
 *          `{ mes }` = um mês; `{ desde, ate }` = de `desde` (inclusivo; padrão MES_INICIAL) até `ate`
 *          (EXCLUSIVO; sem `ate`, sem limite). Nunca conta nada antes de MES_INICIAL.
 * @returns {Promise<{ lancadas: number, total: number, pago: number, naoDetalhado: number }>}
 *   - `lancadas`     = soma das despesas registradas;
 *   - `total`        = lancadas + naoDetalhado (o total que as telas mostram);
 *   - `pago`         = despesas marcadas como pagas + as partes não detalhadas de faturas PAGAS;
 *   - `naoDetalhado` = soma das "outras compras nos cartões" do período.
 */
export async function totalDespesasCorrigido(userId, { mes, desde, ate } = {}) {
  const inicio = mes ?? (desde && desde > MES_INICIAL ? desde : MES_INICIAL);
  const fim = mes ? mesSeguinte(mes) : ate; // exclusivo (pode ser undefined = sem limite)
  const filtroData = {
    createdAt: { $gte: limitesDoMes(inicio).inicio, ...(fim ? { $lt: limitesDoMes(fim).inicio } : {}) },
  };

  const [lancadas, pagas, { entradas }] = await Promise.all([
    somarComFiltro(Despesa, userId, filtroData),
    somarComFiltro(Despesa, userId, { paga: true, ...filtroData }),
    situacaoDoIntervalo(userId, { desde: inicio, ate: fim }),
  ]);
  const naoDetalhado = centavos(entradas.reduce((s, e) => s + e.naoDetalhado, 0));
  const naoDetalhadoPago = centavos(entradas.reduce((s, e) => s + (e.fatura?.paga ? e.naoDetalhado : 0), 0));

  return {
    lancadas: centavos(lancadas),
    total: centavos(lancadas + naoDetalhado),
    pago: centavos(pagas + naoDetalhadoPago),
    naoDetalhado,
  };
}
