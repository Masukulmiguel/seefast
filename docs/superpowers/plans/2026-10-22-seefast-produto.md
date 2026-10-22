# Plano: SeeFast como produto (multi-tenant + UI profissional)

## Objectivo
- **Admin (super-admin)**: dashboard próprio onde vê e gere os clientes que
  compraram o serviço (utilizadores com Devices registados).
- **Cliente**: instala a app Android, configura-a (cria a sua conta), e passa a
  ter o seu próprio dashboard onde vê tudo o que se passa no seu telemóvel.
- **Site principal** público, profissional, com animações.
- **Dashboards** redesenhados segundo o skill `ui-ux-pro-max`.

## Design system (do skill ui-ux-pro-max)
- Pattern: Real-Time / Operations Landing
- Style: Glassmorphism (dark suportado)
- Cores: bg `#0F172A`, card `#1B2336`, primary `#1E293B`, accent `#22C55E`,
  destructive `#EF4444`, muted `#94A3B8`, border `#475569`
- Tipografia: Fira Sans (texto) + Fira Code (dados)
- Motion: Stagger List, 300-450ms, `back.out(1.4)`, respeitando
  `prefers-reduced-motion`
- Densidade 7/10 (dashboard)

## Fase A — Backend multi-tenant
1. `server/migrations/005_multitenant.sql`:
   - `devices.user_id` (dono) + índice
   - `users.plano`, `users.estado` (activo/suspenso)
2. `server/api.js`:
   - `POST /api/registro` (público): cria conta de cliente + regista o
     dispositivo; devolve `{user, device:{id, token}}` — o token em claro
     aparece uma vez, como já acontecia.
   - `GET /api/clientes` (admin): lista clientes + contagem de dispositivos
   - `GET /api/devices`: admin vê todos; `cliente` vê só os seus
   - Todas as coleções (`locations`, `apps`, `usage`, `permissions`,
     `alerts`, `parental-rules`) filtradas pelo dono quando o papel é
     `cliente`
   - `GET /api/cliente/dispositivo` (cliente): o seu dispositivo principal
3. `server/auth.js`: `role` passa a incluir `cliente`

## Fase B — App Android
- `EnrolamentoActivity`: modo **Conta** (email + senha + servidor) que chama
  `POST /api/registro` e guarda o `id`/`token` recebidos; modo **Token**
  (admin) mantido — o caminho `id.token` continua a funcionar.

## Fase C — Frontend profissional
- `src/index.css`: tokens (dark + light), glassmorphism, animações, skeletons
- `src/pages/Landing.jsx`: site principal público (hero, como funciona,
  funcionalidades, planos, FAQ, CTA)
- `src/pages/Admin.jsx`: dashboard super-admin (clientes, dispositivos, estado)
- `src/pages/Client.jsx`: dashboard do cliente (o seu telemóvel)
- `Sidebar`: navegação por papel
- `App.jsx`: rotas `/` (landing quando anónimo), `/admin`, `/cliente`

## Fase D — Verificação
- Testes do servidor (vitest) + testes do frontend
- `npm run build` sem erros
- Deploy no Render (autoDeploy por commit)
