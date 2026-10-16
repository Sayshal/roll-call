import { MODULE } from '../constants.mjs';
import { baseAdapter } from './base.mjs';
import { dnd5eAdapter } from './dnd5e.mjs';

/** @type {Map<string, object>} System id -> adapter overrides. */
const adapters = new Map([[dnd5eAdapter.id, dnd5eAdapter]]);

/** @type {object} Adapter chosen at setup. */
let activeAdapter = baseAdapter;

/**
 * Register an adapter for a system, inside the `rollCall.registerAdapters` hook.
 * @param {string} systemId System id the adapter serves.
 * @param {object} adapter Adapter members overriding the base adapter.
 */
export function registerAdapter(systemId, adapter) {
  adapters.set(systemId, adapter);
}

/**
 * Collect third-party adapters, pick the one for the current system and let it hook into its system.
 * @param {object} api Public API passed to the registration hook.
 */
export function resolveAdapter(api) {
  Hooks.callAll(MODULE.HOOKS.REGISTER_ADAPTERS, api);
  const system = adapters.get(game.system.id);
  activeAdapter = system ? { ...baseAdapter, ...system, id: system.id ?? game.system.id } : baseAdapter;
  activeAdapter.setup();
  ATLAS.log(3, `Adapter resolved: ${activeAdapter.id}`);
}

/**
 * The active system adapter.
 * @returns {object} Adapter.
 */
export function getAdapter() {
  return activeAdapter;
}
