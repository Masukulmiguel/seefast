// Ponto de entrada de produção na raiz do repositório.
//
// Porquê este ficheiro: o Render procura o módulo em
// /opt/render/project/src/server.js. Sem este ficheiro, um Start Command
// "node server.js" falha com "Cannot find module".
//
// O que faz:
//   1) garante que o frontend está compilado em dist/ (build automático se
//      faltar — assim o serviço arranca mesmo que o Build Command do
//      dashboard seja só "npm install" e o `npm run build` nunca corra);
//   2) arranca o servidor de produção: painel compilado + API na mesma
//      porta (exigência do Render: um web service só escuta numa porta).

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const RAIZ = resolve(process.cwd());
const DIST = join(RAIZ, "dist");

// 1) Build do frontend se ainda não existir.
if (!existsSync(join(DIST, "index.html"))) {
  console.log("[start] dist/ ausente — a compilar o frontend...");
  const resultado = spawnSync("npm", ["run", "build"], {
    cwd: RAIZ,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (resultado.status !== 0) {
    console.error(
      "[start] o build do frontend falhou — o painel vai servir a API mas sem interface."
    );
  }
}

// 2) Servidor de produção (painel + API na mesma porta).
await import("./server/producao.js");
