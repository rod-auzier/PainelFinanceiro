/**
 * CaixinhaItem — um card de caixinha na aba Porquinho: bolinha de cor, nome, valor (mono) e os
 * botões EDITAR (lápis) e EXCLUIR (lixeira).
 *
 * Props:
 *  - caixinha  {{ _id, nome, valor }}
 *  - cor       {string}  cor da caixinha (a mesma da barra empilhada).
 *  - onSalvar  {(caixinha, { nome, valor }) => Promise<void>}  edição (a tela faz a atualização
 *              otimista e lança Error se a API falhar — a mensagem aparece aqui).
 *  - onExcluir {(caixinha) => void}  chamado depois da confirmação.
 *  - lembrete  {string}  (opcional) aviso pequeno mostrado ao EDITAR (ex.: conferir o mês de
 *              referência dos saldos) — só informa, não bloqueia.
 *  - pendente  {boolean} caixinha recém-adicionada que a API ainda não confirmou (id provisório):
 *              sem editar/excluir até chegar o id real.
 *
 * Estados internos:
 *  - edição: nome e valor viram inputs (Salvar / Cancelar; Enter salva, Esc cancela), sem
 *    recarregar a tela;
 *  - confirmação de exclusão na própria linha ("Excluir 'X'? R$ Y sai do total guardado.").
 * Botões com 44×44px de toque; inputs em 16px (sem zoom no iOS).
 */
import { useState } from 'react';
import { NOME_CAIXINHA_MAX, validarCaixinha } from '../lib/caixinhas.js';
import CategoriaPonto from './CategoriaPonto.jsx';
import Money from './Money.jsx';

const INPUT =
  'w-full min-h-[44px] rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

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

export default function CaixinhaItem({ caixinha, cor, onSalvar, onExcluir, pendente = false, lembrete }) {
  const [modo, setModo] = useState('ver'); // 'ver' | 'editar' | 'excluir'
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function editar() {
    setNome(caixinha.nome);
    setValor(String(caixinha.valor));
    setErro('');
    setModo('editar');
  }

  async function salvar() {
    const r = validarCaixinha(nome, valor);
    if (r.erro) return setErro(r.erro);
    setErro('');
    setSalvando(true);
    try {
      await onSalvar(caixinha, { nome: r.nome, valor: r.valor });
      setModo('ver');
    } catch (err) {
      setErro(err.response?.data?.message || err.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  // ---------- Edição ----------
  if (modo === 'editar') {
    return (
      <li
        className="space-y-3 rounded border border-accent bg-surface p-3"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            salvar();
          } else if (e.key === 'Escape') setModo('ver');
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={NOME_CAIXINHA_MAX}
            aria-label="Nome da caixinha"
            autoFocus
            className={INPUT}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-label="Valor da caixinha em reais"
            className={`${INPUT} num sm:w-40 sm:shrink-0`}
          />
        </div>
        {/* Lembrete discreto (não bloqueia): o valor deve bater com o mês de referência escolhido. */}
        {lembrete && <p className="text-xs text-accent">{lembrete}</p>}
        {erro && (
          <p role="alert" className="text-sm text-negative">
            {erro}
          </p>
        )}
        <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="min-h-[44px] rounded bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => setModo('ver')}
            className="min-h-[44px] rounded border border-border px-4 text-sm text-muted hover:text-fg"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  // ---------- Visualização (+ confirmação de exclusão) ----------
  return (
    <li className="rounded border border-border bg-surface px-3 py-1">
      <div className="flex min-h-[52px] items-center gap-3">
        <CategoriaPonto cor={cor} grande />
        <p className="min-w-0 flex-1 break-words text-sm">{caixinha.nome}</p>
        <Money value={caixinha.valor} className="shrink-0 text-sm font-medium" />
        <div className={`flex shrink-0 ${pendente ? 'invisible' : ''}`}>
          <button
            type="button"
            onClick={editar}
            aria-label={`Editar ${caixinha.nome}`}
            className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-accent"
          >
            <IconeLapis />
          </button>
          <button
            type="button"
            onClick={() => setModo('excluir')}
            aria-label={`Excluir ${caixinha.nome}`}
            className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-negative"
          >
            <IconeLixeira />
          </button>
        </div>
      </div>

      {modo === 'excluir' && (
        <div role="alert" className="mb-2 mt-1 space-y-2 border-t border-border pt-2 text-sm">
          <p>
            Excluir <span className="font-medium">"{caixinha.nome}"</span>?{' '}
            <Money value={caixinha.valor} /> sai do total guardado.
          </p>
          <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
            <button
              type="button"
              onClick={() => {
                setModo('ver');
                onExcluir(caixinha);
              }}
              className="min-h-[44px] rounded bg-negative px-4 font-medium text-bg hover:opacity-90"
            >
              Excluir
            </button>
            <button
              type="button"
              onClick={() => setModo('ver')}
              className="min-h-[44px] rounded border border-border px-4 text-muted hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
