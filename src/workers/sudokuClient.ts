import { generate } from '@/core/generator';
import type { Board, Difficulty, Puzzle } from '@/core/types';
import { runSolve } from './solveRunner';
import type { SolveProgress, SolveSpeed, WorkerRequest, WorkerResponse } from './protocol';

export interface SolveCallbacks {
  onProgress?: (progress: SolveProgress) => void;
  onSolved?: (progress: SolveProgress) => void;
  onFailed?: (progress: SolveProgress) => void;
  onCancelled?: () => void;
  onError?: (message: string) => void;
}

export interface SudokuClient {
  generate: (difficulty: Difficulty) => Promise<Puzzle>;
  solve: (board: Board, speed: SolveSpeed, callbacks: SolveCallbacks) => number;
  cancel: (requestId: number) => void;
  dispose: () => void;
}

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;

  try {
    // This exact `new URL(..., import.meta.url)` form is what lets Vite find
    // and bundle the worker — a computed path would not be statically analysable.
    return new Worker(new URL('./sudoku.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

export function createSudokuClient(): SudokuClient {
  const worker = createWorker();

  let nextRequestId = 1;
  const solveCallbacks = new Map<number, SolveCallbacks>();
  const generateResolvers = new Map<number, (puzzle: Puzzle) => void>();
  const generateRejecters = new Map<number, (error: Error) => void>();
  // Only used by the no-worker fallback.
  const locallyCancelled = new Set<number>();

  function settleSolve(requestId: number, run: (callbacks: SolveCallbacks) => void): void {
    const callbacks = solveCallbacks.get(requestId);
    if (!callbacks) return;
    solveCallbacks.delete(requestId);
    run(callbacks);
  }

  if (worker) {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      switch (message.type) {
        case 'generated': {
          generateResolvers.get(message.requestId)?.({
            puzzle: message.puzzle,
            solution: message.solution,
          });
          generateResolvers.delete(message.requestId);
          generateRejecters.delete(message.requestId);
          return;
        }
        case 'progress':
          solveCallbacks.get(message.requestId)?.onProgress?.(message);
          return;
        case 'solved':
          settleSolve(message.requestId, (cb) => cb.onSolved?.(message));
          return;
        case 'failed':
          settleSolve(message.requestId, (cb) => cb.onFailed?.(message));
          return;
        case 'cancelled':
          settleSolve(message.requestId, (cb) => cb.onCancelled?.());
          return;
        case 'error': {
          generateRejecters.get(message.requestId)?.(new Error(message.message));
          generateRejecters.delete(message.requestId);
          generateResolvers.delete(message.requestId);
          settleSolve(message.requestId, (cb) => cb.onError?.(message.message));
          return;
        }
      }
    };
  }

  function send(request: WorkerRequest): void {
    worker?.postMessage(request);
  }

  return {
    generate(difficulty) {
      const requestId = nextRequestId++;

      // Without a worker, generation is fast enough (single-digit ms) to run
      // inline — it is the streaming solve that would block, not this.
      if (!worker) return Promise.resolve(generate(difficulty));

      return new Promise<Puzzle>((resolve, reject) => {
        generateResolvers.set(requestId, resolve);
        generateRejecters.set(requestId, reject);
        send({ type: 'generate', requestId, difficulty });
      });
    },

    solve(board, speed, callbacks) {
      const requestId = nextRequestId++;
      solveCallbacks.set(requestId, callbacks);

      if (worker) {
        send({ type: 'solve', requestId, board, speed });
        return requestId;
      }

      // Fallback: same paced runner, just on this thread. It still yields
      // between batches, so the UI keeps painting — just with less headroom.
      void runSolve(Uint8Array.from(board), speed, {
        isCancelled: () => locallyCancelled.has(requestId),
        onCancelled: () => {
          locallyCancelled.delete(requestId);
          settleSolve(requestId, (cb) => cb.onCancelled?.());
        },
        onProgress: (progress) => solveCallbacks.get(requestId)?.onProgress?.(progress),
        onDone: (solved, progress) =>
          settleSolve(requestId, (cb) =>
            solved ? cb.onSolved?.(progress) : cb.onFailed?.(progress),
          ),
      }).catch((error: unknown) => {
        settleSolve(requestId, (cb) =>
          cb.onError?.(error instanceof Error ? error.message : String(error)),
        );
      });

      return requestId;
    },

    cancel(requestId) {
      locallyCancelled.add(requestId);
      send({ type: 'cancel', requestId });
    },

    dispose() {
      worker?.terminate();
      solveCallbacks.clear();
      generateResolvers.clear();
      generateRejecters.clear();
      locallyCancelled.clear();
    },
  };
}
