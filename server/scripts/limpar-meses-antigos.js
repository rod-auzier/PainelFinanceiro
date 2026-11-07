/**
 * Limpeza dos lançamentos ANTERIORES ao início do painel (MES_INICIAL = 2026-10).
 *
 * Remove receitas e despesas de UM usuário com data anterior a 01/10/2026
 * (00h de Brasília) — por exemplo, as cópias de fixos feitas em meses antigos.
 *
 * SEGURANÇA
 *  - Por padrão roda em DRY-RUN: só LISTA o que seria apagado. NADA é apagado.
 *  - Só apaga com o parâmetro explícito `--confirmar`.
 *  - Exige `--email=<seu e-mail>`: mexe apenas nos registros desse usuário.
 *  - O filtro é sempre `createdAt < 2026-10-01 00:00 (Brasília)`: registros de
 *    outubro/2026 em diante NUNCA são tocados (o script confere as contagens antes
 *    e depois e avisa se algo de outubro em diante mudou).
 *
 * USO (rode dentro da pasta server/, onde está o .env com a MONGO_URI):
 *   npm run limpar:antigos -- --email=voce@exemplo.com              # só lista (dry-run)
 *   npm run limpar:antigos -- --email=voce@exemplo.com --confirmar  # apaga de verdade
 *
 * (Equivalente: node scripts/limpar-meses-antigos.js --email=... [--confirmar])
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Despesa } from '../src/models/Despesa.js';
import { Receita } from '../src/models/Receita.js';
import { User } from '../src/models/User.js';
import { MES_INICIAL, limitesDoMes } from '../src/utils/mes.js';

/** Lê `--email=...` e `--confirmar`. Qualquer outro argumento aborta (evita typo perigoso). */
function lerArgumentos(argv) {
  const args = { email: null, confirmar: false };
  for (const arg of argv) {
    if (arg === '--confirmar') args.confirmar = true;
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length).trim().toLowerCase();
    else throw new Error(`Argumento desconhecido: "${arg}". Use --email=<e-mail> [--confirmar].`);
  }
  if (!args.email) throw new Error('Informe o usuário: --email=<seu e-mail>.');
  return args;
}

const formatarData = (d) =>
  new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

const formatarValor = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function main() {
  const { email, confirmar } = lerArgumentos(process.argv.slice(2));

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI não definida. Rode dentro de server/ (onde está o .env).');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Banco: ${mongoose.connection.name}`);

  const usuario = await User.findOne({ email });
  if (!usuario) throw new Error(`Usuário não encontrado: ${email}`);

  // Tudo ANTES deste instante é "antigo": 01/10/2026 00:00 (Brasília).
  const limite = limitesDoMes(MES_INICIAL).inicio;
  const antigos = { userId: usuario._id, createdAt: { $lt: limite } };
  const atuais = { userId: usuario._id, createdAt: { $gte: limite } };

  console.log(`Usuário: ${email}`);
  console.log(`Limite: ${formatarData(limite)} (Brasília) — só registros ANTERIORES a isso entram na limpeza.\n`);

  const [receitas, despesas] = await Promise.all([
    Receita.find(antigos).sort({ createdAt: 1 }),
    Despesa.find(antigos).sort({ createdAt: 1 }),
  ]);

  console.log(`RECEITAS anteriores a ${MES_INICIAL}: ${receitas.length}`);
  for (const r of receitas) {
    const detalhe = r.descricao ? `${r.fonte} — ${r.descricao}` : r.fonte;
    console.log(`  ${formatarData(r.createdAt)}  ${detalhe}  ${formatarValor(r.valor)}${r.recorrente ? '  [fixa]' : ''}`);
  }
  console.log(`\nDESPESAS anteriores a ${MES_INICIAL}: ${despesas.length}`);
  for (const d of despesas) {
    console.log(`  ${formatarData(d.createdAt)}  ${d.descricao} (${d.categoria})  ${formatarValor(d.valor)}${d.recorrente ? '  [fixa]' : ''}`);
  }

  const total = receitas.length + despesas.length;
  const [receitasAtuais, despesasAtuais] = await Promise.all([Receita.countDocuments(atuais), Despesa.countDocuments(atuais)]);
  console.log(`\nSerão preservados (de ${MES_INICIAL} em diante): ${receitasAtuais} receitas, ${despesasAtuais} despesas.`);

  if (total === 0) {
    console.log('\nNada a apagar.');
    return;
  }

  if (!confirmar) {
    console.log(`\nDRY-RUN: NADA foi apagado. ${total} registro(s) seriam removidos.`);
    console.log('Para apagar de verdade, rode de novo com --confirmar:');
    console.log(`  npm run limpar:antigos -- --email=${email} --confirmar`);
    return;
  }

  // --- Apagando (confirmado) ---
  const [apR, apD] = await Promise.all([Receita.deleteMany(antigos), Despesa.deleteMany(antigos)]);
  console.log(`\nApagados: ${apR.deletedCount} receitas e ${apD.deletedCount} despesas.`);

  // Conferência: nada de outubro/2026 em diante pode ter mudado.
  const [receitasDepois, despesasDepois] = await Promise.all([Receita.countDocuments(atuais), Despesa.countDocuments(atuais)]);
  if (receitasDepois === receitasAtuais && despesasDepois === despesasAtuais) {
    console.log(`Conferência OK: registros de ${MES_INICIAL} em diante intactos.`);
  } else {
    console.error('ATENÇÃO: a contagem de registros atuais mudou! Verifique o banco.');
    process.exitCode = 1;
  }
}

main()
  .catch((erro) => {
    console.error(`\nErro: ${erro.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
