import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_KEYLEN = 64;

export const SESSION_COOKIE = "seefast_session";
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

// scrypt com salt aleatório por password: scrypt$<salt-hex>$<hash-hex>
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [algoritmo, saltHex, hashHex] = stored.split("$");
  if (algoritmo !== "scrypt" || !saltHex || !hashHex) return false;
  let esperado;
  try {
    esperado = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (esperado.length === 0) return false;
  const real = scryptSync(
    String(password),
    Buffer.from(saltHex, "hex"),
    esperado.length
  );
  return real.length === esperado.length && timingSafeEqual(real, esperado);
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString("hex");
  const agora = Date.now();
  const expiraEm = new Date(agora + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO sessions (token, user_id, criado_em, expira_em) VALUES (?, ?, ?, ?)"
  ).run(token, userId, new Date(agora).toISOString(), expiraEm);
  return { token, expiraEm };
}

// Devolve o utilizador da sessão, ou null se o token não existir ou tiver expirado.
export function getSessionUser(db, token) {
  if (!token) return null;
  const sessao = db
    .prepare("SELECT token, expira_em FROM sessions WHERE token = ?")
    .get(token);
  if (!sessao) return null;
  if (sessao.expira_em <= new Date().toISOString()) {
    deleteSession(db, token);
    return null;
  }
  const user = db
    .prepare("SELECT id, email, role FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = ?)")
    .get(token);
  return user ?? null;
}

export function deleteSession(db, token) {
  if (!token) return false;
  const info = db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  return info.changes > 0;
}

export function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((parte) => parte.trim())
      .filter((parte) => parte.includes("="))
      .map((parte) => {
        const indice = parte.indexOf("=");
        return [
          decodeURIComponent(parte.slice(0, indice).trim()),
          decodeURIComponent(parte.slice(indice + 1).trim()),
        ];
      })
  );
}

export function sessionCookie(token, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function newUserId() {
  return `usr-${randomUUID()}`;
}
