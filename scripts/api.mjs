import { getAdapter, registerAdapter } from './adapters/registry.mjs';
import { MODULE } from './constants.mjs';

/** @type {object} Public Roll Call API. */
export const RollCallAPI = {
  registerAdapter,
  /** @returns {object} The active system adapter. */
  get adapter() {
    return getAdapter();
  }
};

/** Expose the API on the module and as `globalThis.ROLLCALL`. */
export function createGlobalNamespace() {
  globalThis.ROLLCALL = { api: RollCallAPI };
  game.modules.get(MODULE.ID).api = RollCallAPI;
}
