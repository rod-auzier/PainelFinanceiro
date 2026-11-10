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
  - `models/` — schemas Mongoose (`User`, `Receita`, `Despesa`, `Meta`, `Categoria`, `FixosGerados`);
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
│       │   ├── caixinhas.js    # caixinhas: cores pela ordem de criação, soma, ordenação, validação
│       │   ├── constants.js    # categorias: padrão (provisórias), PALETA_CORES, "Outros", validação do nome
│       │   ├── previsao.js     # previsão das metas ("No ritmo atual, chega em mar/2027") — funções puras
│       ├── hooks/
│       │   ├── useRecurso.js   # hook genérico de carregamento de lista da API
│       │   └── useMesSelecionado.js # mês escolhido no seletor (guardado no sessionStorage)
│       ├── services/
│       │   └── api.js          # Instância axios + interceptor do token JWT
│       ├── context/
│       │   ├── AuthContext.jsx # Estado de auth (login/register/logout, localStorage)
│       │   └── CategoriasContext.jsx # categorias PERSONALIZADAS do usuário (lista, nome→cor, criar/editar/excluir)
│       ├── components/
│       │   ├── AuthForm.jsx                 # form e-mail+senha (Login e Registro; Registro com Nome/Sobrenome)
│       │   ├── CampoSenha.jsx               # campo de senha com Mostrar/Ocultar
│       │   ├── MenuUsuario.jsx              # menu do avatar no topo do celular (Perfil / Sair)
│       │   ├── Layout.jsx                   # sidebar (>=md) / bottom nav (<md) + <Outlet>
│       │   ├── IconesNav.jsx                # ícones de linha (SVG inline) do menu
│       │   ├── ListaLancamentos.jsx         # Receitas: tabela (>=md) / cards (<md) + edição inline
│       │   ├── GuardadoCard.jsx             # Porquinho: card "Total guardado" (= soma das caixinhas) + média e mês em andamento
│       │   ├── BarraCaixinhas.jsx           # Porquinho: barra empilhada + legenda (nome e %)
│       │   ├── CaixinhaItem.jsx             # Porquinho: caixinha (cor, nome, valor, editar, excluir com confirmação)
│       │   ├── MetaItem.jsx                 # meta: checkbox grande, barra de progresso, editar, lixeira
│       │   ├── Money.jsx                    # valor R$ em fonte mono + tabular-nums
│       │   ├── SeletorMes.jsx               # ‹ mês › — navegação entre meses (Receitas/Despesas/Resumo)
│       │   ├── ResumoSaldoCard.jsx          # Resumo: saldo grande, selo, barra "gastou N% da receita", variação
│       │   ├── ResumoTotalCard.jsx          # Resumo: card de receitas/despesas com ícone e comparação
│       │   ├── CategoriasDonut.jsx          # Resumo: rosca (SVG) + lista por categoria, com destaque cruzado
│       │   ├── MaioresDespesas.jsx          # Resumo: as 5 maiores despesas do mês
│       │   ├── CategoriaPonto.jsx           # bolinha com a cor da categoria do usuário
│       │   ├── CartoesSecao.jsx             # Despesas (painel lateral): card "Cartões de crédito" (blocos, criar/editar/excluir)
│       │   ├── CartaoCard.jsx               # Despesas: bloco de UM cartão (fatura do mês, não detalhado, fatura paga)
│       │   ├── ListaDespesas.jsx            # Despesas: card da lista (filtros, 3 áreas por linha, edição, total)
│       │   ├── PagamentoMesCard.jsx         # Despesas (painel lateral): "Pagamento do mês" (total, pago, falta)
│       │   ├── SeletorCartao.jsx            # campo Cartão: Nenhum / cartões com bolinha / "+ Novo cartão"
│       │   ├── SeletorCategoria.jsx         # campo Categoria com bolinhas + "+ Nova categoria" (mini-formulário)
│       │   ├── FormCategoria.jsx            # mini-formulário de categoria: nome + grade de cores
│       │   └── GerenciarCategorias.jsx      # seção "Categorias" da tela de Despesas (criar/editar/excluir)
│       └── pages/
│           ├── Login.jsx       # Tela de login
│           ├── Registro.jsx    # Tela de cadastro (com Nome e Sobrenome)
│           ├── Perfil.jsx      # Perfil: nome/sobrenome + alterar senha
│           ├── Receitas.jsx    # Formulário + tabela + total de receitas
│           ├── Despesas.jsx    # Cabeçalho + faixa "+ Nova despesa" + lista + painel lateral (pagamento, cartões)
│           ├── Resumo.jsx      # Cards, indicador Superávit/Déficit e gráfico
│           ├── Porquinho.jsx   # Caixinhas + total guardado (atualização otimista)
│           └── Metas.jsx       # card compacto do total + metas com valor/progresso (atualização otimista)
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
        │   ├── User.js         # { email único, senha (hash bcrypt via bcryptjs), nome, sobrenome, saldoInicial (legado), caixinhasMigradas }
        │   ├── Caixinha.js     # { userId, nome (2–30), valor ≥ 0, createdAt } — aba Porquinho
        │   ├── Receita.js      # { userId, fonte, descricao, valor, recorrente, createdAt }
        │   ├── Despesa.js      # { userId, descricao, categoria, valor, recorrente, paga, cartao (antigo), cartaoId, createdAt }
        │   ├── Cartao.js       # { userId, nome (2–24, único), cor, padrao } — cartões de crédito (até 5)
        │   ├── FaturaCartao.js # { userId, cartaoId, mes "AAAA-MM", valor, paga } — 1 por cartão e mês
        │   ├── Meta.js         # { userId, titulo, concluida, valorAlvo?, alvoAtingido, createdAt }
        │   ├── Categoria.js    # { userId, nome (2–24, único por usuário sem diferenciar maiúsculas), cor, createdAt }
        │   └── FixosGerados.js # marcador (usuário, tipo, mês) da geração automática de fixos
        ├── middlewares/
        │   ├── auth.js         # Valida JWT → injeta req.userId
        │   └── errorHandler.js # 404 + handler de erros padronizado
        ├── utils/
        │   ├── asyncHandler.js # Encaminha erros de handlers async ao errorHandler
        │   └── mes.js          # MES_INICIAL + mês "AAAA-MM": mesAtual() em America/Fortaleza, limites do mês, filtro por createdAt
        ├── services/
        │   ├── fixos.js        # geração AUTOMÁTICA dos fixos do mês (idempotente, com marcador único)
        │   ├── propagacao.js   # edição de fixo vale para os meses seguintes (campos que se propagam) + ajuste único
        │   ├── totais.js       # somarValor / somarMesesFechados: somas de receitas/despesas (aggregation)
        │   ├── guardado.js     # total guardado (= soma das caixinhas) + média dos meses fechados + parcial do mês + conclusão automática das metas
        │   ├── caixinhas.js    # transição do saldo inicial → caixinha "Saldo inicial" (1 vez) + soma
        │   ├── categorias.js   # categorias padrão no 1º acesso, "Outros" protegida, contagem de despesas por categoria
        │   └── cartao.js       # ★ cálculo CENTRAL dos cartões: max(fatura, detalhado) por cartão, linhas virtuais, total corrigido, transição
        ├── controllers/
        │   ├── auth.controller.js     # register, login, me
        │   ├── receita.controller.js  # listar, criar, atualizar, remover (por userId)
        │   ├── despesa.controller.js  # listar, criar, atualizar, remover (por userId)
        │   ├── resumo.controller.js   # agrega totais (aggregation MongoDB)
        │   ├── meta.controller.js     # listar, criar, atualizar (PATCH), remover (por userId)
        │   ├── guardado.controller.js # total guardado (GET)
        │   ├── caixinha.controller.js # listar (+ total guardado), criar, editar, excluir (por userId)
        │   ├── categoria.controller.js # listar, criar, renomear/recolorir, excluir (por userId)
        │   ├── cartao.controller.js # cartões: listar, criar, editar, excluir (por userId)
        │   └── fatura.controller.js # fatura por cartão e mês: obter, salvar, marcar paga, remover (por userId)
        └── routes/
            ├── index.js           # Agrupa as rotas sob /api (+ /health)
            ├── auth.routes.js     # /api/register, /api/login, /api/me e /api/auth/{me,perfil,senha}
            ├── receita.routes.js  # /api/receitas  (protegida)
            ├── despesa.routes.js  # /api/despesas  (protegida)
            ├── resumo.routes.js   # /api/resumo    (protegida)
            ├── meta.routes.js     # /api/metas     (protegida)
            ├── guardado.routes.js # /api/guardado  (protegida)
            ├── caixinha.routes.js # /api/caixinhas (protegida)
            ├── categoria.routes.js # /api/categorias (protegida)
            ├── cartao.routes.js # /api/cartoes (protegida)
            └── fatura.routes.js # /api/faturas (protegida)
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
- **Fundo "grade técnica"**: uma grade decorativa de linhas finas (1px, branco a **9%**,
  quadrados de **52px**) atrás de todas as telas — logadas, Login e Cadastro. Some suavemente
  nas bordas (máscara radial elíptica, centro em 50%/35%, opaca até ~20% e transparente em ~85%),
  então aparece mais no centro-topo; como os cards e a sidebar têm fundo sólido, só aparece nas
  áreas livres. É estática e **fixa** (não rola com a página): um `body::before` com
  `position: fixed; inset: 0; z-index: 0; pointer-events: none`, com o app (`#root`) acima dela
  (`z-index: 1`) — sem rolagem horizontal e sem custo ao rolar. No **celular** fica mais discreta
  (**40px**, **6%**). Ajuste em `client/src/index.css`: variáveis `--grade-tamanho` e
  `--grade-opacidade` (no `:root`, e no `@media (max-width: 767px)` para o celular).
