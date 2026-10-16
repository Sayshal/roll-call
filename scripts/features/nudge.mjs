import { MODULE } from '../constants.mjs';
import { canNudge, combatantFor, nudge } from '../utils/_module.mjs';

/** GM "Nudge Player" entry in the combatant context menu, shared by the core tracker and the dock. */
export class Nudge {
  /** Add the context menu entry when the feature is enabled. */
  static register() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.NUDGE_ENABLED)) return;
    Hooks.on('getCombatTrackerContextOptions', Nudge.#addEntry);
  }

  /**
   * Append the nudge entry.
   * @param {foundry.applications.sidebar.tabs.CombatTracker} tracker The core tracker.
   * @param {object[]} entries Context menu entries.
   */
  static #addEntry(tracker, entries) {
    entries.push({
      label: 'ROLLCALL.Nudge.Action',
      icon: 'fa-solid fa-bell',
      visible: (target) => game.user.isGM && game.settings.get(MODULE.ID, MODULE.SETTINGS.NUDGE_ENABLED) && canNudge(combatantFor(target, tracker.viewed)),
      onClick: (_event, target) => nudge(combatantFor(target, tracker.viewed))
    });
  }
}
