/**
 * PROPAGAÇÃO DOS LANÇAMENTOS FIXOS ("Repete todo mês") para os MESES SEGUINTES.
 *
 * Ao editar um fixo, a mudança vale também para as cópias dele nos meses POSTERIORES — assim não é
 * preciso editar de novo todo mês. Meses ANTERIORES nunca são tocados.
 *
 * COMO ACHAR "AS CÓPIAS" DE UM FIXO
 *   Mesmo usuário, `recorrente: true`, `createdAt` a partir do 1º dia do mês SEGUINTE ao do lançamento
 *   editado, e a mesma CHAVE normalizada (sem diferenciar maiúsculas, acentos e espaços):
 *     - Despesa: a descrição;
 *     - Receita: a fonte + a descrição (a mesma chave usada na geração dos fixos — services/fixos.js).
 *   Se o usuário RENOMEIA, a chave ANTIGA (antes da edição) é usada para achar as cópias e os valores
 *   NOVOS são gravados nelas.
 *
 * QUAIS CAMPOS SE PROPAGAM (`CAMPOS_PROPAGADOS`)
 *   - Despesa: descrição, categoria, cartão (`cartaoId` + o `cartao` que o acompanha) e "Repete todo mês";
 *   - Receita: fonte, descrição e "Repete todo mês".
 *   Desmarcar "Repete todo mês" também desmarca as cópias seguintes (deixam de ser fixas).
 * QUAIS NÃO SE PROPAGAM (de propósito)
 *   - `valor`: varia todo mês (ex.: a conta de luz) — cada mês mantém o seu;
 *   - `paga`: cada mês tem o seu pagamento.
 *
 * EXCLUSÃO: `idsDosSeguintes` acha as mesmas cópias para a opção "excluir também dos meses seguintes"
 * (escolha explícita do usuário; o padrão é excluir só o mês).
 *
 * Isolamento: tudo filtrado por `userId`. Nada é apagado aqui (só `$set` de campos específicos).
 */
import { Receita } from '../models/Receita.js';
import { Despesa } from '../models/Despesa.js';
import { User } from '../models/User.js';
import { limitesDoMes, mesAnterior, mesDe, mesSeguinte } from '../utils/mes.js';

/** Campos que se propagam, por tipo (valor e paga ficam de fora — ver o topo). */
export const CAMPOS_PROPAGADOS = {
  despesa: ['descricao', 'categoria', 'cartaoId', 'cartao', 'recorrente'],
  receita: ['fonte', 'descricao', 'recorrente'],
};

/** Model e campos que formam a CHAVE de identificação do fixo, por tipo. */
const CONFIG = {
  despesa: { Model: Despesa, chaves: ['descricao'] },
  receita: { Model: Receita, chaves: ['fonte', 'descricao'] },
};

