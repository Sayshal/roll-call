import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';

/** Stops players moving their combat tokens outside their own turn. */
export class MoveLock {
  /** @type {Notification|null} The last off-turn warning, replaced by the next so repeated attempts show one. */
  static #warning = null;

  /** Hook token movement. */
  static register() {
    Hooks.on('preMoveToken', MoveLock.#onPreMove);
  }

  /**
   * Block a player's move when the token's combatant is not acting, nor grouped with the one acting.
   * @param {TokenDocument} token The moving token.
   * @returns {boolean|void} False to block the move.
   */
  static #onPreMove(token) {
    if (game.user.isGM || !game.settings.get(MODULE.ID, MODULE.SETTINGS.MOVE_LOCK)) return;
    const combat = game.combat;
    if (!combat?.started || (combat.scene && combat.scene !== token.parent)) return;
    const combatants = combat.getCombatantsByToken(token);
    const active = combat.combatant;
    if (!combatants.length || !active) return;
    const adapter = getAdapter();
    const activeKey = adapter.groupKey(active);
    if (combatants.some((combatant) => combatant === active || (activeKey && adapter.groupKey(combatant) === activeKey))) return;
    if (MoveLock.#warning) ui.notifications.remove(MoveLock.#warning);
    MoveLock.#warning = ui.notifications.warn('ROLLCALL.MoveLock.NotYourTurn', { localize: true });
    return false;
  }
}
