// Stockfish (lite, single-threaded WASM) in a Web Worker, for the engine levels. Loaded on first use only.

export interface EngineMove {
  uci: string;
  /** Score for the side to move, in centipawns; mates are ±100000 minus the distance. */
  cp: number;
}

class Engine {
  private worker: Worker;
  private listeners: ((line: string) => void)[] = [];
  private failures: ((e: Error) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;

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

  /** Best move for the side to move. Requests run one at a time. */
  bestMove(fen: string, depth = 12): Promise<EngineMove> {
    const run = async () => {
      await this.ready;
      this.worker.postMessage(`position fen ${fen}`);
      const out = await this.send(`go depth ${depth}`, (l) => l.startsWith('bestmove'));
      const uci = out.at(-1)!.split(' ')[1];
      let cp = 0;
      for (const l of out) {
        const m = l.match(/score (cp|mate) (-?\d+)/);
        if (m) cp = m[1] === 'cp' ? Number(m[2]) : Math.sign(Number(m[2])) * (100000 - Math.abs(Number(m[2])));
      }
      return { uci, cp };
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

let shared: Engine | undefined;

/** The app's single engine instance, started on first use. */
export function engine(): Engine {
  shared ??= new Engine();
  return shared;
}
