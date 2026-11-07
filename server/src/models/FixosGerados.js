/**
 * Model: FixosGerados — marcador de "os fixos deste mês já foram gerados".
 *
 * Para que a geração automática de lançamentos recorrentes NUNCA duplique — nem
 * se a tela abrir duas vezes, nem com dois aparelhos ao mesmo tempo — cada
 * (usuário, tipo, mês) tem no máximo UM marcador, garantido por um ÍNDICE ÚNICO.
 * Quem consegue inserir o marcador "ganha" o direito de gerar aquele mês; as
 * outras requisições simultâneas recebem erro de chave duplicada e não geram.
 *
 * Efeito colateral útil: o mês é gerado uma única vez, então se você apagar um
 * lançamento fixo gerado, ele NÃO ressuscita na próxima vez que abrir o mês.
 *
 * Campos:
 *  - userId      : dono (ObjectId → User). Tudo é isolado por usuário.
 *  - tipo        : 'receita' | 'despesa' (cada uma tem a sua geração).
 *  - mes         : mês gerado, "AAAA-MM".
 *  - criadoEm    : quando a geração começou (usado para detectar geração "travada").
 *  - concluidoEm : quando terminou. Enquanto for `null`, a geração está em andamento
 *                  (ou travou — ver services/fixos.js, que recupera marcadores velhos).
 */
import mongoose from 'mongoose';

const fixosGeradosSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tipo: { type: String, enum: ['receita', 'despesa'], required: true },
  mes: { type: String, required: true },
  criadoEm: { type: Date, default: Date.now },
  concluidoEm: { type: Date, default: null },
});

// O índice único é o que impede duplicação mesmo com requisições simultâneas.
fixosGeradosSchema.index({ userId: 1, tipo: 1, mes: 1 }, { unique: true });

export const FixosGerados = mongoose.model('FixosGerados', fixosGeradosSchema);
