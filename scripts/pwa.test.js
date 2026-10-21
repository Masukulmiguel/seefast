// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publico = join(raiz, "public");

const manifesto = JSON.parse(
  readFileSync(join(publico, "manifest.webmanifest"), "utf8")
);

// Le a dimensao de um PNG a partir do chunk IHDR.
function dimensoesPng(buffer) {
  const assinatura = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < assinatura.length; i++) {
    if (buffer[i] !== assinatura[i]) throw new Error("assinatura PNG inválida");
  }
  if (buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("chunk IHDR em falta");
  }
  return {
    largura: buffer.readUInt32BE(16),
    altura: buffer.readUInt32BE(20),
  };
}

describe("ícones da PWA", () => {
  it.each([
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["icon-maskable-512.png", 512],
  ])("%s existe e é um PNG de %ix%i", (ficheiro, lado) => {
    const caminho = join(publico, ficheiro);
    expect(existsSync(caminho)).toBe(true);
    const { largura, altura } = dimensoesPng(readFileSync(caminho));
    expect(largura).toBe(lado);
    expect(altura).toBe(lado);
  });
});

describe("manifesto da PWA", () => {
  it("tem os campos que o Android exige para instalar", () => {
    expect(manifesto.name).toBeTruthy();
    expect(manifesto.short_name).toBeTruthy();
    expect(manifesto.start_url).toBe("/");
    expect(manifesto.display).toBe("standalone");
    expect(manifesto.theme_color).toBeTruthy();
    expect(manifesto.background_color).toBeTruthy();
  });

  it("tem um ícone de 192px e um de 512px (requisito de instalabilidade)", () => {
    const tamanhos = manifesto.icons.map((icone) => icone.sizes);
    expect(tamanhos).toContain("192x192");
    expect(tamanhos).toContain("512x512");
  });

  it("tem um ícone maskable (Android adaptativo)", () => {
    expect(manifesto.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("todos os ficheiros de ícone referenciados existem", () => {
    for (const icone of manifesto.icons) {
      const caminho = join(publico, icone.src.replace(/^\//, ""));
      expect(existsSync(caminho), `falta ${icone.src}`).toBe(true);
    }
  });
});

describe("service worker", () => {
  it("existe e nunca cacheia a API", () => {
    const sw = readFileSync(join(publico, "sw.js"), "utf8");
    expect(sw).toContain('"/api/"');
  });
});
