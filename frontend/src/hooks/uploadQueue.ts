import type { ImportResult, UploadOutcome } from '../types/imports';

// "pending" and "uploading" exist only in the browser; the rest come from the API.
export type ItemStatus = 'pending' | 'uploading' | ImportResult['status'];

export type QueueItem = {
  id: string;
  file: File;
  status: ItemStatus;
  result: ImportResult | null;
};

export type QueuePhase = 'idle' | 'running' | 'done';

export type QueueState = {
  phase: QueuePhase;
  year: number | null;
  items: QueueItem[];
};

export type QueueAction =
  | { type: 'start'; items: QueueItem[]; year: number }
  | { type: 'uploading'; id: string }
  | { type: 'finished'; id: string; result: ImportResult }
  | { type: 'complete' }
  | { type: 'reset' };

export type QueueSummary = Record<ItemStatus, number> & { total: number };

export const initialQueueState: QueueState = {
  phase: 'idle',
  year: null,
  items: [],
};

// Index in the id keeps it unique even if two files share a name.
export function createQueueItems(files: File[]): QueueItem[] {
  return files.map((file, index) => ({
    id: `${index}-${file.name}`,
    file,
    status: 'pending',
    result: null,
  }));
}

function updateItem(items: QueueItem[], id: string, changes: Partial<QueueItem>): QueueItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...changes } : item));
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'start':
      return { phase: 'running', year: action.year, items: action.items };
    case 'uploading':
      return {
        ...state,
        items: updateItem(state.items, action.id, { status: 'uploading' }),
      };
    case 'finished':
      return {
        ...state,
        items: updateItem(state.items, action.id, {
          status: action.result.status,
          result: action.result,
        }),
      };
    case 'complete':
      return { ...state, phase: 'done' };
    case 'reset':
      return initialQueueState;
    default: {
      // If a new action type is added but not handled, this line fails to compile.
      const unhandled: never = action;
      return unhandled;
    }
  }
}

export function summarize(items: QueueItem[]): QueueSummary {
  const summary: QueueSummary = {
    total: items.length,
    pending: 0,
    uploading: 0,
    imported: 0,
    skipped: 0,
    error: 0,
  };
  for (const item of items) {
    summary[item.status] += 1;
  }
  return summary;
}

// Used when something fails in the browser itself (should not happen, since
// uploadImport never throws, but the queue must never get stuck on "uploading").
export function clientErrorResult(filename: string, message: string): ImportResult {
  return {
    filename,
    status: 'error',
    event_id: null,
    event_date: null,
    client_name: null,
    message,
    warnings: [],
  };
}

/**
 * Converts any UploadOutcome into a displayable ImportResult.
 * Non-contract outcomes become "error" rows, so the queue has a single shape to render.
 */
export function outcomeToResult(filename: string, outcome: UploadOutcome): ImportResult {
  switch (outcome.kind) {
    case 'result':
      return outcome.body;
    case 'network-error':
      return clientErrorResult(filename, outcome.message);
    case 'unexpected-response':
      return clientErrorResult(filename, outcome.message);
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}
