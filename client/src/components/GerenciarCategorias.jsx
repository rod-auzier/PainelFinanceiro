/**
 * GerenciarCategorias — seção "Categorias" da tela de Despesas: criar, editar e excluir as
 * categorias PERSONALIZADAS do usuário.
 *
 * Fechada, é só uma faixa com "Categorias · X de 15" e o botão "Gerenciar". Aberta:
 *  - lista com bolinha de cor, nome e quantas despesas (de todos os meses) usam a categoria;
 *  - botão EDITAR (lápis): troca a linha pelo <FormCategoria> (nome + cor). Renomear também
 *    renomeia nas despesas (o servidor faz isso) e a tela avisa quantas foram atualizadas;
 *  - botão EXCLUIR (lixeira): pede CONFIRMAÇÃO na própria linha, dizendo quantas despesas serão
 *    movidas para "Outros" (nunca são apagadas); depois avisa quantas foram movidas;
 *  - "Outros" aparece SEM editar/excluir (é fixa: destino das despesas de categorias excluídas);
 *  - "+ Nova categoria" no fim (desabilitado ao atingir o limite), já com a 1ª cor livre da paleta.
 * Ao abrir, recarrega a lista para as contagens de despesas estarem em dia.
 *
 * Props:
 *  - inicialAberto {boolean}  começa já aberta (usado quando a seção é mostrada numa janela/modal —
 *              link "Gerenciar categorias" da lista de Despesas). Padrão false.
 *  - onFechar  {() => void}  (opcional) chamado ao clicar "Fechar" — a janela em volta se fecha.
 *  - aoAlterar {() => void}  chamado depois de renomear/excluir, para a tela recarregar as
 *              despesas (os nomes de categoria delas podem ter mudado).
 *
 * Tema Grafite: card sólido (bg-surface + borda hairline); botões e linhas com ≥ 44px de toque.
 */
import { useEffect, useState } from 'react';
import { useCategorias } from '../context/CategoriasContext.jsx';
import { NOME_OUTROS, ehOutros, primeiraCorLivre } from '../lib/constants.js';
import CategoriaPonto from './CategoriaPonto.jsx';
import FormCategoria from './FormCategoria.jsx';

/** "1 despesa" / "3 despesas". */
const qtdTexto = (n) => `${n} ${n === 1 ? 'despesa' : 'despesas'}`;

