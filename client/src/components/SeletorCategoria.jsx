/**
 * SeletorCategoria — campo "Categoria" das Despesas (formulário de criação e edição inline).
 *
 * Um <select> nativo não consegue mostrar a bolinha colorida (principalmente no iPhone), então
 * este é um seletor próprio:
 *  - o BOTÃO mostra a bolinha + o nome da categoria escolhida;
 *  - ao abrir, um painel lista as categorias do USUÁRIO (useCategorias), cada uma com a bolinha de
 *    cor, e por último a opção "+ Nova categoria";
 *  - "+ Nova categoria" troca o painel por um mini-formulário (<FormCategoria>: nome + cor, já com
 *    a primeira cor da paleta ainda não usada) SEM sair da tela. Ao criar, a nova categoria já fica
 *    selecionada. Com o limite de categorias atingido, a opção aparece desabilitada com o aviso.
 *
 * Props:
 *  - valor        {string}            nome da categoria selecionada (o que a Despesa guarda).
 *  - onChange     {(nome) => void}
 *  - permitirNova {boolean}           mostra "+ Nova categoria" (padrão true).
 *  - className    {string}            classes extras do botão (altura/fundo do contexto).
 *
 * Fecha ao clicar/tocar fora ou com Esc. Opções com 44px de altura (toque confortável). O painel é
 * `absolute` com z-index acima da linha de total "sticky" das listas.
 */
import { useEffect, useRef, useState } from 'react';
import { useCategorias } from '../context/CategoriasContext.jsx';
import { chaveCategoria, primeiraCorLivre } from '../lib/constants.js';
import CategoriaPonto from './CategoriaPonto.jsx';
import FormCategoria from './FormCategoria.jsx';

/** Seta "▾" do botão. */
function Seta() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function SeletorCategoria({ valor, onChange, permitirNova = true, className = '' }) {
  const { categorias, limite, resolver, criar } = useCategorias();
  const [modo, setModo] = useState('fechado'); // 'fechado' | 'lista' | 'nova'
  const raiz = useRef(null);

  const atual = resolver(valor); // categoria de exibição (sem correspondência → "Outros")
  const noLimite = categorias.length >= limite;

  // Fecha ao clicar/tocar fora do componente.
  useEffect(() => {
    if (modo === 'fechado') return undefined;
    const fora = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) setModo('fechado');
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [modo]);

  function escolher(nome) {
    onChange(nome);
    setModo('fechado');
  }

  /** Cria a categoria pelo mini-formulário e já a deixa selecionada. */
  async function criarESelecionar(dados) {
    const nova = await criar(dados); // erro sobe para o <FormCategoria> mostrar
    escolher(nova.nome);
  }

  return (
    <div
      ref={raiz}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && modo !== 'fechado') {
          e.stopPropagation();
          setModo('fechado');
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={modo !== 'fechado'}
        onClick={() => setModo((m) => (m === 'fechado' ? 'lista' : 'fechado'))}
        className={[
          'flex w-full min-h-[44px] items-center gap-2 rounded border border-border px-3 py-2 text-left text-base text-fg',
          'focus:border-accent focus:outline-none',
          modo !== 'fechado' ? 'border-accent' : '',
          className,
        ].join(' ')}
      >
        <CategoriaPonto cor={atual.cor} grande />
        <span className="min-w-0 flex-1 truncate">{atual.nome}</span>
        <span className="text-muted">
          <Seta />
        </span>
      </button>

      {modo !== 'fechado' && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded border border-border bg-surface p-2 shadow-lg shadow-black/40">
          {modo === 'lista' ? (
            <ul role="listbox" aria-label="Categorias" className="max-h-72 overflow-y-auto overscroll-contain">
              {categorias.map((c) => {
                const marcada = chaveCategoria(c.nome) === chaveCategoria(atual.nome);
                return (
                  <li key={c._id ?? c.nome} role="option" aria-selected={marcada}>
                    <button
                      type="button"
                      onClick={() => escolher(c.nome)}
                      className={[
                        'flex w-full min-h-[44px] items-center gap-2 rounded px-2 text-left text-sm',
                        'hover:bg-bg focus-visible:bg-bg focus-visible:outline-none',
                        marcada ? 'text-accent' : 'text-fg',
                      ].join(' ')}
                    >
                      <CategoriaPonto cor={c.cor} grande />
                      <span className="min-w-0 flex-1 break-words">{c.nome}</span>
                      {marcada && <span aria-hidden="true">✓</span>}
                    </button>
                  </li>
                );
              })}
              {permitirNova && (
                <li className="mt-1 border-t border-border pt-1">
                  <button
                    type="button"
                    disabled={noLimite}
                    onClick={() => setModo('nova')}
                    className="flex w-full min-h-[44px] items-center gap-2 rounded px-2 text-left text-sm text-accent hover:bg-bg disabled:cursor-not-allowed disabled:text-muted"
                  >
                    {noLimite ? `Limite de ${limite} categorias atingido` : '+ Nova categoria'}
                  </button>
                </li>
              )}
            </ul>
          ) : (
            <div className="p-1">
              <p className="mb-3 text-sm font-medium">Nova categoria</p>
              <FormCategoria
                inicial={{ nome: '', cor: primeiraCorLivre(categorias) }}
                rotuloSalvar="Criar"
                aoSalvar={criarESelecionar}
                aoCancelar={() => setModo('lista')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
