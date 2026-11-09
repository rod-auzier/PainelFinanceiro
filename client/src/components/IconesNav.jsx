/**
 * IconesNav — ícones de linha da navegação (sidebar do desktop e barra inferior do celular).
 *
 * O projeto não usa biblioteca de ícones, então são SVGs inline (24x24, traço de 1,8, sem
 * preenchimento). O traço usa `currentColor`: o ícone herda a cor do texto do item (amarelo
 * quando ativo, secundário quando inativo), sem nenhuma cor própria.
 *
 * Exporta `ICONE_NAV`, um mapa rota → componente, usado pelo <Layout>.
 *
 * Props de cada ícone:
 *  - size {number}  lado em px (padrão 18).
 */

/** Casca comum: define tamanho, traço e esconde o ícone de leitores de tela (o texto já diz tudo). */
function Icone({ size = 18, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

/** Receitas — seta para cima. */
export const IconeReceitas = (props) => (
  <Icone {...props}>
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </Icone>
);

/** Despesas — seta para baixo. */
export const IconeDespesas = (props) => (
  <Icone {...props}>
    <path d="M12 5v14" />
    <path d="M19 12l-7 7-7-7" />
  </Icone>
);

/** Resumo — grade de 4 quadrados. */
export const IconeResumo = (props) => (
  <Icone {...props}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icone>
);

/** Metas — alvo (círculos concêntricos). */
export const IconeMetas = (props) => (
  <Icone {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Icone>
);

/** Porquinho — cofrinho (porquinho de perfil com focinho, orelha, patas e o rabinho à esquerda).
 *  Desenho no estilo do ícone "PiggyBank" do lucide, refeito aqui porque o projeto não usa a lib. */
export const IconePorquinho = (props) => (
  <Icone {...props}>
    <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />
    <path d="M16 10h.01" />
    <path d="M2 8v1a2 2 0 0 0 2 2h1" />
  </Icone>
);

/** Rota → ícone. As chaves são as mesmas rotas da lista NAV do Layout. */
export const ICONE_NAV = {
  '/receitas': IconeReceitas,
  '/despesas': IconeDespesas,
  '/resumo': IconeResumo,
  '/porquinho': IconePorquinho,
  '/metas': IconeMetas,
};
