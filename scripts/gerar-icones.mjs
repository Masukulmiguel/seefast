// Gera os icones PNG da PWA sem dependencias externas.
// Codificador PNG minimo (RGBA, 8 bits) + fonte bitmap 5x7 para o monograma "SF".
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const saida = join(raiz, "public");

const FUNDO = [0x10, 0x2a, 0x43, 0xff]; // #102A43
const GLYPH = [0xff, 0xff, 0xff, 0xff]; // branco

const FONTE = {
  S: ["01110", "10001", "10000", "01110", "00001", "10001", "01110"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const comprimento = Buffer.alloc(4);
  comprimento.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([comprimento, corpo, crc]);
}

function codificarPng(largura, altura, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidade de bits
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) {
    const inicio = y * (1 + largura * 4);
    raw[inicio] = 0; // filtro "None"
    pixels.copy(raw, inicio + 1, y * largura * 4, (y + 1) * largura * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Desenha o monograma "SF" centrado; devolve a cor de cada pixel.
function desenharMonograma(largura, altura, escala) {
  const larguraTexto = 5 * escala * 2 + escala; // 2 letras + espaco
  const alturaTexto = 7 * escala;
  const origemX = Math.floor((largura - larguraTexto) / 2);
  const origemY = Math.floor((altura - alturaTexto) / 2);

  const porPixel = (x, y) => {
    for (const [indiceLetra, letra] of ["S", "F"].entries()) {
      const glifo = FONTE[letra];
      const baseX = origemX + indiceLetra * (5 * escala + escala);
      const gx = Math.floor((x - baseX) / escala);
      const gy = Math.floor((y - origemY) / escala);
      if (gx < 0 || gx > 4 || gy < 0 || gy > 6) continue;
      if (glifo[gy][gx] === "1") return GLYPH;
    }
    return null;
  };

  return porPixel;
}

function gerarIcone({ ficheiro, tamanho, cantosArredondados, escala }) {
  const pixels = Buffer.alloc(tamanho * tamanho * 4);
  const raio = cantosArredondados ? Math.round(tamanho * 0.22) : 0;
  const porPixel = desenharMonograma(tamanho, tamanho, escala);

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const offset = (y * tamanho + x) * 4;
      const dentroDosCantos =
        raio === 0 || dentroDoRetanguloArredondado(x, y, tamanho, raio);
      const cor = porPixel(x, y) ?? (dentroDosCantos ? FUNDO : null);
      if (cor) {
        pixels[offset] = cor[0];
        pixels[offset + 1] = cor[1];
        pixels[offset + 2] = cor[2];
        pixels[offset + 3] = cor[3];
      }
    }
  }

  writeFileSync(join(saida, ficheiro), codificarPng(tamanho, tamanho, pixels));
  return ficheiro;
}

function dentroDoRetanguloArredondado(x, y, tamanho, raio) {
  const pertoEsquerda = x < raio;
  const pertoDireita = x >= tamanho - raio;
  const pertoCima = y < raio;
  const pertoBaixo = y >= tamanho - raio;
  if (!pertoEsquerda && !pertoDireita && !pertoCima && !pertoBaixo) return true;

  const cx = pertoEsquerda ? raio : pertoDireita ? tamanho - raio - 1 : x;
  const cy = pertoCima ? raio : pertoBaixo ? tamanho - raio - 1 : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= raio * raio;
}

const ficheiros = [
  gerarIcone({ ficheiro: "icon-192.png", tamanho: 192, cantosArredondados: true, escala: 12 }),
  gerarIcone({ ficheiro: "icon-512.png", tamanho: 512, cantosArredondados: true, escala: 32 }),
  // Maskable: sem cantos (o Android aplica a mascara) e monograma menor (safe zone).
  gerarIcone({ ficheiro: "icon-maskable-512.png", tamanho: 512, cantosArredondados: false, escala: 24 }),
];

console.log(`[icones] gerados: ${ficheiros.join(", ")}`);
