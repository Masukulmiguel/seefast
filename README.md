# SeeFast — Painel de Supervisão

Painel web de supervisão de dispositivos com consentimento explícito.
React + Vite no frontend, API HTTP em Node com SQLite no backend.

## Requisitos

- Node.js 22.19+ ou 24 (`undici` 8, dependência do vitest, exige `>=22.19`;
  o `engines` no `package.json`declara isto). O CI corre em Node 22 e 24.
- npm

## Arranque

```bash
npm install        # dependências

# 1) criar o primeiro utilizador (uma vez)
#    Windows (PowerShell):
$env:SEEFAST_ADMIN_EMAIL="ana@seefast"; $env:SEEFAST_ADMIN_PASSWORD="segredo123"; npm run seed:admin
#    macOS/Linux:
SEEFAST_ADMIN_EMAIL=ana@seefast SEEFAST_ADMIN_PASSWORD=segredo123 npm run seed:admin

# 2) arrancar
npm start          # API (3001) + Vite dev server (5173) em simultâneo
```

Ou em terminais separados:

```bash
npm run server     # API em http://127.0.0.1:3001
npm run dev        # frontend em http://localhost:5173
```

### Produção (uma só porta)

```bash
npm run build      # compila o frontend para dist/
npm run start:prod # serve dist/ + a API na mesma porta (PORT ou 3001)
```

O `server/producao.js` é o que se usa no Render e em qualquer hosting: serve
os ficheiros estáticos compilados **e** encaminha `/api/*` para o mesmo
handler da API, tudo numa única porta. É exigência do Render: um web service
só pode escutar numa porta.

O Vite faz proxy de `/api/*` para `http://127.0.0.1:3001` (ver `vite.config.js`),
por isso o frontend fala com a API sem CORS em desenvolvimento.

> Nota: o dev server do Vite 8 escuta em `localhost` (IPv6 `::1`) — abra
> `http://localhost:5173`, não `127.0.0.1:5173`.

### Acessível a partir de um telemóvel (rede local)

```powershell
$env:SEEFAST_HOST="0.0.0.0"   # a API passa a escutar em toda a rede local
npm start
```

A API avisa quando está exposta. Só use isto numa rede de confiança: as
sessões viajam por HTTP em claro (ver "Limitações conhecidas").

### Instalar no telemóvel (PWA)

O painel é uma PWA: no Chrome/Android, *Menu → Adicionar ao ecrã principal*
cria um ícone que abre em ecrã inteiro e funciona offline. Os ícones são
gerados por `npm run icones` (script próprio, sem dependências).

**A PWA não recolhe dados do dispositivo** — para isso existe a app Android
(ver `docs/superpowers/specs/`), que fala com a API através dos endpoints de
ingestão.

## Outros comandos

```bash
npm test           # vitest (jsdom + testing-library; server/*.test.js em node)
npm run build      # build de produção em dist/
npm run preview    # serve o build de produção
npm run seed:admin # cria/actualiza um utilizador (admin ou visualizador)
```

## Acesso e papéis

- Login por email + password. A password nunca é guardada em claro: hash
  `scrypt` com salt aleatório por utilizador.
- Sessão por cookie `seefast_session` (`HttpOnly`, `SameSite=Lax`), válida 7
  dias, guardada no servidor (revogável).
- Papéis: **admin** (lê e escreve) e **visualizador** (só lê). As escritas são
  restritas ao admin (403 para visualizador) e ficam registadas em auditoria.
- `SEEFAST_ADMIN_ROLE=visualizador` cria um utilizador sem poderes de escrita.
- Sem recuperação de password por email (não há servidor de email): a
  redefinição é local, correndo `npm run seed:admin` com a nova password.

## Rotas e dados

| Path | Página | Endpoint |
|------|--------|----------|
| `/` | Dashboard (indicadores + listas) | `/api/devices` + `/api/alerts` |
| `/dispositivos` | Dispositivos | `/api/devices` |
| `/localizacao` | Localização | `/api/locations` |
| `/controlo-parental` | Controlo Parental (editar limite) | `/api/parental-rules` |
| `/aplicacoes` | Aplicações (bloquear/desbloquear) | `/api/apps` |
| `/alertas` | Alertas (reconhecer) | `/api/alerts` |
| `/permissoes` | Permissões | `/api/permissions` |
| `/auditoria` | Auditoria | `/api/audit` |
| qualquer outro | 404 com regresso ao dashboard | — |

