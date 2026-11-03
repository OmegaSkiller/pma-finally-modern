#!/usr/bin/env node
// Builds the phpMyAdmin 5.2 themes:
//   1. Sass: Bootstrap 5.3 + tokenised PMA layout partials        (src/scss)
//   2. Tailwind v4: shadcn-style design layer via @apply           (src/tailwind)
//   3. Lucide icon sheet: every ic_* class as a currentColor mask  (src/icons.mjs)
//   4. Per-variant colour tokens appended, RTL sheet via rtlcss
//   5. Static assets copied, release zips written to ../release
//
// Usage: node build.mjs [--zip] [--out <dir>]

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import rtlcss from 'rtlcss';
import { transform } from 'lightningcss';
import { icons, tones } from './src/icons.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(root, 'dist');
const zip = args.includes('--zip');

const variants = [
  { id: 'finally-modern', name: 'Finally Modern', tokens: ['light'], desc: 'shadcn-inspired light theme' },
  { id: 'finally-modern-dark', name: 'Finally Modern Dark', tokens: ['dark'], desc: 'shadcn-inspired dark theme' },
  { id: 'finally-modern-auto', name: 'Finally Modern Auto', tokens: ['light', 'dark@media'], desc: 'shadcn-inspired theme that follows the OS light/dark setting' },
];

// 1. Sass base
const base = sass.compile(join(root, 'src/scss/theme.scss'), {
  loadPaths: [join(root, 'node_modules')],
  style: 'expanded',
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls'],
}).css;

// 2. Tailwind design layer
const tmp = join(root, 'build');
mkdirSync(tmp, { recursive: true });
execFileSync(join(root, 'node_modules/.bin/tailwindcss'), [
  '-i', join(root, 'src/tailwind/theme.css'),
  '-o', join(tmp, 'design.css'),
], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
const design = readFileSync(join(tmp, 'design.css'), 'utf8');

// 3. Lucide icon sheet
function svgUri(name) {
  const svg = readFileSync(join(root, 'node_modules/lucide-static/icons', `${name}.svg`), 'utf8')
    .replace(/<!--.*?-->/s, '')
    .replace(/\s*class="[^"]*"/, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}

let iconCss = '/* Lucide icons (ISC licence) rendered as currentColor masks */\n';
const byGlyph = new Map();
for (const [id, glyph] of Object.entries(icons)) {
  if (!byGlyph.has(glyph)) byGlyph.set(glyph, []);
  byGlyph.get(glyph).push(id);
}
for (const [glyph, ids] of byGlyph) {
  // .ic_* classes plus <img src=".../img/<id>.png|gif"> loaded directly by templates & JS
  const sel = ids.flatMap((id) => [
    `.ic_${id}`,
    `img[src$="/img/${id}.png"]`,
    `img[src$="/img/${id}.gif"]`,
  ]).join(',\n');
  iconCss += `${sel} { --icon: ${svgUri(glyph)}; }\n`;
}
for (const [id, tone] of Object.entries(tones)) {
  iconCss += `.ic_${id}, img[src$="/img/${id}.png"] { --icon-color: var(--icon-${tone}); }\n`;
}
iconCss += `[class*=" ic_bd_"], [class^="ic_bd_"] { opacity: .35; }\n`;
// Direct <img src> icons: hide the bitmap, paint the Lucide glyph instead.
const direct = Object.keys(icons).flatMap((id) => [`img[src$="/img/${id}.png"]`, `img[src$="/img/${id}.gif"]`]);
iconCss += `${direct.join(',\n')} {
  object-position: -9999px 0;
  -webkit-mask: var(--icon) center / contain no-repeat;
  mask: var(--icon) center / contain no-repeat;
  background-color: var(--icon-color, currentColor);
}\n`;

// 4. Tokens per variant
const tokenCss = (t) => {
  const [mode, media] = t.split('@');
  const css = readFileSync(join(root, `src/tailwind/tokens-${mode}.css`), 'utf8');
  return media ? `@media (prefers-color-scheme: dark) {\n${css}\n}\n` : css;
};

const banner = `/*! ${pkg.displayName} v${pkg.version} | phpMyAdmin 5.2 theme | GPL-2.0-or-later
 *  Icons: Lucide (ISC) | Font: Geist (OFL-1.1) | Base: Bootstrap 5.3 (MIT) */\n`;

rmSync(join(tmp, 'design.css'));

// Minify for the browsers that support oklch(), color-mix() and :has();
// lightningcss adds the -webkit-mask prefix Chromium < 120 still needs.
const targets = { chrome: 111 << 16, safari: (16 << 16) | (4 << 8), firefox: 121 << 16 };
function minify(code) {
  if (args.includes('--no-minify')) return code;
  return transform({ filename: 'theme.css', code: Buffer.from(code), minify: true, targets }).code.toString();
}
for (const v of variants) {
  const dir = join(outDir, v.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'css'), { recursive: true });
  cpSync(join(root, 'static'), dir, { recursive: true });

  const css = minify([banner, v.tokens.map(tokenCss).join('\n'), base, design, iconCss].join('\n'));
  writeFileSync(join(dir, 'css/theme.css'), css);
  writeFileSync(join(dir, 'css/theme.rtl.css'), rtlcss.process(css));

  writeFileSync(join(dir, 'theme.json'), JSON.stringify({
    name: v.name,
    version: pkg.version,
    description: v.desc,
    author: pkg.author,
    url: pkg.homepage,
    supports: ['5.2'],
  }, null, 4) + '\n');

  const shot = join(root, 'screenshots', `${v.id}.png`);
  if (existsSync(shot)) cpSync(shot, join(dir, 'screen.png'));

  console.log(`built ${v.id}  (${(css.length / 1024).toFixed(0)} KB css)`);

  if (zip) {
    const rel = join(root, '..', 'release');
    mkdirSync(rel, { recursive: true });
    const file = join(rel, `${v.id}-${pkg.version}.zip`);
    rmSync(file, { force: true });
    execFileSync('zip', ['-qr', '-X', file, v.id, '-x', '*.DS_Store'], { cwd: outDir });
    console.log(`  → ${file}`);
  }
}
