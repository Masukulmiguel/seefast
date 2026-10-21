// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PORT = 34173;
const apiPath = resolve(dirname(fileURLToPath(import.meta.url)), "api.js");

let child;

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
  child = spawn(process.execPath, [apiPath], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    if (await isUp()) return;
    await wait(100);
  }
  throw new Error("API não arrancou dentro do tempo esperado");
}, 20000);

afterAll(() => {
  if (child && child.exitCode === null) child.kill();
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

describe("server/api.js", () => {
  it("OPTIONS anuncia apenas os métodos suportados (GET)", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      method: "OPTIONS",
    });
    expect(res.headers.get("access-control-allow-methods")).toBe("GET,OPTIONS");
  });

  it("request-target malformado responde 400 em vez de rebentar o processo", async () => {
    const raw = await rawRequest(
      "GET http://% HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
    );
    expect(raw).toMatch(/^HTTP\/1\.1 400 /);
  });
});
