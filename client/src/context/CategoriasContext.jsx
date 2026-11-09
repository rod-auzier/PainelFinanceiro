/**
 * Contexto das CATEGORIAS PERSONALIZADAS de despesa.
 *
 * Fica dentro do <Layout> (só existe com usuário logado) e carrega UMA vez a lista do usuário
 * (GET /api/categorias — que cria as 5 padrão no 1º acesso). Todas as telas leem daqui, então a
 * cor de uma categoria é a mesma em todo lugar: formulário e lista de Despesas, rosca/legenda e
 * "Maiores despesas" do Resumo.
 *
 * Expõe (via `useCategorias()`):
 *  - categorias  {Array<{ _id, nome, cor, qtdDespesas }>}  na ordem de criação, com "Outros" por último.
 *                Enquanto a API não respondeu, é a lista padrão (CATEGORIAS_PADRAO, sem _id).
 *  - limite      {number}   máximo de categorias por usuário (vem da API; 15).
 *  - carregando  {boolean} / erro {string}
 *  - recarregar  {() => Promise<void>}
 *  - resolver    {(nome) => { nome, cor }}  categoria de EXIBIÇÃO de uma despesa: casa pelo nome sem
 *                diferenciar maiúsculas; sem correspondência → "Outros" (o dado gravado não muda).
 *  - criar       {({ nome, cor }) => Promise<categoria>}
 *  - atualizar   {(id, { nome?, cor? }) => Promise<{ categoria, despesasAtualizadas }>}
 *  - remover     {(id) => Promise<{ movidas }>}
 *  Os três últimos recarregam a lista ao terminar e deixam o erro da API subir (quem chama mostra).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import {
  CATEGORIAS_PADRAO,
  COR_CATEGORIA_PADRAO,
  NOME_OUTROS,
  chaveCategoria,
  ehOutros,
} from '../lib/constants.js';

const CategoriasContext = createContext(null);

/** Coloca "Outros" no fim da lista, mantendo a ordem das demais. */
const outrosPorUltimo = (lista) => [...lista.filter((c) => !ehOutros(c.nome)), ...lista.filter((c) => ehOutros(c.nome))];

export function CategoriasProvider({ children }) {
  const [categorias, setCategorias] = useState(() => outrosPorUltimo(CATEGORIAS_PADRAO));
  const [limite, setLimite] = useState(15);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    try {
      const { data } = await api.get('/categorias');
      setCategorias(outrosPorUltimo(data.categorias ?? []));
      if (data.limite) setLimite(data.limite);
      setErro('');
    } catch (err) {
      setErro(err.response?.data?.message || 'Falha ao carregar as categorias.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Índice nome normalizado → categoria, para o `resolver` ser O(1).
  const porChave = useMemo(() => new Map(categorias.map((c) => [chaveCategoria(c.nome), c])), [categorias]);

  const resolver = useCallback(
    (nome) =>
      porChave.get(chaveCategoria(nome)) ??
      porChave.get(chaveCategoria(NOME_OUTROS)) ?? { nome: NOME_OUTROS, cor: COR_CATEGORIA_PADRAO },
    [porChave],
  );

  const criar = useCallback(
    async (dados) => {
      const { data } = await api.post('/categorias', dados);
      await recarregar();
      return data.categoria;
    },
    [recarregar],
  );

  const atualizar = useCallback(
    async (id, dados) => {
      const { data } = await api.patch(`/categorias/${id}`, dados);
      await recarregar();
      return data;
    },
    [recarregar],
  );

  const remover = useCallback(
    async (id) => {
      const { data } = await api.delete(`/categorias/${id}`);
      await recarregar();
      return data;
    },
    [recarregar],
  );

  const value = useMemo(
    () => ({ categorias, limite, carregando, erro, recarregar, resolver, criar, atualizar, remover }),
    [categorias, limite, carregando, erro, recarregar, resolver, criar, atualizar, remover],
  );

  return <CategoriasContext.Provider value={value}>{children}</CategoriasContext.Provider>;
}

/** Hook de acesso às categorias do usuário. */
export function useCategorias() {
  const ctx = useContext(CategoriasContext);
  if (!ctx) throw new Error('useCategorias deve ser usado dentro de <CategoriasProvider>');
  return ctx;
}
