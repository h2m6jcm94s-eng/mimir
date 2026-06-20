#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = dirname(__dirname);
const src = join(root, 'src');
const dist = join(root, 'dist');

const watch = process.argv.includes('--watch');

if (existsSync(dist)) {
  rmSync(dist, { recursive: true });
}
mkdirSync(dist, { recursive: true });

const entries = ['background.ts', 'content.ts', 'options.ts'];

async function bundle() {
  await build({
    entryPoints: entries.map((e) => join(src, e)),
    outdir: dist,
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    sourcemap: true,
    minify: !watch,
    logLevel: 'info',
  });

  copyFileSync(join(src, 'manifest.json'), join(dist, 'manifest.json'));
  copyFileSync(join(src, 'options.html'), join(dist, 'options.html'));
}

await bundle();

if (watch) {
  // build feedback omitted to keep lint clean
}
