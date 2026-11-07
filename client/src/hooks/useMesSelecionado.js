/**
 * useMesSelecionado — mês escolhido no seletor de mês ("AAAA-MM").
 *
 * Retorna `[mes, setMes]`, como o `useState`. O valor fica guardado no
 * sessionStorage, então ao trocar de aba (Receitas → Despesas → Resumo) o
 * mês escolhido continua o mesmo; ao abrir o app de novo, começa no mês atual.
 */
import { useCallback, useState } from 'react';
import { mesAtual } from '../lib/mes.js';

const CHAVE = 'mesSelecionado';
const FORMATO = /^\d{4}-(0[1-9]|1[0-2])$/;

function lerInicial() {
  try {
    const salvo = sessionStorage.getItem(CHAVE);
    if (salvo && FORMATO.test(salvo)) return salvo;
  } catch {
    /* sessionStorage indisponível: usa o mês atual */
  }
  return mesAtual();
}

export function useMesSelecionado() {
  const [mes, setMesEstado] = useState(lerInicial);

  const setMes = useCallback((novo) => {
    setMesEstado(novo);
    try {
      sessionStorage.setItem(CHAVE, novo);
    } catch {
      /* ignora */
    }
  }, []);

  return [mes, setMes];
}
