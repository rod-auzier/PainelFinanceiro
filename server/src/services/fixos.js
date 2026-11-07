/**
 * Geração AUTOMÁTICA dos lançamentos fixos (`recorrente: true`) — Receitas e Despesas.
 *
 * Ao abrir um mês, se ele ainda não foi "gerado", o sistema cria sozinho os
 * lançamentos recorrentes do mês de origem, mantendo descrição, categoria,
 * valor e o dia do mês — o usuário só edita o que mudou (ex.: a conta de luz).
 *
 * REGRAS
 *  - Só gera para meses de MES_INICIAL (exclusive) até o mês ATUAL. Meses
 *    futuros (navegados só para olhar) não geram nada.
 *  - ORIGEM = o mês mais recente, anterior ao alvo e não anterior a MES_INICIAL,
 *    que tenha ao menos um recorrente. Por isso pular um mês não quebra nada
 *    (se novembro nunca foi aberto, janeiro copia de outubro).
 *  - Não duplica um lançamento que já existe no mês de destino (mesma "chave":
 *    Despesa = descrição; Receita = fonte + descrição — comparação sem diferenciar
 *    caixa/espaços — e também recorrente).
 *
 * IDEMPOTÊNCIA E CONCORRÊNCIA
 *  Cada (usuário, tipo, mês) tem um marcador em `FixosGerados` com ÍNDICE ÚNICO.
 *  Gerar = "reivindicar" o marcador (insert). Se duas requisições chegam juntas
 *  (tela aberta duas vezes, dois aparelhos), só uma consegue inserir o marcador e
 *  gerar; a outra recebe chave duplicada, não gera nada e espera a primeira terminar.
 *  O marcador só é criado quando há o que copiar — assim, abrir um mês cujo mês de
 *  origem ainda não tem recorrentes não "queima" a geração. E, como cada mês é
 *  gerado uma única vez, um fixo que você apagar não ressuscita.
 *  Se a geração travar no meio (ex.: função serverless interrompida), o marcador
 *  fica "velho" (sem `concluidoEm`) e é recuperado automaticamente após 30 s.
 *
 * Isolamento: tudo filtrado por `userId`.
 */
import { Receita } from '../models/Receita.js';
import { Despesa } from '../models/Despesa.js';
import { FixosGerados } from '../models/FixosGerados.js';
import {
  MES_INICIAL,
  dataNoMes,
  diaDe,
  filtroDoMes,
  limitesDoMes,
  mesDe,
  mesSeguinte,
} from '../utils/mes.js';

/** Como cada tipo de lançamento é identificado e copiado. */
export const CONFIG_FIXOS = {
  despesa: { Model: Despesa, chaves: ['descricao'], campos: ['descricao', 'categoria', 'valor'] },
  receita: { Model: Receita, chaves: ['fonte', 'descricao'], campos: ['fonte', 'descricao', 'valor'] },
};

const ESPERA_MAX_MS = 3000; // quanto o "perdedor" da corrida espera o "ganhador" terminar
const ESPERA_PASSO_MS = 150;
const MARCADOR_TRAVADO_MS = 30_000; // marcador sem conclusão há mais que isso = geração travada

const normalizar = (v) => String(v ?? '').trim().toLowerCase();
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tenta "reivindicar" a geração de (usuário, tipo, mês).
 * @returns {Promise<boolean>} `true` se esta chamada ganhou e deve gerar.
 */
async function reivindicar(userId, tipo, mes) {
  const inserir = async () => {
    try {
      await FixosGerados.create({ userId, tipo, mes });
      return true;
    } catch (erro) {
      if (erro?.code === 11000) return false; // chave duplicada: outra requisição já reivindicou
      throw erro;
    }
  };

  if (await inserir()) return true;

  // Já existia. Se estiver travado (sem conclusão há muito tempo), remove e tenta de novo.
  const limite = new Date(Date.now() - MARCADOR_TRAVADO_MS);
  const velho = await FixosGerados.findOneAndDelete({
    userId,
    tipo,
    mes,
    concluidoEm: null,
    criadoEm: { $lt: limite },
  });
  return velho ? inserir() : false;
}

/** Espera (até ESPERA_MAX_MS) a geração em andamento de outra requisição terminar. */
async function aguardarConclusao(userId, tipo, mes) {
  const fim = Date.now() + ESPERA_MAX_MS;
  while (Date.now() < fim) {
    const marcador = await FixosGerados.findOne({ userId, tipo, mes }).select('concluidoEm');
    if (!marcador || marcador.concluidoEm) return;
    await dormir(ESPERA_PASSO_MS);
  }
}

