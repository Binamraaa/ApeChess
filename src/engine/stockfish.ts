// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

// Stockfish (lite, single-threaded WASM) in a Web Worker, for the engine levels. Loaded on first use only.

export interface EngineMove {
  uci: string;
  /** Score for the side to move, in centipawns; mates are ±100000 minus the distance. */
  cp: number;
}

export interface SearchOptions {
  depth?: number;
  /** Think for this long instead of to a depth, in milliseconds. */
  movetime?: number;
  /** Play at about this Elo (Stockfish's UCI_Elo, 1320–3190) instead of full strength. */
  elo?: number;
  /** How many best lines to report (MultiPV). */
  lines?: number;
}

export interface SearchResult extends EngineMove {
  /** The best lines, best first: each line's first move and score for the side to move. */
  lines: EngineMove[];
}

const scoreOf = (kind: string, n: number) => (kind === 'cp' ? n : Math.sign(n) * (100000 - Math.abs(n)));

class Engine {
  private worker: Worker;
  private listeners: ((line: string) => void)[] = [];
  private failures: ((e: Error) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  /** Options as last sent, so they're only sent when they change. */
  private options = { elo: 0, lines: 1 };

  constructor() {
    this.worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
    this.worker.onmessage = (e: MessageEvent<string>) => {
      for (const l of [...this.listeners]) l(String(e.data));
    };
    // If the engine dies, fail what's pending and start a fresh one next time.
    this.worker.onerror = () => {
      for (const f of this.failures.splice(0)) f(new Error('Engine stopped'));
      this.listeners = [];
      this.worker.terminate();
      if (shared === this) shared = undefined;
    };
    this.ready = (async () => {
      await this.send('uci', (l) => l === 'uciok');
      await this.send('isready', (l) => l === 'readyok');
    })();
  }

  private send(cmd: string, until: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const seen: string[] = [];
      const listen = (line: string) => {
        seen.push(line);
        if (until(line)) {
          this.listeners.splice(this.listeners.indexOf(listen), 1);
          this.failures.splice(this.failures.indexOf(reject), 1);
          resolve(seen);
        }
      };
      this.listeners.push(listen);
      this.failures.push(reject);
      this.worker.postMessage(cmd);
    });
  }

  /** Runs one job at a time, in order. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = this.queue.then(job, job);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Best move for the side to move. */
  async bestMove(fen: string, depth = 12): Promise<EngineMove> {
    const { uci, cp } = await this.search(fen, { depth });
    return { uci, cp };
  }

  /**
   * Searches the position. With `elo`, the move is the one Stockfish would play at that strength
   * (the scores are still its own full search's).
   */
  search(fen: string, { depth, movetime, elo = 0, lines = 1 }: SearchOptions): Promise<SearchResult> {
    return this.enqueue(async () => {
      await this.ready;
      if (elo !== this.options.elo || lines !== this.options.lines) {
        this.worker.postMessage(`setoption name UCI_LimitStrength value ${elo > 0}`);
        if (elo > 0) this.worker.postMessage(`setoption name UCI_Elo value ${elo}`);
        this.worker.postMessage(`setoption name MultiPV value ${lines}`);
        await this.send('isready', (l) => l === 'readyok');
        this.options = { elo, lines };
      }
      this.worker.postMessage(`position fen ${fen}`);
      const go = movetime ? `go movetime ${movetime}` : `go depth ${depth ?? 12}`;
      const out = await this.send(go, (l) => l.startsWith('bestmove'));
      const best: EngineMove[] = [];
      for (const l of out) {
        const m = l.match(/ multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/);
        if (m) best[Number(m[1]) - 1] = { uci: m[4], cp: scoreOf(m[2], Number(m[3])) };
      }
      const uci = out.at(-1)!.split(' ')[1];
      const found = best.filter(Boolean);
      return { uci, cp: found[0]?.cp ?? 0, lines: found };
    });
  }

  /** Tells the engine a new game starts, so nothing from an old one carries over. */
  newGame(): Promise<void> {
    return this.enqueue(async () => {
      await this.ready;
      this.worker.postMessage('ucinewgame');
      await this.send('isready', (l) => l === 'readyok');
    });
  }
}

let shared: Engine | undefined;

/** The app's single engine instance, started on first use. */
export function engine(): Engine {
  shared ??= new Engine();
  return shared;
}
