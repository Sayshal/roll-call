import { getAdapter } from '../adapters/registry.mjs';

/**
 * The combat shown in the core tracker, falling back to the active one.
 * @returns {Combat|null} Viewed combat.
 */
export function viewedCombat() {
  return ui.combat?.viewed ?? game.combat ?? null;
}

/**
 * A combatant's token disposition, falling back to its actor's prototype token.
 * @param {Combatant} combatant The combatant.
 * @returns {number} A `CONST.TOKEN_DISPOSITIONS` value.
 */
export function combatantDisposition(combatant) {
  return combatant.token?.disposition ?? combatant.actor?.prototypeToken.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
}

/**
 * The combatant an element belongs to, read from the nearest `data-combatant-id`.
 * @param {HTMLElement} target Element inside a combatant's card or row.
 * @param {Combat|null} [combat] Combat to look in; the viewed combat by default.
 * @returns {Combatant|undefined} The combatant.
 */
export function combatantFor(target, combat = viewedCombat()) {
  return combat?.combatants.get(target.closest('[data-combatant-id]')?.dataset.combatantId);
}

/**
 * Whether a combatant fights on the players' side: owned by a player or friendly.
 * @param {Combatant} combatant The combatant.
 * @returns {boolean} Whether it is an ally.
 */
export function isAlly(combatant) {
  return combatant.hasPlayerOwner || combatantDisposition(combatant) === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
}

/**
 * Living allies and living hostile combatants that are not hidden.
 * @param {Combat} combat The combat.
 * @returns {{allies: number, enemies: number}} Counts.
 */
export function sideCounts(combat) {
  const alive = combat.combatants.filter((combatant) => !getAdapter().isDefeated(combatant));
  return {
    allies: alive.filter(isAlly).length,
    enemies: alive.filter((combatant) => !isAlly(combatant) && combatantDisposition(combatant) === CONST.TOKEN_DISPOSITIONS.HOSTILE && !combatant.hidden).length
  };
}