/**
 * Gera os fixos de UM tipo para UM mês, se ainda for o caso.
 *
 * @param   {'receita'|'despesa'} tipo
 * @param   {string} userId
 * @param   {string} mes     mês a gerar, "AAAA-MM" (já validado, ≥ MES_INICIAL)
 * @param   {string} [hoje]  mês ATUAL "AAAA-MM" (padrão: agora). Parâmetro para testes.
 * @returns {Promise<number>} quantos lançamentos foram criados NESTA chamada (0 se não
 *          era para gerar, já estava gerado, não havia origem ou outra requisição gerou).
 */
export async function gerarFixosDoMes(tipo, userId, mes, hoje = mesDe()) {
  // MES_INICIAL não tem origem (nada antes dele); meses futuros não geram.
  if (mes <= MES_INICIAL || mes > hoje) return 0;

  await FixosGerados.init(); // garante o índice único antes de depender dele

  const marcador = await FixosGerados.findOne({ userId, tipo, mes }).select('concluidoEm');
  if (marcador?.concluidoEm) return 0; // caminho rápido: já gerado

  const { Model, chaves, campos } = CONFIG_FIXOS[tipo];

  // Origem: o mês mais recente (entre MES_INICIAL e o alvo) que tenha recorrentes.
  const maisRecente = await Model.findOne({
    userId,
    recorrente: true,
    createdAt: { $gte: limitesDoMes(MES_INICIAL).inicio, $lt: limitesDoMes(mes).inicio },
  })
    .sort({ createdAt: -1 })
    .select('createdAt');
  if (!maisRecente) return 0; // nada para copiar (e não queima o marcador)
  const mesOrigem = mesDe(maisRecente.createdAt);

  if (!(await reivindicar(userId, tipo, mes))) {
    await aguardarConclusao(userId, tipo, mes);
    return 0; // outra requisição gerou (ou está gerando) este mês
  }

  try {
    const [fixosOrigem, fixosDestino] = await Promise.all([
      Model.find({ userId, recorrente: true, ...filtroDoMes(mesOrigem) }).sort({ createdAt: 1 }),
      Model.find({ userId, recorrente: true, ...filtroDoMes(mes) }),
    ]);

    const chaveDe = (doc) => chaves.map((c) => normalizar(doc[c])).join('|');
    const existentes = new Set(fixosDestino.map(chaveDe));

    const novos = [];
    for (const fixo of fixosOrigem) {
      const chave = chaveDe(fixo);
      if (existentes.has(chave)) continue; // já existe neste mês
      existentes.add(chave); // também evita duplicar fixos repetidos na própria origem

      const copia = {
        userId,
        recorrente: true,
        createdAt: dataNoMes(mes, diaDe(fixo.createdAt)), // mesmo dia, mês de destino
      };
      for (const campo of campos) copia[campo] = fixo[campo];
      novos.push(copia);
    }

    if (novos.length > 0) await Model.insertMany(novos);
    await FixosGerados.updateOne({ userId, tipo, mes }, { concluidoEm: new Date() });
    return novos.length;
  } catch (erro) {
    // Falhou no meio: libera o marcador para que uma próxima abertura tente de novo.
    await FixosGerados.deleteOne({ userId, tipo, mes }).catch(() => {});
    throw erro;
  }
}

/**
 * Gera os fixos de receitas E despesas para um mês (o que a abertura do mês dispara).
 * @returns {Promise<{ receitas: number, despesas: number, total: number }>}
 */
export async function gerarFixosDoMesTodos(userId, mes, hoje = mesDe()) {
  const receitas = await gerarFixosDoMes('receita', userId, mes, hoje);
  const despesas = await gerarFixosDoMes('despesa', userId, mes, hoje);
  return { receitas, despesas, total: receitas + despesas };
}

/**
 * Garante que TODOS os meses, de MES_INICIAL até o mês atual, já foram gerados —
 * em ordem, do mais antigo ao mais novo (cada um se apoia no anterior). Usado pelo
 * "total guardado", que soma todos os meses e não pode ficar sem os fixos de um mês
 * que ainda não foi aberto na tela.
 * @param {string} userId
 * @param {string} [hoje] mês atual "AAAA-MM" (padrão: agora). Parâmetro para testes.
 */
export async function garantirFixosAteMesAtual(userId, hoje = mesDe()) {
  for (let mes = mesSeguinte(MES_INICIAL); mes <= hoje; mes = mesSeguinte(mes)) {
    await gerarFixosDoMesTodos(userId, mes, hoje);
  }
}
