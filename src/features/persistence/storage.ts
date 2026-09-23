import type { PersistedStateV1 } from "../scheduling/types";
import { validatePersistedState } from "../scheduling/validation";

/**
 * ============================================================================
 *  SAVING TO (AND LOADING FROM) THE BROWSER
 * ============================================================================
 * ShiftFit has no server and no database — everything lives in this one
 * browser, in a feature called `localStorage` (a small key/value store every
 * browser gives each website). This file is the only place that talks to it.
 * Whatever comes back out is re-validated (`validatePersistedState`, see
 * `../scheduling/validation.ts`) before it's trusted, in case it was hand-
 * edited or left over from an older version of the app.
 */

export const STORAGE_KEY = "shiftfit:state";
const CURRENT_VERSION = 1;

export type StorageAdapter = {
  load(): PersistedStateV1 | null;
  /** Returns false when the browser refused the write (full, blocked, private mode). */
  save(state: PersistedStateV1): boolean;
  clear(): void;
};

/**
 * Versioned localStorage-backed persistence. Everything read back is validated, so
 * corrupted or hand-edited storage can never poison app state — it is treated like a
 * bad import and ignored.
 */
function createLocalStorageAdapter(): StorageAdapter {
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const result = validatePersistedState(migrate(JSON.parse(raw)));
        if (!result.ok) {
          console.warn("ShiftFit: ignoring unreadable saved data.");
          return null;
        }
        return result.value;
      } catch {
        console.warn("ShiftFit: could not read saved data.");
        return null;
      }
    },
    save(state) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* nothing to clear if storage is unavailable */
      }
    },
  };
}

/** Upgrades older saved blobs. Version 1 is the only shape so far; unversioned data is treated as v1. */
function migrate(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && !("version" in raw)) {
    return { ...raw, version: CURRENT_VERSION };
  }
  return raw;
}

export const storage: StorageAdapter = createLocalStorageAdapter();

export function exportBackup(state: PersistedStateV1): string {
  return JSON.stringify(state, null, 2);
}

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export function parseBackup(json: string): ReturnType<typeof validatePersistedState> {
  if (json.length > MAX_BACKUP_BYTES) return { ok: false, errors: ["That file is too large to be a ShiftFit backup."] };
  try {
    return validatePersistedState(migrate(JSON.parse(json)));
  } catch {
    return { ok: false, errors: ["That file isn't valid JSON."] };
  }
}
