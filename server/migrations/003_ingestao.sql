-- Dispositivos registados pelo administrador.
-- token_hash: SHA-256 do token do dispositivo (o token em claro só é mostrado
-- uma vez, na criação). ultimo_reporte: data do último reporte do agente.
ALTER TABLE devices ADD COLUMN token_hash TEXT;
ALTER TABLE devices ADD COLUMN criado_em TEXT;
ALTER TABLE devices ADD COLUMN ultimo_reporte TEXT;

CREATE UNIQUE INDEX idx_devices_token_hash ON devices(token_hash);
