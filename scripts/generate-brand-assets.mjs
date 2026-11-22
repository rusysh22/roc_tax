/**
 * Generates SerenTax brand assets from the source JPGs in /static.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Outputs
 * - apps/web/public/brand/serentax-logo.png  full logo, ink as alpha (black)
 * - apps/web/public/brand/serentax-mark.png  logo mark only, ink as alpha
 *   (both are used as CSS masks so they take `currentColor`: white on the
 *   black navbar, black/white in light/dark theme)
 * - apps/web/src/app/icon.png        512px favicon, transparent rounded corners
 * - apps/web/src/app/apple-icon.png  180px opaque touch icon
 * - apps/web/src/app/favicon.ico     48px PNG-in-ICO for legacy /favicon.ico
 */
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (name) => join(root, "static", name);
const out = (path) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  return file;
};

/** Grayscale JPG (dark ink on white) -> black RGBA with ink as alpha, trimmed. */
async function inkToAlpha(input) {
  const { data, info } = await sharp(input)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    // Map luminance to alpha with a soft ramp: <=40 opaque, >=215 clear.
    const l = data[i];
    const a =
      l <= 40 ? 255 : l >= 215 ? 0 : Math.round(((215 - l) / 175) * 255);
    rgba[i * 4 + 3] = a;
  }
  return { rgba, width, height };
}

function bbox({ rgba, width, height }, x0 = 0, x1 = width) {
  let minX = x1,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = x0; x < x1; x++)
      if (rgba[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function rawImage({ rgba, width, height }) {
  return sharp(rgba, { raw: { width, height, channels: 4 } });
}

// ---- Logo + mark --------------------------------------------------------
const logo = await inkToAlpha(src("serentax-logo.jpg"));
const full = bbox(logo);
await rawImage(logo)
  .extract(full)
  .png({ compressionLevel: 9 })
  .toFile(out("apps/web/public/brand/serentax-logo.png"));

// The mark is the ink left of the first fully empty column gap.
const columnInk = (x) => {
  for (let y = full.top; y < full.top + full.height; y++)
    if (logo.rgba[(y * logo.width + x) * 4 + 3] > 24) return true;
  return false;
};
// Walk right past the mark's ink and stop at the first wide empty gap.
let x = full.left;
let seenInk = false;
for (; x < full.left + full.width; x++) {
  const ink = columnInk(x);
  if (ink) seenInk = true;
  else if (seenInk) {
    // require a gap of at least 12px to separate mark from wordmark
    let run = 0;
    while (x + run < full.left + full.width && !columnInk(x + run)) run++;
    if (run >= 12) break;
    x += run;
  }
}
const mark = bbox(logo, full.left, x);
await rawImage(logo)
  .extract(mark)
  .png({ compressionLevel: 9 })
  .toFile(out("apps/web/public/brand/serentax-mark.png"));

// ---- Favicon ------------------------------------------------------------
// Same design as static/serentax-favicon.jpg (white mark on a black rounded
// square), rebuilt from the cleaned mark because the JPG is only ~200px and
// blurs when scaled. The JPG is still read to confirm its square bounds.
const fav = await inkToAlpha(src("serentax-favicon.jpg"));
const square = bbox(fav);
const markHeight = Math.round(512 * 0.6);
const whiteMark = await rawImage(logo)
  .extract(mark)
  .resize({ height: markHeight, kernel: "lanczos3" })
  .negate({ alpha: false })
  .png()
  .toBuffer();
const cropped = await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#0b0b0b" },
})
  .composite([{ input: whiteMark, gravity: "centre" }])
  .png()
  .toBuffer();
const radius = Math.round(512 * 0.22);
const roundMask = Buffer.from(
  `<svg width="512" height="512"><rect width="512" height="512" rx="${radius}" ry="${radius}"/></svg>`,
);
await sharp(cropped)
  .composite([{ input: roundMask, blend: "dest-in" }])
  .png({ compressionLevel: 9 })
  .toFile(out("apps/web/src/app/icon.png"));

// Apple touch icon: opaque (iOS rounds it). Paint the white JPG corners black.
const rounded = await sharp(cropped)
  .composite([{ input: roundMask, blend: "dest-in" }])
  .png()
  .toBuffer();
const apple512 = await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#0b0b0b" },
})
  .composite([{ input: rounded }])
  .png()
  .toBuffer();
await sharp(apple512)
  .resize(180, 180)
  .flatten({ background: "#0b0b0b" })
  .png({ compressionLevel: 9 })
  .toFile(out("apps/web/src/app/apple-icon.png"));

// favicon.ico: a single 48px PNG embedded in an ICO container.
const png48 = await sharp(out("apps/web/src/app/icon.png"))
  .resize(48, 48)
  .png()
  .toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry.writeUInt8(48, 0); // width
entry.writeUInt8(48, 1); // height
entry.writeUInt8(0, 2); // palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png48.length, 8);
entry.writeUInt32LE(6 + 16, 12); // offset
writeFileSync(
  out("apps/web/src/app/favicon.ico"),
  Buffer.concat([header, entry, png48]),
);

console.log("logo", full, "mark", mark, "favicon square", square);
