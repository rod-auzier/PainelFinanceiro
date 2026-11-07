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
  `recharts`. O roteamento usa `react-router-dom` e o estado de autenticação
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
│       ├── index.css           # ★ TOKENS DE COR (:root) + base + regras do Recharts
│       ├── lib/
│       │   ├── format.js       # brl()
│       │   ├── mes.js          # helpers de mês (AAAA-MM), rótulos e mensagem da cópia de fixos
│       │   ├── constants.js    # CATEGORIAS_DESPESA + paleta do gráfico
│       │   └── theme.js        # token('surface') → lê CSS var em runtime (p/ Recharts)
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
│       │   ├── ListaLancamentos.jsx         # tabela (>=md) / cards (<md) + edição inline
│       │   ├── GuardadoCard.jsx             # "Total guardado" + campo Saldo inicial guardado
│       │   ├── MetaItem.jsx                 # meta: checkbox grande, barra de progresso, editar, lixeira
│       │   ├── Money.jsx                    # valor R$ em fonte mono + tabular-nums
│       │   ├── SeletorMes.jsx               # ‹ mês › — navegação entre meses (Receitas/Despesas/Resumo)
│       │   ├── SummaryCard.jsx              # cartão de valor agregado (size 'hero' | 'default')
│       │   └── DespesasPorCategoriaChart.jsx # gráfico de barras Recharts
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
        │   ├── Despesa.js      # { userId, descricao, categoria, valor, recorrente, createdAt }
        │   └── Meta.js         # { userId, titulo, concluida, valorAlvo?, alvoAtingido, createdAt }
        ├── middlewares/
        │   ├── auth.js         # Valida JWT → injeta req.userId
        │   └── errorHandler.js # 404 + handler de erros padronizado
        ├── utils/
        │   ├── asyncHandler.js # Encaminha erros de handlers async ao errorHandler
        │   └── mes.js          # mês "AAAA-MM": limites no fuso de Brasília, filtro por createdAt
        ├── services/
        │   ├── fixos.js        # copiar fixos (recorrentes) do mês anterior, sem duplicar
│   ├── totais.js       # somarValor: soma de receitas/despesas (aggregation)
│   └── guardado.js     # total guardado + conclusão automática das metas
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

Tema **escuro**, definido por tokens. As 8 cores são declaradas **uma única
vez** como CSS custom properties em [`client/src/index.css`](client/src/index.css)
(bloco `:root`, todo comentado) e o [`tailwind.config.js`](client/tailwind.config.js)
só as **mapeia** para classes utilitárias — nenhum componente tem cor hardcoded.

| Token (`--color-…`) | Hex | Classe Tailwind | Papel |
|---|---|---|---|
| `bg`       | `#14181C` | `bg-bg`        | fundo da aplicação |
| `surface`  | `#1C2227` | `bg-surface`   | cards, inputs, sidebar, cabeçalho de tabela |
| `border`   | `#2A3138` | `border` / `divide-border` | divisórias finas (hairline) e contornos |
| `fg`       | `#E8ECEF` | `text-fg`      | texto principal |
| `muted`    | `#8B95A1` | `text-muted`   | texto secundário, labels, placeholders |
| `positive` | `#3ECF8E` | `text-positive` | receitas, superávit, valores ≥ 0 |
| `negative` | `#E2604A` | `text-negative` | despesas, déficit, valores < 0 |
| `accent`   | `#D4A24C` | `bg-accent` / `text-accent` | ações (botões, links, nav ativa) |

- **Tipografia**: Inter para textos/labels (`font-sans`); **JetBrains Mono**
  para valores monetários e números (`font-mono` + `tabular-nums`, via a classe
  `.num` ou o componente [`Money`](client/src/components/Money.jsx)) — dígitos
  de largura fixa alinham as colunas das tabelas. Fontes carregadas no
  [`index.html`](client/index.html).
- **Estilo das tabelas**: divisórias hairline (`#2A3138`), cantos pouco
  arredondados, sem sombras.
- **Ajustar o tema no futuro**: edite só o bloco `:root` de `index.css`.

---

## Responsividade

