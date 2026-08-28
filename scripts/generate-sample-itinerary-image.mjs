#!/usr/bin/env node
// Renders a sample itinerary screenshot PNG from real Atlas Sandbox flight data.
// Zero runtime dependencies — reuses the bitmap PNG encoder from extraction fixtures.
//
// Usage: node scripts/generate-sample-itinerary-image.mjs
// Output: app/public/sample-itinerary-screenshot.png

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_PUBLIC = join(ROOT, 'app/public/sample-itinerary-screenshot.png');
const OUT_ASSET = join(ROOT, 'app/src/assets/sample-itinerary-screenshot.png');

const data = JSON.parse(
  readFileSync(join(ROOT, 'app-fixture-contracts/sample-itinerary-screenshot-data.json'), 'utf-8'),
);

const W = 960;
const H = 640;
const SCALE = 3;

const WHITE = [255, 255, 255];
const BLACK = [30, 30, 30];
const RED = [179, 0, 0];
const GREY = [120, 120, 120];
const BLUE = [8, 66, 152];

const FONT = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
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
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '\u2014': [0, 0, 0, 31, 0, 0, 0],
  ':': [0, 4, 4, 0, 4, 4, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '|': [4, 4, 4, 4, 4, 4, 4],
  ',': [0, 0, 0, 0, 12, 4, 8],
};

function makeCanvas(bg = [247, 247, 242]) {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => [...bg]));
}

function drawText(canvas, text, x, y, color, scale = SCALE) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT['.'];
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

function chunk(type, bufData) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bufData.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), bufData]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(canvas) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 3);
    raw[rowStart] = 0;
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
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const { firstLeg, secondLeg, departureDate, watermarkLines } = data;

const canvas = makeCanvas();
drawRect(canvas, 0, 0, W, 56, [255, 235, 235]);
for (const [i, line] of watermarkLines.entries()) {
  drawText(canvas, line, 20, 14 + i * 22, RED, 2);
}

drawText(canvas, 'SAMPLE DEMO ITINERARY — FLIGHT SUMMARY', 20, 80, BLACK, 3);
drawText(canvas, `DATE: ${departureDate}`, 20, 130, BLUE, 2);
drawText(canvas, 'NOT A REAL TICKET OR BOOKING CONFIRMATION', 20, 160, GREY, 2);

drawRect(canvas, 16, 190, W - 32, 2, [200, 200, 200]);

const leg1Line = `LEG 1: ${firstLeg.carrier} ${firstLeg.flightNumber} | ${firstLeg.origin} TO ${firstLeg.destination} | ${departureDate} | ${firstLeg.departureTime} - ${firstLeg.arrivalTime} | ${firstLeg.priceDisplay}`;
const leg2Line = `LEG 2: ${secondLeg.carrier} ${secondLeg.flightNumber} | ${secondLeg.origin} TO ${secondLeg.destination} | ${departureDate} | ${secondLeg.departureTime} - ${secondLeg.arrivalTime} | ${secondLeg.priceDisplay}`;

drawText(canvas, leg1Line, 20, 210, BLACK, 2);
drawText(canvas, leg2Line, 20, 250, BLACK, 2);

drawText(canvas, `CONNECTION AT ${firstLeg.destination}: ${data.connectionDurationMinutes} MIN`, 20, 300, BLACK, 2);
drawText(canvas, 'PASSENGER: DEMO TRAVELLER (SAMPLE ONLY)', 20, 350, BLACK, 2);
drawText(canvas, 'REFERENCE: DEMO-SCREENSHOT-001 (NOT A BOOKING)', 20, 390, BLACK, 2);
drawText(canvas, 'FLIGHT DATA FROM ATLAS SANDBOX OBSERVATIONS — DEMO ARTIFACT', 20, 560, GREY, 2);
drawText(canvas, 'STITCHCHECK SAMPLE SCREENSHOT FOR UPLOAD/EXTRACTION DEMO', 20, 590, GREY, 2);

mkdirSync(dirname(OUT_PUBLIC), { recursive: true });
mkdirSync(dirname(OUT_ASSET), { recursive: true });
const png = encodePng(canvas);
writeFileSync(OUT_PUBLIC, png);
writeFileSync(OUT_ASSET, png);
console.log(`wrote ${OUT_PUBLIC}`);
console.log(`wrote ${OUT_ASSET}`);
