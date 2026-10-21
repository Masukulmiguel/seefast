# SeeFast — Painel de Supervisão

Painel web (MVP) de supervisão de dispositivos com consentimento explícito.
React + Vite no frontend, API HTTP pequena em Node no backend.

## Requisitos

- Node.js 18+ (usa `fetch` e `node:http`)
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

## Rotas

| Path | Página |
|------|--------|
| `/` | Dashboard (dispositivos + alertas via API) |
| `/dispositivos` | Dispositivos (lista via API) |
| `/localizacao` | Localização |
| `/controlo-parental` | Controlo Parental |
| `/aplicacoes` | Aplicações |
| `/alertas` | Alertas (lista via API) |
| `/permissoes` | Permissões |
| `/auditoria` | Auditoria |
| qualquer outro | 404 com regresso ao dashboard |

## Estrutura

```
src/
  App.jsx              # shell + rotas + overlay da sidebar
  index.css            # tokens --sf-*, reset, shell, .page-placeholder
  components/          # Sidebar, Header (CSS próprio em cada .css)
  pages/               # 8 páginas + NotFound
  test/setup.js        # setup do vitest
  App.test.jsx         # testes de navegação, a11y e ligação à API
server/
  api.js               # API HTTP em memória (GET /api/health|devices|alerts)
  api.test.js          # testes da API (processo real, porta via env PORT)
start.js               # arranca API + Vite; mata a árvore de processos no fim
```

## API

| Endpoint | Resposta |
|----------|----------|
| `GET /api/health` | `{ status: "ok", service: "seefast-api" }` |
| `GET /api/devices` | `{ devices: [{ id, nome, estado, bateria }] }` |
| `GET /api/alerts` | `{ alerts: [{ id, nivel, mensagem, em }] }` |

Escuta apenas em `127.0.0.1` (não exposto à rede). Dados mock em memória.

## Estado

MVP: o Dashboard, Dispositivos e Alertas já leem a API; as restantes páginas
são placeholders preparados para ligação futura. As funcionalidades
operacionais dependem da app SeeFast Android e do consentimento explícito
do utilizador.
