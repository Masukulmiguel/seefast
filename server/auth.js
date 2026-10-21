// TODO: implementar (ver server/auth.test.js)
export function hashPassword(password) {
  return "";
}

export function verifyPassword(password, stored) {
  return false;
}

export function createSession(db, userId) {
  return { token: "", expiraEm: "" };
}

export function getSessionUser(db, token) {
  return null;
}

export function deleteSession(db, token) {
  return false;
}

export function parseCookies(header) {
  return {};
}

export function sessionCookie(token, maxAgeSeconds) {
  return "";
}
