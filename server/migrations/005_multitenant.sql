-- Multi-tenant: cada dispositivo pertence a um utilizador (o cliente que o
-- registou). O admin ve tudo; o cliente so ve os seus.
--
-- A coluna `user_id` e NULL para os dispositivos criados antes desta
-- migracao (sem dono) — o admin ve-os na mesma, os clientes nao.

ALTER TABLE devices ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_devices_user_id ON devices(user_id);

-- Plano comercial e estado da conta do cliente.
ALTER TABLE users ADD COLUMN plano TEXT NOT NULL DEFAULT 'gratuito';
ALTER TABLE users ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo';

-- Dispositivos por cliente (contagem rapida no dashboard do admin).
CREATE VIEW IF NOT EXISTS clientes_resumo AS
SELECT
  u.id AS user_id,
  u.email,
  u.plano,
  u.estado,
  u.criado_em AS registado_em,
  COUNT(d.id) AS dispositivos,
  MAX(d.ultimo_reporte) AS ultimo_reporte
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
GROUP BY u.id, u.email, u.plano, u.estado, u.criado_em;
