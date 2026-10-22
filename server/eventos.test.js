import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";

// A API real e carregada com uma base de dados em memoria: os testes
// exercitam o codigo de producao, nao uma copia.
process.env.SEEFAST_DB = ":memory:";
process.env.SEEFAST_SERVIDOR_UNICO = "1";

const { handler } = await import("./api.js");
const { openDatabase } = await import("./db.js");
const { hashPassword, newUserId } = await import("./auth.js");

/**
 * Testes do log de eventos: idempotencia, filtros e a distincao entre o que
 * o servidor recebeu e o que o dispositivo ainda tem por enviar.
 *
 * O servidor e a API real, arrancada em sockets de verdade: prova-se o
 * percurso completo (pedido -> validacao -> base de dados -> resposta).
 */

let servidor;
let base;
let db;
let deviceId;
let token;

function hashToken(t) {
  return createHash("sha256").update(t).digest("hex");
}

async function enviar(eventos) {
  const resposta = await fetch(`${base}/api/devices/${deviceId}/eventos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ eventos }),
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

beforeAll(async () => {
  db = openDatabase(":memory:");

  const userId = newUserId();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, criado_em, plano, estado)
     VALUES (?, ?, ?, 'cliente', ?, 'gratuito', 'activo')`
  ).run(userId, "cliente@teste.pt", hashPassword("senha12345"), new Date().toISOString());

  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, criado_em, plano, estado)
     VALUES (?, ?, ?, 'admin', ?, 'admin', 'activo')`
  ).run(newUserId(), "admin@teste.pt", hashPassword("admin12345"), new Date().toISOString());

  deviceId = `dev-${randomBytes(4).toString("hex")}`;
  token = randomBytes(24).toString("hex");
  db.prepare(
    `INSERT INTO devices (id, nome, estado, bateria, token_hash, criado_em, user_id)
     VALUES (?, ?, 'desconhecido', 0, ?, ?, ?)`
  ).run(deviceId, "Telemóvel do teste", hashToken(token), new Date().toISOString(), userId);

  servidor = createServer((req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;

  // Sessao de admin (cookie real, do login real) para ler o painel.
  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@teste.pt", password: "admin12345" }),
  });
  const setCookie = login.headers.get("set-cookie") ?? "";
  cookieAdmin = () => ({ cookie: setCookie.split(";")[0] });
});

afterAll(async () => {
  await new Promise((resolve) => servidor.close(resolve));
});

describe("log de eventos", () => {
  it("aceita um lote de eventos e guarda quando ocorreu e quando chegou", async () => {
    const { status, corpo } = await enviar([
      {
        id: "evt-1",
        tipo: "ESTADO",
        corpo: { estado: "online", bateria: 82 },
        ocorridoEm: "2026-10-22T10:00:00.000Z",
        criadoEm: "2026-10-22T10:00:01.000Z",
      },
    ]);

    expect(status).toBe(200);
    expect(corpo.novos).toBe(1);
    expect(corpo.duplicados).toBe(0);

    const evento = db.prepare("SELECT * FROM events WHERE id = 'evt-1'").get();
    expect(evento.ocorrido_em).toBe("2026-10-22T10:00:00.000Z");
    expect(evento.recebido_em).not.toBe(evento.ocorrido_em);
    expect(JSON.parse(evento.payload).bateria).toBe(82);
  });

  it("reenviar o mesmo evento nao cria duplicado", async () => {
    const evento = {
      id: "evt-reenvio",
      tipo: "LOCALIZACAO",
      corpo: { lat: 38.7223, lon: -9.1393 },
      ocorreuEm: "2026-10-22T10:00:00.000Z",
    };

    const primeira = await enviar([evento]);
    const segunda = await enviar([evento]);

    expect(primeira.corpo.novos).toBe(1);
    expect(segunda.corpo.novos).toBe(0);
    expect(segunda.corpo.duplicados).toBe(1);
    expect(segunda.corpo.aceites).toBe(1);

    const total = db
      .prepare("SELECT COUNT(*) AS n FROM events WHERE id = 'evt-reenvio'")
      .get().n;
    expect(total).toBe(1);
  });

  it("filtra por dispositivo, tipo e intervalo de datas", async () => {
    await enviar([
      { id: "f1", tipo: "ESTADO", corpo: {}, ocorridoEm: "2026-10-20T10:00:00.000Z" },
      { id: "f2", tipo: "LOCALIZACAO", corpo: {}, ocorridoEm: "2026-10-22T10:00:00.000Z" },
      { id: "f3", tipo: "ESTADO", corpo: {}, ocorridoEm: "2026-10-22T12:00:00.000Z" },
    ]);

    const porTipo = await (
      await fetch(`${base}/api/eventos?tipo=ESTADO`, { headers: cookieAdmin() })
    ).json();
    expect(porTipo.eventos.length).toBeGreaterThanOrEqual(2);

    const porIntervalo = await (
      await fetch(`${base}/api/eventos?de=2026-10-22T00:00:00.000Z`, { headers: cookieAdmin() })
    ).json();
    expect(porIntervalo.eventos.every((e) => e.ocorridoEm >= "2026-10-22")).toBe(true);

    const deOutro = await (
      await fetch(`${base}/api/eventos?dispositivo=dev-inexistente`, { headers: cookieAdmin() })
    ).json();
    expect(deOutro.eventos).toHaveLength(0);
  });

  it("o painel so ve os eventos que o servidor recebeu de facto", async () => {
    const antes = await (
      await fetch(`${base}/api/eventos?dispositivo=${deviceId}`, { headers: cookieAdmin() })
    ).json();
    const totalAntes = antes.eventos.length;

    await enviar([
      {
        id: "evt-confirmado",
        tipo: "ESTADO",
        corpo: { estado: "online" },
        ocorridoEm: "2026-10-22T10:00:00.000Z",
      },
    ]);

    const depois = await (
      await fetch(`${base}/api/eventos?dispositivo=${deviceId}`, { headers: cookieAdmin() })
    ).json();
    expect(depois.eventos.length).toBe(totalAntes + 1);
    expect(depois.eventos.some((e) => e.id === "evt-confirmado")).toBe(true);
    expect(depois.contagens.total).toBeGreaterThan(0);
  });

  it("o estado do dispositivo e actualizado a partir do evento", async () => {
    await enviar([
      {
        id: "evt-estado",
        tipo: "ESTADO",
        corpo: { estado: "online", bateria: 64, em: "2026-10-22T10:00:00.000Z" },
        ocorridoEm: "2026-10-22T10:00:00.000Z",
      },
    ]);

    const dispositivos = await (
      await fetch(`${base}/api/devices`, { headers: cookieAdmin() })
    ).json();
    const meu = dispositivos.devices.find((d) => d.id === deviceId);
    expect(meu.estado).toBe("online");
    expect(meu.bateria).toBe(64);
  });

  it("rejeita um lote sem eventos", async () => {
    const resposta = await fetch(`${base}/api/devices/${deviceId}/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ eventos: "nao e uma lista" }),
    });
    expect(resposta.status).toBe(400);
  });

  it("rejeita um lote demasiado grande", async () => {
    const muitos = Array.from({ length: 201 }, (_, i) => ({
      id: `evt-grande-${i}`,
      tipo: "ESTADO",
      corpo: {},
    }));
    const { status } = await enviar(muitos);
    expect(status).toBe(400);
  });

  it("um token invalido nao ingere eventos", async () => {
    const resposta = await fetch(`${base}/api/devices/${deviceId}/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-invalido",
      },
      body: JSON.stringify({ eventos: [{ id: "x", tipo: "ESTADO", corpo: {} }] }),
    });
    expect(resposta.status).toBe(401);
  });
});

/** Sessao de admin para ler os endpoints do painel. */
let cookieAdmin = () => ({});
