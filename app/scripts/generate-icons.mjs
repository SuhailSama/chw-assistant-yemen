/**
 * Generates PWA icons (192x192 and 512x512) as PNG files.
 * Green (#1a6b4a) background with a white "+" cross symbol.
 * Uses pure Node.js with zlib — no canvas dependency required.
 */

import { createWriteStream } from 'fs';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// PNG CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(val) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(val);
  return b;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([
    writeUint32BE(data.length),
    typeBuffer,
    data,
    writeUint32BE(crc32(crcData))
  ]);
}

function generatePNG(size) {
  const BG_R = 0x1a, BG_G = 0x6b, BG_B = 0x4a;

  // Build raw RGBA pixel data
  // Cross arm thickness: ~15% of size, centered
  const armThick = Math.max(Math.round(size * 0.15), 4);
  const armInset = Math.round(size * 0.2);
  const center = Math.round(size / 2);

  const rows = [];
  for (let y = 0; y < size; y++) {
    // Filter byte 0 = None
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const inHBar = (y >= center - Math.floor(armThick / 2) && y < center + Math.ceil(armThick / 2) && x >= armInset && x < size - armInset);
      const inVBar = (x >= center - Math.floor(armThick / 2) && x < center + Math.ceil(armThick / 2) && y >= armInset && y < size - armInset);
      const isCross = inHBar || inVBar;
      const offset = 1 + x * 3;
      if (isCross) {
        row[offset] = 0xff; row[offset + 1] = 0xff; row[offset + 2] = 0xff;
      } else {
        row[offset] = BG_R; row[offset + 1] = BG_G; row[offset + 2] = BG_B;
      }
    }
    rows.push(row);
  }

  const rawData = Buffer.concat(rows);
  const compressed = deflateSync(rawData);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);   // width
  ihdrData.writeUInt32BE(size, 4);   // height
  ihdrData[8] = 8;                   // bit depth
  ihdrData[9] = 2;                   // color type: RGB
  ihdrData[10] = 0;                  // compression method
  ihdrData[11] = 0;                  // filter method
  ihdrData[12] = 0;                  // interlace method

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function writeIcon(size, filename) {
  const png = generatePNG(size);
  const path = join(PUBLIC_DIR, filename);
  const ws = createWriteStream(path);
  ws.write(png);
  ws.end();
  ws.on('finish', () => console.log(`Created ${filename} (${size}x${size}, ${png.length} bytes)`));
}

writeIcon(192, 'icon-192.png');
writeIcon(512, 'icon-512.png');
