import { MODULE } from '../constants.mjs';
import { combatClock, nudge } from '../utils/_module.mjs';

/** Runs the GM-chosen action once when the active combat's turn clock reaches zero. */
export class TurnTimer {
  /** @type {string|null} Round and turn key of the last expiry handled, so each turn expires once. */
  static #expired = null;

  /**
   * Check the turn clock every second on the primary GM.
   */
  static register() {
    if (game.settings.get(MODULE.ID, MODULE.SETTINGS.TURN_EXPIRY) === 'nothing') return;
    Hooks.once('ready', () => setInterval(TurnTimer.#check, 1000));
  }

  /** On the primary GM, run the expiry action when the active combat's turn clock has run out. */
  static #check() {
    if (!ATLAS.isPrimaryGM) return;
    const action = game.settings.get(MODULE.ID, MODULE.SETTINGS.TURN_EXPIRY);
    const duration = game.settings.get(MODULE.ID, MODULE.SETTINGS.TURN_DURATION);
    const combat = game.combat;
    if (action === 'nothing' || !duration || !combat?.started || !combat.combatant) return;
    const clock = combatClock(combat);
    if (!clock || clock.turn < duration * 1000 || combat.getFlag(MODULE.ID, MODULE.FLAGS.CLOCK)?.turnKey !== `${combat.round}.${combat.turn}`) return;
    const key = `${combat.id}.${combat.round}.${combat.turn}`;
    if (key === TurnTimer.#expired) return;
    TurnTimer.#expired = key;
    if (action === 'endTurn') combat.nextTurn();
    else nudge(combat.combatant);
  }
}
