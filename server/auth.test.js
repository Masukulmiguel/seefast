// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, runMigrations } from "./db.js";
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession,
  parseCookies,
  sessionCookie,
} from "./auth.js";

let dir;
let db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "seefast-auth-"));
  db = openDatabase(join(dir, "auth.db"));
  runMigrations(db);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, criado_em) VALUES (?, ?, ?, ?, ?)"
  ).run("u1", "ana@seefast", hashPassword("segredo123"), "admin", "2026-10-21T00:00:00Z");
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("passwords", () => {
  it("aceita a password correcta", () => {
    const guardado = hashPassword("segredo123");
    expect(verifyPassword("segredo123", guardado)).toBe(true);
  });

  it("rejeita a password errada", () => {
    const guardado = hashPassword("segredo123");
    expect(verifyPassword("outra-coisa", guardado)).toBe(false);
  });

  it("gera hashes diferentes para a mesma password (salt aleatório)", () => {
    expect(hashPassword("segredo123")).not.toBe(hashPassword("segredo123"));
  });

  it("não guarda a password em claro", () => {
    expect(hashPassword("segredo123")).not.toContain("segredo123");
  });

  it("rejeita hashes malformados sem rebentar", () => {
    expect(verifyPassword("x", "nao-e-um-hash")).toBe(false);
    expect(verifyPassword("x", undefined)).toBe(false);
    expect(verifyPassword("x", "scrypt$aa$bb")).toBe(false);
  });
});

describe("sessões", () => {
  it("cria uma sessão e devolve o utilizador", () => {
    const { token } = createSession(db, "u1");
    const user = getSessionUser(db, token);
    expect(user).not.toBeNull();
    expect(user.email).toBe("ana@seefast");
    expect(user.role).toBe("admin");
  });

  it("devolve null para um token desconhecido", () => {
    expect(getSessionUser(db, "token-inexistente")).toBeNull();
  });

  it("devolve null para uma sessão expirada", () => {
    const { token } = createSession(db, "u1");
    db.prepare("UPDATE sessions SET expira_em = ? WHERE token = ?").run(
      "2020-01-01T00:00:00Z",
      token
    );
    expect(getSessionUser(db, token)).toBeNull();
  });

  it("deleteSession invalida a sessão", () => {
    const { token } = createSession(db, "u1");
    expect(deleteSession(db, token)).toBe(true);
    expect(getSessionUser(db, token)).toBeNull();
  });

  it("gera tokens diferentes em cada sessão", () => {
    const a = createSession(db, "u1");
    const b = createSession(db, "u1");
    expect(a.token).not.toBe(b.token);
  });
});

describe("cookies", () => {
  it("faz parse do header de cookies", () => {
    expect(parseCookies("a=1; seefast_session=abc")).toEqual({
      a: "1",
      seefast_session: "abc",
    });
  });

  it("devolve objecto vazio sem header", () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it("monta um cookie HttpOnly e SameSite=Lax", () => {
    const cookie = sessionCookie("abc123", 3600);
    expect(cookie).toContain("seefast_session=abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });
});
