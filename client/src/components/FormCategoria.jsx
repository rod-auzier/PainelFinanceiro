/**
 * FormCategoria — mini-formulário de NOME + COR. Usado para categorias e também para os CARTÕES de
 * crédito (mesmas regras: nome de 2 a 24 caracteres e a mesma paleta).
 * Para categorias: criar ("+ Nova categoria"
 * no seletor do formulário de Despesas e no gerenciamento) e para editar uma categoria existente.
 *
 * Props:
 *  - inicial       {{ nome: string, cor: string }}   valores iniciais.
 *  - placeholder   {string}   texto de exemplo do nome (padrão "Ex.: Transporte"; cartões: "Ex.: Nubank").
 *  - rotuloSalvar  {string}   texto do botão principal (ex.: "Criar", "Salvar").
 *  - aoSalvar      {({ nome, cor }) => Promise<void>}  chama a API; se lançar erro, a mensagem
 *                             (da API ou do Error) aparece em vermelho no próprio formulário.
 *  - aoCancelar    {() => void}
 *
 * NÃO é um <form>: ele aparece DENTRO do formulário de despesa (formulários aninhados não são
 * permitidos em HTML). Por isso os botões são `type="button"` e o Enter é tratado à mão — sem
 * enviar a despesa por engano. Esc cancela.
 *
 * Seletor de cor: grade com a PALETA_CORES (boas no fundo escuro, sem verde/vermelho puros). Se
 * a cor atual não estiver na paleta (ex.: as cores das 5 categorias padrão), ela aparece como a
 * primeira opção, para poder ser mantida. Cada amostra tem área de toque de 44×44px.
 */
import { useId, useState } from 'react';
import { NOME_CATEGORIA_MAX, PALETA_CORES, validarNomeCategoria } from '../lib/constants.js';
import CategoriaPonto from './CategoriaPonto.jsx';

const INPUT =
  'w-full min-h-[44px] rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

/** Grade de cores (radiogroup acessível). */
function SeletorCor({ valor, onChange }) {
  // A cor atual entra na grade se não for da paleta (ex.: "#356A9C" da Saúde padrão).
  const cores = PALETA_CORES.some((c) => c.toUpperCase() === valor.toUpperCase())
    ? PALETA_CORES
    : [valor, ...PALETA_CORES];

  return (
    <div role="radiogroup" aria-label="Cor da categoria" className="grid w-max grid-cols-5 gap-1">
      {cores.map((cor) => {
        const marcada = cor.toUpperCase() === valor.toUpperCase();
        return (
          <button
            key={cor}
            type="button"
            role="radio"
            aria-checked={marcada}
            aria-label={`Cor ${cor}`}
            title={cor}
            onClick={() => onChange(cor)}
            className="flex h-11 w-11 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {/* Amostra: anel claro em volta da cor escolhida. */}
            <span
              aria-hidden="true"
              className={`h-7 w-7 rounded-full ${marcada ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : ''}`}
              style={{ backgroundColor: cor }}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function FormCategoria({ inicial, placeholder = 'Ex.: Transporte', rotuloSalvar = 'Salvar', aoSalvar, aoCancelar }) {
  const idNome = useId();
  const [nome, setNome] = useState(inicial.nome ?? '');
  const [cor, setCor] = useState(inicial.cor);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const msg = validarNomeCategoria(nome);
    if (msg) return setErro(msg);
    setErro('');
    setSalvando(true);
    try {
      await aoSalvar({ nome: nome.trim(), cor });
    } catch (err) {
      setErro(err.response?.data?.message || err.message || 'Não foi possível salvar.');
      setSalvando(false);
    }
  }

  // Enter salva (sem enviar o formulário de despesa em volta); Esc cancela.
  function teclas(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      salvar();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      aoCancelar();
    }
  }

  return (
    <div className="space-y-3" onKeyDown={teclas}>
      <div>
        <label htmlFor={idNome} className="mb-1 block text-xs uppercase tracking-wide text-muted">
          Nome
        </label>
        <div className="flex items-center gap-2">
          <CategoriaPonto cor={cor} grande />
          <input
            id={idNome}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={NOME_CATEGORIA_MAX}
            placeholder={placeholder}
            autoFocus
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-muted">Cor</p>
        <SeletorCor valor={cor} onChange={setCor} />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      )}

      <div className="flex gap-2 [&>button]:flex-1">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="min-h-[44px] rounded bg-accent px-3 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : rotuloSalvar}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          className="min-h-[44px] rounded border border-border px-3 text-sm text-muted hover:text-fg"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
