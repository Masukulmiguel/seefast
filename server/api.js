import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sortByDateDesc } from "../src/lib/dates.js";
import { openDatabase, runMigrations, seedDatabase } from "./db.js";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionUser,
  parseCookies,
  sessionCookie,
  verifyPassword,
} from "./auth.js";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.SEEFAST_HOST || "127.0.0.1";
const MAX_BODY = 64 * 1024;

const db = openDatabase();
runMigrations(db);
seedDatabase(db);

const bool = (v) => Boolean(v);

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...corsHeaders(res.req ?? { headers: {} }),
    ...extraHeaders,
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    req.on("data", (chunk) => {
      corpo += chunk;
      if (corpo.length > MAX_BODY) {
        reject(new Error("corpo demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!corpo.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(corpo));
      } catch {
        reject(new Error("json inválido"));
      }
    });
    req.on("error", reject);
  });
}

function tokenDaRequisicao(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE] ?? null;
}

function utilizadorDaRequisicao(req) {
  return getSessionUser(db, tokenDaRequisicao(req));
}

const routes = {
  "GET /api/devices": (req, res) =>
    sendJson(res, 200, {
      devices: db
        .prepare(
          "SELECT id, nome, estado, bateria, ultimo_reporte FROM devices ORDER BY id"
        )
        .all(),
    }),

  // Registo de um dispositivo novo: devolve o token uma unica vez.
  "POST /api/devices": async (req, res) => {
    const corpo = await readJsonBody(req);
    const nome = String(corpo.nome ?? "").trim();
    if (!nome) {
      sendJson(res, 400, { error: "nome_em_falta" });
      return;
    }
    const id = `dev-${randomBytes(4).toString("hex")}`;
    const token = randomBytes(24).toString("hex");
    db.prepare(
      "INSERT INTO devices (id, nome, estado, bateria, token_hash, criado_em) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      nome,
      "desconhecido",
      0,
      hashToken(token),
      new Date().toISOString()
    );
    sendJson(res, 200, { device: { id, nome, token } });
  },

  // --- Ingestão (agente Android) -------------------------------------------
  "POST /api/devices/:id/estado": async (req, res, { params }) => {
    const corpo = await readJsonBody(req);
    const estado = ["online", "offline", "desconhecido"].includes(corpo.estado)
      ? corpo.estado
      : "desconhecido";
    const bateria = Number.isFinite(Number(corpo.bateria))
      ? Math.min(100, Math.max(0, Math.round(Number(corpo.bateria))))
      : 0;
    const em = String(corpo.em ?? new Date().toISOString());
    db.prepare(
      "UPDATE devices SET estado = ?, bateria = ?, ultimo_reporte = ? WHERE id = ?"
    ).run(estado, bateria, em, params.id);
    sendJson(res, 200, { device: { id: params.id, estado, bateria, ultimo_reporte: em } });
  },

  "POST /api/devices/:id/localizacao": async (req, res, { params }) => {
    const corpo = await readJsonBody(req);
    const lat = Number(corpo.lat);
    const lon = Number(corpo.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      sendJson(res, 400, { error: "coordenadas_invalidas" });
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      sendJson(res, 400, { error: "coordenadas_fora_do_ambito" });
      return;
    }
    const nome =
      db.prepare("SELECT nome FROM devices WHERE id = ?").get(params.id)?.nome ??
      "Dispositivo";
    const em = String(corpo.em ?? new Date().toISOString());
    db.prepare(
      `INSERT INTO locations (device_id, nome, lat, lon, atualizado_em)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET nome = excluded.nome, lat = excluded.lat,
         lon = excluded.lon, atualizado_em = excluded.atualizado_em`
    ).run(params.id, nome, lat, lon, em);
    sendJson(res, 200, { localizacao: { deviceId: params.id, lat, lon, atualizadoEm: em } });
  },

  "POST /api/devices/:id/apps": async (req, res, { params }) => {
    const corpo = await readJsonBody(req);
    const apps = Array.isArray(corpo.apps) ? corpo.apps : [];
    const existentes = db
      .prepare("SELECT pacote, bloqueada FROM apps WHERE device_id = ?")
      .all(params.id);
    const bloqueadas = new Map(existentes.map((a) => [a.pacote, a.bloqueada]));

    db.transaction(() => {
      db.prepare("DELETE FROM apps WHERE device_id = ?").run(params.id);
      const inserir = db.prepare(
        "INSERT OR REPLACE INTO apps (id, device_id, nome, pacote, tamanho_mb, bloqueada) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const app of apps) {
        const pacote = String(app.pacote ?? "").trim();
        if (!pacote) continue;
        // A decisao de bloqueio e do administrador: a app nao a pode mudar.
        const bloqueada = bloqueadas.get(pacote) ?? 0;
        inserir.run(
          `app-${randomBytes(4).toString("hex")}`,
          params.id,
          String(app.nome ?? pacote),
          pacote,
          Math.max(0, Math.round(Number(app.tamanhoMb) || 0)),
          bloqueada
        );
      }
    })();

    sendJson(res, 200, { apps: apps.length });
  },

  "POST /api/devices/:id/uso": async (req, res, { params }) => {
    const corpo = await readJsonBody(req);
    if (!Array.isArray(corpo.uso)) {
      sendJson(res, 400, { error: "uso_invalido" });
      return;
    }
    const registadoEm = new Date().toISOString();
    db.transaction(() => {
      db.prepare("DELETE FROM usage WHERE device_id = ?").run(params.id);
      const inserir = db.prepare(
        "INSERT INTO usage (device_id, pacote, minutos, registado_em) VALUES (?, ?, ?, ?)"
      );
      for (const linha of corpo.uso) {
        const pacote = String(linha.pacote ?? "").trim();
        const minutos = Number(linha.minutos);
        if (!pacote || !Number.isFinite(minutos) || minutos < 0) continue;
        inserir.run(params.id, pacote, Math.round(minutos), registadoEm);
      }
    })();
    sendJson(res, 200, { registos: corpo.uso.length });
  },

  "POST /api/devices/:id/consentimento": async (req, res, { params }) => {
    const corpo = await readJsonBody(req);
    const consentimento =
      corpo.consentimento === "concedido" ? "concedido" : "pendente";
    const nome =
      db.prepare("SELECT nome FROM devices WHERE id = ?").get(params.id)?.nome ??
      "Dispositivo";
    db.prepare(
      `INSERT INTO permissions (device_id, nome, consentimento, camera, microfone, localizacao)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET nome = excluded.nome,
         consentimento = excluded.consentimento, camera = excluded.camera,
         microfone = excluded.microfone, localizacao = excluded.localizacao`
    ).run(
      params.id,
      nome,
      consentimento,
      corpo.camera ? 1 : 0,
      corpo.microfone ? 1 : 0,
      corpo.localizacao ? 1 : 0
    );
    sendJson(res, 200, { consentimento });
  },

  "GET /api/alerts": (req, res) =>
    sendJson(res, 200, {
      alerts: sortByDateDesc(
        db.prepare("SELECT id, nivel, mensagem, em, reconhecido FROM alerts").all()
      ).map((a) => ({ ...a, reconhecido: bool(a.reconhecido) })),
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
          `SELECT a.id, a.device_id AS deviceId, a.nome, a.pacote,
                  a.tamanho_mb AS tamanhoMb, a.bloqueada,
                  COALESCE(u.minutos, 0) AS minutos
             FROM apps a
             LEFT JOIN usage u ON u.device_id = a.device_id AND u.pacote = a.pacote
            ORDER BY a.id`
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

  "PATCH /api/apps/:id": async (req, res, { user, params }) => {
    const corpo = await readJsonBody(req);
    const bloqueada = corpo.bloqueada ? 1 : 0;
    const info = db
      .prepare("UPDATE apps SET bloqueada = ? WHERE id = ?")
      .run(bloqueada, params.id);
    if (info.changes === 0) {
      sendJson(res, 404, { error: "nao_encontrado" });
      return;
    }
    registarAuditoria(
      user,
      bloqueada ? "bloqueou aplicação" : "desbloqueou aplicação",
      `app:${params.id}`
    );
    const app = db
      .prepare(
        "SELECT id, device_id AS deviceId, nome, pacote, tamanho_mb AS tamanhoMb, bloqueada FROM apps WHERE id = ?"
      )
      .get(params.id);
    sendJson(res, 200, { app: { ...app, bloqueada: bool(app.bloqueada) } });
  },

  "PATCH /api/parental-rules/:id": async (req, res, { user, params }) => {
    const corpo = await readJsonBody(req);
    const actual = db
      .prepare("SELECT * FROM parental_rules WHERE id = ?")
      .get(params.id);
    if (!actual) {
      sendJson(res, 404, { error: "nao_encontrado" });
      return;
    }
    const limite = Number.isFinite(Number(corpo.limiteMinutos))
      ? Math.max(0, Math.round(Number(corpo.limiteMinutos)))
      : actual.limite_minutos;
    const inicio =
      typeof corpo.inicio === "string" && corpo.inicio ? corpo.inicio : actual.inicio;
    const fim = typeof corpo.fim === "string" && corpo.fim ? corpo.fim : actual.fim;
    db.prepare(
      "UPDATE parental_rules SET limite_minutos = ?, inicio = ?, fim = ? WHERE id = ?"
    ).run(limite, inicio, fim, params.id);
    registarAuditoria(user, "actualizou limite de ecrã", `reg:${params.id}`);
    const rule = db
      .prepare(
        "SELECT id, device_id AS deviceId, nome, limite_minutos AS limiteMinutos, inicio, fim FROM parental_rules WHERE id = ?"
      )
      .get(params.id);
    sendJson(res, 200, { rule });
  },

  "POST /api/alerts/:id/ack": (req, res, { user, params }) => {
    const info = db
      .prepare("UPDATE alerts SET reconhecido = 1, reconhecido_em = ? WHERE id = ?")
      .run(new Date().toISOString(), params.id);
    if (info.changes === 0) {
      sendJson(res, 404, { error: "nao_encontrado" });
      return;
    }
    registarAuditoria(user, "reconheceu alerta", `alerta:${params.id}`);
    const alerta = db
      .prepare("SELECT id, nivel, mensagem, em, reconhecido FROM alerts WHERE id = ?")
      .get(params.id);
    sendJson(res, 200, {
      alert: { ...alerta, reconhecido: bool(alerta.reconhecido) },
    });
  },
};

async function handleLogin(req, res) {
  let corpo;
  try {
    corpo = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "pedido_invalido" });
    return;
  }
  const email = String(corpo.email ?? "").trim().toLowerCase();
  const password = String(corpo.password ?? "");
  const user = db
    .prepare("SELECT id, email, password_hash, role FROM users WHERE email = ?")
    .get(email);

  // Email errado e password errada dão o mesmo erro (não revelamos que
  // emails existem).
  if (!user || !verifyPassword(password, user.password_hash)) {
    sendJson(res, 401, { error: "credenciais_invalidas" });
    return;
  }

  const { token } = createSession(db, user.id);
  sendJson(
    res,
    200,
    { user: { id: user.id, email: user.email, role: user.role } },
    { "Set-Cookie": sessionCookie(token) }
  );
}

