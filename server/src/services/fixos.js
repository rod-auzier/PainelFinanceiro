/**
 * SINCRONIZAÇÃO DOS LANÇAMENTOS FIXOS ("Repete todo mês") — Receitas e Despesas, POR ITEM e IDEMPOTENTE.
 *
 * REGRA
 *   Todo lançamento com "Repete todo mês" deve existir em TODOS os meses seguintes até o mês ATUAL (fuso
 *   America/Fortaleza), nunca antes de MES_INICIAL. Para cada mês de destino, olhamos ITEM A ITEM:
 *     - para cada CHAVE (mesmo lançamento: descrição — receita: fonte + descrição — sem acento, sem
 *       diferença de maiúscula/espaços; ver services/propagacao.js → chaveDoFixo), pegamos a ocorrência
 *       MAIS RECENTE antes do mês de destino;
 *     - se ela é fixa (`recorrente: true`) e NÃO existe nenhum lançamento com essa chave no destino →
 *       criamos a cópia: descrição, categoria, cartão, valor e o dia do mês dessa ocorrência mais recente,
 *       "Repete todo mês" = true e paga = false;
 *     - se JÁ existe no destino (fixo ou não) → não cria nem altera NADA (valor, paga, edições ficam);
 *     - se a ocorrência mais recente NÃO é fixa (o usuário desligou "Repete todo mês" ali) → não cria;
 *     - se o usuário EXCLUIU o lançamento daquele mês (marca FixoRemovido) → não recria (ver o model).
 *   Repetir a sincronização não muda nada: ela só cria o que falta.
 *
 * QUANDO RODA
 *   (a) ao abrir/consultar um mês (GET /api/despesas|receitas|resumo?mes=) — só até o mês atual;
 *   (b) ao CRIAR um lançamento já com "Repete todo mês" — preenche os meses seguintes até o atual;
 *   (c) ao EDITAR e ligar "Repete todo mês" — idem;
 *   e antes de somar o total/média (services/guardado.js), para todos os meses até o atual.
 *
 * (Antes havia um marcador "este mês já foi gerado" (model FixosGerados): um mês gerado nunca mais era
 *  conferido, e um fixo marcado depois num mês anterior não chegava aos meses seguintes. O marcador
 *  ficou LEGADO — os registros continuam no banco, mas não são mais lidos.)
 *
 * CONCORRÊNCIA: uma trava curta por (usuário, tipo, mês) — TravaFixos — evita duas requisições
 * simultâneas criarem a mesma cópia; quem perde espera a outra terminar e não cria nada.
 *
 * Isolamento: tudo filtrado por `userId`. Nada é apagado aqui.
 */
import { Receita } from '../models/Receita.js';
import { Despesa } from '../models/Despesa.js';
import { FixoRemovido } from '../models/FixoRemovido.js';
import { TravaFixos } from '../models/TravaFixos.js';
import { chaveDoFixo } from './propagacao.js';
import { MES_INICIAL, dataNoMes, diaDe, limitesDoMes, mesAtual, mesDe, mesSeguinte } from '../utils/mes.js';

/**
 * Como cada tipo é copiado. `campos` é a lista BRANCA do que vai para a cópia (além de userId, recorrente
 * e createdAt): `paga` fica de fora de propósito — a cópia sempre entra como NÃO paga. O cartão
 * (`cartao` + `cartaoId`) é copiado: o fixo continua no mesmo cartão; o valor da FATURA não é copiado.
 */
export const CONFIG_FIXOS = {
  despesa: { Model: Despesa, campos: ['descricao', 'categoria', 'valor', 'cartao', 'cartaoId'] },
  receita: { Model: Receita, campos: ['fonte', 'descricao', 'valor'] },
};

const ESPERA_MAX_MS = 3000; // quanto o "perdedor" da trava espera o "ganhador" terminar
const ESPERA_PASSO_MS = 150;
const TRAVA_VELHA_MS = 30_000; // trava mais velha que isso = sincronização interrompida
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executa `fn` com a trava de (usuário, tipo, mês). Se outra requisição já estiver sincronizando, espera
 * ela terminar e devolve 0 (ela é quem cria). A trava é sempre removida ao final.
 */
async function comTrava(userId, tipo, mes, fn) {
  await TravaFixos.init(); // índice único pronto antes de depender dele
  const pegar = async () => {
    try {
      await TravaFixos.create({ userId, tipo, mes });
      return true;
    } catch (erro) {
      if (erro?.code === 11000) return false; // outra requisição está sincronizando este mês
      throw erro;
    }
  };

  let minha = await pegar();
  if (!minha) {
    // Trava esquecida (serverless interrompida)? Descarta e tenta de novo.
    const velha = await TravaFixos.findOneAndDelete({ userId, tipo, mes, criadoEm: { $lt: new Date(Date.now() - TRAVA_VELHA_MS) } });
    if (velha) minha = await pegar();
  }
  if (!minha) {
    const fim = Date.now() + ESPERA_MAX_MS;
    while (Date.now() < fim && (await TravaFixos.exists({ userId, tipo, mes }))) await dormir(ESPERA_PASSO_MS);
    return 0;
  }
  try {
    return await fn();
  } finally {
    await TravaFixos.deleteOne({ userId, tipo, mes }).catch(() => {});
  }
}

/**
 * Cria, no mês `mes`, as cópias que faltam dos fixos (regra no topo). Sem trava — use `gerarFixosDoMes`.
 * @returns {Promise<number>} quantas cópias foram criadas
 */
