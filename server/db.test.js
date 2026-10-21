// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, runMigrations, seedDatabase } from "./db.js";

let dir;
let db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "seefast-db-"));
  db = openDatabase(join(dir, "test.db"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const tabelas = () =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name);

describe("migrations", () => {
  it("cria as tabelas do painel", () => {
    runMigrations(db);
    expect(tabelas()).toEqual(
      expect.arrayContaining([
        "devices",
        "alerts",
        "locations",
        "parental_rules",
        "apps",
        "permissions",
        "audit_entries",
        "schema_migrations",
      ])
    );
  });

  it("não reaplica migrations já aplicadas", () => {
    runMigrations(db);
    const antes = db
      .prepare("SELECT COUNT(*) AS n FROM schema_migrations")
      .get().n;
    runMigrations(db);
    const depois = db
      .prepare("SELECT COUNT(*) AS n FROM schema_migrations")
      .get().n;
    expect(antes).toBeGreaterThan(0);
    expect(depois).toBe(antes);
  });
});

describe("seed", () => {
  it("popula a base com dispositivos e alertas", () => {
    runMigrations(db);
    seedDatabase(db);
    expect(db.prepare("SELECT COUNT(*) AS n FROM devices").get().n).toBe(2);
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM alerts").get().n
    ).toBeGreaterThan(1);
  });

  it("é idempotente: correr duas vezes não duplica", () => {
    runMigrations(db);
    seedDatabase(db);
    seedDatabase(db);
    expect(db.prepare("SELECT COUNT(*) AS n FROM devices").get().n).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM apps").get().n).toBe(2);
  });
});
