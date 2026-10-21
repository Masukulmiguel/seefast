-- Utilizadores do painel (administradores e visualizadores).
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'visualizador',
  criado_em     TEXT NOT NULL
);

-- Sessões (token opaco guardado no servidor, cookie HttpOnly no cliente).
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  criado_em  TEXT NOT NULL,
  expira_em  TEXT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
