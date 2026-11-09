/**
 * CartoesSecao — seção "Cartões de crédito" no topo da tela de Despesas: um <CartaoCard> por cartão
 * (fatura do mês, parte não detalhada, fatura paga), mais criar/editar/excluir cartões.
 *
 * Props:
 *  - mes        {string}  "AAAA-MM".
 *  - situacoes  {Array}   `cartoes` de GET /api/despesas?mes (situação de cada cartão no mês).
 *  - cartoes    {object}  retorno de useCartoes() (lista, limite, criar/atualizar/remover).
 *  - aoAlterar  {() => Promise<void>}  recarrega as despesas (linhas virtuais, totais, "paga").
 *
 * - EDITAR um cartão: o card vira o mini-formulário (nome + cor).
 * - EXCLUIR: confirmação no próprio card dizendo QUANTAS despesas viram despesas comuns (nunca são
 *   apagadas) e que as faturas dele saem; depois, aviso com o resultado.
 * - "+ Novo cartão" no fim (desabilitado no limite de 5), já com a 1ª cor livre da paleta (tons
 *   discretos, sem verde/vermelho puros).
 * - ESTADO VAZIO: explica para que servem os cartões e oferece criar o primeiro.
 * Layout: 1 coluna no celular, 2 no desktop (`lg`).
 */
import { useState } from 'react';
import { primeiraCorLivre } from '../lib/constants.js';
import CartaoCard, { IconeCartao } from './CartaoCard.jsx';
import FormCategoria from './FormCategoria.jsx';

const qtdTexto = (n) => `${n} ${n === 1 ? 'despesa' : 'despesas'}`;

export default function CartoesSecao({ mes, situacoes, cartoes, aoAlterar }) {
  const { cartoes: lista, limite, criar, atualizar, remover } = cartoes;
  const [editandoId, setEditandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [criando, setCriando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Um card por cartão do usuário (a lista de useCartoes manda: um cartão recém-criado já aparece,
  // mesmo antes de a lista de despesas recarregar). A situação do mês vem da API; sem ela, zerada.
  const itens = lista.map((c) => {
    const s = situacoes.find((x) => String(x.cartao._id) === String(c._id));
    const cartao = { _id: String(c._id), nome: c.nome, cor: c.cor, padrao: c.padrao };
    return s ? { ...s, cartao } : { cartao, fatura: null, detalhado: 0, naoDetalhado: 0, excedeu: false };
  });
  const qtdDe = (id) => lista.find((c) => String(c._id) === String(id))?.qtdDespesas ?? 0;

  /** Abre só UMA coisa por vez (edição, exclusão ou novo). */
  function focar({ editar = null, excluir = null, novo = false }) {
    setEditandoId(editar);
    setExcluindoId(excluir);
    setCriando(novo);
    setAviso('');
    setErro('');
  }

  async function salvarEdicao(id, dados) {
    await atualizar(id, dados); // erro sobe ao formulário
    setEditandoId(null);
    setAviso('Cartão salvo.');
    await aoAlterar(); // o nome aparece nas linhas virtuais e nos selos
  }

  async function salvarNovo(dados) {
    await criar(dados);
    setCriando(false);
    setAviso(`Cartão "${dados.nome}" criado.`);
    await aoAlterar();
  }

  async function confirmarExclusao(cartao) {
    setOcupado(true);
    setErro('');
    try {
      const { despesasAfetadas } = await remover(cartao._id);
      setExcluindoId(null);
      setAviso(
        `Cartão "${cartao.nome}" excluído.${despesasAfetadas ? ` ${qtdTexto(despesasAfetadas)} ${despesasAfetadas === 1 ? 'virou despesa comum' : 'viraram despesas comuns'}.` : ''}`,
      );
      await aoAlterar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível excluir o cartão.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="space-y-3" aria-label="Cartões de crédito">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span className="text-accent">
            <IconeCartao size={18} />
          </span>
          Cartões de crédito
          <span className="num text-xs font-normal text-muted">
            · {lista.length} de {limite}
          </span>
        </h2>
        {!criando && (
          <button
            type="button"
            disabled={lista.length >= limite}
            onClick={() => focar({ novo: true })}
            className="min-h-[44px] rounded border border-dashed border-border px-3 text-sm text-accent hover:opacity-80 disabled:cursor-not-allowed disabled:text-muted"
          >
            {lista.length >= limite ? `Limite de ${limite} cartões` : '+ Novo cartão'}
          </button>
        )}
      </div>

      {aviso && (
        <p role="status" className="text-sm text-positive">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      )}

      {criando && (
        <div className="rounded border border-accent bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Novo cartão</p>
          <FormCategoria
            inicial={{ nome: '', cor: primeiraCorLivre(lista) }}
            placeholder="Ex.: Nubank"
            rotuloSalvar="Criar"
            aoSalvar={salvarNovo}
            aoCancelar={() => setCriando(false)}
          />
        </div>
      )}

      {itens.length === 0 && !criando ? (
        /* Estado vazio claro */
        <div className="rounded border border-dashed border-border bg-surface p-4 text-sm">
          <p className="font-medium">Nenhum cartão cadastrado</p>
          <p className="mt-1 text-muted">
            Cadastre seus cartões (ex.: PicPay, Nubank) para informar o total de cada fatura. As compras que
            você não lançou entram no total — e as que você lançou nunca contam duas vezes.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {itens.map((s) => {
            const id = s.cartao._id;
            if (editandoId === id) {
              return (
                <div key={id} className="rounded border border-accent bg-surface p-4">
                  <p className="mb-3 text-sm font-medium">Editar cartão</p>
                  <FormCategoria
                    inicial={{ nome: s.cartao.nome, cor: s.cartao.cor }}
                    placeholder="Ex.: Nubank"
                    aoSalvar={(dados) => salvarEdicao(id, dados)}
                    aoCancelar={() => setEditandoId(null)}
                  />
                </div>
              );
            }
            if (excluindoId === id) {
              const qtd = qtdDe(id);
              return (
                <div key={id} role="alert" className="space-y-3 rounded border border-negative bg-surface p-4 text-sm">
                  <p>
                    Excluir o cartão <span className="font-medium">"{s.cartao.nome}"</span>?{' '}
                    {qtd > 0
                      ? `${qtdTexto(qtd)} ${qtd === 1 ? 'vai virar despesa comum' : 'vão virar despesas comuns'} (nenhuma é apagada).`
                      : 'Nenhuma despesa usa este cartão.'}{' '}
                    As faturas informadas dele serão removidas.
                  </p>
                  <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => confirmarExclusao(s.cartao)}
                      className="min-h-[44px] rounded bg-negative px-4 font-medium text-bg hover:opacity-90 disabled:opacity-60"
                    >
                      {ocupado ? 'Excluindo…' : 'Excluir'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcluindoId(null)}
                      className="min-h-[44px] rounded border border-border px-4 text-muted hover:text-fg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <CartaoCard
                key={id}
                mes={mes}
                situacao={s}
                aoAlterar={aoAlterar}
                onEditar={() => focar({ editar: id })}
                onExcluir={() => focar({ excluir: id })}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
