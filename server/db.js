import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

export const MIGRATIONS_DIR = join(aqui, "migrations");
export const DB_PATH = process.env.SEEFAST_DB || resolve("data", "seefast.db");

export function openDatabase(path = DB_PATH) {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// Aplica as migrations por ordem (nome do ficheiro). Cada uma corre uma vez,
// registada em schema_migrations, dentro de uma transação.
export function runMigrations(db, dir = MIGRATIONS_DIR) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL)"
  );
  const jaAplicadas = new Set(
    db.prepare("SELECT nome FROM schema_migrations").all().map((r) => r.nome)
  );
  const ficheiros = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let aplicadas = 0;
  for (const ficheiro of ficheiros) {
    if (jaAplicadas.has(ficheiro)) continue;
    const sql = readFileSync(join(dir, ficheiro), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db
        .prepare(
          "INSERT INTO schema_migrations (nome, aplicada_em) VALUES (?, ?)"
        )
        .run(ficheiro, new Date().toISOString());
    })();
    aplicadas += 1;
  }
  return aplicadas;
}

const SEED = {
  devices: [
    ["dev-001", "Telemóvel da Ana", "online", 82],
    ["dev-002", "Tablet do João", "offline", 34],
  ],
  alerts: [
    ["alt-003", "critical", "Root detetado no dispositivo dev-003", "2026-10-21T08:15:00Z", 0, null],
    ["alt-001", "warning", "Dispositivo dev-002 sem ligação", "2026-10-20T09:00:00Z", 0, null],
    ["alt-002", "info", "Nova app instalada no dispositivo dev-001", "2026-10-19T11:30:00Z", 0, null],
  ],
  locations: [
    ["dev-001", "Telemóvel da Ana", 38.7223, -9.1393, "2026-10-21T08:00:00Z"],
    ["dev-002", "Tablet do João", 41.1579, -8.6291, "2026-10-20T17:30:00Z"],
  ],
  parental_rules: [
    ["reg-001", "dev-001", "Telemóvel da Ana", 120, "20:00", "22:00"],
    ["reg-002", "dev-002", "Tablet do João", 60, "19:00", "21:00"],
  ],
  apps: [
    ["app-001", "dev-001", "Instagram", "com.instagram.android", 45, 1],
    ["app-002", "dev-001", "TikTok", "com.zhiliaoapp.musically", 78, 0],
  ],
  permissions: [
    ["dev-001", "Telemóvel da Ana", "concedido", 0, 0, 1],
    ["dev-002", "Tablet do João", "pendente", 0, 0, 0],
  ],
  audit_entries: [
    ["aud-001", "2026-10-21T07:45:00Z", "admin@seefast", "atualizou limite de ecrã", "dev-001"],
    ["aud-002", "2026-10-20T14:10:00Z", "admin@seefast", "bloqueou aplicação", "app-001"],
  ],
};

// Popula a base apenas se estiver vazia — correr o seed duas vezes não duplica.
export function seedDatabase(db) {
  return db.transaction(() => {
    const existentes = db.prepare("SELECT COUNT(*) AS n FROM devices").get().n;
    if (existentes > 0) return 0;

    const inserir = (tabela, colunas, linhas) => {
      const placeholders = colunas.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO ${tabela} (${colunas.join(", ")}) VALUES (${placeholders})`
      );
      for (const linha of linhas) stmt.run(...linha);
    };

    inserir("devices", ["id", "nome", "estado", "bateria"], SEED.devices);
    inserir(
      "alerts",
      ["id", "nivel", "mensagem", "em", "reconhecido", "reconhecido_em"],
      SEED.alerts
    );
    inserir(
      "locations",
      ["device_id", "nome", "lat", "lon", "atualizado_em"],
      SEED.locations
    );
    inserir(
      "parental_rules",
      ["id", "device_id", "nome", "limite_minutos", "inicio", "fim"],
      SEED.parental_rules
    );
    inserir(
      "apps",
      ["id", "device_id", "nome", "pacote", "tamanho_mb", "bloqueada"],
      SEED.apps
    );
    inserir(
      "permissions",
      ["device_id", "nome", "consentimento", "camera", "microfone", "localizacao"],
      SEED.permissions
    );
    inserir("audit_entries", ["id", "em", "ator", "acao", "alvo"], SEED.audit_entries);
    return 1;
  })();
}
