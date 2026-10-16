import { MODULE } from '../constants.mjs';
import { viewedCombat } from '../utils/_module.mjs';

/** Turn keybindings: GM next and previous turn, and end turn for the active combatant's owner. Unbound by default. */
export class Keybindings {
  /** Register the keybindings. */
  static register() {
    const register = (action, name, onDown, restricted) =>
      game.keybindings.register(MODULE.ID, action, {
        name,
        editable: [],
        onDown,
        restricted,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
      });
    register(MODULE.KEYBINDINGS.NEXT_TURN, 'ROLLCALL.Keybindings.NextTurn.Name', () => Keybindings.#turn('nextTurn'), true);
    register(MODULE.KEYBINDINGS.PREVIOUS_TURN, 'ROLLCALL.Keybindings.PreviousTurn.Name', () => Keybindings.#turn('previousTurn'), true);
    register(MODULE.KEYBINDINGS.END_TURN, 'ROLLCALL.Keybindings.EndTurn.Name', Keybindings.#endTurn, false);
  }

  /**
   * Advance or rewind the viewed combat's turn.
   * @param {string} method `nextTurn` or `previousTurn`.
   * @returns {boolean} Whether the key was handled.
   */
  static #turn(method) {
    const combat = viewedCombat();
    if (!combat?.started) return false;
    combat[method]();
    return true;
  }

  /**
   * End the viewed combat's turn when this user owns the active combatant.
   * @returns {boolean} Whether the key was handled.
   */
  static #endTurn() {
    const combat = viewedCombat();
    if (!combat?.started || !combat.combatant?.isOwner) return false;
    combat.nextTurn();
    return true;
  }
}
