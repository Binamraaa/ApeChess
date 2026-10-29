// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// Exports web-sized WebP variants of Bapu's master artwork (abu.png) into public/bapu/.
// The master file is never modified. Run with: npm run bapu
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'abu.png';
const OUT = 'public/bapu';

// Head region in the 1024×1536 master, tuned by eye.
const HEAD = { cx: 512, cy: 470, r: 360 };

async function main() {
  mkdirSync(OUT, { recursive: true });

  for (const width of [512, 256]) {
    await sharp(SRC).resize({ width }).webp({ quality: 82 }).toFile(`${OUT}/bapu-${width}.webp`);
  }

  const size = HEAD.r * 2;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${HEAD.r}" cy="${HEAD.r}" r="${HEAD.r}" fill="#fff"/></svg>`,
  );
  const head = await sharp(SRC)
    .extract({ left: HEAD.cx - HEAD.r, top: HEAD.cy - HEAD.r, width: size, height: size })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  for (const px of [256, 128]) {
    await sharp(head).resize(px, px).webp({ quality: 85 }).toFile(`${OUT}/bapu-head-${px}.webp`);
  }

  // PWA icons: head on cream, square (maskable icons need padding).
  for (const px of [192, 512]) {
    const inner = Math.round(px * 0.8);
    const headImg = await sharp(head).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: px, height: px, channels: 4, background: '#F3E3C8' } })
      .composite([{ input: headImg, gravity: 'center' }])
      .png()
      .toFile(`${OUT}/icon-${px}.png`);
  }

  console.log('Bapu exported to', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
