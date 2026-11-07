/**
 * useRecurso — hook genérico para carregar uma lista da API.
 *
 * Parâmetros:
 *  - path  {string}  Caminho relativo da API (ex.: '/receitas').
 *  - chave {string}  Nome da propriedade no corpo da resposta que contém
 *                    o array (ex.: 'receitas' para `{ receitas: [...] }`).
 *
 * Retorna:
 *  - itens      {Array}     dados carregados (vazio até chegar a resposta);
 *  - carregando {boolean}   true enquanto a requisição está em andamento;
 *  - erro       {string}    mensagem de erro (vazia se ok);
 *  - recarregar {() => Promise<void>}  refaz a requisição (chamar após criar/excluir);
 *  - setItens   {Function}  setter do estado local — permite atualizações
 *                           OTIMISTAS (alterar a lista na hora, antes da API
 *                           responder, e reverter se falhar). Ex.: tela de Metas.
 *
 * O token JWT é anexado automaticamente pelo interceptor de services/api.js.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useRecurso(path, chave) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(path);
      setItens(data[chave] ?? []);
      setErro('');
    } catch (err) {
      setErro(err.response?.data?.message || 'Falha ao carregar os dados.');
    } finally {
      setCarregando(false);
    }
  }, [path, chave]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { itens, setItens, carregando, erro, recarregar };
}
