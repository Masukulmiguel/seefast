# SeeFast — Painel de Supervisão

Painel web (MVP) de supervisão de dispositivos com consentimento explícito.
React + Vite no frontend, API HTTP em Node no backend.

## Requisitos

- Node.js 20.19+, 22.12+ ou 24 (o Vite 8 impõe estes mínimos)
- npm

## Arranque

```bash
npm install        # dependências
npm start          # API (3001) + Vite dev server (5173) em simultâneo
```

Ou em terminais separados:

```bash
npm run server     # API em http://127.0.0.1:3001
npm run dev        # frontend em http://localhost:5173
```

O Vite faz proxy de `/api/*` para `http://127.0.0.1:3001` (ver `vite.config.js`),
por isso o frontend fala com a API sem CORS em desenvolvimento.

> Nota: o dev server do Vite 8 escuta em `localhost` (IPv6 `::1`) — abra
> `http://localhost:5173`, não `127.0.0.1:5173`.

## Outros comandos

```bash
npm test           # vitest (jsdom + testing-library; server/api.test.js em node)
npm run build      # build de produção em dist/
npm run preview    # serve o build de produção
```

## Rotas e dados

| Path | Página | Endpoint |
|------|--------|----------|
| `/` | Dashboard (indicadores + listas) | `/api/devices` + `/api/alerts` |
| `/dispositivos` | Dispositivos | `/api/devices` |
| `/localizacao` | Localização | `/api/locations` |
| `/controlo-parental` | Controlo Parental | `/api/parental-rules` |
| `/aplicacoes` | Aplicações | `/api/apps` |
| `/alertas` | Alertas (mais recentes primeiro) | `/api/alerts` |
| `/permissoes` | Permissões | `/api/permissions` |
| `/auditoria` | Auditoria (mais recente primeiro) | `/api/audit` |
| qualquer outro | 404 com regresso ao dashboard | — |

## API

| Endpoint | Resposta |
|----------|----------|
| `GET /api/health` | `{ status: "ok", service: "seefast-api" }` |
| `GET /api/devices` | `{ devices: [{ id, nome, estado, bateria }] }` |
| `GET /api/alerts` | `{ alerts: [{ id, nivel, mensagem, em }] }` — ordenados por data descendente |
| `GET /api/locations` | `{ locations: [{ deviceId, nome, lat, lon, atualizadoEm }] }` |
| `GET /api/parental-rules` | `{ rules: [{ id, deviceId, nome, limiteMinutos, inicio, fim }] }` |
| `GET /api/apps` | `{ apps: [{ id, deviceId, nome, pacote, tamanhoMb, bloqueada }] }` |
| `GET /api/permissions` | `{ permissions: [{ deviceId, nome, consentimento, camera, microfone, localizacao }] }` |
| `GET /api/audit` | `{ entries: [{ id, em, ator, acao, alvo }] }` — ordenados por data descendente |

Escuta apenas em `127.0.0.1` (não exposto à rede). Dados mock em memória.
Pedidos com request-target malformado respondem 400 em vez de derrubar o processo.

## Estrutura

```
src/
  App.jsx                  # shell + rotas + overlay da sidebar
  index.css                # tokens --sf-*, reset, shell, .stat-row, .page-placeholder
  components/              # Sidebar, Header, DataCollectionPage (CSS próprio em cada .css)
  lib/
    dates.js               # sortByDateDesc (com teste próprio)
    useApiCollection.js    # hook de carregamento de coleções da API
  pages/                   # 8 páginas + NotFound
  test/setup.js            # setup do vitest
  App.test.jsx             # navegação, a11y e ligação à API
server/
  api.js                   # API HTTP em memória (8 endpoints GET)
  api.test.js              # testes da API (processo real, porta via env PORT)
.github/workflows/ci.yml   # CI: audit + testes + build em cada push/PR
start.js                   # arranca API + Vite; mata a árvore de processos no fim
```

## CI

`.github/workflows/ci.yml` corre em cada push/PR para `main`:

1. `npm ci`
2. `npm audit --audit-level=high` (falha em vulnerabilidades high/critical)
3. `npm test`
4. `npm run build`

Testa em Node 22.12 e 24.

## Estado

MVP completo do ponto de vista do painel: as 8 páginas leem a API, com
indicadores de estado no Dashboard, alertas e auditoria ordenados por data e
estados de carregamento/erro em todas as páginas.

Por fazer (decisões de arquitectura ainda por tomar):

- **Persistência** — a API guarda dados mock em memória; falta base de dados
  + migrations.
- **Autenticação/autorização** — a API não tem auth (só escuta em localhost).
- **Escrita** — todos os endpoints são de leitura; bloquear apps, definir
  limites ou localizar exigem operações POST/PATCH com autenticação.
- **Tempo real** — o estado atualiza-se ao carregar a página (sem polling/SSE).
- **App Android** — a app SeeFast Android (recolha de dados e consentimento)
  está fora deste repositório.

As funcionalidades operacionais dependem da app SeeFast Android e do
consentimento explícito do utilizador.