function handleLogout(req, res) {
  deleteSession(db, tokenDaRequisicao(req));
  res.writeHead(204, { ...corsHeaders(req), "Set-Cookie": clearSessionCookie() });
  res.end();
}

function handleSession(req, res) {
  const user = utilizadorDaRequisicao(req);
  if (!user) {
    sendJson(res, 401, { error: "nao_autenticado" });
    return;
  }
  sendJson(res, 200, { user });
}

// Escritas: só o administrador pode alterar o estado do painel.
const ADMIN_ONLY = new Set([
  "POST /api/devices",
  "PATCH /api/apps/:id",
  "PATCH /api/parental-rules/:id",
  "POST /api/alerts/:id/ack",
]);

// Ingestão: o agente Android autentica-se com o token do dispositivo.
const INGESTAO = new Set([
  "POST /api/devices/:id/estado",
  "POST /api/devices/:id/localizacao",
  "POST /api/devices/:id/apps",
  "POST /api/devices/:id/uso",
  "POST /api/devices/:id/consentimento",
]);

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenDoDispositivo(req) {
  const header = String(req.headers.authorization ?? "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

function dispositivoPorToken(token) {
  if (!token) return null;
  return (
    db
      .prepare("SELECT id, nome FROM devices WHERE token_hash = ?")
      .get(hashToken(token)) ?? null
  );
}

function registarAuditoria(user, acao, alvo) {
  db.prepare(
    "INSERT INTO audit_entries (id, em, ator, acao, alvo) VALUES (?, ?, ?, ?, ?)"
  ).run(
    `aud-${randomUUID()}`,
    new Date().toISOString(),
    user.email,
    acao,
    alvo
  );
}

// Procura a rota para (método, caminho), incluindo padrões com :param.
function matchRoute(method, pathname) {
  const exact = routes[`${method} ${pathname}`];
  if (exact) return { key: `${method} ${pathname}`, handler: exact, params: {} };

  for (const [key, handler] of Object.entries(routes)) {
    const [metodo, padrao] = key.split(" ");
    if (metodo !== method || !padrao.includes(":")) continue;
    const partes = padrao.split("/");
    const pedacos = pathname.split("/");
    if (partes.length !== pedacos.length) continue;
    const params = {};
    let bate = true;
    for (let i = 0; i < partes.length; i++) {
      if (partes[i].startsWith(":")) {
        params[partes[i].slice(1)] = decodeURIComponent(pedacos[i]);
      } else if (partes[i] !== pedacos[i]) {
        bate = false;
        break;
      }
    }
    if (bate) return { key, handler, params };
  }
  return null;
}

const server = createServer(async (req, res) => {
  res.req = req;

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
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  if (key === "POST /api/login") {
    await handleLogin(req, res);
    return;
  }
  if (key === "POST /api/logout") {
    handleLogout(req, res);
    return;
  }
  if (key === "GET /api/session") {
    handleSession(req, res);
    return;
  }
  if (key === "GET /api/health") {
    sendJson(res, 200, { status: "ok", service: "seefast-api" });
    return;
  }

  const rota = matchRoute(req.method, url.pathname);

  // Ingestão: autenticada pelo token do dispositivo (não por sessão).
  if (rota && INGESTAO.has(rota.key)) {
    const device = dispositivoPorToken(tokenDoDispositivo(req));
    if (!device) {
      sendJson(res, 401, { error: "dispositivo_nao_autenticado" });
      return;
    }
    if (device.id !== rota.params.id) {
      sendJson(res, 403, { error: "token_de_outro_dispositivo" });
      return;
    }
    await rota.handler(req, res, { device, params: rota.params });
    return;
  }

  // Tudo o resto exige sessão válida.
  const user = utilizadorDaRequisicao(req);
  if (!user) {
    sendJson(res, 401, { error: "nao_autenticado" });
    return;
  }

  if (!rota) {
    sendJson(res, 404, { error: "not_found", path: url.pathname });
    return;
  }
  if (ADMIN_ONLY.has(rota.key) && user.role !== "admin") {
    sendJson(res, 403, { error: "sem_permissao" });
    return;
  }

  await rota.handler(req, res, { user, params: rota.params });
});

server.listen(PORT, HOST, () => {
  console.log(`[seefast-api] a escutar em http://${HOST}:${PORT}`);
  if (HOST === "0.0.0.0") {
    console.warn(
      "[seefast-api] AVISO: a API esta acessivel a toda a rede local. Use apenas numa rede de confianza."
    );
  }
});
