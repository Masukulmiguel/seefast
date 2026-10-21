// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, runMigrations } from "./db.js";
import { hashPassword } from "./auth.js";

const PORT = 34173;
const BASE = `http://127.0.0.1:${PORT}`;
const apiPath = resolve(dirname(fileURLToPath(import.meta.url)), "api.js");

const CREDENCIAIS = { email: "admin@seefast", password: "segredo123" };
const CREDENCIAIS_VIS = { email: "visor@seefast", password: "segredo123" };

let child;
let dbDir;
let cookie = "";
let cookieVisualizador = "";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

function cookieFrom(res) {
  const headers = res.headers.getSetCookie?.() ?? [];
  return headers.map((c) => c.split(";")[0]).join("; ");
}

beforeAll(async () => {
  // Base de dados temporária: os testes não tocam em data/seefast.db.
  dbDir = mkdtempSync(join(tmpdir(), "seefast-api-"));
  const dbPath = join(dbDir, "api.db");

  const db = openDatabase(dbPath);
  runMigrations(db);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, criado_em) VALUES (?, ?, ?, ?, ?)"
  ).run("u-admin", CREDENCIAIS.email, hashPassword(CREDENCIAIS.password), "admin", new Date().toISOString());
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, criado_em) VALUES (?, ?, ?, ?, ?)"
  ).run("u-vis", CREDENCIAIS_VIS.email, hashPassword(CREDENCIAIS_VIS.password), "visualizador", new Date().toISOString());
  db.close();

  child = spawn(process.execPath, [apiPath], {
    env: { ...process.env, PORT: String(PORT), SEEFAST_DB: dbPath },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    if (await isUp()) break;
    await wait(100);
  }

  const login = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDENCIAIS),
  });
  cookie = cookieFrom(login);

  const loginVis = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDENCIAIS_VIS),
  });
  cookieVisualizador = cookieFrom(loginVis);
}, 20000);

afterAll(async () => {
  // Espera que o processo da API saia antes de apagar a base temporária
  // (senão o Windows mantém o ficheiro bloqueado e o rm falha com EPERM).
  if (child && child.exitCode === null) {
    const saiu = new Promise((r) => child.once("exit", r));
    child.kill();
    await saiu;
  }
  if (dbDir) rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// Pedido HTTP bruto: permite enviar request-targets que o parser do Node
// aceita mas que a aplicação tem de tratar.
function rawRequest(payload) {
  return new Promise((resolvePromise) => {
    const socket = net.connect(PORT, "127.0.0.1");
    let data = "";
    const done = () => resolvePromise(data);
    socket.on("connect", () => socket.write(payload));
    socket.on("data", (chunk) => {
      data += chunk.toString();
    });
    socket.on("error", done); // ligação morta sem resposta = data vazio
    socket.on("close", done);
    socket.setTimeout(3000, () => {
      socket.destroy();
      done();
    });
  });
}

// Coleções expostas pela API: endpoint -> chave do payload.
const collections = [
  ["/api/devices", "devices"],
  ["/api/alerts", "alerts"],
  ["/api/locations", "locations"],
  ["/api/parental-rules", "rules"],
  ["/api/apps", "apps"],
  ["/api/permissions", "permissions"],
  ["/api/audit", "entries"],
];

describe("autenticação", () => {
  it("OPTIONS anuncia os métodos suportados (GET, POST)", async () => {
    const res = await fetch(`${BASE}/api/health`, { method: "OPTIONS" });
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET,POST,OPTIONS"
    );
  });

  it("GET /api/devices sem sessão responde 401", async () => {
    const res = await fetch(`${BASE}/api/devices`);
    expect(res.status).toBe(401);
  });

  it("POST /api/login com password errada responde 401", async () => {
    const res = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...CREDENCIAIS, password: "errada" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("credenciais_invalidas");
  });

  it("POST /api/login com email inexistente devolve o mesmo erro", async () => {
    const res = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ninguem@seefast", password: "errada" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("credenciais_invalidas");
  });

  it("POST /api/login com credenciais válidas devolve cookie e utilizador", async () => {
    const res = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CREDENCIAIS),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(CREDENCIAIS.email);
    expect(body.user.role).toBe("admin");
    const setCookie = res.headers.getSetCookie?.() ?? [];
    expect(setCookie.join(";")).toContain("HttpOnly");
    expect(setCookie.join(";")).toContain("SameSite=Lax");
  });

  it("GET /api/session com o cookie devolve o utilizador", async () => {
    const res = await fetch(`${BASE}/api/session`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(CREDENCIAIS.email);
  });

  it("GET /api/devices com o cookie devolve 200", async () => {
    const res = await fetch(`${BASE}/api/devices`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
  });

  it("POST /api/logout invalida a sessão", async () => {
    const login = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CREDENCIAIS),
    });
    const sessao = cookieFrom(login);
    const logout = await fetch(`${BASE}/api/logout`, {
      method: "POST",
      headers: { Cookie: sessao },
    });
    expect(logout.status).toBe(204);
    const depois = await fetch(`${BASE}/api/session`, {
      headers: { Cookie: sessao },
    });
    expect(depois.status).toBe(401);
  });
});

