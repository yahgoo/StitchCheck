#!/usr/bin/env node
// Synthetic fixture generator for the StitchCheck Gemini smoke test.
// Produces PNG fixtures from scratch (no copied travel screenshots, no real
// data). Zero dependencies: PNG encoding uses Node's built-in zlib, and text
// is rendered with an embedded 5x7 bitmap font. Fully offline.
//
// Every image carries the visible watermark:
//   SYNTHETIC FIXTURE — NOT REAL DATA — NO PII

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = dirname(fileURLToPath(import.meta.url));

const W = 960;
const H = 560;
const SCALE = 3;

const WHITE = [255, 255, 255];
const BLACK = [30, 30, 30];
const RED = [179, 0, 0];
const GREY = [120, 120, 120];

// 5x7 bitmap font; each glyph is 7 rows of 5-bit patterns (MSB = leftmost).
const FONT = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [1, 1, 1, 1, 17, 17, 14],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 10, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "\u2014": [0, 0, 0, 31, 0, 0, 0], // em dash: full-width bar
  ":": [0, 4, 4, 0, 4, 4, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "|": [4, 4, 4, 4, 4, 4, 4],
  "#": [10, 10, 31, 10, 31, 10, 10],
  ",": [0, 0, 0, 0, 12, 4, 8],
};

function makeCanvas(bg = [247, 247, 242]) {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => [...bg]));
}

function drawText(canvas, text, x, y, color, scale = SCALE) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT["?"] ?? FONT["."];
    if (glyph) {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if ((glyph[row] >> (4 - col)) & 1) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const py = y + row * scale + sy;
                const px = cx + col * scale + sx;
                if (py >= 0 && py < H && px >= 0 && px < W) {
                  canvas[py][px] = [...color];
                }
              }
            }
          }
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawRect(canvas, x, y, w, h, color) {
  for (let py = y; py < y + h && py < H; py++) {
    for (let px = x; px < x + w && px < W; px++) {
      if (py >= 0 && px >= 0) canvas[py][px] = [...color];
    }
  }
}

const WATERMARK = "SYNTHETIC FIXTURE \u2014 NOT REAL DATA \u2014 NO PII";

