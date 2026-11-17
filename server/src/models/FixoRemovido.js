/**
 * Model: FixoRemovido — marca "este lançamento fixo foi EXCLUÍDO deste mês" (o "removidoDoMes").
 *
 * A sincronização dos fixos (services/fixos.js) cria, em cada mês, as cópias que faltam dos lançamentos
 * com "Repete todo mês". Sem esta marca, um fixo que o usuário excluiu de um mês voltaria na próxima
 * sincronização. Por isso, ao excluir um lançamento, gravamos aqui (usuário, tipo, chave, mês):
 *  - `emDiante: false` → "só deste mês": a sincronização não recria NESTE mês (nos seguintes continua);
 *  - `emDiante: true`  → "este e os meses seguintes": não recria neste mês nem nos seguintes — a menos
 *                        que o usuário volte a lançar o fixo DEPOIS (aí a fonte é mais nova que a marca).
 *
 * Campos:
 *  - userId   : dono. Tudo isolado por usuário.
 *  - tipo     : 'receita' | 'despesa'.
 *  - chave    : chave normalizada do lançamento (sem acento/maiúscula/espaços extras; despesa: descrição;
 *               receita: fonte + descrição) — a mesma usada para achar "o mesmo fixo" (services/propagacao.js).
 *  - mes      : "AAAA-MM" do mês em que foi excluído.
 *  - emDiante : ver acima. Padrão false.
 *  - criadoEm : quando foi marcado.
 * Nada é apagado por causa desta marca: ela só impede RECRIAR.
 */
import mongoose from 'mongoose';

const fixoRemovidoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tipo: { type: String, enum: ['receita', 'despesa'], required: true },
  chave: { type: String, required: true },
  mes: { type: String, required: true },
  emDiante: { type: Boolean, default: false },
  criadoEm: { type: Date, default: Date.now },
});

// Uma marca por (usuário, tipo, chave, mês).
fixoRemovidoSchema.index({ userId: 1, tipo: 1, chave: 1, mes: 1 }, { unique: true });

export const FixoRemovido = mongoose.model('FixoRemovido', fixoRemovidoSchema);
