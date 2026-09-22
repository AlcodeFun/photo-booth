import { useCallback, useReducer } from 'react';
import { FrameTemplateConfig } from '@photo-booth/types';

const MAX_HISTORY = 60;

interface HistoryState {
  present: FrameTemplateConfig;
  past: FrameTemplateConfig[];
  future: FrameTemplateConfig[];
  version: number;
}

type HistoryAction =
  | { type: 'commit'; updater: (current: FrameTemplateConfig) => FrameTemplateConfig }
  | { type: 'replace'; updater: (current: FrameTemplateConfig) => FrameTemplateConfig }
  | { type: 'snapshot' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; snapshot: FrameTemplateConfig };

const reducer = (state: HistoryState, action: HistoryAction): HistoryState => {
  switch (action.type) {
    case 'commit': {
      const next = action.updater(state.present);
      if (next === state.present) {
        return state;
      }
      return {
        present: next,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        future: [],
        version: state.version + 1,
      };
    }
    case 'replace': {
      const next = action.updater(state.present);
      if (next === state.present) {
        return state;
      }
      return { ...state, present: next };
    }
    case 'snapshot': {
      return {
        ...state,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        future: [],
        version: state.version + 1,
      };
    }
    case 'undo': {
      if (state.past.length === 0) {
        return state;
      }
      const previous = state.past[state.past.length - 1];
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, state.present],
        version: state.version + 1,
      };
    }
    case 'redo': {
      if (state.future.length === 0) {
        return state;
      }
      const next = state.future[state.future.length - 1];
      return {
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(0, -1),
        version: state.version + 1,
      };
    }
    case 'reset': {
      return { present: action.snapshot, past: [], future: [], version: state.version + 1 };
    }
    default:
      return state;
  }
};

export const useFrameHistory = (initial: FrameTemplateConfig) => {
  const [state, dispatch] = useReducer(reducer, initial, (present) => ({
    present,
    past: [],
    future: [],
    version: 0,
  }));

  const commit = useCallback((updater: (current: FrameTemplateConfig) => FrameTemplateConfig) => {
    dispatch({ type: 'commit', updater });
  }, []);

  const replace = useCallback((updater: (current: FrameTemplateConfig) => FrameTemplateConfig) => {
    dispatch({ type: 'replace', updater });
  }, []);

  const snapshot = useCallback(() => {
    dispatch({ type: 'snapshot' });
  }, []);

  const reset = useCallback((next: FrameTemplateConfig) => {
    dispatch({ type: 'reset', snapshot: next });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'undo' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'redo' });
  }, []);

  return {
    template: state.present,
    commit,
    replace,
    snapshot,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    version: state.version,
  };
};