- **Cores de dados**: as cores das categorias (rosca do Resumo, bolinhas) são escolhidas pelo usuário
  (gravadas na `Categoria`) a partir da `PALETA_CORES` de [`lib/constants.js`](client/src/lib/constants.js);
  não fazem parte do tema.
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
| Navegação ([Layout.jsx](client/src/components/Layout.jsx)) | **bottom nav fixa** (5 itens, ícone acima do rótulo, ativo em amarelo) + barra fina no topo com o avatar (menu: Perfil e Sair) | **sidebar** lateral fixa (14rem): marca (logo + "Painel Financeiro" / "Controle pessoal"), rótulo "MENU", itens com ícone (ativo: fundo, borda, amarelo e barrinha de 3px na borda esquerda) e cartão do usuário (avatar com a inicial, nome, "Sair") no rodapé |
| Listas de Receitas/Despesas ([ListaLancamentos.jsx](client/src/components/ListaLancamentos.jsx)) | **cards empilhados** (label + valor em coluna) | **tabela** com cabeçalho, linhas hairline e rodapé de total |
| Formulários (Receita/Despesa) | **1 coluna** | **2 colunas** (a partir de `sm`) |
| Saldo Final (Resumo) | 32px | 36px (`sm`) → 48px (`md`) |

Acessibilidade de toque: inputs em `text-base` (**16px** — evita o zoom
automático do iOS ao focar); botões e itens de navegação com **≥ 44×44px**
(`min-h-[44px]`, bottom nav 56px).

---

## Uso das telas (frontend)

