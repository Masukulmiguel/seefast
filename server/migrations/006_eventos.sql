-- Eventos recebidos do agente Android.
--
-- Um evento e um facto que aconteceu no telemovel (estado, localizacao,
-- app instalada, tempo de uso, mudanca de consentimento). A app guarda-o
-- localmente antes de enviar, com um id unico; este e o mesmo id.
--
-- `evento_id` e UNIQUE: se a app reenviar o mesmo evento (porque a resposta
-- se perdeu, por exemplo), o servidor reconhece-o e nao cria um duplicado.
-- E o que garante a idempotencia.

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  device_id   TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  ocorrido_em TEXT NOT NULL,   -- quando o facto aconteceu no telemovel
  recebido_em TEXT NOT NULL,   -- quando o servidor o recebeu
  criado_em   TEXT NOT NULL    -- quando a app o guardou localmente
);

CREATE INDEX idx_events_device ON events(device_id, recebido_em DESC);
CREATE INDEX idx_events_tipo ON events(tipo);
CREATE INDEX idx_events_ocorrido ON events(ocorrido_em DESC);

-- Ultima sincronizacao bem-sucedida por dispositivo: quando o servidor
-- recebeu o ultimo evento deste telemovel.
CREATE TABLE IF NOT EXISTS sessoes_sincronizacao (
  device_id       TEXT PRIMARY KEY,
  ultima_em       TEXT NOT NULL,
  eventos_aceites INTEGER NOT NULL DEFAULT 0
);
