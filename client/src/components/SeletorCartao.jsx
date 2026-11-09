/**
 * SeletorCartao — campo "Cartão" das Despesas (formulário de criação e edição inline).
 *
 * Opções: "Nenhum (outra forma de pagamento)", os cartões do usuário (bolinha de cor + nome) e, por
 * último, "+ Novo cartão" — que troca o painel por um mini-formulário (nome + cor, já com a primeira
 * cor livre da paleta) SEM sair da tela; o cartão criado já fica selecionado. No limite de cartões, a
 * opção aparece desabilitada. Um <select> nativo não mostra a bolinha (iPhone), por isso é próprio.
 *
 * Props:
 *  - valor      {string}  id do cartão escolhido, ou '' = nenhum.
 *  - onChange   {(id: string) => void}
 *  - cartoes    {Array<{ _id, nome, cor }>}  cartões do usuário (useCartoes).
 *  - limite     {number}
 *  - criar      {({ nome, cor }) => Promise<cartao>}  (useCartoes().criar)
 *  - className  {string}  classes extras do botão.
 *
 * Fecha ao clicar/tocar fora ou com Esc; opções com 44px; painel acima da linha de total "sticky".
 */
import { useEffect, useRef, useState } from 'react';
import { primeiraCorLivre } from '../lib/constants.js';
import CategoriaPonto from './CategoriaPonto.jsx';
import FormCategoria from './FormCategoria.jsx';

const NENHUM = 'Nenhum (outra forma de pagamento)';

/** Seta "▾" do botão. */
function Seta() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function SeletorCartao({ valor, onChange, cartoes, limite, criar, className = '' }) {
  const [modo, setModo] = useState('fechado'); // 'fechado' | 'lista' | 'novo'
  const raiz = useRef(null);
  const atual = cartoes.find((c) => String(c._id) === String(valor)) ?? null;

  // Fecha ao clicar/tocar fora do componente.
  useEffect(() => {
    if (modo === 'fechado') return undefined;
    const fora = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) setModo('fechado');
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [modo]);

  function escolher(id) {
    onChange(id);
    setModo('fechado');
  }

  /** Cria o cartão pelo mini-formulário e já o deixa selecionado. */
  async function criarESelecionar(dados) {
    const novo = await criar(dados); // erro sobe para o <FormCategoria> mostrar
    escolher(String(novo._id));
  }

  const opcao = (marcada) =>
    [
      'flex w-full min-h-[44px] items-center gap-2 rounded px-2 text-left text-sm',
      'hover:bg-bg focus-visible:bg-bg focus-visible:outline-none',
      marcada ? 'text-accent' : 'text-fg',
    ].join(' ');

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
        aria-label={`Cartão: ${atual ? atual.nome : NENHUM}`}
        onClick={() => setModo((m) => (m === 'fechado' ? 'lista' : 'fechado'))}
        className={[
          'flex w-full min-h-[44px] items-center gap-2 rounded border border-border px-3 py-2 text-left text-base',
          'focus:border-accent focus:outline-none',
          modo !== 'fechado' ? 'border-accent' : '',
          atual ? 'text-fg' : 'text-muted',
          className,
        ].join(' ')}
      >
        {atual && <CategoriaPonto cor={atual.cor} grande />}
        <span className="min-w-0 flex-1 truncate">{atual ? atual.nome : 'Sem cartão'}</span>
        <span className="text-muted">
          <Seta />
        </span>
      </button>

      {modo !== 'fechado' && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded border border-border bg-surface p-2 shadow-lg shadow-black/40">
          {modo === 'lista' ? (
            <ul role="listbox" aria-label="Cartões" className="max-h-72 overflow-y-auto overscroll-contain">
              <li role="option" aria-selected={!atual}>
                <button type="button" onClick={() => escolher('')} className={opcao(!atual)}>
                  <span className="min-w-0 flex-1">{NENHUM}</span>
                  {!atual && <span aria-hidden="true">✓</span>}
                </button>
              </li>
              {cartoes.map((c) => {
                const marcada = atual && String(c._id) === String(atual._id);
                return (
                  <li key={c._id} role="option" aria-selected={Boolean(marcada)}>
                    <button type="button" onClick={() => escolher(String(c._id))} className={opcao(marcada)}>
                      <CategoriaPonto cor={c.cor} grande />
                      <span className="min-w-0 flex-1 break-words">{c.nome}</span>
                      {marcada && <span aria-hidden="true">✓</span>}
                    </button>
                  </li>
                );
              })}
              <li className="mt-1 border-t border-border pt-1">
                <button
                  type="button"
                  disabled={cartoes.length >= limite}
                  onClick={() => setModo('novo')}
                  className="flex w-full min-h-[44px] items-center gap-2 rounded px-2 text-left text-sm text-accent hover:bg-bg disabled:cursor-not-allowed disabled:text-muted"
                >
                  {cartoes.length >= limite ? `Limite de ${limite} cartões atingido` : '+ Novo cartão'}
                </button>
              </li>
            </ul>
          ) : (
            <div className="p-1">
              <p className="mb-3 text-sm font-medium">Novo cartão</p>
              <FormCategoria
                inicial={{ nome: '', cor: primeiraCorLivre(cartoes) }}
                placeholder="Ex.: Nubank"
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
