-- Tempo de uso por app (reporte do agente Android).
-- Uma linha por (dispositivo, app); cada reporte substitui o anterior.
CREATE TABLE usage (
  device_id   TEXT NOT NULL,
  pacote      TEXT NOT NULL,
  minutos     INTEGER NOT NULL,
  registado_em TEXT NOT NULL,
  PRIMARY KEY (device_id, pacote)
);

CREATE INDEX idx_usage_device ON usage(device_id);
