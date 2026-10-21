// Copies the single-threaded "lite" Stockfish build (GPL-3.0) into public/stockfish/ so the app can run it
// in a Web Worker (Level 18). Runs before dev and build; the copy is gitignored.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const bin = join(dirname(require.resolve('stockfish/package.json')), 'bin');
const out = join(import.meta.dirname, '..', 'public', 'stockfish');
mkdirSync(out, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copyFileSync(join(bin, f), join(out, f));
console.log('Stockfish copied to public/stockfish/');
