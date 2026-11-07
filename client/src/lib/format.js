/**
 * Helpers de formatação usados pelas telas.
 */

/** Formata um número como moeda brasileira. Ex.: 1234.5 -> "R$ 1.234,50". */
export function brl(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Moeda brasileira ARREDONDADA, sem centavos (só para exibição). Ex.: 2195 -> "R$ 2.195".
 * Usada onde falta espaço, como no centro da rosca do Resumo; os cálculos não mudam.
 */
export function brlInteiro(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/**
 * Valor em reais COM SINAL explícito: 300 → "+R$ 300,00", -150 → "-R$ 150,00".
 * Usado nas variações em relação ao mês anterior.
 */
export function brlComSinal(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    signDisplay: 'exceptZero',
  });
}
