import { MODULE } from '../constants.mjs';

/** Copies a token's hidden state to its combatants whenever the token is hidden or shown. */
export class HiddenSync {
  /** Watch token updates. */
  static register() {
    Hooks.on('updateToken', HiddenSync.#onUpdateToken);
  }

  /**
   * On the primary GM, match the hidden state of the token's combatants in every combat, skipping those Hide Until Seen still holds.
   * @param {TokenDocument} token The updated token.
   * @param {object} changes The changes.
   */
  static #onUpdateToken(token, changes) {
    if (!('hidden' in changes) || !ATLAS.isPrimaryGM) return;
    for (const combat of game.combats) {
      const updates = combat.combatants
        .filter((combatant) => combatant.token === token && combatant.hidden !== token.hidden && !combatant.getFlag(MODULE.ID, MODULE.FLAGS.AUTO_HIDDEN))
        .map((combatant) => ({ _id: combatant.id, hidden: token.hidden }));
      if (updates.length) combat.updateEmbeddedDocuments('Combatant', updates);
    }
  }
}
