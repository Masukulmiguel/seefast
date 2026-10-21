import { createServer } from "node:http";
import { sortByDateDesc } from "../src/lib/dates.js";
import { openDatabase, runMigrations, seedDatabase } from "./db.js";

const PORT = Number(process.env.PORT) || 3001;
const HOST = "127.0.0.1";

const db = openDatabase();
runMigrations(db);
seedDatabase(db);

const bool = (v) => Boolean(v);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

const routes = {
  "GET /api/health": (req, res) =>
    sendJson(res, 200, { status: "ok", service: "seefast-api" }),

  "GET /api/devices": (req, res) =>
    sendJson(res, 200, {
      devices: db
        .prepare("SELECT id, nome, estado, bateria FROM devices ORDER BY id")
        .all(),
    }),

  "GET /api/alerts": (req, res) =>
    sendJson(res, 200, {
      alerts: sortByDateDesc(
        db.prepare("SELECT id, nivel, mensagem, em FROM alerts").all()
      ),
    }),

  "GET /api/locations": (req, res) =>
    sendJson(res, 200, {
      locations: db
        .prepare(
          "SELECT device_id AS deviceId, nome, lat, lon, atualizado_em AS atualizadoEm FROM locations ORDER BY device_id"
        )
        .all(),
    }),

  "GET /api/parental-rules": (req, res) =>
    sendJson(res, 200, {
      rules: db
        .prepare(
          "SELECT id, device_id AS deviceId, nome, limite_minutos AS limiteMinutos, inicio, fim FROM parental_rules ORDER BY id"
        )
        .all(),
    }),

  "GET /api/apps": (req, res) =>
    sendJson(res, 200, {
      apps: db
        .prepare(
          "SELECT id, device_id AS deviceId, nome, pacote, tamanho_mb AS tamanhoMb, bloqueada FROM apps ORDER BY id"
        )
        .all()
        .map((a) => ({ ...a, bloqueada: bool(a.bloqueada) })),
    }),

  "GET /api/permissions": (req, res) =>
    sendJson(res, 200, {
      permissions: db
        .prepare(
          "SELECT device_id AS deviceId, nome, consentimento, camera, microfone, localizacao FROM permissions ORDER BY device_id"
        )
        .all()
        .map((p) => ({
          ...p,
          camera: bool(p.camera),
          microfone: bool(p.microfone),
          localizacao: bool(p.localizacao),
        })),
    }),

  "GET /api/audit": (req, res) =>
    sendJson(res, 200, {
      entries: sortByDateDesc(
        db.prepare("SELECT id, em, ator, acao, alvo FROM audit_entries").all()
      ),
    }),
};

const server = createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${HOST}:${PORT}`);
  } catch {
    // Request-target malformado: o parser do Node aceita, o URL rejeita.
    // Sem isto a exceção não tratada mata o processo da API.
    sendJson(res, 400, { error: "bad_request" });
    return;
  }
  const key = `${req.method} ${url.pathname}`;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const handler = routes[key];
  if (handler) {
    handler(req, res);
    return;
  }

  sendJson(res, 404, { error: "not_found", path: url.pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`[seefast-api] a escutar em http://${HOST}:${PORT}`);
});