O app tem **duas telas públicas** (Login e Registro) e, após autenticar,
a navegação para Resumo (página inicial — `/` e o login levam a `/resumo`), Receitas, Despesas, Porquinho (ícone de cofrinho) e Metas, nessa ordem (sidebar no desktop, bottom
nav no celular — ver [Responsividade](#responsividade)). O token JWT fica
no `localStorage`; use "Sair" para descartá-lo.

### Registro (`/registro`)
Informe **Nome** e **Sobrenome** (obrigatórios: mínimo 2 e máximo 50 caracteres, espaços das pontas
removidos), **e-mail** e **senha** (mínimo 6 caracteres) e clique em *Cadastrar*.
O backend já devolve o token, então você entra direto no painel. Link no
rodapé alterna para a tela de Login. O servidor valida nome e sobrenome de novo.

**Usuários antigos** (criados antes do nome existir) continuam entrando normalmente: ficam sem
`nome`/`sobrenome` e o app usa o **e-mail como nome exibido** (e a inicial do e-mail no avatar)
até eles preencherem o nome pelo Perfil. Nada quebra por falta do nome.

### Cartão do usuário e Perfil (`/perfil`)
- **Sidebar (desktop)**: no rodapé, um cartão com o **avatar** (inicial do *nome*; do e-mail se ainda
  não há nome), **"Nome Sobrenome"** em destaque (truncado com reticências se longo) e o botão **Sair** embaixo
  (**sem e-mail** no cartão; usuários antigos, sem nome, veem o e-mail no lugar do nome). **Clicar no cartão** (menos no "Sair") abre o Perfil.
- **Celular**: a barra inferior continua só com as 5 telas. No topo, o **avatar** abre um menu com
  o nome, **Perfil** e **Sair**. O e-mail só aparece no Perfil (somente leitura).
- **Perfil** — seção **Dados**: editar *Nome* e *Sobrenome* (mesmas regras do cadastro); o e-mail só
  aparece, sem edição. *Salvar* mostra "Dados salvos." (verde) e o nome na sidebar atualiza na hora.
  Usuários antigos veem os campos vazios e podem preenchê-los pela primeira vez.
- **Perfil** — seção **Alterar senha**: *Senha atual*, *Nova senha* e *Confirmar nova senha*, cada
  uma com botão **Mostrar/Ocultar**. Regras: nova senha com **no mínimo 8 caracteres**, **diferente
  da atual** e **confirmação igual**. Erros claros em vermelho ("Senha atual incorreta. Restam 4
  tentativas.", etc.) e sucesso em verde ("Senha alterada com sucesso.").
- **Limite de tentativas**: o projeto não tinha rate limit, então foi criado um para a troca de senha:
  **5 erros seguidos** da senha atual **bloqueiam a troca por 10 minutos** (`429`, mesmo que a
  senha certa seja informada nesse período); acertar zera o contador. Os contadores ficam no banco
  (`senhaTentativas`/`senhaBloqueadoAte` no `User`, ocultos da API) porque na Vercel cada
  requisição pode cair numa instância diferente. Erros de validação de formato não contam.
- **Segurança**: as rotas agem só sobre o usuário do token (nunca por id do corpo); a senha atual é
  conferida com `bcrypt.compare`, a nova é gravada como hash bcrypt, e senhas/hashes nunca são
  devolvidos nem registrados em log. Os tokens já emitidos seguem válidos até expirar (trocar a
  senha não derruba a sessão atual).

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

**Organização da tela** (só aparência; as regras de fixos, cartões, fatura, paga e totais não mudam):

```
Despesas                                   ‹  Novembro de 2026  ›  Hoje   [+ Nova despesa]
Novembro de 2026 · em andamento
[faixa "+ Nova despesa" — recolhida; abre logo abaixo do cabeçalho]
┌ Lista (1fr, ~650px) ────────────────────────┐  ┌ Painel (290px) ──────────┐
│ Todas · PicPay · Nubank   1 de 6 pagas  [Marcar todas como pagas]  Gerenciar categorias │
│ [✓] Internet ↻ (● PicPay)          R$ 130,00 │  │ PAGAMENTO DO MÊS         │
│     ● Utilidades                             │  │ R$ 2.180  ▓▓░░ Pago/Falta│
│ ...                                          │  │ CARTÕES DE CRÉDITO · 2/5 │
│                         Total   R$ 2.180,00  │  │ (um bloco por cartão)    │
└──────────────────────────────────────────────┘  └──────────────────────────┘
```

- **Cabeçalho**: à esquerda "Despesas" e, pequeno e cinza, o mês e a situação ("· em andamento",
  "· fechado" ou "· futuro"); à direita a navegação do mês (‹ mês ›, *Hoje* — a seta "anterior" fica
  **desabilitada em outubro/2026**) e o botão dourado **+ Nova despesa**. Lista e totais são do mês
  escolhido; novas despesas são lançadas nesse mês.
- **Contêiner único centralizado** (largura máxima **960px**, centralizado na área à direita do menu)
  envolve o cabeçalho, a faixa "+ Nova despesa" e o corpo — o cabeçalho termina exatamente na borda
  direita do painel lateral.
- **Corpo em 2 colunas** a partir de 1024px de tela (`lg`): **lista** flexível (`1fr`, ~650px no
  contêiner de 960px; coluna do valor estreita, ~120px, perto do nome) + **painel lateral** de 290px,
  gap de 18px, alinhados ao topo. Abaixo disso, **coluna única** na largura toda (margem de 16px no
  celular): cabeçalho → painel (Pagamento do mês, Cartões) → lista. Todos os blocos em card sólido.
- **+ Nova despesa** abre uma faixa (borda dourada sutil) com **Descrição | Categoria** (com bolinha;
  `+ Nova categoria` no fim) **| Cartão** ("Sem cartão" por padrão; `+ Novo cartão`) **| Valor | Repete
  todo mês | Adicionar**. Depois de adicionar, os campos limpam e a faixa **continua aberta** para lançar
  várias seguidas; **Esc** ou ✕ fecha. No celular os campos ficam empilhados.
- **Lista** (card único):
  - **barra do topo**: filtros por cartão (chip *Todas* + um chip por cartão, com bolinha), "**N de M
    pagas**", o botão **Marcar todas como pagas** (com confirmação) e o link discreto **Gerenciar
    categorias** (abre a mesma tela de gerenciar categorias numa janela);
  - cada linha tem **3 áreas**: [caixa *Paga*] [nome] [valor]. O nome mostra, na 1ª linha, a descrição,
    o **↻** dourado quando é *Repete todo mês* e a **pílula do cartão** (bolinha + nome); na 2ª, pequena e
    cinza, a **categoria** com a bolinha da cor dela. Valor em vermelho, mono, à direita;
  - **editar** (lápis) e **excluir** (✕) aparecem ao **passar o mouse** na linha (em telas sem mouse —
    celular — ficam sempre visíveis, empilhados). Editar troca a linha pelos campos (mesma validação);
    excluir um fixo pergunta "só este mês / este e os meses seguintes";
  - despesa **paga** fica com nome, categoria e valor a ~50% (destaca o que falta pagar);
  - a linha calculada **"Outras compras no cartão (nome)"** aparece com o selo *calculada*, sem caixa e sem
    editar/excluir;
  - **rodapé**: só "Total" + o valor grande em vermelho (soma das linhas mostradas).
- **Painel lateral**:
  - **PAGAMENTO DO MÊS**: total do mês em vermelho, barra verde com a fração paga, "Pago R$ x" (verde) e
    "Falta R$ y" (dourado). Sempre o mês inteiro (sem o filtro de cartão);
  - **CARTÕES DE CRÉDITO · N de 5** com *+ Novo*: um bloco por cartão — nome, editar/excluir,
    "Detalhado nas despesas", **Fatura total do mês** (mostra o valor salvo) + *Salvar*, e "Outras compras
    no cartão", *Fatura paga* e *Remover fatura* quando há fatura (ver
    [Cartões de crédito](#cartões-de-crédito-vários-cartões-sem-contar-nada-duas-vezes)).
- **Categoria**: as **categorias do usuário**, com a bolinha de cor (ver
  [Categorias personalizadas](#categorias-personalizadas)). **Valor** obrigatório, ≥ 0.
- **Fixos automáticos** (não há botão): ao abrir um mês, o servidor cria sozinho as despesas fixas do
  mês anterior (descrição, categoria, valor e cartão) e a tela avisa quantas foram adicionadas.
- **Marcar como paga**: cada despesa tem uma **caixa de marcação grande** (44×44px de toque, mesmo
  estilo das Metas: verde `#3ECF8E` quando marcada). Marcada = texto levemente apagado (o valor
  continua visível). **Atualização otimista**: marca na hora e sincroniza com
  `PATCH /api/despesas/:id` (se falhar, desfaz e avisa). Campo `paga` (Boolean, padrão `false`;
  despesas antigas valem como não pagas). **É só informativo**: total e saldo continuam somando
  *todas* as despesas. Os **fixos gerados automaticamente não herdam o status** (entram sempre
  como não pagos) e **editar não altera** o status.
- **Marcar todas como pagas** (barra do topo da lista): pede confirmação na própria tela e age só nas
  pendentes do mês selecionado (`PATCH /api/despesas/pagas`).
- No **Resumo**, o card *Total de despesas* mostra **Pago** e **Falta pagar** (esta em amarelo
  `#D4A24C`) com uma barrinha fina do que já foi pago. Vale para qualquer mês navegável.

### Cartões de crédito (vários cartões, sem contar nada duas vezes)

**O problema**: algumas despesas (ex.: Internet R$ 130, Energia) são pagas num cartão, e a **fatura**
daquele cartão (ex.: R$ 500) já **inclui** essas despesas. Lançar a fatura inteira como despesa faria a
Internet contar duas vezes. Por isso você liga ao cartão as despesas que quiser detalhar e informa **só o
total da fatura de cada cartão** no mês — o painel calcula o resto. Funciona com **vários cartões** (ex.:
PicPay, Nubank — até **5**), cada um com a sua fatura.

**Como usar** (tela de Despesas)
1. **Cartões de crédito** (topo da tela): crie os seus cartões (*+ Novo cartão*: nome de 2 a 24
   caracteres, único, e uma cor da paleta discreta — sem verde/vermelho puros). Cada cartão tem um card
   com **editar** e **excluir**. Sem cartões, a seção explica para que servem.
2. Ao lançar ou editar uma despesa, escolha o **Cartão**: "Nenhum (outra forma de pagamento)", um dos
   seus cartões (com a bolinha de cor) ou **+ Novo cartão** (mini-formulário sem sair da tela; o cartão
   criado já fica escolhido). A despesa ganha um **selo** com a cor e o nome do cartão; o **filtro
   rápido** mostra só as despesas (e a linha calculada) de um cartão.
3. No card de cada cartão: **Detalhado nas despesas** (soma das despesas daquele cartão no mês), o campo
   **Fatura total do mês (R$)** com *Salvar* (*Remover* apaga só a fatura informada) e, em destaque,
   **Outras compras no cartão** — a diferença, que foi **somada ao total de despesas**.
4. **Fatura paga** (por cartão): marca a fatura e também as despesas **daquele cartão** no mês ainda
   pendentes; a linha calculada dele passa a contar como paga em "Pago / Falta pagar". **Desmarcar desfaz
   só o que essa ação marcou**.
- **Excluir um cartão** pede confirmação dizendo **quantas despesas** serão afetadas: elas **viram
  despesas comuns** (nunca são apagadas) e as **faturas** daquele cartão são removidas.

**A conta (por mês)** — função central `server/src/services/cartao.js` (`calcularCartao`,
`cartoesDoMes` e `totalDespesasCorrigido`), usada por todas as telas:

```
para cada cartão c:
  detalhado_c    = Σ despesas do mês ligadas ao cartão c
  SEM fatura_c   → total_c = detalhado_c            (cada despesa conta uma vez)
  COM fatura_c   → naoDetalhado_c = max(0, fatura_c − detalhado_c)
                   total_c        = max(fatura_c, detalhado_c)
total de despesas do mês = despesas que NÃO são cartão + Σ total_c
                         = todas as despesas lançadas + Σ naoDetalhado_c
```

- O `max(0, …)` impede valor negativo; se as despesas de um cartão **passam da fatura** (valor
  desatualizado, compra que só cai na próxima…), vale o detalhado e **aquele card** mostra um aviso.
- **Linhas virtuais "Outras compras no cartão (nome)"**: cada `naoDetalhado_c` aparece na lista de
  Despesas do mês como uma linha **calculada** (selo "calculada", sem editar/excluir/marcar), na categoria
  **Outros**. **Não são registros salvos** — a API as monta na hora (`linhasVirtuais` em
  `GET /api/despesas?mes=`). A linha de Total da lista as considera.
- **Vale em todo lugar** (a mesma função, para os números nunca divergirem): Resumo (saldo, total de
  despesas — com "inclui R$ Y de outras compras nos cartões" —, barra de comprometimento, Pago/Falta
  pagar), rosca por categoria (as linhas contam em "Outros"), maiores despesas e a **média / previsão**
  do Porquinho e das Metas (a regra de meses fechados não mudou; o total guardado é só a soma das caixinhas).
- **Fixos**: despesas recorrentes copiadas para o mês seguinte **mantêm o cartão**; o **valor da fatura
  não é copiado** (muda todo mês).

**Transição do controle antigo (um cartão só), sem migração em massa e sem mudar os totais**
- Despesas com `cartao: true` e **sem `cartaoId`**, e faturas **sem `cartaoId`**, pertencem a um
  **cartão padrão "Cartão"**. Ele é criado automaticamente na **primeira vez que você abre a tela de
  Despesas** (só se houver esses dados antigos), **uma única vez** (marca `cartoesMigrados` no usuário e
  índice único parcial — sem duplicar mesmo com duas telas abertas).
- **Nenhuma despesa ou fatura antiga é reescrita**: o cálculo e as rotas reconhecem os dados antigos
  como do cartão padrão. Antes de o cartão existir, o cálculo usa um cartão "Cartão" provisório — os
  totais são os mesmos antes e depois.
- O índice único antigo de faturas (usuário + mês) é trocado por usuário + cartão + mês (necessário para
  dois cartões terem fatura no mesmo mês). Isso só mexe no índice, não em dados.
- Isolamento: cartões, faturas e despesas sempre filtrados pelo `userId` do token; uma despesa só pode
  ser ligada a um cartão do próprio usuário.

### Categorias personalizadas

As categorias de despesa são **de cada usuário**: dá para criar, editar (nome e cor) e excluir.

- **Onde**: no formulário de Despesas o campo *Categoria* lista as suas categorias com a bolinha de
  cor e, por último, **+ Nova categoria** — abre um mini-formulário (nome + cor) sem sair da tela, e a
  categoria criada já fica selecionada. Para gerenciar tudo, use a seção **Categorias** no fim da tela
  de Despesas (*Gerenciar*): lista com bolinha, nome, quantas despesas usam cada uma, e os botões
  **editar** e **excluir**.
- **Regras** (validadas no servidor): nome de **2 a 24 caracteres**, **único por usuário sem
  diferenciar maiúsculas** ("Lazer" = "lazer"), cor no formato `#RRGGBB`, **no máximo 15 categorias**.
- **Seletor de cor**: grade com 10 cores boas no fundo escuro e distinguíveis entre si, sem verde e
  vermelho puros (que indicam receita/despesa): `#3F78B0`, `#4FB3BF`, `#9B8AD9`, `#C9B27C`,
  `#B98AB5`, `#7FB5A0`, `#D2A66E`, `#8E9AAF`, `#5E6AB5`, `#6B7682` (`PALETA_CORES` em
  `client/src/lib/constants.js`). Uma categoria nova já vem com a **primeira cor ainda não usada**.
  Ao editar uma categoria cuja cor não é da grade (ex.: as padrão), a cor atual aparece como primeira
  opção, para poder ser mantida.
- **Renomear** uma categoria renomeia também as despesas do usuário que usam o nome antigo (elas não
  ficam órfãs); a tela avisa quantas foram atualizadas.
- **Excluir**: pede confirmação dizendo **quantas despesas serão movidas para "Outros"**. As despesas
  **nunca são apagadas** — só passam para "Outros" — e a tela avisa quantas foram movidas.
- **"Outros" é fixa**: não pode ser excluída nem renomeada (a API recusa com `400`) e aparece sem os
  botões de editar/excluir.
- **Transição sem migração (preguiçosa)**: na primeira vez que o usuário abre as categorias
  (`GET /api/categorias`, chamado ao entrar no app), o servidor cria as 5 padrão com as cores de
  antes — Utilidades `#3F78B0`, Saúde `#356A9C`, Alimentação `#2B5A86`, Outros `#234A70`, Lazer
  `#6B7682`. Duas aberturas ao mesmo tempo não duplicam (índice único usuário + nome normalizado).
- **Ligação com as despesas**: a despesa continua guardando o **nome** da categoria como texto
  (nenhum dado antigo foi alterado). Ela casa com a categoria do usuário de mesmo nome, sem
  diferenciar maiúsculas. Se não houver correspondência, a despesa é **exibida como "Outros"**
  (lista, formulário, rosca e maiores despesas), mas o valor gravado não muda.
- **Cores em todo o app** vêm das categorias do usuário (`CategoriasContext`, carregado uma vez ao
  entrar): rosca e legenda do Resumo, maiores despesas, lista e formulário de Despesas.
- **Isolamento**: todas as rotas usam o `userId` do token; renomear/excluir só mexe nas despesas do
  próprio usuário.

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
- **Cada categoria tem sempre a mesma cor em todo o app** — a cor que o **usuário escolheu** para
  ela (ver [Categorias personalizadas](#categorias-personalizadas)); despesa com categoria sem
  correspondência aparece como "Outros". A rosca tem vão de 2px entre as fatias e, ao passar o
  mouse/tocar, destaca a fatia e mostra nome, valor e % no centro. A mesma bolinha aparece na lista
  e no formulário de Despesas.
- **Muitas categorias**: com mais de 6 na rosca, a legenda vira **duas colunas** (quando há largura)
  e ganha **rolagem própria** (altura máxima) — os nomes quebram de linha, nunca são cortados.
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
- A **média guardada por mês** (Porquinho e Metas) considera só lançamentos de outubro/2026 em diante
  **e só meses fechados** (ver [Total guardado e média](#total-guardado-e-média)). O **total guardado**
  é só a soma das caixinhas.

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
O cálculo do total guardado/média também garante a geração de todos os meses até o atual antes de somar.

**Editar e excluir fixos — propagação para os meses seguintes** (`server/src/services/propagacao.js`)
- **Editar** uma despesa ou receita **fixa** aplica a mudança também às cópias dela nos **meses
  POSTERIORES** — no backend, na mesma operação da edição, sem confirmação. **Meses anteriores nunca
  mudam.** Depois de salvar aparece um aviso discreto: "Aplicado também a N meses seguintes".
- **Como as cópias são achadas**: mesmo usuário, fixas (`recorrente: true`), de meses posteriores, com a
  mesma chave **normalizada** (sem diferenciar maiúsculas, acentos e espaços) — despesa: a descrição;
  receita: fonte + descrição. Se você **renomear**, a descrição **antiga** acha as cópias e a **nova** é
  gravada nelas.
- **Se propagam**: descrição, categoria, cartão (`cartaoId`) e o próprio "Repete todo mês" (desmarcar
  desmarca também os meses seguintes) — nas receitas, fonte, descrição e "Repete todo mês".
- **NÃO se propagam**: o **valor** (a conta de luz varia todo mês) e o status **paga** (cada mês tem o seu).
- **Excluir** um fixo pergunta antes: **Só este mês** (padrão) ou **Este e os meses seguintes**
  (`DELETE …/:id?escopo=seguintes`). Excluir um lançamento comum continua sem pergunta.
- **Meses novos** continuam sendo gerados copiando do mês anterior: descrição, categoria, valor e cartão
  (`cartaoId`).
- **Ajuste único dos fixos já existentes** (uma vez por usuário, ao abrir Despesas; flag
  `fixosAjustados`): cada despesa fixa **sem cartão** que tenha uma correspondente fixa (mesma descrição)
  no mês **imediatamente anterior** **com cartão** recebe o cartão e a categoria dela, em cadeia
  (out → nov → dez). Não muda valor, paga nem despesas que já têm cartão; nada é apagado. A tela avisa
  quantos lançamentos foram ajustados. (Corrige meses copiados antes de o cartão ser marcado no mês
  anterior.)

### Total guardado e média

> **Total guardado = Σ valores das caixinhas. Só isso.**

- As caixinhas são o dinheiro **realmente guardado** — atualize os valores delas quando conferir os
  saldos. O resultado dos meses (receitas − despesas) **não é somado** ao total, senão contaria de novo o
  que já está nelas. **Fechar um mês não muda o total.**
- Exemplo: só a caixinha "Cofrinho PicPay" = R$ 3.870,00 → Total guardado = **R$ 3.870,00**, em qualquer
  mês, antes e depois de o mês fechar.
- **Fonte única**: `calcularGuardado` em `server/src/services/guardado.js` (devolvido em
  `GET /api/guardado`, `GET /api/caixinhas` e `GET /api/metas`). Porquinho e Metas mostram esse valor; o
  progresso, a conclusão automática e o ponto de partida da previsão das metas usam ele. O Porquinho só
  repete a soma na tela para acompanhar na hora as edições otimistas.
- O campo `caixinhasReferencia` do usuário (mês de referência, de uma regra anterior) é **legado e
  ignorado**: continua no banco, mas não é lido.

**Média guardada por mês** (informativa, fora do total; é o **ritmo** da previsão das metas) = média de
(receitas − despesas corrigidas pelo cartão) por **mês fechado**, de outubro/2026 (`MES_INICIAL`) até o
mês ANTERIOR ao atual. O mês em andamento não entra: ele passa a contar na média quando fecha (ex.: hoje é
07/11/2026 → só outubro; novembro entra em 01/12/2026).

- **"Hoje" é a data em `America/Fortaleza` (UTC-3)**, calculada no backend — nunca o fuso do servidor
  (na Vercel é UTC e viraria o mês 3 horas antes). Há **uma única função** para "mês atual":
  `mesAtual()` em `server/src/utils/mes.js`, reutilizada pelo total guardado, pela geração
  automática de fixos e pela criação de lançamentos. O mês vira à meia-noite de Fortaleza
  (ex.: às 23h59 de 30/11 ainda é novembro, mesmo que em UTC já seja dezembro).
- O resultado **parcial do mês em andamento** é devolvido à parte (`emAndamento` em `GET /api/guardado`)
  só para exibir: no Porquinho aparece uma linha discreta — *"Mês em andamento (novembro/2026),
  entra em 01/12/2026: R$ X"* — com o nome do mês e a data (em que ele fecha e entra na média)
  calculados dinamicamente. Não entra no total.

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

### Porquinho (`/porquinho`)
Onde o dinheiro guardado está: você cadastra **caixinhas** — cada lugar onde guarda dinheiro, com
nome e valor (ex.: "Caixinha Nubank" R$ 10.000, "Caixinha Mercado Livre" R$ 10.000, "Carteira
Binance" R$ 30.000). A **soma das caixinhas** substituiu o antigo campo único "Saldo inicial
guardado" da aba Metas.

**Card "Total guardado"** (topo): o valor grande em verde é a **soma das caixinhas** (só isso). Ao
lado, como informação: *Média guardada por mês (base: N meses)* (só com ao menos 1 mês fechado) e,
discreta, *Mês em andamento (novembro/2026), entra em 01/12/2026*. Ver
[Total guardado e média](#total-guardado-e-média).

**Seção "Caixinhas"**
- **Barra empilhada** horizontal com a proporção de cada caixinha no total delas, uma cor por
  caixinha, e legenda com nome e %. As cores são as da paleta das categorias (tons discretos, sem
  verde/vermelho puros) e seguem a **ordem de criação** — a cor de uma caixinha não muda quando os
  valores mudam (com mais de 10 caixinhas a paleta recomeça).
- **Lista** da **maior para a menor** (cards em 2 colunas no desktop, 1 no celular): bolinha de cor,
  nome, valor em fonte mono, **editar** (nome e valor viram campos ali mesmo; Enter salva, Esc cancela)
  e **excluir** (com confirmação na própria linha).
- **Adicionar caixinha**: nome (placeholder "Ex.: Caixinha Nubank"), valor (R$) e *Adicionar* — Enter
  também adiciona. Contador "N de 20".
- **Estado vazio** amigável quando não há caixinhas.
- **Atualização otimista** em criar, editar e excluir: a tela muda na hora (o total também, porque é
  calculado a partir da lista na tela) e, se a API falhar, volta ao estado anterior e mostra o erro.
- **Regras** (validadas no servidor): nome de **2 a 30 caracteres**, valor **número ≥ 0**, **no
  máximo 20 caixinhas** por usuário.

**Transição do antigo "Saldo inicial guardado" (sem migração em massa)**
- O campo `saldoInicial` do usuário **continua no banco** (não foi apagado nem alterado), mas não
  entra mais no total.
- Na **primeira vez** que o total guardado ou as caixinhas são consultados depois da mudança
  (abrir o Porquinho ou as Metas), se o usuário tem saldo inicial **maior que zero** e
  **nenhuma caixinha**, o servidor cria **uma** caixinha **"Saldo inicial"** com esse valor e grava
  `caixinhasMigradas: true` no usuário. Assim o saldo antigo não se perde.
- Acontece **uma única vez**: nunca duplica (índice único parcial na caixinha migrada, mesmo com
  duas telas abertas ao mesmo tempo) e, se você excluir ou renomear essa caixinha, ela não volta.
- Roda também ao calcular o total pelas Metas (não só no Porquinho) para o total nunca "perder" o
  saldo inicial, seja qual for a primeira tela aberta.

Dados: **uma** chamada, `GET /api/caixinhas`, traz as caixinhas e o total guardado juntos.

### Metas (`/metas`)
Objetivos pessoais com checkbox ("quadradinho") e, opcionalmente, um **valor** que
vira barra de progresso.

**Card compacto** (topo): "Total guardado: R$ X" e "Média guardada por mês: R$ Y (base: N meses)",
com o link **Ver Porquinho**. O total = **soma das caixinhas** (ver
[Total guardado e média](#total-guardado-e-média)); as caixinhas ficam no [Porquinho](#porquinho-porquinho).
O antigo campo "Saldo inicial guardado" e o botão *Salvar saldo* saíram desta aba.
- **Média guardada por mês** = **média de (receitas − despesas) por mês fechado**: de outubro/2026 ao mês
  anterior ao atual, o mês atual **não entra** (fuso America/Fortaleza).
  Calculada **no backend** (`mediaMensal` e `mesesFechados` em `GET /api/guardado`, no `guardado` de
  `GET /api/metas` e de `GET /api/caixinhas`; `services/guardado.js`). Com só 1 mês fechado a base diz
  "(base: 1 mês)" — estimativa fraca; sem nenhum mês fechado a linha não aparece. As caixinhas não
  entram na média.

**Metas**
- **Adicionar**: título + **Valor (R$) opcional** — botão *Adicionar* ou **Enter**.
  Sem valor, a meta é um checklist comum.
- **Meta com valor**: barra de progresso **verde**, porcentagem e "R$ X de R$ Y".
  Progresso = `min(total guardado ÷ valor, 100%)`.
- **Previsão** (texto pequeno, cor secundária, abaixo da barra): em cada meta **com valor ainda não
  atingido**, "**No ritmo atual, chega em mar/2027**" (mês abreviado em pt-BR). Conta:
  `faltam = valor − total guardado` (ponto de partida: a soma das caixinhas), `meses = ceil(faltam ÷
  média)` (ritmo: a média dos meses fechados), `previsão = mês atual + meses` (nunca o mês atual). Média **zero ou negativa** → "Sem previsão no ritmo atual". **Nenhum mês
  fechado** ainda → sem previsão. Metas já atingidas/concluídas ou sem valor não mostram previsão.
  Cálculo na tela, em `client/src/lib/previsao.js`, a partir da média que a API devolve.
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
| POST   | `/api/register`       | não  | `{ nome, sobrenome, email, senha }` (nome/sobrenome: 2–50 caracteres) | `201 { user, token }` · `400` · `409` |
| POST   | `/api/login`          | não  | `{ email, senha }`                                 | `200 { user, token }` · `400` · `401`                |
| GET    | `/api/me`             | sim  | header `Bearer`                                    | `200 { user }` · `401` · `404`                       |
| GET    | `/api/auth/me`        | sim  | header `Bearer`                                    | `200 { user }` com `nome`, `sobrenome` (ausentes em usuários antigos) e `email` · `401` · `404` |
| PATCH  | `/api/auth/perfil`    | sim  | `{ nome, sobrenome }`                              | `200 { user }` · `400` · `401`                       |
| PATCH  | `/api/auth/senha`     | sim  | `{ senhaAtual, novaSenha, confirmacao }`           | `200 { message }` · `400` (validação / "Senha atual incorreta") · `429` (bloqueio por 5 erros seguidos, 10 min) · `401` |
| GET    | `/api/receitas`       | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { receitas: [...], fixosGerados }` (do mês; abrir o mês gera os fixos; sem `mes`, de out/2026 em diante) |
| POST   | `/api/receitas`       | sim  | `{ fonte, valor, descricao?, recorrente?, mes? }`  | `201 { receita }` · `400`                            |
| PUT    | `/api/receitas/:id`   | sim  | `{ fonte, valor, descricao?, recorrente? }`        | `200 { receita, propagadas }` (fixa: fonte/descrição/recorrente vão para os meses seguintes; o valor não) · `400` · `404` |
| DELETE | `/api/receitas/:id`   | sim  | query `?escopo=seguintes` (opcional, só fixa)      | `200 { removidas }` (padrão: só esta; `seguintes`: também as cópias fixas dos meses seguintes) · `400` · `404` |
| GET    | `/api/despesas`       | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { despesas: [...], fixosGerados, cartoes?, linhasVirtuais? }` (do mês; abrir o mês gera os fixos; sem `mes`, de out/2026 em diante). Com `mes`: `cartoes` = situação de cada cartão (`{ cartoes: [{ cartao, fatura, detalhado, naoDetalhado, totalCartao, excedeu }], naoDetalhado, excedeu }`) e `linhasVirtuais` = as linhas calculadas "Outras compras no cartão (nome)". Abrir a tela aplica a transição do cartão padrão (1 vez) e o ajuste único dos fixos (`fixosAjustados` = quantos foram ajustados) |
| POST   | `/api/despesas`       | sim  | `{ descricao, valor, categoria?, recorrente?, cartaoId?, mes? }` (`cartaoId`: cartão do usuário ou `null`) | `201 { despesa }` · `400` |
| PUT    | `/api/despesas/:id`   | sim  | `{ descricao, valor, categoria?, recorrente?, cartaoId? }` | `200 { despesa, propagadas }` (fixa: descrição/categoria/cartão/recorrente vão para os meses seguintes; valor e paga não) · `400` · `404` (não altera `paga`) |
| PATCH  | `/api/despesas/:id`   | sim  | `{ paga: boolean }`                                | `200 { despesa }` · `400` · `404`                    |
| PATCH  | `/api/despesas/pagas` | sim  | `{ mes: "AAAA-MM" }`                               | `200 { atualizadas }` (marca as pendentes do mês) · `400` |
| DELETE | `/api/despesas/:id`   | sim  | query `?escopo=seguintes` (opcional, só fixa)      | `200 { removidas }` (padrão: só esta; `seguintes`: também as cópias fixas dos meses seguintes) · `400` · `404` |
| GET    | `/api/resumo`         | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { totalReceitas, totalDespesas, outrasComprasCartao, cartaoExcedeu, saldo, totalPago, faltaPagar, fixosGerados }` — `totalDespesas` já CORRIGIDO pelos cartões (inclui `outrasComprasCartao`, a soma das partes não detalhadas de todas as faturas); `totalPago`/`faltaPagar` são só informativos (do mês; sem `mes`, de out/2026 em diante) |
| GET    | `/api/metas`          | sim  | —                                                 | `200 { metas: [...], guardado }` (mais recentes primeiro; já sincronizadas; `guardado` = o mesmo objeto de `GET /api/guardado`, numa chamada só) |
| POST   | `/api/metas`          | sim  | `{ titulo, valorAlvo? }`                           | `201 { meta }` · `400`                               |
| PATCH  | `/api/metas/:id`      | sim  | `{ concluida?, titulo?, valorAlvo? }` (ao menos um; `valorAlvo: null` remove) | `200 { meta }` · `400` · `404`  |
| DELETE | `/api/metas/:id`      | sim  | —                                                 | `204` · `400` (id inválido) · `404`                  |
| GET    | `/api/guardado`       | sim  | —                                                 | `200 { totalCaixinhas, saldoAcumulado, total, mesesFechados, mediaMensal, emAndamento }` — `total` = soma das caixinhas (só isso); `saldoAcumulado` = receitas − despesas dos meses fechados (informativo, base da média); `mediaMensal` = média de (receitas − despesas) por mês fechado (`null` sem mês fechado); `emAndamento` = `{ mes, receitas, despesas, saldo, entraEm }` (parcial fora do total). (O antigo `PUT /api/guardado` do saldo inicial foi removido.) |
| GET    | `/api/caixinhas`      | sim  | —                                                 | `200 { caixinhas: [{ _id, nome, valor, createdAt, updatedAt }], limite, guardado }` (ordem de criação; na 1ª vez cria a caixinha "Saldo inicial" a partir do saldo antigo; `guardado` = o mesmo objeto de `GET /api/guardado`, ou `null` se falhar) |
| POST   | `/api/caixinhas`      | sim  | `{ nome, valor }` (nome 2–30; valor número ≥ 0)    | `201 { caixinha }` · `400` (validação / limite de 20) |
| PATCH  | `/api/caixinhas/:id`  | sim  | `{ nome?, valor? }` (ao menos um)                  | `200 { caixinha }` · `400` · `404` |
| DELETE | `/api/caixinhas/:id`  | sim  | —                                                 | `204` · `400` (id inválido) · `404` |
| GET    | `/api/cartoes`        | sim  | —                                                 | `200 { cartoes: [{ _id, nome, cor, padrao, qtdDespesas }], limite }` (aplica a transição do cartão padrão na 1ª vez) |
| POST   | `/api/cartoes`        | sim  | `{ nome, cor }` (nome 2–24; cor `#RRGGBB`)         | `201 { cartao }` · `400` (validação / limite de 5) · `409` (nome repetido) |
| PATCH  | `/api/cartoes/:id`    | sim  | `{ nome?, cor? }`                                  | `200 { cartao }` · `400` · `404` · `409` |
| DELETE | `/api/cartoes/:id`    | sim  | —                                                 | `200 { despesasAfetadas, faturasRemovidas }` (despesas viram comuns; faturas do cartão saem) · `400` · `404` |
| GET    | `/api/faturas`        | sim  | query `?mes=AAAA-MM`                               | `200 { cartoes: [...], naoDetalhado, excedeu }` (situação de todos os cartões no mês) · `400` |
| PUT    | `/api/faturas/:mes/:cartaoId` | sim | `{ valor }` (número ≥ 0)                     | `200` situação dos cartões (cria ou atualiza) · `400` · `404` |
| PATCH  | `/api/faturas/:mes/:cartaoId/paga` | sim | `{ paga: boolean }`                     | `200` situação + `despesasAlteradas` (marca/desmarca as despesas daquele cartão no mês) · `400` · `404` |
| DELETE | `/api/faturas/:mes/:cartaoId` | sim | —                                            | `204` · `400` · `404` |
| GET    | `/api/categorias`     | sim  | —                                                 | `200 { categorias: [{ _id, nome, cor, qtdDespesas, ... }], limite }` (cria as 5 padrão no 1º acesso; `qtdDespesas` = despesas de todos os meses com esse nome) |
| POST   | `/api/categorias`     | sim  | `{ nome, cor }` (nome 2–24; cor `#RRGGBB`)         | `201 { categoria }` · `400` (validação / limite de 15) · `409` (nome repetido) |
| PATCH  | `/api/categorias/:id` | sim  | `{ nome?, cor? }` (ao menos um)                    | `200 { categoria, despesasAtualizadas }` (renomear leva as despesas junto) · `400` (validação / renomear "Outros") · `404` · `409` |
| DELETE | `/api/categorias/:id` | sim  | —                                                 | `200 { movidas }` (despesas passam para "Outros") · `400` (excluir "Outros") · `404` |

---

## Próximos passos sugeridos

- Filtros por período/categoria e paginação nas listagens.
- Validação de payload com `zod` ou `express-validator`.
- Testes automatizados (`vitest` no client, `supertest` no server).
