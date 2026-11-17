// Renders the brand logo to the 1024x1024 PNG that electron-builder turns into the app icon.
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ICON_SIZE = 1024;
// macOS icons sit inside a margin; a full-bleed square looks oversized in the Dock
const ARTWORK_SIZE = 824;
// sharp reads an SVG at 72 dpi unless told otherwise
const SVG_DEFAULT_DENSITY = 72;
const MAX_DENSITY = 2400;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src/assets/brand/logo.svg');
const outputDir = path.join(root, 'build');
const output = path.join(outputDir, 'icon.png');

if (!existsSync(source)) {
  console.error(`Logo not found: ${source}`);
  process.exit(1);
}

try {
  mkdirSync(outputDir, { recursive: true });
  const padding = (ICON_SIZE - ARTWORK_SIZE) / 2;
  // Rasterise at about twice the artwork size whatever the SVG's own size: a fixed
  // density overflows sharp's pixel limit for a large logo and blurs a tiny one
  const { width = ARTWORK_SIZE, height = ARTWORK_SIZE } = await sharp(source).metadata();
  const density = Math.max(1, Math.min(MAX_DENSITY, (SVG_DEFAULT_DENSITY * ARTWORK_SIZE * 2) / Math.max(width, height)));
  await sharp(source, { density })
    .resize(ARTWORK_SIZE, ARTWORK_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(output);
  console.error(`Wrote ${path.relative(root, output)}`);
} catch (error) {
  console.error(`Could not build the app icon: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
