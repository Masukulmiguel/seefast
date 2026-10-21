// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PORT = 34173;
const apiPath = resolve(dirname(fileURLToPath(import.meta.url)), "api.js");

let child;
let dbDir;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  // Base de dados temporária: os testes não tocam em data/seefast.db.
  dbDir = mkdtempSync(join(tmpdir(), "seefast-api-"));
  child = spawn(process.execPath, [apiPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      SEEFAST_DB: join(dbDir, "api.db"),
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    if (await isUp()) return;
    await wait(100);
  }
  throw new Error("API não arrancou dentro do tempo esperado");
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

describe("server/api.js", () => {
  it("OPTIONS anuncia apenas os métodos suportados (GET)", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      method: "OPTIONS",
    });
    expect(res.headers.get("access-control-allow-methods")).toBe("GET,OPTIONS");
  });

  it.each(collections)("GET %s devolve a coleção %s com dados", async (endpoint, chave) => {
    const res = await fetch(`http://127.0.0.1:${PORT}${endpoint}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data[chave])).toBe(true);
    expect(data[chave].length).toBeGreaterThan(0);
  });

  it("GET /api/alerts devolve os alertas mais recentes primeiro", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/alerts`);
    const data = await res.json();
    expect(data.alerts.length).toBeGreaterThan(1);
    const datas = data.alerts.map((a) => Date.parse(a.em));
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  // Este é o último teste: um request malformado derruba o processo, por isso
  // tem de correr depois de todos os outros.
  it("request-target malformado responde 400 em vez de rebentar o processo", async () => {
    const raw = await rawRequest(
      "GET http://% HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
    );
    expect(raw).toMatch(/^HTTP\/1\.1 400 /);
  });
});
