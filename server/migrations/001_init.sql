-- Dispositivos registados no painel.
CREATE TABLE devices (
  id        TEXT PRIMARY KEY,
  nome      TEXT NOT NULL,
  estado    TEXT NOT NULL,
  bateria   INTEGER NOT NULL
);

-- Alertas gerados pelo sistema (conservados para auditoria).
CREATE TABLE alerts (
  id            TEXT PRIMARY KEY,
  nivel         TEXT NOT NULL,
  mensagem      TEXT NOT NULL,
  em            TEXT NOT NULL,
  reconhecido   INTEGER NOT NULL DEFAULT 0,
  reconhecido_em TEXT
);

-- Última localização conhecida de cada dispositivo.
CREATE TABLE locations (
  device_id     TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  lat           REAL NOT NULL,
  lon           REAL NOT NULL,
  atualizado_em TEXT NOT NULL
);

-- Regras de controlo parental por dispositivo.
CREATE TABLE parental_rules (
  id              TEXT PRIMARY KEY,
  device_id       TEXT NOT NULL,
  nome            TEXT NOT NULL,
  limite_minutos  INTEGER NOT NULL,
  inicio          TEXT NOT NULL,
  fim             TEXT NOT NULL
);

-- Aplicações instaladas nos dispositivos.
CREATE TABLE apps (
  id          TEXT PRIMARY KEY,
  device_id   TEXT NOT NULL,
  nome        TEXT NOT NULL,
  pacote      TEXT NOT NULL,
  tamanho_mb  INTEGER NOT NULL,
  bloqueada   INTEGER NOT NULL DEFAULT 0
);

-- Consentimento e permissões por dispositivo.
CREATE TABLE permissions (
  device_id     TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  consentimento TEXT NOT NULL,
  camera        INTEGER NOT NULL DEFAULT 0,
  microfone     INTEGER NOT NULL DEFAULT 0,
  localizacao   INTEGER NOT NULL DEFAULT 0
);

-- Registo de ações administrativas.
CREATE TABLE audit_entries (
  id    TEXT PRIMARY KEY,
  em    TEXT NOT NULL,
  ator  TEXT NOT NULL,
  acao  TEXT NOT NULL,
  alvo  TEXT NOT NULL
);
