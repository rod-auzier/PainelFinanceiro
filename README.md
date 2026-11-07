# Painel Financeiro Pessoal

Aplicação full stack para controle de finanças pessoais: cadastro de receitas e
despesas, categorização e visualização de saldo, com autenticação por usuário.

---

## Arquitetura

```
┌──────────────┐        HTTP / JSON        ┌──────────────┐        ┌────────────┐
│   client/    │  ───────────────────────▶ │   server/    │ ─────▶ │  MongoDB   │
│ React + Vite │  ◀─────────────────────── │ Express API  │ ◀───── │ (Mongoose) │
│  + Tailwind  │     JWT no Authorization   │              │        │            │
└──────────────┘                           └──────────────┘        └────────────┘
```

- **Frontend (`client/`)** — SPA em React criada com Vite, **tema escuro**
  com Tailwind CSS (cores como tokens/CSS variables — ver [Tema](#tema-design-system)),
  layout responsivo (sidebar no desktop / bottom nav no celular — ver
  [Responsividade](#responsividade)). Consome a API via `axios`; o gráfico do Resumo usa
  SVG feito à mão (rosca do Resumo). O roteamento usa `react-router-dom` e o estado de autenticação
  vive num `AuthContext` — o **token JWT é salvo no `localStorage`** e injetado
  em `Authorization: Bearer <token>` por um interceptor em `services/api.js`.
  Em desenvolvimento, o Vite faz *proxy* de `/api` para o backend, evitando
  configuração de CORS.

- **Backend (`server/`)** — API REST em Node.js + Express (ESM). Camadas:
  - `config/` — carregamento de env e conexão (cacheada) com o banco;
  - `models/` — schemas Mongoose (`User`, `Receita`, `Despesa`);
  - `middlewares/` — autenticação JWT e tratamento de erros;
  - `controllers/` — regras de cada endpoint;
  - `routes/` — definição das rotas sob o prefixo `/api`.
  Senhas são gravadas como hash bcrypt (via `bcryptjs`, compatível com
  serverless); as rotas protegidas são sempre filtradas pelo `userId` do token.

- **Banco de dados** — MongoDB acessado via Mongoose. String de conexão
  configurável (`MONGO_URI`), local ou MongoDB Atlas.

- **Deploy (Vercel)** — o mesmo `app` Express roda de duas formas:
  localmente via `server/src/index.js` (abre uma porta) e, na Vercel, via
  `api/index.js`, que o reexporta como **Serverless Function** em `/api/*`.
  O frontend é publicado como site estático (`client/dist`). Não há dois
  serviços separados: tudo vive no mesmo domínio da Vercel. Ver
  [Deploy na Vercel](#deploy-na-vercel).

### Autenticação (fluxo)

1. `POST /api/register` ou `POST /api/login` retorna `{ user, token }`.
2. O frontend guarda o `token` e o envia em `Authorization: Bearer <token>`.
3. O middleware `authRequired` valida o token e injeta `req.userId`.

---

## Estrutura de pastas

```
Finanças/
├── README.md
├── .gitignore                  # ignora .env, node_modules, .vercel, ...
├── .vercelignore               # o que NÃO enviar no deploy (inclui .env)
├── vercel.json                 # build do client + rewrites (/api → função, resto → SPA)
├── package.json                # deps do backend p/ a Serverless Function + scripts
│
├── api/
│   └── index.js                # Serverless Function da Vercel: reexporta o app Express
│
├── client/                     # Frontend (React + Vite + Tailwind)
│   ├── index.html              # HTML base; carrega /src/main.jsx
│   ├── package.json
│   ├── vite.config.js          # Config do Vite + proxy /api → backend
│   ├── tailwind.config.js      # MAPEIA os tokens de cor (CSS vars) → classes; fontes; raios
│   ├── postcss.config.js       # PostCSS: tailwindcss + autoprefixer
│   ├── .env.example            # VITE_API_URL (opcional; normalmente nem precisa)
│   └── src/
│       ├── main.jsx            # Bootstrap do React (Router + AuthProvider)
│       ├── App.jsx             # Mapa de rotas (públicas + privadas sob Layout)
│       ├── index.css           # ★ TOKENS DE COR (:root) + base + animações do Resumo
│       ├── lib/
│       │   ├── format.js       # brl()
│       │   ├── mes.js          # MES_INICIAL + helpers de mês (AAAA-MM), rótulos e aviso de fixos gerados
│       │   ├── constants.js    # CATEGORIAS_DESPESA + mapa único de cores das categorias
│       ├── hooks/
│       │   ├── useRecurso.js   # hook genérico de carregamento de lista da API
│       │   └── useMesSelecionado.js # mês escolhido no seletor (guardado no sessionStorage)
│       ├── services/
│       │   └── api.js          # Instância axios + interceptor do token JWT
│       ├── context/
│       │   └── AuthContext.jsx # Estado de auth (login/register/logout, localStorage)
│       ├── components/
│       │   ├── AuthForm.jsx                 # form e-mail+senha (Login e Registro)
│       │   ├── Layout.jsx                   # sidebar (>=md) / bottom nav (<md) + <Outlet>
│       │   ├── IconesNav.jsx                # ícones de linha (SVG inline) do menu
│       │   ├── ListaLancamentos.jsx         # tabela (>=md) / cards (<md) + edição inline
│       │   ├── GuardadoCard.jsx             # "Total guardado" + campo Saldo inicial guardado
│       │   ├── MetaItem.jsx                 # meta: checkbox grande, barra de progresso, editar, lixeira
│       │   ├── Money.jsx                    # valor R$ em fonte mono + tabular-nums
│       │   ├── SeletorMes.jsx               # ‹ mês › — navegação entre meses (Receitas/Despesas/Resumo)
│       │   ├── ResumoSaldoCard.jsx          # Resumo: saldo grande, selo, barra "gastou N% da receita", variação
│       │   ├── ResumoTotalCard.jsx          # Resumo: card de receitas/despesas com ícone e comparação
│       │   ├── CategoriasDonut.jsx          # Resumo: rosca (SVG) + lista por categoria, com destaque cruzado
│       │   ├── MaioresDespesas.jsx          # Resumo: as 5 maiores despesas do mês
│       │   └── CategoriaPonto.jsx           # bolinha com a cor fixa da categoria
│       └── pages/
│           ├── Login.jsx       # Tela de login
│           ├── Registro.jsx    # Tela de cadastro
│           ├── Receitas.jsx    # Formulário + tabela + total de receitas
│           ├── Despesas.jsx    # Formulário + tabela + total de despesas
│           ├── Resumo.jsx      # Cards, indicador Superávit/Déficit e gráfico
│           └── Metas.jsx       # Total guardado + metas com valor/progresso (atualização otimista)
│
└── server/                     # Backend (Node.js + Express + Mongoose)
    ├── package.json
    ├── .env                    # LOCAL, não versionado (MONGO_URI, JWT_SECRET, PORT)
    ├── .env.example            # modelo do .env
    └── src/
        ├── index.js            # Entry point LOCAL: conecta ao DB e sobe o HTTP
        ├── app.js              # Instância Express (middlewares + rotas + conexão sob demanda)
        ├── config/
        │   ├── env.js          # Lê e valida variáveis de ambiente
        │   └── db.js           # Conexão Mongoose cacheada (serverless-safe)
        ├── models/
        │   ├── User.js         # { email único, senha (hash bcrypt via bcryptjs), saldoInicial }
        │   ├── Receita.js      # { userId, fonte, descricao, valor, recorrente, createdAt }
        │   ├── Despesa.js      # { userId, descricao, categoria, valor, recorrente, paga, createdAt }
        │   └── Meta.js         # { userId, titulo, concluida, valorAlvo?, alvoAtingido, createdAt }
        ├── middlewares/
        │   ├── auth.js         # Valida JWT → injeta req.userId
        │   └── errorHandler.js # 404 + handler de erros padronizado
        ├── utils/
        │   ├── asyncHandler.js # Encaminha erros de handlers async ao errorHandler
        │   └── mes.js          # MES_INICIAL + mês "AAAA-MM": mesAtual() em America/Fortaleza, limites do mês, filtro por createdAt
        ├── services/
        │   ├── fixos.js        # geração AUTOMÁTICA dos fixos do mês (idempotente, com marcador único)
        │   ├── totais.js       # somarValor / somarMesesFechados: somas de receitas/despesas (aggregation)
        │   └── guardado.js     # total guardado (só meses fechados) + parcial do mês + conclusão automática das metas
        ├── controllers/
        │   ├── auth.controller.js     # register, login, me
        │   ├── receita.controller.js  # listar, criar, atualizar, remover (por userId)
        │   ├── despesa.controller.js  # listar, criar, atualizar, remover (por userId)
        │   ├── resumo.controller.js   # agrega totais (aggregation MongoDB)
        │   ├── meta.controller.js     # listar, criar, atualizar (PATCH), remover (por userId)
│   └── guardado.controller.js # total guardado e saldo inicial
        └── routes/
            ├── index.js           # Agrupa as rotas sob /api (+ /health)
            ├── auth.routes.js     # /api/register, /api/login, /api/me
            ├── receita.routes.js  # /api/receitas  (protegida)
            ├── despesa.routes.js  # /api/despesas  (protegida)
            ├── resumo.routes.js   # /api/resumo    (protegida)
            ├── meta.routes.js     # /api/metas     (protegida)
└── guardado.routes.js # /api/guardado  (protegida)
```

---

## Pré-requisitos

- **Node.js 20+** e npm — https://nodejs.org
- **MongoDB** rodando localmente (`mongodb://127.0.0.1:27017`) **ou** uma
  string de conexão do **MongoDB Atlas**.

Verifique a instalação:

```bash
node --version
npm --version
```

---

## Como rodar localmente

### 1. Backend

```bash
cd server
npm install
cp .env.example .env        # no Windows PowerShell: Copy-Item .env.example .env
# edite o .env e defina MONGO_URI e JWT_SECRET
npm run dev                 # sobe em http://localhost:3001 com --watch
```

### 2. Frontend

Em outro terminal:

```bash
cd client
npm install
npm run dev                 # sobe em http://localhost:5173
```

Abra <http://localhost:5173>, crie uma conta e comece a lançar receitas e
despesas. As chamadas para `/api/*` são encaminhadas automaticamente para o
backend pelo proxy do Vite.

Para local, só precisa instalar `server/` e `client/`. As dependências na
raiz (`package.json`) existem para a Serverless Function da Vercel — instale-as
apenas se for testar o deploy localmente com `vercel dev`.

### Scripts disponíveis

| Onde  | Comando               | O que faz                                          |
|-------|-----------------------|---------------------------------------------------|
| raiz  | `npm run dev:server`  | atalho para `npm --prefix server run dev`          |
| raiz  | `npm run dev:client`  | atalho para `npm --prefix client run dev`          |
| raiz  | `npm run build`       | instala e compila o `client/` (usado pela Vercel)  |
| raiz  | `npm run install:all` | instala raiz + server + client                     |
| `server/` | `npm run dev`     | API com reload automático (`node --watch`)         |
| `server/` | `npm start`       | API em modo produção                               |
| `client/` | `npm run dev`     | Dev server do Vite com HMR                         |
| `client/` | `npm run build`   | Build de produção em `client/dist/`                |
| `client/` | `npm run preview` | Serve o build de produção localmente               |

---

## Tema (design system)

Tema escuro **"Grafite profundo"**, definido por tokens. As 8 cores são declaradas **uma única
vez** como CSS custom properties em [`client/src/index.css`](client/src/index.css)
(bloco `:root`, todo comentado) e o [`tailwind.config.js`](client/tailwind.config.js)
só as **mapeia** para classes utilitárias — nenhum componente tem cor hardcoded.

| Token (`--color-…`) | Hex | Classe Tailwind | Papel |
|---|---|---|---|
| `bg`       | `#0A0C0F` | `bg-bg`        | fundo da aplicação |
| `surface`  | `#111418` | `bg-surface`   | cards, inputs, sidebar, cabeçalho de tabela |
| `border`   | `#1E2329` | `border` / `divide-border` | divisórias finas (hairline) e contornos |
| `fg`       | `#E6EAED` | `text-fg`      | texto principal |
| `muted`    | `#7A8590` | `text-muted`   | texto secundário, labels, placeholders |
| `positive` | `#3ECF8E` | `text-positive` | receitas, superávit, valores ≥ 0 |
| `negative` | `#E2604A` | `text-negative` | despesas, déficit, valores < 0 |
| `accent`   | `#D4A24C` | `bg-accent` / `text-accent` | ações (botões, links, nav ativa) |

- **Tipografia**: Inter para textos/labels (`font-sans`); **JetBrains Mono**
  para valores monetários e números (`font-mono` + `tabular-nums`, via a classe
  `.num` ou o componente [`Money`](client/src/components/Money.jsx)) — dígitos
  de largura fixa alinham as colunas das tabelas. Fontes carregadas no
  [`index.html`](client/index.html).
- **Estilo das tabelas**: divisórias hairline (`--color-border`, `#1E2329`), cantos pouco
  arredondados, sem sombras.
- **Ajustar o tema no futuro**: edite só o bloco `:root` de `index.css`. Exceção:
  o navegador lê `<meta name="theme-color">` ([`index.html`](client/index.html)) e
  `theme_color`/`background_color` ([`manifest.json`](client/public/manifest.json))
  sem acesso às variáveis CSS — se mudar o fundo (`--color-bg`), atualize esses
  três valores também (hoje `#0A0C0F`).
- **Cores de dados**: as cores das categorias (rosca do Resumo, bolinhas) são fixas em
  [`lib/constants.js`](client/src/lib/constants.js) e não fazem parte do tema.
- **Contraste (WCAG)**: texto secundário `#7A8590` tem 4,9:1 sobre `surface` e 5,2:1 sobre
  `bg` (mínimo AA = 4,5:1); texto principal 15,3:1; verde 9,3:1, vermelho 5,3:1 e amarelo
  8,0:1 sobre `surface`. As divisórias e a diferença card/fundo são propositalmente sutis
  (~1,2:1 e ~1,1:1), como no tema anterior — a separação vem do contorno hairline.

---

## Responsividade

Breakpoints padrão do Tailwind (`sm` 640px, `md` 768px). O ponto de virada
principal é **`md`** — abaixo dele o layout é mobile, os pontos de mudança
estão comentados no código:

| Elemento | `< md` (mobile) | `>= md` (desktop) |
|---|---|---|
| Navegação ([Layout.jsx](client/src/components/Layout.jsx)) | **bottom nav fixa** (4 itens, ícone acima do rótulo, ativo em amarelo) + barra fina no topo com "Sair" | **sidebar** lateral fixa (14rem): marca (logo + "Painel Financeiro" / "Controle pessoal"), rótulo "MENU", itens com ícone (ativo: fundo, borda, amarelo e barrinha de 3px na borda esquerda) e cartão do usuário (avatar com a inicial, e-mail, "Sair") no rodapé |
| Listas de Receitas/Despesas ([ListaLancamentos.jsx](client/src/components/ListaLancamentos.jsx)) | **cards empilhados** (label + valor em coluna) | **tabela** com cabeçalho, linhas hairline e rodapé de total |
| Formulários (Receita/Despesa) | **1 coluna** | **2 colunas** (a partir de `sm`) |
| Saldo Final (Resumo) | 32px | 36px (`sm`) → 48px (`md`) |

Acessibilidade de toque: inputs em `text-base` (**16px** — evita o zoom
automático do iOS ao focar); botões e itens de navegação com **≥ 44×44px**
(`min-h-[44px]`, bottom nav 56px).

---

## Uso das telas (frontend)

O app tem **duas telas públicas** (Login e Registro) e, após autenticar,
a navegação para Resumo (página inicial — `/` e o login levam a `/resumo`), Receitas, Despesas e Metas, nessa ordem (sidebar no desktop, bottom
nav no celular — ver [Responsividade](#responsividade)). O token JWT fica
no `localStorage`; use "Sair" para descartá-lo.

### Registro (`/registro`)
Informe **e-mail** e **senha** (mínimo 6 caracteres) e clique em *Cadastrar*.
O backend já devolve o token, então você entra direto no painel. Link no
rodapé alterna para a tela de Login.

### Login (`/login`)
Mesmo formulário, para quem já tem conta. Credenciais inválidas mostram a
mensagem de erro vinda da API. Ao entrar, vai para `/resumo`.

### Receitas (`/receitas`)
- **Formulário**: `Fonte` (obrigatório), `Descrição` (opcional) e `Valor`
  (obrigatório, ≥ 0). *Adicionar receita* salva e a lista recarrega.
- **Seletor de mês** (‹ mês ›, e *Hoje*) no topo: a lista e o total mostram só
  o mês escolhido; novas receitas são lançadas nesse mês. A seta "anterior" fica
  **desabilitada em outubro/2026** (ver [Início do painel](#início-do-painel-e-fixos-automáticos)).
- **Repete todo mês** (checkbox no formulário): marca a receita como **fixa**
  (aparece como "↻ Todo mês" na lista).
- **Fixos automáticos** (não há botão): ao abrir um mês, o servidor cria sozinho as
  receitas fixas do mês anterior (fonte, descrição e valor) e a tela mostra um
  aviso discreto, ex.: "↻ 2 fixos adicionados automaticamente".
- **Lista**: tabela no desktop, cards no mobile; total do mês ao fim.
- **Editar inline** (lápis): os campos da linha viram inputs ali mesmo, com
  *Salvar* / *Cancelar* (PUT `/api/receitas/:id`) — é por aqui que se ajusta o
  valor de uma fixa gerada; dá para (des)marcar "Todo mês". **✕** exclui.

### Despesas (`/despesas`)
- **Formulário**: `Descrição` (obrigatório), `Categoria` (select fixo:
  Utilidades, Alimentação, Saúde, Lazer, Outros) e `Valor`
  (obrigatório, ≥ 0).
- **Seletor de mês** (‹ mês ›, e *Hoje*) no topo: lista e total do mês escolhido;
  novas despesas são lançadas nesse mês. A seta "anterior" fica **desabilitada em
  outubro/2026**.
- **Repete todo mês** (checkbox no formulário): marca a despesa como **fixa**
  ("↻ Todo mês" na lista).
- **Fixos automáticos** (não há botão): ao abrir um mês, o servidor cria sozinho as
  despesas fixas do mês anterior (descrição, categoria e valor) para você só editar
  o que mudou (ex.: a conta de luz), e a tela avisa quantas foram adicionadas.
- **Lista**: descrição, categoria, fixo e valor; tabela no desktop, cards no
  mobile; total do mês ao fim.
- **Editar inline** (lápis): campos viram inputs (`Categoria` continua um
  select), *Salvar* / *Cancelar* (PUT `/api/despesas/:id`). **✕** exclui.
- **Marcar como paga**: cada despesa tem uma **caixa de marcação grande** (44×44px de toque, mesmo
  estilo das Metas: verde `#3ECF8E` quando marcada). Marcada = texto levemente apagado (o valor
  continua visível). **Atualização otimista**: marca na hora e sincroniza com
  `PATCH /api/despesas/:id` (se falhar, desfaz e avisa). Campo `paga` (Boolean, padrão `false`;
  despesas antigas valem como não pagas). **É só informativo**: total e saldo continuam somando
  *todas* as despesas. Os **fixos gerados automaticamente não herdam o status** (entram sempre
  como não pagos) e **editar não altera** o status.
- **Topo da tela**: "**X de Y pagas**" e o botão **Marcar todas como pagas** (pede confirmação
  na própria tela; age só nas pendentes do mês selecionado — `PATCH /api/despesas/pagas`).
- No **Resumo**, o card *Total de despesas* mostra **Pago** e **Falta pagar** (esta em amarelo
  `#D4A24C`) com uma barrinha fina do que já foi pago. Vale para qualquer mês navegável.

### Resumo (`/resumo`)
Tela só **visual**: tudo é calculado com os dados que já existem (nada novo para preencher, nenhuma
rota ou regra de cálculo alterada). Tema escuro, valores em fonte mono tabular, cores do tema
(verde `#3ECF8E`, vermelho `#E2604A`, amarelo `#D4A24C`).

- **Seletor de mês** (‹ mês ›) no topo: tudo é do mês escolhido (lembrado ao trocar de aba; nunca
  antes de outubro/2026). No **celular fica fixo no topo** enquanto você rola, com botões de 44px.
  Abrir o mês também gera os fixos dele e mostra o aviso discreto "N fixos adicionados".
- **Card principal (saldo do mês)**: *Saldo final* grande (verde ≥ 0 / vermelho < 0) com o selo
  **▲ Superávit / ▼ Déficit**; abaixo, **uma barra horizontal** — "Você gastou **52%** da receita":
  parte **vermelha** = despesas, parte **verde** = o que sobrou (se gastou mais que recebeu, a barra
  fica toda vermelha e a legenda troca "Sobrou" por "Faltou"); e, em texto pequeno, a **variação do
  saldo** ("+R$ 300,00 em relação a outubro"). A comparação com o mês anterior **só aparece em meses
  FECHADOS** (anteriores ao mês atual, no fuso America/Fortaleza): no mês em andamento e nos futuros não
  há comparação em nenhum card, e em outubro/2026 também não (não existe mês anterior).
  *Como saber se o mês está fechado:* `mesFechado` em `client/src/lib/mes.js`, sobre o `mesAtual()` do
  cliente (também em America/Fortaleza, igual ao servidor).
- **Cards de receitas e despesas**: ícone discreto, valor e **comparação com o mês anterior**
  ("▲ 15% vs outubro") — a cor mostra se foi bom ou ruim (receita subir = verde; despesa subir =
  vermelho). Sem comparação (e sem linha vazia) no mês em andamento/futuro, em outubro/2026 ou quando o
  mês anterior foi zero.
- **Despesas por categoria**: **rosca (donut)** ao lado de uma **lista** da maior para a menor
  (bolinha com a cor, nome, valor e % do total). **Passar o mouse (ou tocar)** numa fatia ou num item
  destaca o outro (o resto esmaece; no toque, tocar de novo desfaz). Com uma única categoria ou
  nenhuma despesa, mostra um estado simples.
- **Maiores despesas do mês**: as 5 maiores (descrição, categoria, valor), da maior para a menor.
- **Cada categoria tem sempre a mesma cor em todo o app** — paleta "azuis escuros", num único mapa
  (`COR_CATEGORIA` em `client/src/lib/constants.js`): Utilidades `#3F78B0`, Saúde `#356A9C`,
  Alimentação `#2B5A86`, Outros `#234A70`, Lazer `#6B7682`; categoria
  desconhecida usa `#6B7682`. Sem verde/vermelho (significado fixo no tema). Como os azuis são
  parecidos, a rosca tem vão de 2px entre as fatias e, ao passar o mouse/tocar, destaca a fatia
  e mostra nome, valor e % no centro. A mesma bolinha aparece na lista de Despesas.
- **Layout**: no desktop, o card principal (2/3) fica no topo com receitas/despesas ao lado (1/3), e
  abaixo, em duas colunas, a rosca com a lista e as maiores despesas; no celular, **uma coluna**,
  sem rolagem horizontal.
- **Animações** suaves ao carregar (barra e rosca "preenchendo"), discretas e desligadas para quem usa
  `prefers-reduced-motion` (regra em `index.css`).

Dados: `GET /api/resumo?mes=` (totais), `GET /api/despesas?mes=` (rosca e maiores) e, se existir mês
anterior **e o mês exibido já está fechado**, `GET /api/resumo?mes=<anterior>` (comparações; se falhar, só some a comparação). Os cálculos
puros (agrupar por categoria, variação %, % comprometido, top 5) estão em `client/src/lib/resumo.js`.
A rosca é SVG feito à mão — o Recharts foi removido (o bundle caiu de ~590 kB para ~260 kB).

> **Como o mês funciona:** receitas e despesas só têm a data `createdAt`; o mês de um
> lançamento é o mês do seu `createdAt` (fuso de Brasília, UTC-3). Ao lançar com outro
> mês selecionado, o `createdAt` é posicionado nesse mês. Sem `mes`, as rotas listam e
> somam de outubro/2026 em diante.

### Início do painel e fixos automáticos

**Início do painel (`MES_INICIAL = "2026-10"`)** — o painel existe só de **outubro/2026**
em diante. A constante vive em um único lugar por lado: `server/src/utils/mes.js` e
`client/src/lib/mes.js` (mantenha as duas iguais).
- O seletor de mês bloqueia a seta "anterior" em outubro/2026 (apagada/desabilitada);
  um mês antigo guardado na sessão é ajustado para outubro/2026.
- A API recusa (`400`) `?mes=` ou `mes` anteriores a `2026-10`; listas e somas **sem**
  `mes` só enxergam lançamentos de outubro/2026 em diante.
- O **total guardado** das Metas considera só lançamentos de outubro/2026 em diante
  **e só meses fechados** (ver [Total guardado: só meses fechados](#total-guardado-só-meses-fechados)),
  mais o "Saldo inicial guardado".

**Fixos automáticos (feitos no backend)** — lançamentos com "Repete todo mês" são
criados sozinhos ao abrir um mês (`GET /api/receitas|despesas?mes=` e `GET /api/resumo?mes=`):
- copia **descrição, categoria e valor** (receitas: fonte + descrição + valor) e o dia do mês;
- **só até o mês atual** — meses futuros (navegados só para olhar) não geram nada, e
  nunca antes de outubro/2026;
- a origem é o **mês mais recente que tenha fixos** (se você pulou um mês, continua
  funcionando — ex.: janeiro copia de outubro se nov/dez nunca foram abertos);
- **nunca duplica**: pula o que já existe no mês (mesma descrição, também recorrente) e, além
  disso, cada (usuário, tipo, mês) tem um *marcador* com **índice único** (`FixosGerados`):
  mesmo com a tela aberta duas vezes ou em dois aparelhos ao mesmo tempo, só uma
  requisição gera — as outras esperam e só leem. Marcador travado há mais de 30 s é recuperado;
- como cada mês é gerado uma vez, **um fixo apagado não ressuscita** ao reabrir o mês;
- a resposta traz `fixosGerados` (quantos foram criados na chamada) e a tela mostra um aviso
  discreto ("N fixos adicionados").
O "total guardado" também garante a geração de todos os meses até o atual antes de somar.

### Total guardado: só meses fechados

O **Total guardado** das Metas conta apenas **meses fechados**:

> **Total guardado = Saldo inicial guardado + Σ (receitas − despesas) de cada mês, de outubro/2026
> (`MES_INICIAL`) até o mês ANTERIOR ao mês atual.** O mês em andamento **não entra** no total.

Exemplo — hoje é 07/11/2026: **entra outubro**; novembro só passa a entrar em **01/12/2026**,
dezembro em 01/01/2027, e assim por diante. Meses futuros também não entram. Como as barras de
progresso (e a conclusão automática) usam esse total, uma meta **não é concluída por um mês ainda
aberto** — só quando ele fecha.

- **"Hoje" é a data em `America/Fortaleza` (UTC-3)**, calculada no backend — nunca o fuso do servidor
  (na Vercel é UTC e viraria o mês 3 horas antes). Há **uma única função** para "mês atual":
  `mesAtual()` em `server/src/utils/mes.js`, reutilizada pelo total guardado, pela geração
  automática de fixos e pela criação de lançamentos. O mês vira à meia-noite de Fortaleza
  (ex.: às 23h59 de 30/11 ainda é novembro, mesmo que em UTC já seja dezembro).
- O resultado **parcial do mês em andamento** é devolvido à parte (`emAndamento` em `GET /api/guardado`)
  só para exibir: na tela de Metas aparece uma linha discreta — *"Mês em andamento (novembro/2026),
  entra em 01/12/2026: R$ X"* — com o nome do mês e a data calculados dinamicamente.
- Antes de outubro/2026 (painel ainda não começou) o total é só o saldo inicial e não há mês em andamento.

### Limpeza dos meses anteriores a outubro/2026 (script manual)

Nada é apagado automaticamente. Para remover receitas/despesas **do seu usuário** anteriores a
01/10/2026 (por exemplo, cópias de fixos feitas em meses antigos), use o script — rode **dentro de
`server/`** (ele lê a `MONGO_URI` do `.env`):

```bash
cd server
npm run limpar:antigos -- --email=voce@exemplo.com              # DRY-RUN: só lista o que seria apagado
npm run limpar:antigos -- --email=voce@exemplo.com --confirmar  # apaga de verdade
```

- **Padrão = dry-run**: imprime cada registro (data, descrição, valor) e quantos seriam apagados, e
  termina com "NADA foi apagado". Só o parâmetro explícito `--confirmar` apaga.
- Exige `--email` (mexe só nesse usuário); argumento desconhecido aborta.
- O filtro é sempre `createdAt < 01/10/2026 00:00 (Brasília)`: **registros de outubro/2026 em diante
  nunca são tocados** (o script mostra quantos serão preservados e confere as contagens depois).
- Comece sempre pelo dry-run, leia a lista e só então rode com `--confirmar`.

### Metas (`/metas`)
Objetivos pessoais com checkbox ("quadradinho") e, opcionalmente, um **valor** que
vira barra de progresso.

**Total guardado** (card no topo)
- Fórmula: **saldo inicial guardado + (receitas − despesas) dos MESES FECHADOS**, de outubro/2026 até o
  mês anterior ao atual — o mês em andamento não entra (ver
  [Total guardado: só meses fechados](#total-guardado-só-meses-fechados)).
- Linhas do card: *Saldo inicial guardado*, *Receitas − despesas (meses fechados, desde out/2026)* e,
  discreta, *Mês em andamento (novembro/2026), entra em 01/12/2026: R$ X* (parcial, ainda fora do total).
- O **Saldo inicial guardado** é um único número por usuário, editável ali mesmo
  (*Salvar saldo*): use-o para acertar o que você já tinha guardado antes de usar o
  painel. Ao salvar, as metas são reavaliadas.

**Metas**
- **Adicionar**: título + **Valor (R$) opcional** — botão *Adicionar* ou **Enter**.
  Sem valor, a meta é um checklist comum.
- **Meta com valor**: barra de progresso **verde**, porcentagem e "R$ X de R$ Y".
  Progresso = `min(total guardado ÷ valor, 100%)`.
- **Conclusão automática**: quando o total guardado atinge o valor, a meta é marcada
  como concluída sozinha. Você continua podendo marcar/desmarcar à mão — se
  desmarcar uma meta que já foi concluída automaticamente, ela **não** é remarcada
  (a conclusão automática só dispara quando o total *cruza* o valor; se ele cair
  abaixo e voltar a subir, dispara de novo).
- **Editar** (lápis): título e valor viram inputs (*Salvar* / *Cancelar*, `PATCH`).
  Serve para dar valor às metas que você já tinha ("5 mil", "10 mil", "20 mil").
  Valor em branco = meta sem valor. Mudar o valor reavalia a conclusão automática.
- **Marcar como concluída**: toque no quadradinho (ou no texto). A caixa fica
  **verde** e o texto **riscado em cinza**. A mudança aparece na hora
  (**atualização otimista**) e é sincronizada com a API; se a API falhar, volta ao
  estado anterior e mostra o erro.
- **Excluir**: ícone de **lixeira** (`DELETE /api/metas/:id`).
- **Contador** no topo: "X de Y concluídas". **Ordem**: pendentes primeiro; em cada grupo, do **menor para o maior valor** (5 mil, 10 mil, 15 mil, 20 mil…) e, por último, as metas **sem valor** (a mais antiga primeiro). A lista se reorganiza sozinha ao marcar, desmarcar, editar ou adicionar (regra única em `client/src/lib/metas.js`); concluídas
  embaixo, sob o rótulo "Concluídas". Sem metas, mensagem amigável.

O checkbox, o lápis e a lixeira têm áreas de toque ≥ 44px; a linha inteira (caixa +
texto) é clicável (56px). Valores em fonte mono tabular, tema escuro e responsivo.

**Carregamento robusto**: a tela faz **uma única** chamada (`GET /api/metas`, que já traz o total
guardado — duas chamadas simultâneas disputavam a geração de fixos no servidor); a sincronização com o
total nunca bloqueia a lista (se falhar, as metas ainda são devolvidas); as requisições têm *timeout* de
20 s e, se falharem, a tela mostra o erro com o botão **Tentar de novo** (em vez de ficar em
"Carregando…" para sempre). As metas existentes nunca são alteradas por essas mudanças.

---

## Variáveis de ambiente

| Variável         | Obrigatória | Exemplo                                          | Descrição                                                        |
|------------------|-------------|--------------------------------------------------|-----------------------------------------------------------------|
| `MONGO_URI`      | **sim**     | `mongodb+srv://user:senha@cluster0.xxx.mongodb.net/painel-financas` | String de conexão do MongoDB (Atlas ou local).  |
| `JWT_SECRET`     | **sim**     | string aleatória de 32+ caracteres               | Segredo de assinatura/verificação dos tokens JWT.               |
| `PORT`           | não (`3001`)| `3001`                                           | Porta do Express **no servidor local**. Ignorada na Vercel.     |
| `JWT_EXPIRES_IN` | não (`7d`)  | `7d`                                             | Expiração do token.                                             |
| `CLIENT_URL`     | não         | `https://seu-app.vercel.app`                     | Restringe o CORS a esse domínio. Sem valor, aceita qualquer origem. |

- **Local**: essas variáveis ficam em `server/.env` (copie de `server/.env.example`).
  O arquivo **não é versionado** (está no `.gitignore` e no `.vercelignore`).
- **Vercel**: as mesmas variáveis são configuradas no **painel do projeto**
  (Settings → Environment Variables) — ver [Deploy na Vercel](#deploy-na-vercel).
- **Frontend**: **não precisa de nenhuma variável**. Em produção o `client`
  chama `/api/...` no mesmo domínio; em dev, o proxy do Vite resolve.

---

## Deploy na Vercel

O projeto é publicado como **um único projeto Vercel**: o `client/` vira um
site estático e o `server/` vira uma **Serverless Function** em `/api/*`
(arquivo `api/index.js`). O `vercel.json` amarra as duas partes:

```jsonc
{
  "buildCommand": "npm run build",          // instala e compila o client/
  "outputDirectory": "client/dist",         // site estático publicado
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },   // API  → função Express
    { "source": "/(.*)",     "destination": "/index.html" } // resto → SPA React
  ]
}
```

> Arquivos estáticos reais (`/assets/*`, `/favicon.ico`) são servidos **antes**
> das rewrites, então o segundo rewrite não atrapalha o carregamento do app.

### Passo 1 — Criar o cluster gratuito no MongoDB Atlas

1. Crie uma conta em <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster** → escolha o plano **M0 (Free)** e uma região próxima.
3. **Database Access** → *Add New Database User*: crie um usuário com senha
   (guarde a senha; evite caracteres como `@ : / ?` ou use a versão
   *percent-encoded* na URI). Permissão: *Read and write to any database*.
4. **Network Access** → *Add IP Address* → **Allow access from anywhere**
   (`0.0.0.0/0`). As funções da Vercel não têm IP fixo, então isso é
   necessário. (Para endurecer depois: use *Private Endpoint* ou a lista de
   IPs da Vercel.)
5. **Database → Connect → Drivers** → copie a *connection string*, algo como:
   ```
   mongodb+srv://<user>:<senha>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
6. Ajuste a URI: troque `<user>` e `<senha>` pelos valores reais e **inclua o
   nome do banco** antes do `?`, por exemplo `.../painel-financas?...`.
   Essa string final é o valor de `MONGO_URI`.

### Passo 2 — Gerar o `JWT_SECRET`

Uma string longa e aleatória (32+ caracteres). Exemplo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Passo 3 — Subir o código

Envie o projeto para um repositório no GitHub/GitLab/Bitbucket. Confirme que
o **`server/.env` NÃO foi commitado**:

```bash
git status --porcelain        # server/.env não pode aparecer
git check-ignore server/.env  # deve imprimir "server/.env"
```

### Passo 4 — Importar o projeto na Vercel

1. <https://vercel.com/new> → *Import* o repositório.
2. **Root Directory**: deixe na **raiz** do repo (onde estão `vercel.json` e
   `api/`). Não aponte para `client/`.
3. **Framework Preset**: `Other` (o `vercel.json` já define build e saída).
4. **Build & Output**: pode deixar em branco — o `vercel.json` manda.
5. **Não clique em Deploy ainda** — configure as variáveis primeiro (passo 5).

### Passo 5 — Configurar as variáveis de ambiente no painel

Em **Settings → Environment Variables** (ou já na tela de import), adicione,
marcando os ambientes **Production**, **Preview** e **Development**:

| Nome            | Valor                                                        | Obrigatória |
|-----------------|-------------------------------------------------------------|-------------|
| `MONGO_URI`     | a *connection string* do Atlas (com usuário, senha e `/painel-financas`) | **sim** |
| `JWT_SECRET`    | a string aleatória gerada no passo 2                        | **sim**     |
| `JWT_EXPIRES_IN`| `7d` (ou outro prazo)                                       | não         |
| `CLIENT_URL`    | a URL final do projeto, ex. `https://seu-app.vercel.app`    | não\*       |

\* Opcional porque frontend e API ficam no mesmo domínio (same-origin). Defina
depois do primeiro deploy, quando souber a URL, se quiser travar o CORS.

> **Após alterar variáveis, é preciso *Redeploy*** (Deployments → ⋯ → Redeploy)
> para elas entrarem em vigor.

### Passo 6 — Deploy e verificação

Clique em **Deploy**. Ao terminar, teste:

```bash
curl https://seu-app.vercel.app/api/health      # -> {"status":"ok", ...}
```

Abra `https://seu-app.vercel.app`, crie uma conta e lance uma receita. Se algo
falhar, veja **Deployments → (deploy) → Functions / Logs** — erro comum é
`MONGO_URI`/`JWT_SECRET` ausente ou IP não liberado no Atlas.

### Resumo: o que configurar manualmente no painel da Vercel

- [ ] `MONGO_URI` — **obrigatória**
- [ ] `JWT_SECRET` — **obrigatória**
- [ ] `JWT_EXPIRES_IN` — opcional (padrão `7d`)
- [ ] `CLIENT_URL` — opcional (defina após saber a URL, para restringir CORS)
- [ ] MongoDB Atlas: liberar `0.0.0.0/0` em *Network Access*
- [ ] Após qualquer mudança de variável: **Redeploy**

Nada de `server/.env` vai para a Vercel — o `.vercelignore` bloqueia, e as
variáveis vêm exclusivamente do painel.

---

## Endpoints da API

Rotas protegidas exigem o header `Authorization: Bearer <token>`. O
middleware `authRequired` valida o JWT e injeta `req.userId` no handler;
todas as queries de receita/despesa filtram por esse `userId`.

| Método | Rota                  | Auth | Recebe                                             | Retorna                                              |
|--------|-----------------------|------|---------------------------------------------------|-----------------------------------------------------|
| GET    | `/api/health`         | não  | —                                                 | `{ status, uptime }`                                 |
| POST   | `/api/register`       | não  | `{ email, senha }`                                 | `201 { user, token }` · `400` · `409`                |
| POST   | `/api/login`          | não  | `{ email, senha }`                                 | `200 { user, token }` · `400` · `401`                |
| GET    | `/api/me`             | sim  | header `Bearer`                                    | `200 { user }` · `401` · `404`                       |
| GET    | `/api/receitas`       | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { receitas: [...], fixosGerados }` (do mês; abrir o mês gera os fixos; sem `mes`, de out/2026 em diante) |
| POST   | `/api/receitas`       | sim  | `{ fonte, valor, descricao?, recorrente?, mes? }`  | `201 { receita }` · `400`                            |
| PUT    | `/api/receitas/:id`   | sim  | `{ fonte, valor, descricao?, recorrente? }`        | `200 { receita }` · `400` · `404`                    |
| DELETE | `/api/receitas/:id`   | sim  | —                                                 | `204` · `400` (id inválido) · `404`                  |
| GET    | `/api/despesas`       | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { despesas: [...], fixosGerados }` (do mês; abrir o mês gera os fixos; sem `mes`, de out/2026 em diante) |
| POST   | `/api/despesas`       | sim  | `{ descricao, valor, categoria?, recorrente?, mes? }` | `201 { despesa }` · `400`                         |
| PUT    | `/api/despesas/:id`   | sim  | `{ descricao, valor, categoria?, recorrente? }`    | `200 { despesa }` · `400` · `404` (não altera `paga`) |
| PATCH  | `/api/despesas/:id`   | sim  | `{ paga: boolean }`                                | `200 { despesa }` · `400` · `404`                    |
| PATCH  | `/api/despesas/pagas` | sim  | `{ mes: "AAAA-MM" }`                               | `200 { atualizadas }` (marca as pendentes do mês) · `400` |
| DELETE | `/api/despesas/:id`   | sim  | —                                                 | `204` · `400` (id inválido) · `404`                  |
| GET    | `/api/resumo`         | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { totalReceitas, totalDespesas, saldo, totalPago, faltaPagar, fixosGerados }` (`totalPago`/`faltaPagar` são só informativos; o saldo usa todas as despesas) (do mês; sem `mes`, de out/2026 em diante) |
| GET    | `/api/metas`          | sim  | —                                                 | `200 { metas: [...], guardado }` (mais recentes primeiro; já sincronizadas; `guardado` = o mesmo objeto de `GET /api/guardado`, numa chamada só) |
| POST   | `/api/metas`          | sim  | `{ titulo, valorAlvo? }`                           | `201 { meta }` · `400`                               |
| PATCH  | `/api/metas/:id`      | sim  | `{ concluida?, titulo?, valorAlvo? }` (ao menos um; `valorAlvo: null` remove) | `200 { meta }` · `400` · `404`  |
| DELETE | `/api/metas/:id`      | sim  | —                                                 | `204` · `400` (id inválido) · `404`                  |
| GET    | `/api/guardado`       | sim  | —                                                 | `200 { saldoInicial, saldoAcumulado, total, emAndamento }` — só meses fechados; `emAndamento` = `{ mes, receitas, despesas, saldo, entraEm }` (parcial fora do total) |
| PUT    | `/api/guardado`       | sim  | `{ saldoInicial }` (número ≥ 0)                    | `200 { saldoInicial, saldoAcumulado, total, emAndamento }` · `400` |

---

## Próximos passos sugeridos

- Edição (`PUT`) de receitas e despesas.
- Filtros por período/categoria e paginação nas listagens.
- Validação de payload com `zod` ou `express-validator`.
- Testes automatizados (`vitest` no client, `supertest` no server).