async function sincronizarMes(tipo, userId, mes) {
  const { Model, campos } = CONFIG_FIXOS[tipo];
  const inicioDestino = limitesDoMes(mes).inicio;

  const [itens, marcas] = await Promise.all([
    // Tudo de MES_INICIAL até o fim do mês de destino, em ordem: o último visto de cada chave antes do
    // destino é a "ocorrência mais recente".
    Model.find({ userId, createdAt: { $gte: limitesDoMes(MES_INICIAL).inicio, $lt: limitesDoMes(mes).fim } })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    FixoRemovido.find({ userId, tipo, mes: { $lte: mes } }).lean(),
  ]);

  const noDestino = new Set(); // chaves que já existem no mês de destino (fixas ou não)
  const maisRecente = new Map(); // chave → ocorrência mais recente ANTES do destino
  for (const item of itens) {
    const chave = chaveDoFixo(tipo, item);
    if (item.createdAt >= inicioDestino) noDestino.add(chave);
    else maisRecente.set(chave, item);
  }

  // Excluído pelo usuário? "Só deste mês" bloqueia só este mês; "este e os seguintes" bloqueia daqui em
  // diante, a menos que a fonte seja mais nova que a exclusão (o usuário voltou a lançar o fixo).
  const excluido = (chave, mesFonte) =>
    marcas.some((m) => m.chave === chave && (m.mes === mes || (m.emDiante && m.mes <= mes && mesFonte < m.mes)));

  const novos = [];
  for (const [chave, fonte] of maisRecente) {
    if (!fonte.recorrente) continue; // a ocorrência mais recente não repete (o usuário desligou)
    if (noDestino.has(chave)) continue; // já existe no destino: não cria nem mexe
    if (excluido(chave, mesDe(fonte.createdAt))) continue; // o usuário excluiu deste mês
    const copia = { userId, recorrente: true, createdAt: dataNoMes(mes, diaDe(fonte.createdAt)) };
    for (const campo of campos) if (fonte[campo] !== undefined) copia[campo] = fonte[campo];
    novos.push(copia); // `paga` não é copiado: entra como não paga (padrão do model)
  }
  if (novos.length) await Model.insertMany(novos);
  return novos.length;
}

/**
 * Sincroniza os fixos de UM tipo em UM mês (idempotente).
 * @param {'receita'|'despesa'} tipo
 * @param {string} userId
 * @param {string} mes   "AAAA-MM" (já validado)
 * @param {string} [hoje] mês atual (padrão: agora, America/Fortaleza). Parâmetro para testes.
 * @returns {Promise<number>} quantas cópias foram criadas NESTA chamada (0 se nada faltava, se o mês é
 *          MES_INICIAL/anterior ou futuro, ou se outra requisição estava sincronizando).
 */
export async function gerarFixosDoMes(tipo, userId, mes, hoje = mesAtual()) {
  if (mes <= MES_INICIAL || mes > hoje) return 0; // MES_INICIAL não tem mês anterior; futuro não gera
  return comTrava(userId, tipo, mes, () => sincronizarMes(tipo, userId, mes));
}

/** Receitas E despesas de um mês (o que a abertura do mês dispara). */
export async function gerarFixosDoMesTodos(userId, mes, hoje = mesAtual()) {
  const receitas = await gerarFixosDoMes('receita', userId, mes, hoje);
  const despesas = await gerarFixosDoMes('despesa', userId, mes, hoje);
  return { receitas, despesas, total: receitas + despesas };
}

/**
 * Sincroniza um tipo nos meses SEGUINTES a `mesOrigem`, em ordem, até o mês atual — usado ao criar um
 * fixo ou ao ligar "Repete todo mês" num lançamento (as cópias que faltam aparecem na hora).
 * @returns {Promise<Record<string, number>>} mês → quantas cópias foram criadas (só meses com > 0)
 */
export async function sincronizarDesde(tipo, userId, mesOrigem, hoje = mesAtual()) {
  const criados = {};
  for (let mes = mesSeguinte(mesOrigem); mes <= hoje; mes = mesSeguinte(mes)) {
    const n = await gerarFixosDoMes(tipo, userId, mes, hoje);
    if (n > 0) criados[mes] = n;
  }
  return criados;
}

/**
 * Garante a sincronização de TODOS os meses, de MES_INICIAL até o atual, em ordem (cada um se apoia no
 * anterior). Usado pelo total guardado / média, que somam todos os meses.
 */
export async function garantirFixosAteMesAtual(userId, hoje = mesAtual()) {
  for (let mes = mesSeguinte(MES_INICIAL); mes <= hoje; mes = mesSeguinte(mes)) {
    await gerarFixosDoMesTodos(userId, mes, hoje);
  }
}

/**
 * Grava a marca "removido deste mês" de um lançamento excluído (o "removidoDoMes"), para a
 * sincronização não recriá-lo. `emDiante` = o usuário excluiu também dos meses seguintes.
 * Idempotente (upsert). Nada é apagado.
 * @param {'receita'|'despesa'} tipo
 * @param {string} userId
 * @param {object} lancamento  o lançamento excluído (precisa das chaves e do createdAt)
 * @param {boolean} emDiante
 */
export async function marcarRemovido(tipo, userId, lancamento, emDiante = false) {
  const chave = chaveDoFixo(tipo, lancamento);
  const mes = mesDe(lancamento.createdAt);
  await FixoRemovido.updateOne(
    { userId, tipo, chave, mes },
    // `emDiante` nunca volta de true para false (uma exclusão "e seguintes" vale mais que uma "só deste").
    emDiante ? { $set: { emDiante: true }, $setOnInsert: { criadoEm: new Date() } } : { $setOnInsert: { emDiante: false, criadoEm: new Date() } },
    { upsert: true },
  );
}
