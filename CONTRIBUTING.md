# Contributing

Issues and pull requests are welcome.

## Setup

Requires Node 20+.

```bash
npm install
npm run build
```

To try changes, point a local phpMyAdmin 5.2 at the output:

```bash
ln -s "$PWD/dist/finally-modern" /path/to/phpMyAdmin/themes/finally-modern
```

Rebuild after each change and hard-reload the page.

## Where things live

| Path | Purpose |
| --- | --- |
| `src/tailwind/tokens-*.css` | Colour tokens per mode. Start here to retheme. |
| `src/tailwind/*.css` | Design layer: Tailwind `@apply` on phpMyAdmin selectors |
| `src/icons.mjs` | phpMyAdmin icon id → Lucide icon name |
| `src/scss/` | Bootstrap config and tokenised phpMyAdmin layout partials |
| `static/` | Files copied as-is into each theme (fonts, fallback images, jQuery UI assets) |
| `build.mjs` | Build pipeline |

`src/scss/base/` was generated from phpMyAdmin's stock `bootstrap` theme by
`scripts/import-base.mjs`. To pull in a newer phpMyAdmin base, re-run it, then review the diff.

## Guidelines

- Use colour tokens (`var(--foreground)` and friends), never hard-coded colours.
- Check both light and dark before opening a PR; attach screenshots for visual changes.
- Keep rows compact and don't rely on colour alone to convey meaning.
- Run `npm run build` and make sure it passes.

## Releasing

Bump `version` in `package.json` and add a `CHANGELOG.md` entry, then tag and push:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

The Release workflow builds the zips and publishes them on GitHub.
