import { createServer } from "node:http";
import { sortByDateDesc } from "../src/lib/dates.js";

const PORT = Number(process.env.PORT) || 3001;
const HOST = "127.0.0.1";

const devices = [
  { id: "dev-001", nome: "Telemóvel da Ana", estado: "online", bateria: 82 },
  { id: "dev-002", nome: "Tablet do João", estado: "offline", bateria: 34 },
];

const alerts = [
  { id: "alt-003", nivel: "critical", mensagem: "Root detetado no dispositivo dev-003", em: "2026-10-21T08:15:00Z" },
  { id: "alt-001", nivel: "warning", mensagem: "Dispositivo dev-002 sem ligação", em: "2026-10-20T09:00:00Z" },
  { id: "alt-002", nivel: "info", mensagem: "Nova app instalada no dispositivo dev-001", em: "2026-10-19T11:30:00Z" },
];

const locations = [
  { deviceId: "dev-001", nome: "Telemóvel da Ana", lat: 38.7223, lon: -9.1393, atualizadoEm: "2026-10-21T08:00:00Z" },
  { deviceId: "dev-002", nome: "Tablet do João", lat: 41.1579, lon: -8.6291, atualizadoEm: "2026-10-20T17:30:00Z" },
];

const rules = [
  { id: "reg-001", deviceId: "dev-001", nome: "Telemóvel da Ana", limiteMinutos: 120, inicio: "20:00", fim: "22:00" },
  { id: "reg-002", deviceId: "dev-002", nome: "Tablet do João", limiteMinutos: 60, inicio: "19:00", fim: "21:00" },
];

const apps = [
  { id: "app-001", deviceId: "dev-001", nome: "Instagram", pacote: "com.instagram.android", tamanhoMb: 45, bloqueada: true },
  { id: "app-002", deviceId: "dev-001", nome: "TikTok", pacote: "com.zhiliaoapp.musically", tamanhoMb: 78, bloqueada: false },
];

const permissions = [
  { deviceId: "dev-001", nome: "Telemóvel da Ana", consentimento: "concedido", camera: false, microfone: false, localizacao: true },
  { deviceId: "dev-002", nome: "Tablet do João", consentimento: "pendente", camera: false, microfone: false, localizacao: false },
];

const entries = [
  { id: "aud-001", em: "2026-10-21T07:45:00Z", ator: "admin@seefast", acao: "atualizou limite de ecrã", alvo: "dev-001" },
  { id: "aud-002", em: "2026-10-20T14:10:00Z", ator: "admin@seefast", acao: "bloqueou aplicação", alvo: "app-001" },
];

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
  "GET /api/health": (req, res) => sendJson(res, 200, { status: "ok", service: "seefast-api" }),
  "GET /api/devices": (req, res) => sendJson(res, 200, { devices }),
  "GET /api/alerts": (req, res) =>
    sendJson(res, 200, { alerts: sortByDateDesc(alerts) }),
  "GET /api/locations": (req, res) =>
    sendJson(res, 200, { locations: sortByDateDesc(locations, "atualizadoEm") }),
  "GET /api/parental-rules": (req, res) => sendJson(res, 200, { rules }),
  "GET /api/apps": (req, res) => sendJson(res, 200, { apps }),
  "GET /api/permissions": (req, res) => sendJson(res, 200, { permissions }),
  "GET /api/audit": (req, res) =>
    sendJson(res, 200, { entries: sortByDateDesc(entries) }),
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
