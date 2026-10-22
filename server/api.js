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
  hashPassword,
  newUserId,
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
  "GET /api/devices": (req, res, { user }) =>
    sendJson(res, 200, {
      devices: db
        .prepare(
          `SELECT d.id, d.nome, d.estado, d.bateria, d.ultimo_reporte,
                  d.user_id AS userId, u.email AS dono
             FROM devices d
             LEFT JOIN users u ON u.id = d.user_id
            ORDER BY d.id`
        )
        .all()
        .filter((d) => {
          const escopo = escopoDeDispositivos(user);
          return escopo === null || d.userId === escopo;
        }),
    }),

  // Lista de clientes (admin): quem subscreveu o serviço e com quantos
  // dispositivos. Nunca exposta a clientes.
  "GET /api/clientes": (req, res) =>
    sendJson(res, 200, {
      clientes: db
        .prepare(
          `SELECT u.id, u.email, u.plano, u.estado, u.criado_em AS registadoEm,
                  COUNT(d.id) AS dispositivos,
                  MAX(d.ultimo_reporte) AS ultimoReporte
             FROM users u
             LEFT JOIN devices d ON d.user_id = u.id
            WHERE u.role = 'cliente'
            GROUP BY u.id, u.email, u.plano, u.estado, u.criado_em
            ORDER BY u.criado_em DESC`
        )
        .all(),
    }),

  // Registo de um dispositivo novo: devolve o token uma unica vez.
  // Admin: cria um dispositivo para um cliente ja registado (ou sem dono).
  // Cliente: cria o seu proprio dispositivo (ligado a si).
  "POST /api/devices": async (req, res, { user }) => {
    const corpo = await readJsonBody(req);
    const nome = String(corpo.nome ?? "").trim();
    if (!nome) {
      sendJson(res, 400, { error: "nome_em_falta" });
      return;
    }
    // O dono: o admin pode indicar o cliente; o cliente e sempre o proprio.
    // Um cliente nunca pode atribuir o dispositivo a outra conta.
    let owner = user.id;
    if (user.role === "admin") {
      owner = String(corpo.userId ?? "").trim() || null;
    }
    const id = `dev-${randomBytes(4).toString("hex")}`;
    const token = randomBytes(24).toString("hex");
    db.prepare(
      `INSERT INTO devices (id, nome, estado, bateria, token_hash, criado_em, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      nome,
      "desconhecido",
      0,
      hashToken(token),
      new Date().toISOString(),
      owner
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

  "GET /api/locations": (req, res, { user }) =>
    sendJson(res, 200, {
      locations: filtrarPorDono(
        user,
        db
          .prepare(
            "SELECT device_id AS deviceId, nome, lat, lon, atualizado_em AS atualizadoEm FROM locations ORDER BY device_id"
          )
          .all()
      ),
    }),

  "GET /api/parental-rules": (req, res, { user }) =>
    sendJson(res, 200, {
      rules: filtrarPorDono(
        user,
        db
          .prepare(
            "SELECT id, device_id AS deviceId, nome, limite_minutos AS limiteMinutos, inicio, fim FROM parental_rules ORDER BY id"
          )
          .all()
      ),
    }),

  "GET /api/apps": (req, res, { user }) =>
    sendJson(res, 200, {
      apps: filtrarPorDono(
        user,
        db
          .prepare(
            `SELECT a.id, a.device_id AS deviceId, a.nome, a.pacote,
                    a.tamanho_mb AS tamanhoMb, a.bloqueada,
                    COALESCE(u.minutos, 0) AS minutos
               FROM apps a
               LEFT JOIN usage u ON u.device_id = a.device_id AND u.pacote = a.pacote
              ORDER BY a.id`
          )
          .all()
          .map((a) => ({ ...a, bloqueada: bool(a.bloqueada) }))
      ),
    }),

  "GET /api/permissions": (req, res, { user }) =>
    sendJson(res, 200, {
      permissions: filtrarPorDono(
        user,
        db
          .prepare(
            "SELECT device_id AS deviceId, nome, consentimento, camera, microfone, localizacao FROM permissions ORDER BY device_id"
          )
          .all()
          .map((p) => ({
            ...p,
            camera: bool(p.camera),
            microfone: bool(p.microfone),
            localizacao: bool(p.localizacao),
          }))
      ),
    }),

  "GET /api/usage": (req, res, { user }) =>
    sendJson(res, 200, {
      usage: filtrarPorDono(
        user,
        db
          .prepare(
            "SELECT device_id AS deviceId, pacote, minutos, registado_em AS registadoEm FROM usage ORDER BY minutos DESC"
          )
          .all()
      ),
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

/**
 * Registo publico: o cliente cria a sua conta e regista o seu telefone de
 * uma so vez. E o que a app Android chama quando o utilizador configura o
 * dispositivo pela primeira vez.
 *
 * Devolve o token do dispositivo em claro (uma unica vez) e a sessao do
 * cliente, para que o painel fique logo autenticado.
 */
async function handleRegisto(req, res) {
  let corpo;
  try {
    corpo = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "pedido_invalido" });
    return;
  }

  const email = String(corpo.email ?? "").trim().toLowerCase();
  const password = String(corpo.password ?? "");
  const nome = String(corpo.nome ?? "").trim() || "Dispositivo";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    sendJson(res, 400, { error: "email_invalido" });
    return;
  }
  if (password.length < 8) {
    sendJson(res, 400, { error: "password_curta" });
    return;
  }

  const existente = db
    .prepare("SELECT id, role FROM users WHERE email = ?")
    .get(email);
  if (existente) {
    // A conta ja existe: nao criamos outra. O cliente tem de entrar.
    sendJson(res, 409, { error: "conta_existe" });
    return;
  }

  const userId = newUserId();
  const deviceId = `dev-${randomBytes(4).toString("hex")}`;
  const token = randomBytes(24).toString("hex");
  const agora = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, criado_em, plano, estado)
       VALUES (?, ?, ?, 'cliente', ?, 'gratuito', 'activo')`
    ).run(userId, email, hashPassword(password), agora);

    db.prepare(
      `INSERT INTO devices (id, nome, estado, bateria, token_hash, criado_em, user_id)
       VALUES (?, ?, 'desconhecido', 0, ?, ?, ?)`
    ).run(deviceId, nome, hashToken(token), agora, userId);
  })();

  const { token: sessao } = createSession(db, userId);
  sendJson(
    res,
    201,
    {
      user: { id: userId, email, role: "cliente" },
      device: { id: deviceId, nome, token },
    },
    { "Set-Cookie": sessionCookie(sessao) }
  );
}

