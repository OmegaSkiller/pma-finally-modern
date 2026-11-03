#!/usr/bin/env node
// Builds the 640x400 theme thumbnails (the screen.png phpMyAdmin shows in its theme picker)
// from full-size screenshots: screenshots/full-light.png and screenshots/full-dark.png.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
const W = 640;
const H = 400;
const light = () => sharp(join(dir, 'full-light.png')).resize(W, H);
const dark = () => sharp(join(dir, 'full-dark.png')).resize(W, H);

await light().png().toFile(join(dir, 'finally-modern.png'));
await dark().png().toFile(join(dir, 'finally-modern-dark.png'));

const left = await light().extract({ left: 0, top: 0, width: W / 2, height: H }).toBuffer();
const right = await dark().extract({ left: W / 2, top: 0, width: W / 2, height: H }).toBuffer();
await sharp({ create: { width: W, height: H, channels: 4, background: '#fff' } })
  .composite([{ input: left, left: 0, top: 0 }, { input: right, left: W / 2, top: 0 }])
  .png()
  .toFile(join(dir, 'finally-modern-auto.png'));
console.log('previews written');