function watermark(canvas) {
  drawText(canvas, WATERMARK, 20, 16, RED);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(canvas) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const [r, g, b] = canvas[y][x];
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function save(name, canvas) {
  const file = join(outDir, name);
  writeFileSync(file, encodePng(canvas));
  console.log(`wrote ${name}`);
}

// GEM-01 (also reused by GEM-08): clean two-leg itinerary.
{
  const c = makeCanvas();
  watermark(c);
  drawText(c, "DEMO AIR - FICTIONAL ITINERARY", 20, 64, BLACK, 4);
  drawText(c, "LEG 1: DA 100 | AAA TO BBB | 2026-09-01 | 08:00 - 10:30", 20, 130, BLACK, 2);
  drawText(c, "LEG 2: DA 200 | BBB TO CCC | 2026-09-01 | 11:45 - 14:20", 20, 170, BLACK, 2);
  drawText(c, "PASSENGER: SYNTHETIC TRAVELLER (FICTIONAL)", 20, 230, BLACK, 2);
  drawText(c, "BOOKING REFERENCE: XX0000 (FICTIONAL)", 20, 270, BLACK, 2);
  drawText(c, "TOTAL: 123.00 DEM (FICTIONAL CURRENCY)", 20, 310, BLACK, 2);
  drawText(c, "SEPARATELY BOOKED LEGS FOR THE STITCHCHECK SYNTHETIC DEMO.", 20, 500, GREY, 2);
  save("gem-01-two-leg-clean.png", c);
}

// GEM-02: optional field (leg 2 flight number) intentionally absent.
{
  const c = makeCanvas();
  watermark(c);
  drawText(c, "DEMO AIR - FICTIONAL ITINERARY", 20, 64, BLACK, 4);
  drawText(c, "LEG 1: DA 100 | AAA TO BBB | 2026-09-01 | 08:00 - 10:30", 20, 130, BLACK, 2);
  drawText(c, "LEG 2: BBB TO CCC | 2026-09-01 | 11:45 - 14:20", 20, 170, BLACK, 2);
  drawText(c, "PASSENGER: SYNTHETIC TRAVELLER (FICTIONAL)", 20, 230, BLACK, 2);
  drawText(c, "BOOKING REFERENCE: XX0000 (FICTIONAL)", 20, 270, BLACK, 2);
  drawText(c, "TOTAL: 123.00 DEM (FICTIONAL CURRENCY)", 20, 310, BLACK, 2);
  drawText(c, "OPTIONAL FIELD INTENTIONALLY MISSING FOR THE GEM-02 SCENARIO.", 20, 500, GREY, 2);
  save("gem-02-two-leg-missing-optional.png", c);
}

// GEM-03: fragmented layout (scattered, irregularly spaced lines).
{
  const c = makeCanvas([239, 233, 220]);
  watermark(c);
  drawText(c, "DEMO", 40, 70, BLACK);
  drawText(c, "AIR", 400, 96, BLACK);
  drawText(c, "DA 100", 620, 60, BLACK);
  drawText(c, "AAA", 90, 160, BLACK);
  drawText(c, "BBB", 640, 140, BLACK);
  drawText(c, "2026-09-01", 300, 210, BLACK);
  drawText(c, "08:00", 110, 280, BLACK);
  drawText(c, "10:30", 600, 260, BLACK);
  drawText(c, "LEG 2: DA 200", 60, 360, BLACK);
  drawText(c, "BBB CCC", 480, 380, BLACK);
  drawText(c, "11:45", 200, 430, BLACK);
  drawText(c, "14:20", 560, 420, BLACK);
  drawText(c, "FRAGMENTED FICTIONAL LAYOUT FOR THE GEM-03 SCENARIO.", 20, 500, GREY, 2);
  save("gem-03-two-leg-fragmented.png", c);
}

// GEM-04: clearly not a flight itinerary.
{
  const c = makeCanvas([238, 243, 247]);
  watermark(c);
  drawText(c, "FICTIONAL RECIPE CARD", 20, 64, BLACK, 4);
  drawText(c, "DEMO SOUP - SERVES 4 (FICTIONAL)", 20, 130, BLACK, 2);
  drawText(c, "INGREDIENTS: 2 CUPS FICTIONAL BROTH,", 20, 170, BLACK, 2);
  drawText(c, "1 DICED IMAGINARY CARROT, SALT TO TASTE.", 20, 210, BLACK, 2);
  drawText(c, "METHOD: SIMMER FOR 20 MINUTES, STIR GENTLY.", 20, 250, BLACK, 2);
  drawText(c, "DELIBERATELY NOT A FLIGHT ITINERARY FOR THE GEM-04 SCENARIO.", 20, 500, GREY, 2);
  save("gem-04-non-itinerary.png", c);
}

// GEM-05: one required field (leg 1 departure time) deliberately unreadable.
{
  const c = makeCanvas();
  watermark(c);
  drawText(c, "DEMO AIR - FICTIONAL ITINERARY", 20, 64, BLACK, 4);
  drawText(c, "LEG 1: DA 100 | AAA TO BBB | 2026-09-01", 20, 130, BLACK, 2);
  drawText(c, "DEPARTURE:", 20, 170, BLACK, 2);
  drawText(c, "##:## ILLEGIBLE", 240, 170, [150, 150, 150], 2);
  drawRect(c, 235, 162, 300, 30, [150, 150, 150]); // obscuring smudge
  drawText(c, "ARRIVAL: 10:30", 20, 210, BLACK, 2);
  drawText(c, "LEG 2: DA 200 | BBB TO CCC | 2026-09-01 | 11:45 - 14:20", 20, 250, BLACK, 2);
  drawText(c, "BOOKING REFERENCE: XX0000 (FICTIONAL)", 20, 310, BLACK, 2);
  drawText(c, "REQUIRED DEPARTURE TIME INTENTIONALLY UNREADABLE FOR GEM-05.", 20, 500, GREY, 2);
  save("gem-05-unreadable-field.png", c);
}

console.log("done: 5 synthetic PNG fixtures generated");