## API

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/health` | `{ status: "ok", service: "seefast-api" }` (público) |
| `POST /api/login` | `{ email, password }` → cookie de sessão (público) |
| `POST /api/logout` | termina a sessão |
| `GET /api/session` | utilizador da sessão actual |
| `GET /api/devices` | `{ devices: [{ id, nome, estado, bateria, ultimo_reporte }] }` |
| `POST /api/devices` | regista um dispositivo: `{ nome }` → devolve `{ device: { id, nome, token } }` — **admin**, o token só aparece uma vez |
| `POST /api/devices/:id/estado` | `{ estado, bateria, em }` — **token do dispositivo** |
| `POST /api/devices/:id/localizacao` | `{ lat, lon, em }` — **token do dispositivo** |
| `POST /api/devices/:id/apps` | `{ apps: [{ nome, pacote, tamanhoMb }] }` — **token do dispositivo** |
| `POST /api/devices/:id/uso` | `{ uso: [{ pacote, minutos }] }` — **token do dispositivo** |
| `POST /api/devices/:id/consentimento` | `{ consentimento, camera, microfone, localizacao }` — **token do dispositivo** |
| `GET /api/alerts` | `{ alerts: [{ id, nivel, mensagem, em, reconhecido }] }` — data descendente |
| `GET /api/locations` | `{ locations: [{ deviceId, nome, lat, lon, atualizadoEm }] }` |
| `GET /api/parental-rules` | `{ rules: [{ id, deviceId, nome, limiteMinutos, inicio, fim }] }` |
| `GET /api/apps` | `{ apps: [{ id, deviceId, nome, pacote, tamanhoMb, bloqueada }] }` |
| `GET /api/permissions` | `{ permissions: [{ deviceId, nome, consentimento, camera, microfone, localizacao }] }` |
| `GET /api/audit` | `{ entries: [{ id, em, ator, acao, alvo }] }` — data descendente |
| `PATCH /api/apps/:id` | `{ bloqueada }` — **admin** |
| `PATCH /api/parental-rules/:id` | `{ limiteMinutos, inicio, fim }` — **admin** |
| `POST /api/alerts/:id/ack` | reconhece o alerta — **admin** |

Todos os endpoints de dados exigem sessão válida (401 sem cookie).
Pedidos com request-target malformado respondem 400 em vez de derrubar o processo.

## Persistência

- SQLite em `data/seefast.db` (configurável por `SEEFAST_DB`), via `better-sqlite3`.
- Migrations em `server/migrations/NNN_descricao.sql`, aplicadas por ordem ao
  arrancar e registadas em `schema_migrations` (cada uma corre uma vez).
- A base nasce com os dados de demonstração; `npm run seed:admin` cria o
  primeiro utilizador.

## Dispositivos e ingestão (para a app Android)

- Na página **Dispositivos**, o administrador regista um dispositivo (formulário
  "Registar dispositivo"). A API gera um **token** opaco (32 bytes) que é
  mostrado **uma única vez** — a app do telemóvel precisa dele. Na base fica
  só o SHA-256 do token (`devices.token_hash`).
- A app Android envia esse token em `Authorization: Bearer <token>`.
- Os endpoints de ingestão autenticam pelo **token do dispositivo** (não pela
  sessão de humano) e só aceitam o seu próprio `deviceId` (403 caso contrário).
- A ingestão **nunca altera decisões do administrador**: a app pode reportar
  que uma app está instalada, mas não pode desbloquear uma app bloqueada.
- O painel actualiza-se sozinho: Dispositivos, Localização, Dashboard e
  Alertas voltam a perguntar à API (30 s; Aplicações a 60 s).

## Limitações conhecidas

- **Sem HTTPS**: as sessões viajam em claro na rede local. Para uso fora de
  casa, pôr a API atrás de um proxy com TLS.
- A API escuta em `127.0.0.1` por omissão; `SEEFAST_HOST=0.0.0.0` expõe-a à
  rede local.
- O token do dispositivo é de portador (*bearer*): quem o tiver pode reportar
  dados desse dispositivo. Em redes partilhadas, prefere tokens por dispositivo
  revogáveis (campo `token_hash` permite rodar o token).

## Estrutura

```
src/
  App.jsx                  # shell + rotas + gate de sessão
  index.css                # tokens --sf-*, shell, .stat-row, .page-placeholder, login
  components/              # Sidebar, Header, DataCollectionPage (CSS próprio)
  lib/
    dates.js               # sortByDateDesc (com teste próprio)
    useApiCollection.js    # hook de carregamento de coleções da API
    session.jsx            # contexto de sessão (entrar/sair)
  pages/                   # 8 páginas + NotFound + Login
  test/setup.js            # setup do vitest
  App.test.jsx             # navegação, a11y, sessão, acções de admin
server/
  api.js                   # API HTTP (leitura + escrita, auth, ingestão)
  auth.js                  # scrypt, sessões, cookies
  db.js                    # SQLite: migrations + seed
  seed-admin.js            # cria/actualiza um utilizador
  migrations/              # 001_init, 002_users_sessions, 003_ingestao
  *.test.js                # testes de DB, auth e API (processo real)
scripts/
  gerar-icones.mjs         # gerador de ícones PNG da PWA (sem dependências)
  pwa.test.js              # contrato da PWA (manifesto, ícones, SW)
public/
  manifest.webmanifest     # manifesto PWA
  sw.js                    # service worker (nunca cacheia /api)
  icon-*.png               # ícones gerados
.github/workflows/ci.yml   # CI: audit + testes + build em cada push/PR
start.js                   # arranca API + Vite; mata a árvore de processos no fim
```

## CI

`.github/workflows/ci.yml` corre em cada push/PR para `main`:

1. `npm ci`
2. `npm audit --audit-level=high` (falha em vulnerabilidades high/critical)
3. `npm test`
4. `npm run build`

Testa em Node 22 (última 22.x) e 24.

## Estado

Feito: shell responsivo, 8 páginas ligadas à API, indicadores no Dashboard,
ordenação por data, autenticação com papéis, escrita auditada, persistência
SQLite com migrations, 404, ecrã de login, PWA instalável, ingestão de
dispositivos (tokens por dispositivo), registo de dispositivo no painel,
tempo de uso por app, actualização automática (polling), CI.

Por fazer:

- **App Android** — a app que recolhe dados no telemóvel ainda não existe
  (spec em `docs/superpowers/specs/`); a API já tem os endpoints de ingestão
  prontos para ela.
- **Rotação/revogação de token e apagar dispositivo** — hoje o token antigo
  continua válido e os dispositivos órfãos ficam no painel.
- **Retenção de dados** — o servidor não apaga nada automaticamente.
- **Perfis finos** — o modelo de permissões é binário (admin/visualizador).
- **Recuperação de password, 2FA, SSO** — não implementadas.
- **HTTPS** — a API é para rede local em claro.
- **Testes end-to-end** — a cobertura actual é jsdom + API real em processo
  separado (não há Playwright).

As funcionalidades operacionais dependem da app SeeFast Android e do
consentimento explícito do utilizador.
