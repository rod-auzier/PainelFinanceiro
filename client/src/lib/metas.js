/**
 * Regra de ORDENAÇÃO das metas — definida em UM só lugar.
 *
 * A tela de Metas deriva a lista exibida do estado (`metas`) usando esta função dentro
 * de um `useMemo`. Como a ordem é sempre recalculada a partir do estado, a lista se
 * reorganiza sozinha ao marcar, desmarcar, editar (título/valor) ou adicionar uma meta —
 * inclusive nas atualizações otimistas, que alteram o estado antes da API responder.
 *
 * REGRA
 *  1. Pendentes primeiro, concluídas depois (dois grupos).
 *  2. Dentro de cada grupo:
 *       a) metas COM valorAlvo, do MENOR para o MAIOR (5 mil, 10 mil, 15 mil, 20 mil…);
 *          empate de valor → a mais antiga primeiro;
 *       b) metas SEM valorAlvo (só checklist) ficam depois das que têm valor, a mais
 *          antiga primeiro.
 */

/** `true` se a meta tem um valor alvo utilizável (número maior que zero). */
const temValor = (meta) => typeof meta.valorAlvo === 'number' && meta.valorAlvo > 0;

/** Timestamp de criação (ms). Sem `createdAt`, vai para o fim ("mais nova"). */
const criadaEm = (meta) => {
  const t = new Date(meta.createdAt).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};

/**
 * Comparador de metas DENTRO de um mesmo grupo (pendentes ou concluídas).
 * Negativo = `a` vem antes de `b`.
 */
export function compararMetas(a, b) {
  const aTem = temValor(a);
  const bTem = temValor(b);

  if (aTem !== bTem) return aTem ? -1 : 1; // com valor antes de sem valor

  if (aTem && a.valorAlvo !== b.valorAlvo) return a.valorAlvo - b.valorAlvo; // menor valor primeiro

  return criadaEm(a) - criadaEm(b); // empate (ou ambas sem valor): a mais antiga primeiro
}

/**
 * Separa e ordena as metas para exibição.
 * Não altera o array recebido.
 *
 * @param   {Array<{ concluida: boolean, valorAlvo: number|null, createdAt: string }>} metas
 * @returns {{ pendentes: Array, concluidas: Array }}  cada grupo já ordenado (ver regra acima)
 */
export function ordenarMetas(metas) {
  return {
    pendentes: metas.filter((m) => !m.concluida).sort(compararMetas),
    concluidas: metas.filter((m) => m.concluida).sort(compararMetas),
  };
}
