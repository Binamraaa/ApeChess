// Minimal UCI driver for the Stockfish npm build under Node. Dev tooling only:
// the app itself runs Stockfish in a Web Worker (src/engine/).
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export interface Line {
  /** Score from the side to move's point of view, in centipawns. Mates map to ±100000. */
  cp: number;
  mate?: number;
  pv: string[];
}

export class UciEngine {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private waiters: { test: (line: string) => boolean; resolve: (lines: string[]) => void; seen: string[] }[] = [];

  constructor() {
    const require = createRequire(import.meta.url);
    const pkg = dirname(require.resolve('stockfish/package.json'));
    this.proc = spawn(process.execPath, [join(pkg, 'bin', 'stockfish-19-lite-single.js')]);
    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      let nl: number;
      while ((nl = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        for (const w of [...this.waiters]) {
          w.seen.push(line);
          if (w.test(line)) {
            this.waiters.splice(this.waiters.indexOf(w), 1);
            w.resolve(w.seen);
          }
        }
      }
    });
  }

  private send(cmd: string) {
    this.proc.stdin.write(cmd + '\n');
  }

  private until(test: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve) => this.waiters.push({ test, resolve, seen: [] }));
  }

  async init() {
    const ok = this.until((l) => l === 'uciok');
    this.send('uci');
    await ok;
    await this.ready();
  }

  async ready() {
    const ok = this.until((l) => l === 'readyok');
    this.send('isready');
    await ok;
  }

  /** Top `multipv` lines for a position, best first. */
  async analyse(fen: string, depth: number, multipv = 2): Promise<Line[]> {
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send('ucinewgame');
    await this.ready();
    const done = this.until((l) => l.startsWith('bestmove'));
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const out = await done;

    const best = new Map<number, Line>();
    for (const l of out) {
      const m = l.match(/^info depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/);
      if (!m || Number(m[1]) !== depth) continue;
      const kind = m[3];
      const val = Number(m[4]);
      const cp = kind === 'cp' ? val : Math.sign(val) * (100000 - Math.abs(val));
      best.set(Number(m[2]), { cp, mate: kind === 'mate' ? val : undefined, pv: m[5].split(' ') });
    }
    return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line);
  }

  quit() {
    this.send('quit');
    this.proc.kill();
  }
}
