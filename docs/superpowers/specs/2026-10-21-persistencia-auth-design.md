# SeeFast — Persistência (SQLite) + Autenticação

Data: 2026-10-21
Estado: aprovado pelo utilizador (Opção A), com defaults declarados por mim e sem
perguntas adicionais.

## Intenção e porquê

O painel SeeFast tem hoje dados mock em memória: cada reinício da API apaga tudo
e não há forma de registar alterações administrativas. Esta fase dá-lhe uma base
de dados local e uma porta de entrada com identidade, para que o painel deixe de
ser uma demonstração e possa ser usado a sério numa rede doméstica — e para que a
app Android possa falar com a mesma API mais tarde.

## Objectivos

- Dados persistentes em SQLite, com migrations versionadas.
- Login com email + password (hash `scrypt`, nunca em claro), sessão por cookie
  `HttpOnly` / `SameSite=Lax`.
- Dois papéis: `admin` (lê e escreve) e `visualizador` (só lê).
- Endpoints de leitura protegidos (401 sem sessão válida).
- Endpoints de escrita restritos ao `admin` (403 para visualizador).
- Todas as alterações administrativas ficam registadas em auditoria.

## Não objectivos (anti-objectivos)

- Não é um sistema multi-instalação / SaaS: é uma instância local.
- Não há recuperação de password por email (não há servidor de email): a
  redefinição é local, por CLI.
- Não há OAuth/SSO, 2FA, ou refresh tokens.
- Não há dados criptografados ao nível da base de dados.
- Não há tempo real (polling/SSE) nem integração com a app Android — ficam para
  fases seguintes.

## Restrições

- Node 20.19+ / 22.12+ / 24 (o CI corre 22.12 e 24).
- `better-sqlite3` (API síncrona, nativa mas com prebuilds — verificado que
  instala e carrega em Windows/Node 24). `node:sqlite` foi avaliado e
  rejeitado: é experimental e no Node 22.12 ainda exige flag.
- A API continua a escutar apenas em `127.0.0.1`.
- A app Android (outra metade do sistema) ainda não existe.

## Decisões

### Persistência
- Ficheiro: `data/seefast.db` (configurável por `SEEFAST_DB`), em `data/` no
  `.gitignore`.
- Migrations: `server/migrations/NNN_descricao.sql`, aplicadas por ordem num
  `schema_migrations`; cada migration corre uma vez, dentro de transação.
- Seed: a base nasce com os mesmos dados que hoje são mock, para o painel
  continuar a mostrar conteúdo sem passos extra.
- Tabelas: `devices`, `alerts`, `locations`, `parental_rules`, `apps`,
  `permissions`, `audit_entries`, `users`, `sessions`.

### Autenticação
- Password: `scrypt` (node:crypto) com salt aleatório por utilizador, formato
  `scrypt$<salt-hex>$<hash-hex>`; comparação com `timingSafeEqual`.
- Sessão: token opaco de 32 bytes (hex) guardado em `sessions`, validade de 7
  dias, cookie `seefast_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`).
- Sem JWT: o backend é o único consumidor e o estado tem de ser revogável.
- Primeiro admin: `npm run seed:admin` com `SEEFAST_ADMIN_EMAIL` e
  `SEEFAST_ADMIN_PASSWORD` (falha se a password tiver menos de 8 caracteres).
  Variante `visualizador` via `SEEFAST_ADMIN_ROLE=visualizador`.
- Erros de login são deliberadamente indistinguíveis (email errado ou password
  errada → mesmo 401 e mesma mensagem) para não revelar que emails existem.

### Endpoints de escrita (scope mínimo, para que os papéis signifiquem algo)
- `PATCH /api/apps/:id` → `{ bloqueada: boolean }`
- `PATCH /api/parental-rules/:id` → `{ limiteMinutos, inicio, fim }`
- `POST /api/alerts/:id/ack` → marca o alerta como reconhecido
- Cada escrita bem-sucedida cria uma linha em `audit_entries`.

### Frontend
- `/login` com email + password; sem sessão válida, o painel redirecciona para
  `/login` (as páginas da API não são afectadas).
- `GET /api/session` devolve o utilizador actual; a sidebar mostra o nome e o
  botão "Sair".
- Erros de login são mostrados junto ao formulário, sem revelar o motivo exacto.

## Fora do âmbito desta fase (para o builder)

- Tempo real, push notifications, integração com a app Android.
- Perfis finos de permissão (o modelo é binário: admin ou visualizador).
- Recuperação de password, 2FA, SSO.
- Testes end-to-end com Playwright (a cobertura actual é jsdom + API real).
