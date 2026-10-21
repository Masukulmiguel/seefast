import { openDatabase, runMigrations, seedDatabase } from "./db.js";
import { hashPassword, newUserId } from "./auth.js";

// Cria (ou actualiza) um utilizador do painel.
// Uso:
//   SEEFAST_ADMIN_EMAIL=admin@seefast SEEFAST_ADMIN_PASSWORD=segredo123 npm run seed:admin
// Variável opcional: SEEFAST_ADMIN_ROLE=visualizador
const email = String(process.env.SEEFAST_ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = String(process.env.SEEFAST_ADMIN_PASSWORD ?? "");
const role = process.env.SEEFAST_ADMIN_ROLE === "visualizador" ? "visualizador" : "admin";

if (!email || !password) {
  console.error(
    "[seed-admin] Define SEEFAST_ADMIN_EMAIL e SEEFAST_ADMIN_PASSWORD (minimo 8 caracteres)."
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("[seed-admin] A password tem de ter pelo menos 8 caracteres.");
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("[seed-admin] Email inválido (formato esperado: utilizador@dominio).");
  process.exit(1);
}

const db = openDatabase();
runMigrations(db);
seedDatabase(db);

const hash = hashPassword(password);
const existente = db.prepare("SELECT id FROM users WHERE email = ?").get(email);

if (existente) {
  db.prepare("UPDATE users SET password_hash = ?, role = ? WHERE id = ?").run(
    hash,
    role,
    existente.id
  );
  console.log(`[seed-admin] Utilizador ${email} actualizado (papel: ${role}).`);
} else {
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, criado_em) VALUES (?, ?, ?, ?, ?)"
  ).run(newUserId(), email, hash, role, new Date().toISOString());
  console.log(`[seed-admin] Utilizador ${email} criado (papel: ${role}).`);
}

db.close();
