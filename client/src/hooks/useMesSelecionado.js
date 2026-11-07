/**
 * useMesSelecionado — mês escolhido no seletor de mês ("AAAA-MM").
 *
 * Retorna `[mes, setMes]`, como o `useState`. O valor fica guardado no
 * sessionStorage, então ao trocar de aba (Receitas → Despesas → Resumo) o
 * mês escolhido continua o mesmo; ao abrir o app de novo, começa no mês atual.
 *
 * O mês NUNCA fica anterior a MES_INICIAL (outubro/2026): um valor antigo salvo no
 * sessionStorage, ou um `setMes` anterior ao início, é ajustado para MES_INICIAL.
 */
import { useCallback, useState } from 'react';
import { limitarAoInicio, mesAtualDoPainel } from '../lib/mes.js';

const CHAVE = 'mesSelecionado';
const FORMATO = /^\d{4}-(0[1-9]|1[0-2])$/;

function lerInicial() {
  try {
    const salvo = sessionStorage.getItem(CHAVE);
    if (salvo && FORMATO.test(salvo)) return limitarAoInicio(salvo);
  } catch {
    /* sessionStorage indisponível: usa o mês atual */
  }
  return mesAtualDoPainel();
}

export function useMesSelecionado() {
  const [mes, setMesEstado] = useState(lerInicial);

  const setMes = useCallback((novo) => {
    const mes = limitarAoInicio(novo); // nunca antes de MES_INICIAL
    setMesEstado(mes);
    try {
      sessionStorage.setItem(CHAVE, mes);
    } catch {
      /* ignora */
    }
  }, []);

  return [mes, setMes];
}
