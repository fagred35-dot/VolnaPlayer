// Генерирует build/icon.ico из dist/volna-icon.png без внешних зависимостей.
// Внутри — честные изображения размеров 16..256 (BMP для мелких, PNG для 256),
// иначе NSIS/Windows ругаются «invalid icon file size».
// Запускается автоматически при сборке: node make-icon.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const src = path.join(__dirname, "..", "dist", "volna-icon.png");
const outDir = path.join(__dirname, "build");
const outIco = path.join(outDir, "icon.ico");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/* ---------- CRC32 для PNG ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/* ---------- декодер PNG (8-bit: RGB/RGBA/серый/palette) ---------- */
function decodePng(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error("не является PNG-файлом");
  }
  let pos = 8;
  let width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0,
    interlace = 0;
  const idat = [];
  let palette = null,
    trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      trns = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`глубина ${bitDepth} бит не поддерживается`);
  if (interlace) throw new Error("interlaced PNG не поддерживается");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`цветовой тип ${colorType} не поддерживается`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(width * height * 4);

  // расфильтровка построчно
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    raw.copy(line, 0, p, p + stride);
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 0xff;
      else if (filter === 2) line[i] = (line[i] + b) & 0xff;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const pa = Math.abs(b - c),
          pb = Math.abs(a - c),
          pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[i] = (line[i] + pr) & 0xff;
      }
    }
    line.copy(prev);
    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      if (colorType === 6) {
        px[d] = line[s];
        px[d + 1] = line[s + 1];
        px[d + 2] = line[s + 2];
        px[d + 3] = line[s + 3];
      } else if (colorType === 2) {
        px[d] = line[s];
        px[d + 1] = line[s + 1];
        px[d + 2] = line[s + 2];
        px[d + 3] = 255;
      } else if (colorType === 0) {
        px[d] = px[d + 1] = px[d + 2] = line[s];
        px[d + 3] = 255;
      } else if (colorType === 4) {
        px[d] = px[d + 1] = px[d + 2] = line[s];
        px[d + 3] = line[s + 1];
      } else if (colorType === 3) {
        const idx = line[s];
        px[d] = palette[idx * 3];
        px[d + 1] = palette[idx * 3 + 1];
        px[d + 2] = palette[idx * 3 + 2];
        px[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
  }
  return { width, height, rgba: px };
}

/* ---------- уменьшение усреднением области (качественно для иконок) ---------- */
function resizeArea(src, sw, sh, size) {
  const dst = Buffer.alloc(size * size * 4);
  for (let dy = 0; dy < size; dy++) {
    const sy0 = Math.floor((dy * sh) / size);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * sh) / size));
    for (let dx = 0; dx < size; dx++) {
      const sx0 = Math.floor((dx * sw) / size);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * sw) / size));
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0;
      for (let sy = sy0; sy < sy1 && sy < sh; sy++) {
        for (let sx = sx0; sx < sx1 && sx < sw; sx++) {
          const o = (sy * sw + sx) * 4;
          const al = src[o + 3] / 255;
          r += src[o] * al;
          g += src[o + 1] * al;
          b += src[o + 2] * al;
          a += src[o + 3];
          n++;
        }
      }
      const d = (dy * size + dx) * 4;
      const alAvg = n ? a / n / 255 : 0;
      dst[d] = alAvg > 0 ? Math.round(r / n / alAvg) : 0;
      dst[d + 1] = alAvg > 0 ? Math.round(g / n / alAvg) : 0;
      dst[d + 2] = alAvg > 0 ? Math.round(b / n / alAvg) : 0;
      dst[d + 3] = n ? Math.round(a / n) : 0;
    }
  }
  return dst;
}

/* ---------- кодировщик PNG (RGBA8) для записи 256x256 ---------- */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const ro = y * (size * 4 + 1);
    raw[ro] = 0; // filter none
    rgba.copy(raw, ro + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- DIB (BMP) запись для маленьких размеров ---------- */
function dibEntry(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR + AND
  header.writeUInt16LE(1, 12); // planes
  header.writeUInt16LE(32, 14); // bpp
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const srcRow = size - 1 - y; // снизу вверх
    for (let x = 0; x < size; x++) {
      const s = (srcRow * size + x) * 4;
      const d = (y * size + x) * 4;
      xor[d] = rgba[s + 2]; // B
      xor[d + 1] = rgba[s + 1]; // G
      xor[d + 2] = rgba[s]; // R
      xor[d + 3] = rgba[s + 3]; // A
    }
  }
  const maskStride = Math.ceil(size / 32) * 4;
  const and = Buffer.alloc(maskStride * size); // нулевая маска — альфа в пикселях
  return Buffer.concat([header, xor, and]);
}

async function main() {
  if (!fs.existsSync(src)) {
    console.error("❌ dist/volna-icon.png не найден. Сначала соберите сайт: npm run build (в корне)");
    process.exit(1);
  }
  const img = decodePng(fs.readFileSync(src));
  console.log(`ℹ️  PNG: ${img.width}x${img.height}`);

  const images = SIZES.map((size) => {
    const resized = resizeArea(img.rgba, img.width, img.height, size);
    return { size, data: size >= 256 ? encodePng(size, resized) : dibEntry(size, resized) };
  });

  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // тип: иконка
  dir.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 = 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // палитры нет
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outIco, Buffer.concat([dir, ...entries, ...images.map((i) => i.data)]));
  console.log(`✅ Иконка сгенерирована (${SIZES.join(", ")}):`, outIco);
}

main().catch((e) => {
  console.error("❌ Ошибка генерации иконки:", e.message);
  process.exit(1);
});
