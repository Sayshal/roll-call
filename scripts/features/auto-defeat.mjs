import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';
import { toggleDefeated } from '../utils/_module.mjs';

/** Marks combatants defeated when their health reaches zero, for systems that don't do it themselves. */
export class AutoDefeat {
  /** Watch actor updates on the primary GM when the setting is on. The setting is only shown for systems without their own auto-defeat. */
  static register() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.AUTO_DEFEAT)) return;
    Hooks.on('updateActor', AutoDefeat.#onUpdateActor);
  }

  /**
   * Mark the actor's undefeated combatants in started combats defeated when its health is zero.
   * @param {Actor} actor The updated actor.
   */
  static #onUpdateActor(actor) {
    const adapter = getAdapter();
    if (!ATLAS.isPrimaryGM || adapter.provides.autoDefeat || !game.settings.get(MODULE.ID, MODULE.SETTINGS.AUTO_DEFEAT)) return;
    if (adapter.healthFraction(actor) !== 0) return;
    for (const combat of game.combats) {
      if (!combat.started) continue;
      for (const combatant of combat.combatants) if (combatant.actor === actor && !adapter.isDefeated(combatant)) toggleDefeated(combatant);
    }
  }
}
