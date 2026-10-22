// Servidor de produção: uma única porta serve a API e o painel compilado.
//
// O Render (e qualquer hosting) só deteta UMA porta aberta. Em desenvolvimento
// há duas (Vite em 5173, API em 3001); em produção o Vite compila para `dist/`
// e este servidor serve os ficheiros estáticos + a API na mesma porta.
//
// Arranque: node server/producao.js
// Porta: process.env.PORT (o Render define isto) ou 3001.

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

// A API não deve abrir a sua própria porta: o flag diz-lhe que o servidor
// de produção é dono da porta.
process.env.SEEFAST_SERVIDOR_UNICO = "1";

const { handler: apiHandler } = await import("./api.js");

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.SEEFAST_HOST || "0.0.0.0";
const RAIZ = resolve(process.cwd());
const DIST = join(RAIZ, "dist");

// Tipos MIME para os ficheiros estáticos do painel.
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/**
 * Serve um ficheiro de `dist/`. Devolve false se não existir.
 * `caminho` é relativo a dist e já vem validado (sem "..").
 */
function servirEstatico(caminho, res) {
  const alvo = join(DIST, caminho);
  if (!alvo.startsWith(DIST)) return false;
  if (!existsSync(alvo) || !statSync(alvo).isFile()) return false;

  const tipo = TIPOS[extname(alvo).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": tipo,
    // O Vite mete os ficheiros com hash no nome; o index não pode ser cacheado.
    "Cache-Control": caminho.endsWith(".html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  createReadStream(alvo).pipe(res);
  return true;
}

const servidor = createServer((req, res) => {
  let pathname = "/";
  try {
    pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  } catch {
    pathname = "/";
  }

  // A API responde sempre em /api — com os mesmos erros do servidor de API.
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    apiHandler(req, res);
    return;
  }

  // Ficheiro estático do painel.
  const limpo = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  if (limpo !== "/" && servirEstatico(limpo, res)) return;

  // SPA: qualquer rota desconhecida devolve o index (React Router trata).
  if (servirEstatico("index.html", res)) return;

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(
    "SeeFast: o painel nao foi compilado. Execute `npm run build` antes de arrancar em producao.\n"
  );
});

servidor.listen(PORT, HOST, () => {
  console.log(`[seefast] painel + API em http://${HOST}:${PORT}`);
  if (!existsSync(join(DIST, "index.html"))) {
    console.warn("[seefast] AVISO: dist/index.html nao existe — o painel nao vai aparecer.");
  }
});

// Encerramento limpo: o Render envia SIGTERM no redesenho do serviço.
process.on("SIGTERM", () => {
  console.log("[seefast] SIGTERM recebido, a encerrar...");
  servidor.close(() => process.exit(0));
});
