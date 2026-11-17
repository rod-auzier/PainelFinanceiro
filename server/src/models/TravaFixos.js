/**
 * Model: TravaFixos — trava CURTA da sincronização dos fixos de (usuário, tipo, mês).
 *
 * A sincronização é idempotente (só cria o que falta), mas duas requisições ao MESMO tempo (a tela abre
 * /despesas e /resumo juntas, ou dois aparelhos) poderiam ver a mesma falta e criar a cópia duas vezes.
 * Quem consegue inserir a trava (índice único) sincroniza; as outras esperam ela sair e não criam nada.
 * A trava é REMOVIDA ao terminar (não é um marcador de "mês já gerado" — cada abertura confere de novo,
 * item a item). Uma trava esquecida (função serverless interrompida) é descartada após 30 s.
 *
 * Campos: userId, tipo ('receita' | 'despesa'), mes ("AAAA-MM"), criadoEm.
 */
import mongoose from 'mongoose';

const travaFixosSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tipo: { type: String, enum: ['receita', 'despesa'], required: true },
  mes: { type: String, required: true },
  criadoEm: { type: Date, default: Date.now },
});

travaFixosSchema.index({ userId: 1, tipo: 1, mes: 1 }, { unique: true });

export const TravaFixos = mongoose.model('TravaFixos', travaFixosSchema);