describe("escrita (só admin)", () => {
  it("um visualizador não pode bloquear uma app (403)", async () => {
    const res = await fetch(`${BASE}/api/apps/app-002`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieVisualizador },
      body: JSON.stringify({ bloqueada: true }),
    });
    expect(res.status).toBe(403);
  });

  it("sem sessão não há escrita (401)", async () => {
    const res = await fetch(`${BASE}/api/apps/app-002`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bloqueada: true }),
    });
    expect(res.status).toBe(401);
  });

  it("o admin bloqueia uma app e a alteração fica visível", async () => {
    const res = await fetch(`${BASE}/api/apps/app-002`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ bloqueada: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.app.bloqueada).toBe(true);

    const lista = await fetch(`${BASE}/api/apps`, { headers: { Cookie: cookie } });
    const data = await lista.json();
    const app = data.apps.find((a) => a.id === "app-002");
    expect(app.bloqueada).toBe(true);
  });

  it("o admin actualiza o limite de ecrã de uma regra", async () => {
    const res = await fetch(`${BASE}/api/parental-rules/reg-001`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ limiteMinutos: 90, inicio: "19:30", fim: "21:30" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rule.limiteMinutos).toBe(90);
    expect(body.rule.inicio).toBe("19:30");
  });

  it("o admin reconhece um alerta", async () => {
    const res = await fetch(`${BASE}/api/alerts/alt-001/ack`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alert.reconhecido).toBe(true);
  });

  it("cada escrita fica registada em auditoria", async () => {
    const res = await fetch(`${BASE}/api/audit`, { headers: { Cookie: cookie } });
    const data = await res.json();
    const acoes = data.entries.map((e) => e.acao);
    expect(acoes.some((a) => /aplicação/i.test(a))).toBe(true);
    expect(data.entries.some((e) => e.ator === CREDENCIAIS.email)).toBe(true);
  });

  it("um recurso inexistente devolve 404", async () => {
    const res = await fetch(`${BASE}/api/apps/app-999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ bloqueada: true }),
    });
    expect(res.status).toBe(404);
  });
});

describe("coleções da API", () => {
  it.each(collections)("GET %s devolve a coleção %s com dados", async (endpoint, chave) => {
    const res = await fetch(`${BASE}${endpoint}`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data[chave])).toBe(true);
    expect(data[chave].length).toBeGreaterThan(0);
  });

  it("GET /api/alerts devolve os alertas mais recentes primeiro", async () => {
    const res = await fetch(`${BASE}/api/alerts`, { headers: { Cookie: cookie } });
    const data = await res.json();
    expect(data.alerts.length).toBeGreaterThan(1);
    const datas = data.alerts.map((a) => Date.parse(a.em));
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });
});

describe("pedidos inválidos", () => {
  // Este é o último teste: um request malformado derruba o processo, por isso
  // tem de correr depois de todos os outros.
  it("request-target malformado responde 400 em vez de rebentar o processo", async () => {
    const raw = await rawRequest(
      "GET http://% HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
    );
    expect(raw).toMatch(/^HTTP\/1\.1 400 /);
  });
});