Breakpoints padrão do Tailwind (`sm` 640px, `md` 768px). O ponto de virada
principal é **`md`** — abaixo dele o layout é mobile, os pontos de mudança
estão comentados no código:

| Elemento | `< md` (mobile) | `>= md` (desktop) |
|---|---|---|
| Navegação ([Layout.jsx](client/src/components/Layout.jsx)) | **bottom nav fixa** (4 itens) + barra fina no topo com "Sair" | **sidebar** lateral fixa (14rem) com "Sair" no rodapé |
| Listas de Receitas/Despesas ([ListaLancamentos.jsx](client/src/components/ListaLancamentos.jsx)) | **cards empilhados** (label + valor em coluna) | **tabela** com cabeçalho, linhas hairline e rodapé de total |
| Formulários (Receita/Despesa) | **1 coluna** | **2 colunas** (a partir de `sm`) |
| Saldo Final (Resumo) | 32px | 36px (`sm`) → 48px (`md`) |

Acessibilidade de toque: inputs em `text-base` (**16px** — evita o zoom
automático do iOS ao focar); botões e itens de navegação com **≥ 44×44px**
(`min-h-[44px]`, bottom nav 56px).

---

## Uso das telas (frontend)

O app tem **duas telas públicas** (Login e Registro) e, após autenticar,
a navegação para Receitas, Despesas, Resumo e Metas (sidebar no desktop, bottom
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
  o mês escolhido; novas receitas são lançadas nesse mês.
- **Repete todo mês** (checkbox no formulário): marca a receita como **fixa**
  (aparece como "↻ Todo mês" na lista).
- **Copiar fixos do mês anterior**: copia para o mês selecionado as receitas
  fixas do mês anterior (fonte, descrição e valor) e avisa quantas foram
  copiadas. **Não duplica**: o que já existe no mês (mesma fonte + descrição,
  também fixa) é ignorado — dá para clicar de novo sem medo.
- **Lista**: tabela no desktop, cards no mobile; total do mês ao fim.
- **Editar inline** (lápis): os campos da linha viram inputs ali mesmo, com
  *Salvar* / *Cancelar* (PUT `/api/receitas/:id`) — é por aqui que se ajusta o
  valor de uma fixa copiada; dá para (des)marcar "Todo mês". **✕** exclui.

### Despesas (`/despesas`)
- **Formulário**: `Descrição` (obrigatório), `Categoria` (select fixo:
  Utilidades, Alimentação, Transporte, Saúde, Lazer, Outros) e `Valor`
  (obrigatório, ≥ 0).
- **Seletor de mês** (‹ mês ›, e *Hoje*) no topo: lista e total do mês escolhido;
  novas despesas são lançadas nesse mês.
- **Repete todo mês** (checkbox no formulário): marca a despesa como **fixa**
  ("↻ Todo mês" na lista).
- **Copiar fixos do mês anterior**: copia para o mês selecionado as despesas
  fixas do mês anterior (descrição, categoria e valor) para você só editar o
  que mudou (ex.: a conta de luz) e avisa quantas foram copiadas. **Não
  duplica**: se já existe no mês uma despesa fixa com a mesma descrição, ela é
  ignorada.
- **Lista**: descrição, categoria, fixo e valor; tabela no desktop, cards no
  mobile; total do mês ao fim.
- **Editar inline** (lápis): campos viram inputs (`Categoria` continua um
  select), *Salvar* / *Cancelar* (PUT `/api/despesas/:id`). **✕** exclui.

### Resumo (`/resumo`)
- **Seletor de mês** (‹ mês ›) no topo: o resumo e o gráfico são do mês escolhido
  (o mês selecionado é lembrado ao trocar de aba).
- **Saldo Final** em destaque: número grande em fonte monoespaçada, verde se
  ≥ 0 e vermelho se < 0 — é o elemento principal da tela.
- Logo abaixo, o **indicador** **▲ Superávit** (verde) / **▼ Déficit** (vermelho).
- Ao lado, dois cards menores: *Total de Receitas* (verde) e *Total de
  Despesas* (vermelho).
- **Gráfico (Recharts)**: barras com o total gasto por categoria de despesa;
  categorias sem gasto são omitidas.

Os totais dos cartões vêm de `GET /api/resumo?mes=AAAA-MM` (somados no MongoDB via
aggregation); o gráfico é montado no cliente a partir de `GET /api/despesas?mes=AAAA-MM`.

> **Como o mês funciona:** receitas e despesas só têm a data `createdAt`; o mês de um
> lançamento é o mês do seu `createdAt` (fuso de Brasília, UTC-3). Ao lançar com outro
> mês selecionado, o `createdAt` é posicionado nesse mês. Sem `mes`, as rotas
> continuam devolvendo/somando todos os meses.

### Metas (`/metas`)
Objetivos pessoais com checkbox ("quadradinho") e, opcionalmente, um **valor** que
vira barra de progresso.

**Total guardado** (card no topo)
- Fórmula: **saldo inicial guardado + (receitas − despesas de TODOS os meses)**.
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
- **Contador** no topo: "X de Y concluídas". **Ordem**: pendentes primeiro; concluídas
  embaixo, sob o rótulo "Concluídas". Sem metas, mensagem amigável.

O checkbox, o lápis e a lixeira têm áreas de toque ≥ 44px; a linha inteira (caixa +
texto) é clicável (56px). Valores em fonte mono tabular, tema escuro e responsivo.

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
| GET    | `/api/receitas`       | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { receitas: [...] }` (do mês; sem `mes`, todas) |
| POST   | `/api/receitas`       | sim  | `{ fonte, valor, descricao?, recorrente?, mes? }`  | `201 { receita }` · `400`                            |
| POST   | `/api/receitas/copiar-fixos` | sim | `{ mes }` (mês de destino)                  | `200 { copiadas, ignoradas, mesOrigem, fixosNaOrigem }` · `400` |
| PUT    | `/api/receitas/:id`   | sim  | `{ fonte, valor, descricao?, recorrente? }`        | `200 { receita }` · `400` · `404`                    |
| DELETE | `/api/receitas/:id`   | sim  | —                                                 | `204` · `400` (id inválido) · `404`                  |
| GET    | `/api/despesas`       | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { despesas: [...] }` (do mês; sem `mes`, todas) |
| POST   | `/api/despesas`       | sim  | `{ descricao, valor, categoria?, recorrente?, mes? }` | `201 { despesa }` · `400`                         |
| POST   | `/api/despesas/copiar-fixos` | sim | `{ mes }` (mês de destino)                  | `200 { copiadas, ignoradas, mesOrigem, fixosNaOrigem }` · `400` |
| PUT    | `/api/despesas/:id`   | sim  | `{ descricao, valor, categoria?, recorrente? }`    | `200 { despesa }` · `400` · `404`                    |
| DELETE | `/api/despesas/:id`   | sim  | —                                                 | `204` · `400` (id inválido) · `404`                  |
| GET    | `/api/resumo`         | sim  | query `?mes=AAAA-MM` (opcional)                    | `200 { totalReceitas, totalDespesas, saldo }` (do mês; sem `mes`, todos) |
| GET    | `/api/metas`          | sim  | —                                                 | `200 { metas: [...] }` (mais recentes primeiro; já sincronizadas com o total guardado) |
| POST   | `/api/metas`          | sim  | `{ titulo, valorAlvo? }`                           | `201 { meta }` · `400`                               |
| PATCH  | `/api/metas/:id`      | sim  | `{ concluida?, titulo?, valorAlvo? }` (ao menos um; `valorAlvo: null` remove) | `200 { meta }` · `400` · `404`  |
| DELETE | `/api/metas/:id`      | sim  | —                                                 | `204` · `400` (id inválido) · `404`                  |
| GET    | `/api/guardado`       | sim  | —                                                 | `200 { saldoInicial, saldoAcumulado, total }`        |
| PUT    | `/api/guardado`       | sim  | `{ saldoInicial }` (número ≥ 0)                    | `200 { saldoInicial, saldoAcumulado, total }` · `400` |

---

## Próximos passos sugeridos

- Edição (`PUT`) de receitas e despesas.
- Filtros por período/categoria e paginação nas listagens.
- Code-splitting do bundle (o `recharts` deixa o JS acima de 500 kB).
- Validação de payload com `zod` ou `express-validator`.
- Testes automatizados (`vitest` no client, `supertest` no server).
