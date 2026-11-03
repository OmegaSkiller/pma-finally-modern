#!/usr/bin/env node
// One-time importer: copies the SCSS partials of phpMyAdmin's stock "bootstrap"
// theme and rewrites every hard-coded colour to a shadcn-style CSS custom
// property, so the same compiled CSS can serve both light and dark tokens.
//
// Usage: node scripts/import-base.mjs /path/to/phpMyAdmin-5.2.x/themes/bootstrap/scss

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('Usage: import-base.mjs <pma>/themes/bootstrap/scss');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/scss/base');
mkdirSync(out, { recursive: true });

const partials = [
  'common', 'navigation', 'designer', 'enum-editor', 'gis',
  'jqplot', 'print', 'tables', 'reboot', 'forms', 'breadcrumb',
];

const named = {
  // chromatic colours → semantic tokens
  '#235a81': 'var(--link)', '#00f': 'var(--link)', '#369': 'var(--link)',
  '#3a7ead': 'var(--link)', '#6676ff': 'var(--link)', '#009': 'var(--link)',
  '#007': 'var(--link)', '#87ceeb': 'var(--link)', '#7cf': 'var(--link)',
  '#f00': 'var(--destructive)', '#e00': 'var(--destructive)', '#a00': 'var(--destructive)',
  '#e32929': 'var(--destructive)', '#c83838': 'var(--destructive)', '#9a0000': 'var(--destructive)',
  '#800': 'var(--destructive)', '#a11': 'var(--destructive)', '#a44': 'var(--destructive)',
  '#944': 'var(--destructive)', 'rgb(148, 14, 14)': 'var(--destructive)',
  '#ffc': 'var(--highlight)', '#ffd700': 'var(--warning)', '#edec90': 'var(--highlight)',
  '#fbead9': 'var(--highlight)', '#fcc': 'var(--destructive-muted)',
  '#060': 'var(--success)', '#008000': 'var(--success)', '#396': 'var(--success)',
  '#f60': 'var(--warning)', '#f90': 'var(--warning)', '#de935f': 'var(--warning)',
  '#909': 'var(--chart-4)', '#808000': 'var(--chart-3)',
};

function hexLum(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Pick a neutral token from the property the colour is used for and its lightness.
function neutral(lum, prop) {
  const isBorder = /border|outline|box-shadow|column-rule/.test(prop);
  const isBg = /background/.test(prop);
  if (lum >= 0.99) return isBorder ? 'var(--border)' : 'var(--background)';
  if (lum <= 0.01) return isBorder ? 'var(--border-strong)' : 'var(--foreground)';
  if (isBorder) return lum < 0.5 ? 'var(--border-strong)' : 'var(--border)';
  if (isBg) {
    if (lum >= 0.9) return 'var(--muted)';
    if (lum >= 0.6) return 'var(--accent)';
    return 'var(--muted-foreground)';
  }
  // text colour
  if (lum >= 0.5) return 'var(--muted-foreground)';
  if (lum >= 0.3) return 'var(--muted-foreground)';
  return 'var(--foreground)';
}

function convertLine(line) {
  const prop = (line.match(/^\s*([a-z-]+)\s*:/) || [, ''])[1];

  // rgba($black|$white, a) → color-mix
  line = line.replace(/rgba\(\$(black|white),\s*([\d.]+)\)/g, (_, c, a) =>
    `color-mix(in oklab, var(--${c === 'black' ? 'foreground' : 'background'}) ${Math.round(a * 100)}%, transparent)`);
  line = line.replace(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g, (_, r, g, b, a) => {
    const lum = hexLum('#' + [r, g, b].map((n) => (+n).toString(16).padStart(2, '0')).join(''));
    const base = lum > 0.5 ? 'var(--background)' : 'var(--foreground)';
    return `color-mix(in oklab, ${base} ${Math.round(a * 100)}%, transparent)`;
  });

  for (const [k, v] of Object.entries(named)) {
    line = line.split(k + ';').join(v + ';').split(k + ' ').join(v + ' ').split(k + ',').join(v + ',').split(k + ')').join(v + ')');
  }

  line = line.replace(/\$white\b/g, () => neutral(1, prop));
  line = line.replace(/\$black\b/g, () => neutral(0, prop));
  line = line.replace(/\$gray-(\d00)\b/g, (_, n) => neutral(1 - n / 1000, prop));
  line = line.replace(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (hex) => neutral(hexLum(hex), prop));
  return line;
}

for (const name of partials) {
  const file = `_${name}.scss`;
  const text = readFileSync(join(src, file), 'utf8');
  const converted = text.split('\n').map(convertLine).join('\n');
  writeFileSync(join(out, file), `// Imported from phpMyAdmin themes/bootstrap/scss/${file} — colours mapped to tokens.\n${converted}`);
  console.log('imported', file);
}
