import { createServer } from "node:http";

const PORT = Number(process.env.PORT) || 3001;
const HOST = "127.0.0.1";

const devices = [
  { id: "dev-001", nome: "Telemóvel da Ana", estado: "online", bateria: 82 },
  { id: "dev-002", nome: "Tablet do João", estado: "offline", bateria: 34 },
];

const alerts = [
  { id: "alt-001", nivel: "warning", mensagem: "Dispositivo dev-002 sem ligação", em: "2026-10-20T09:00:00Z" },
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
  "GET /api/alerts": (req, res) => sendJson(res, 200, { alerts }),
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
