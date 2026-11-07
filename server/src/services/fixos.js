/**
 * Serviço "Copiar fixos do mês anterior" — usado por Receitas e Despesas.
 *
 * Lançamentos marcados com `recorrente: true` ("Repete todo mês") do mês
 * anterior são copiados para o mês escolhido, mantendo os campos de conteúdo
 * (descrição, categoria, valor…) e o dia do mês, para o usuário só editar o
 * que mudou (ex.: a conta de luz).
 *
 * Anti-duplicação: um fixo NÃO é copiado se o mês de destino já tem um
 * lançamento recorrente com a mesma "chave" (ex.: mesma descrição). Rodar a
 * cópia duas vezes não duplica nada.
 *
 * Isolamento: tudo filtrado por `userId`.
 */
import { diaDe, dataNoMes, filtroDoMes, mesAnterior } from '../utils/mes.js';

// Normaliza para comparar chaves sem diferenciar caixa e espaços nas pontas.
const normalizar = (v) => String(v ?? '').trim().toLowerCase();

/**
 * @param {object}   opcoes
 * @param {import('mongoose').Model} opcoes.Model  `Receita` ou `Despesa`.
 * @param {string}   opcoes.userId                  dono dos lançamentos.
 * @param {string}   opcoes.mes                     mês de DESTINO, "AAAA-MM" (já validado).
 * @param {string[]} opcoes.chaves                  campos que definem "o mesmo lançamento"
 *                                                  (Despesa: ['descricao']; Receita: ['fonte','descricao']).
 * @param {string[]} opcoes.campos                  campos copiados para o novo lançamento.
 * @returns {Promise<{ copiadas: number, ignoradas: number, mesOrigem: string, fixosNaOrigem: number }>}
 *          `ignoradas` = fixos que já existiam no mês de destino.
 */
export async function copiarFixos({ Model, userId, mes, chaves, campos }) {
  const mesOrigem = mesAnterior(mes);

  const [fixosOrigem, fixosDestino] = await Promise.all([
    Model.find({ userId, recorrente: true, ...filtroDoMes(mesOrigem) }).sort({ createdAt: 1 }),
    Model.find({ userId, recorrente: true, ...filtroDoMes(mes) }),
  ]);

  const chaveDe = (doc) => chaves.map((c) => normalizar(doc[c])).join('|');
  const existentes = new Set(fixosDestino.map(chaveDe));

  const novos = [];
  let ignoradas = 0;

  for (const fixo of fixosOrigem) {
    const chave = chaveDe(fixo);
    if (existentes.has(chave)) {
      ignoradas += 1;
      continue;
    }
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

  return {
    copiadas: novos.length,
    ignoradas,
    mesOrigem,
    fixosNaOrigem: fixosOrigem.length,
  };
}