/** Texto normalizado: sem acentos, minúsculas e espaços simples sem as pontas ("Água  Luz " → "agua luz"). */
export function normalizarTexto(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira os acentos (marcas combinantes)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chave normalizada de um lançamento (ex.: despesa "Energia Elétrica" → "energia eletrica"). */
export function chaveDoFixo(tipo, doc) {
  return CONFIG[tipo].chaves.map((c) => normalizarTexto(doc[c])).join('|');
}

/**
 * Ids dos lançamentos FIXOS dos meses POSTERIORES ao de `doc` que correspondem a ele (mesma chave).
 * @param   {'despesa'|'receita'} tipo
 * @param   {string} userId
 * @param   {object} doc  o lançamento como estava ANTES da edição (chave antiga, mês dele)
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
export async function idsDosSeguintes(tipo, userId, doc) {
  const { Model, chaves } = CONFIG[tipo];
  const inicioSeguinte = limitesDoMes(mesSeguinte(mesDe(doc.createdAt))).inicio; // nunca o próprio mês nem anteriores
  const candidatos = await Model.find({ userId, recorrente: true, createdAt: { $gte: inicioSeguinte } })
    .select(['_id', ...chaves])
    .lean();
  const chave = chaveDoFixo(tipo, doc);
  return candidatos.filter((c) => chaveDoFixo(tipo, c) === chave).map((c) => c._id);
}

/**
 * Propaga a edição de um fixo para os meses seguintes (chamada na MESMA operação da edição).
 *
 * Só age se o lançamento era fixo ANTES ou passou a ser fixo AGORA. Grava nas cópias apenas os
 * `CAMPOS_PROPAGADOS` com os valores NOVOS (do documento já atualizado).
 *
 * @param   {'despesa'|'receita'} tipo
 * @param   {string} userId
 * @param   {object} antes   documento antes da edição (para a chave antiga e o mês)
 * @param   {object} depois  documento depois da edição (valores novos)
 * @returns {Promise<number>} quantos lançamentos dos meses seguintes foram alterados (0 se nenhum)
 */
export async function propagarEdicaoFixo(tipo, userId, antes, depois) {
  if (!antes.recorrente && !depois.recorrente) return 0; // não é fixo: nada a propagar
  const ids = await idsDosSeguintes(tipo, userId, antes);
  if (ids.length === 0) return 0;

  const set = {};
  for (const campo of CAMPOS_PROPAGADOS[tipo]) set[campo] = depois[campo] ?? null;
  if (tipo === 'despesa') set.cartao = Boolean(depois.cartaoId) || Boolean(depois.cartao); // mantém o par em sincronia

  const { Model } = CONFIG[tipo];
  const r = await Model.updateMany({ _id: { $in: ids }, userId }, { $set: set });
  return r.modifiedCount;
}

/**
 * AJUSTE ÚNICO dos fixos que já existiam (roda UMA vez por usuário, ao abrir Despesas).
 *
 * Corrige os meses copiados ANTES de o usuário marcar o cartão no mês anterior (ex.: novembro foi
 * gerado de outubro e só depois o cartão foi marcado em outubro). Para cada despesa FIXA de um mês M
 * (do 2º mês com fixos em diante), SEM cartão (nem `cartaoId` nem o `cartao` antigo), que tenha uma
 * correspondente fixa (mesma descrição normalizada) no mês IMEDIATAMENTE anterior COM cartão: copia o
 * cartão e a categoria dessa correspondente. Os meses são percorridos em ordem, então a correção desce
 * em cadeia (out → nov → dez).
 * NÃO altera valor, paga, nem despesas que já têm cartão. Receitas não entram (não têm cartão nem
 * categoria). Nada é apagado.
 *
 * Idempotente e seguro com requisições simultâneas: "reivindica" o ajuste com uma atualização atômica
 * do flag `User.fixosAjustados`; só quem ganha executa (se falhar no meio, o flag é desfeito).
 *
 * @param   {string} userId
 * @returns {Promise<number>} quantas despesas foram ajustadas nesta chamada (0 se já tinha rodado)
 */
export async function ajustarFixosExistentes(userId) {
  const reivindicado = await User.findOneAndUpdate(
    { _id: userId, fixosAjustados: { $ne: true } },
    { $set: { fixosAjustados: true } },
  );
  if (!reivindicado) return 0; // já rodou (ou outra requisição está rodando)

  try {
    const fixos = await Despesa.find({ userId, recorrente: true })
      .select('_id descricao categoria cartao cartaoId createdAt')
      .sort({ createdAt: 1 })
      .lean();

    // mês → (chave → despesa fixa). Se houver repetidas no mesmo mês, fica a primeira.
    const porMes = new Map();
    for (const d of fixos) {
      const mes = mesDe(d.createdAt);
      if (!porMes.has(mes)) porMes.set(mes, new Map());
      const chave = chaveDoFixo('despesa', d);
      if (!porMes.get(mes).has(chave)) porMes.get(mes).set(chave, d);
    }

    const temCartao = (d) => Boolean(d.cartaoId) || d.cartao === true;

    let ajustadas = 0;
    for (const mes of [...porMes.keys()].sort()) {
      const anteriores = porMes.get(mesAnterior(mes)); // só o mês IMEDIATAMENTE anterior
      if (!anteriores) continue;
      for (const [chave, d] of porMes.get(mes)) {
        const origem = anteriores.get(chave);
        if (!origem || temCartao(d) || !temCartao(origem)) continue; // só preenche cartão VAZIO
        const set = { cartaoId: origem.cartaoId ?? null, cartao: true, categoria: origem.categoria };
        await Despesa.updateOne({ _id: d._id, userId }, { $set: set });
        Object.assign(d, set); // a correção vale para o mês seguinte (cadeia)
        ajustadas += 1;
      }
    }
    return ajustadas;
  } catch (erro) {
    await User.updateOne({ _id: userId }, { $set: { fixosAjustados: false } }).catch(() => {});
    throw erro;
  }
}