/**
 * Liga um dispositivo a uma conta.
 *
 * Chamado pela app Android na primeira configuracao (e sempre que o
 * utilizador se liga a partir de um telefone novo):
 *   - conta inexistente  -> cria a conta de cliente + o dispositivo;
 *   - conta existente    -> valida a password e cria um dispositivo novo
 *                          ligado a essa conta.
 *
 * Em ambos os casos devolve o token do dispositivo em claro (uma unica vez)
 * e a sessao do cliente, para o painel ficar logo autenticado.
 */
async function handleLigar(req, res) {
  let corpo;
  try {
    corpo = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "pedido_invalido" });
    return;
  }

  const email = String(corpo.email ?? "").trim().toLowerCase();
  const password = String(corpo.password ?? "");
  const nome = String(corpo.nome ?? "").trim() || "Dispositivo";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    sendJson(res, 400, { error: "email_invalido" });
    return;
  }
  if (password.length < 8) {
    sendJson(res, 400, { error: "password_curta" });
    return;
  }

  const existente = db
    .prepare("SELECT id, email, password_hash, role, estado FROM users WHERE email = ?")
    .get(email);

  let userId;
  if (existente) {
    if (existente.role === "admin") {
      // Um admin nao e um cliente: a app nao cria dispositivos de admin.
      sendJson(res, 403, { error: "conta_reservada" });
      return;
    }
    if (existente.estado !== "activo") {
      sendJson(res, 403, { error: "conta_suspensa" });
      return;
    }
    if (!verifyPassword(password, existente.password_hash)) {
      sendJson(res, 401, { error: "credenciais_invalidas" });
      return;
    }
    userId = existente.id;
  } else {
    userId = newUserId();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, criado_em, plano, estado)
       VALUES (?, ?, ?, 'cliente', ?, 'gratuito', 'activo')`
    ).run(userId, email, hashPassword(password), new Date().toISOString());
  }

  const deviceId = `dev-${randomBytes(4).toString("hex")}`;
  const token = randomBytes(24).toString("hex");
  const agora = new Date().toISOString();

  db.prepare(
    `INSERT INTO devices (id, nome, estado, bateria, token_hash, criado_em, user_id)
     VALUES (?, ?, 'desconhecido', 0, ?, ?, ?)`
  ).run(deviceId, nome, hashToken(token), agora, userId);

  const { token: sessao } = createSession(db, userId);
  sendJson(
    res,
    existente ? 200 : 201,
    {
      user: { id: userId, email, role: "cliente" },
      device: { id: deviceId, nome, token },
      contaNova: !existente,
    },
    { "Set-Cookie": sessionCookie(sessao) }
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
  "GET /api/clientes",
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

/**
 * Escopo de dispositivos visivel para o utilizador.
 * O admin ve todos; o cliente ve apenas os seus.
 * Devolve null para "todos" ou o id do dono.
 */
function escopoDeDispositivos(user) {
  if (!user || user.role === "admin") return null;
  return user.id;
}

/** Filtra uma lista de registos (por device_id) pelo escopo do utilizador. */
function filtrarPorDono(user, registos) {
  const escopo = escopoDeDispositivos(user);
  if (escopo === null) return registos;
  const meus = new Set(
    db
      .prepare("SELECT id FROM devices WHERE user_id = ?")
      .all(escopo)
      .map((d) => d.id)
  );
  return registos.filter((r) => meus.has(r.deviceId ?? r.device_id ?? r.id));
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

// O handler é exportado para que o servidor de produção (server/producao.js)
// possa servir a API e os ficheiros estáticos na MESMA porta — exigência do
// Render (um web service só pode escutar numa porta).
export const handler = async (req, res) => {
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
  // Registo publico: cria a conta do cliente e o seu dispositivo. Nao exige
  // sessao porque e a app Android que o chama na primeira configuracao.
  if (key === "POST /api/registo") {
    await handleRegisto(req, res);
    return;
  }
  // Liga um dispositivo a uma conta (app Android): cria a conta se nao
  // existir, valida a password se existir, e devolve o token do dispositivo.
  if (key === "POST /api/ligar") {
    await handleLigar(req, res);
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
};

// Arranque directo: `node server/api.js` (desenvolvimento, porta 3001).
// Em producao quem arranca e server/producao.js, que importa o handler acima.
if (process.env.SEEFAST_SERVIDOR_UNICO !== "1") {
  const server = createServer(handler);
  server.listen(PORT, HOST, () => {
    console.log(`[seefast-api] a escutar em http://${HOST}:${PORT}`);
    if (HOST === "0.0.0.0") {
      console.warn(
        "[seefast-api] AVISO: a API esta acessivel a toda a rede local. Use apenas numa rede de confianza."
      );
    }
  });
}
