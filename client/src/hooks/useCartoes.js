/**
 * useCartoes — cartões de crédito do usuário (GET /api/cartoes) e as ações sobre eles.
 *
 * Usado só pela tela de Despesas (é lá que a transição do controle antigo de um cartão só acontece,
 * no servidor, na primeira abertura). Retorna:
 *  - cartoes   {Array<{ _id, nome, cor, padrao, qtdDespesas }>}  na ordem de criação;
 *  - limite    {number}  máximo de cartões (5);
 *  - erro      {string}
 *  - recarregar {() => Promise<void>}
 *  - criar     {({ nome, cor }) => Promise<cartao>}
 *  - atualizar {(id, { nome?, cor? }) => Promise<cartao>}
 *  - remover   {(id) => Promise<{ despesasAfetadas, faturasRemovidas }>}
 *  - cartaoDaDespesa {(despesa) => cartao | null}  cartão EFETIVO de uma despesa: o do `cartaoId`; para
 *              as antigas (`cartao: true` sem `cartaoId`), o cartão padrão; senão `null` (não é cartão).
 *  As ações recarregam a lista ao terminar e deixam o erro da API subir (quem chama mostra).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

export function useCartoes() {
  const [cartoes, setCartoes] = useState([]);
  const [limite, setLimite] = useState(5);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    try {
      const { data } = await api.get('/cartoes');
      setCartoes(data.cartoes ?? []);
      if (data.limite) setLimite(data.limite);
      setErro('');
    } catch (err) {
      setErro(err.response?.data?.message || 'Falha ao carregar os cartões.');
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const criar = useCallback(
    async (dados) => {
      const { data } = await api.post('/cartoes', dados);
      await recarregar();
      return data.cartao;
    },
    [recarregar],
  );
  const atualizar = useCallback(
    async (id, dados) => {
      const { data } = await api.patch(`/cartoes/${id}`, dados);
      await recarregar();
      return data.cartao;
    },
    [recarregar],
  );
  const remover = useCallback(
    async (id) => {
      const { data } = await api.delete(`/cartoes/${id}`);
      await recarregar();
      return data;
    },
    [recarregar],
  );

  // Índice id → cartão e o cartão padrão (dono das despesas antigas sem `cartaoId`).
  const porId = useMemo(() => new Map(cartoes.map((c) => [String(c._id), c])), [cartoes]);
  const padrao = useMemo(() => cartoes.find((c) => c.padrao) ?? null, [cartoes]);
  const cartaoDaDespesa = useCallback(
    (d) => (d.cartaoId ? porId.get(String(d.cartaoId)) ?? null : d.cartao ? padrao : null),
    [porId, padrao],
  );

  return { cartoes, limite, erro, recarregar, criar, atualizar, remover, cartaoDaDespesa };
}