/** Ícone de lápis (editar). */
function IconeLapis() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Ícone de lixeira (excluir). */
function IconeLixeira() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function GerenciarCategorias({ aoAlterar, inicialAberto = false, onFechar }) {
  const { categorias, limite, carregando, erro, recarregar, criar, atualizar, remover } = useCategorias();
  const [aberto, setAberto] = useState(inicialAberto);

  // Aberta desde o início (modal): atualiza as contagens de despesas ao montar.
  useEffect(() => {
    if (inicialAberto) recarregar();
  }, [inicialAberto, recarregar]);
  const [editandoId, setEditandoId] = useState(null); // categoria com o formulário aberto
  const [excluindoId, setExcluindoId] = useState(null); // categoria com a confirmação aberta
  const [criando, setCriando] = useState(false); // formulário de nova categoria aberto
  const [aviso, setAviso] = useState(''); // resultado da última ação (verde)
  const [erroAcao, setErroAcao] = useState(''); // falha ao excluir (vermelho)
  const [ocupado, setOcupado] = useState(false);

  const noLimite = categorias.length >= limite;

  /** Abre/fecha a seção; ao abrir, atualiza as contagens. */
  function alternar() {
    if (aberto && onFechar) return onFechar(); // dentro de uma janela: "Fechar" fecha a janela
    const abrir = !aberto;
    setAberto(abrir);
    setEditandoId(null);
    setExcluindoId(null);
    setCriando(false);
    setAviso('');
    setErroAcao('');
    if (abrir) recarregar();
  }

  /** Só UM formulário/confirmação aberto por vez. */
  function focar({ editar = null, excluir = null, nova = false }) {
    setEditandoId(editar);
    setExcluindoId(excluir);
    setCriando(nova);
    setAviso('');
    setErroAcao('');
  }

  async function salvarEdicao(categoria, dados) {
    const { despesasAtualizadas } = await atualizar(categoria._id, dados); // erro sobe ao formulário
    setEditandoId(null);
    if (despesasAtualizadas > 0) {
      setAviso(`Categoria salva. ${qtdTexto(despesasAtualizadas)} ${despesasAtualizadas === 1 ? 'atualizada' : 'atualizadas'}.`);
      aoAlterar?.();
    } else {
      setAviso('Categoria salva.');
      if (dados.nome !== categoria.nome) aoAlterar?.();
    }
  }

  async function confirmarExclusao(categoria) {
    setOcupado(true);
    setErroAcao('');
    try {
      const { movidas } = await remover(categoria._id);
      setExcluindoId(null);
      setAviso(
        movidas > 0
          ? `"${categoria.nome}" excluída. ${qtdTexto(movidas)} ${movidas === 1 ? 'movida' : 'movidas'} para "${NOME_OUTROS}".`
          : `"${categoria.nome}" excluída.`,
      );
      aoAlterar?.();
    } catch (err) {
      setErroAcao(err.response?.data?.message || 'Não foi possível excluir.');
    } finally {
      setOcupado(false);
    }
  }

  async function salvarNova(dados) {
    await criar(dados); // erro sobe ao formulário
    setCriando(false);
    setAviso(`Categoria "${dados.nome}" criada.`);
  }

  return (
    <section className="rounded border border-border bg-surface" aria-label="Categorias">
      {/* Cabeçalho (sempre visível): título, contador e abrir/fechar. */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <p className="text-sm">
          <span className="font-medium">Categorias</span>{' '}
          <span className="num text-muted">
            · {categorias.length} de {limite}
          </span>
        </p>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          className="min-h-[44px] rounded border border-border px-3 text-sm text-accent hover:opacity-80"
        >
          {aberto ? 'Fechar' : 'Gerenciar'}
        </button>
      </div>

      {aberto && (
        <div className="space-y-3 border-t border-border p-3">
          {erro && <p className="text-sm text-negative">{erro}</p>}
          {aviso && (
            <p role="status" className="text-sm text-positive">
              {aviso}
            </p>
          )}

          <ul className="grid gap-2 lg:grid-cols-2">
            {categorias.map((c) => {
              const outros = ehOutros(c.nome);
              const qtd = c.qtdDespesas ?? 0;

              // Linha em modo EDIÇÃO.
              if (c._id && editandoId === c._id) {
                return (
                  <li key={c._id} className="rounded border border-accent bg-bg p-3 lg:col-span-2">
                    <FormCategoria
                      inicial={{ nome: c.nome, cor: c.cor }}
                      aoSalvar={(dados) => salvarEdicao(c, dados)}
                      aoCancelar={() => setEditandoId(null)}
                    />
                  </li>
                );
              }

              return (
                <li key={c._id ?? c.nome} className="rounded border border-border bg-bg px-3 py-1">
                  <div className="flex min-h-[44px] items-center gap-3">
                    <CategoriaPonto cor={c.cor} grande />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm">{c.nome}</p>
                      <p className="text-xs text-muted">
                        {qtdTexto(qtd)}
                        {outros && ' · fixa'}
                      </p>
                    </div>
                    {/* "Outros" é fixa: sem editar/excluir. Antes da API responder (sem _id) também não. */}
                    {!outros && c._id && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => focar({ editar: c._id })}
                          aria-label={`Editar ${c.nome}`}
                          className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-accent"
                        >
                          <IconeLapis />
                        </button>
                        <button
                          type="button"
                          onClick={() => focar({ excluir: c._id })}
                          aria-label={`Excluir ${c.nome}`}
                          className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-negative"
                        >
                          <IconeLixeira />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Confirmação inline da exclusão, com quantas despesas vão para "Outros". */}
                  {excluindoId === c._id && (
                    <div role="alert" className="mb-2 mt-1 space-y-2 border-t border-border pt-2 text-sm">
                      <p>
                        Excluir <span className="font-medium">"{c.nome}"</span>?{' '}
                        {qtd > 0
                          ? `${qtdTexto(qtd)} ${qtd === 1 ? 'será movida' : 'serão movidas'} para "${NOME_OUTROS}" (nenhuma é apagada).`
                          : 'Nenhuma despesa usa esta categoria.'}
                      </p>
                      {erroAcao && <p className="text-negative">{erroAcao}</p>}
                      <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => confirmarExclusao(c)}
                          className="min-h-[44px] rounded bg-negative px-3 font-medium text-bg hover:opacity-90 disabled:opacity-60"
                        >
                          {ocupado ? 'Excluindo…' : 'Excluir'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindoId(null)}
                          className="min-h-[44px] rounded border border-border px-3 text-muted hover:text-fg"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Nova categoria: botão ou o formulário aberto. */}
          {criando ? (
            <div className="rounded border border-accent bg-bg p-3">
              <p className="mb-3 text-sm font-medium">Nova categoria</p>
              <FormCategoria
                inicial={{ nome: '', cor: primeiraCorLivre(categorias) }}
                rotuloSalvar="Criar"
                aoSalvar={salvarNova}
                aoCancelar={() => setCriando(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              disabled={noLimite || carregando}
              onClick={() => focar({ nova: true })}
              className="min-h-[44px] w-full rounded border border-dashed border-border px-3 text-sm text-accent hover:opacity-80 disabled:cursor-not-allowed disabled:text-muted sm:w-auto"
            >
              {noLimite ? `Limite de ${limite} categorias atingido` : '+ Nova categoria'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
