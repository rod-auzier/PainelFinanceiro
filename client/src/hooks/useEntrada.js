/**
 * useEntrada — liga a "animação de entrada" (barras e rosca preenchendo) depois do 1º frame.
 *
 * Retorna `pronto` (boolean). Começa `false`, vira `true` dois frames depois de montar e
 * VOLTA a `false` quando `chave` muda (ex.: ao trocar de mês), reiniciando a animação.
 * Os componentes usam `pronto` para trocar o estilo de "vazio" para "cheio" e deixam o CSS
 * (`transition`) fazer o movimento — o CSS usa `motion-reduce:transition-none`, então quem
 * prefere menos movimento (prefers-reduced-motion) vê o estado final direto, sem animar.
 *
 * @param {unknown} chave  muda → a animação recomeça
 * @returns {boolean} pronto
 */
import { useEffect, useState } from 'react';

export function useEntrada(chave) {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setPronto(false);
    // Dois requestAnimationFrame: garante que o estado "vazio" foi pintado antes de mudar.
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setPronto(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [chave]);

  return pronto;
}
