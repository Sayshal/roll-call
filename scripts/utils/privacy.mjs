import { MODULE } from '../constants.mjs';
import { combatantDisposition } from './combat.mjs';

/** @type {Object<number, string>} Token disposition to its constant name, e.g. `-1` to `HOSTILE`. */
const DISPOSITION_NAMES = foundry.utils.invertObject(CONST.TOKEN_DISPOSITIONS);

/**
 * Whether a user may see an element of a combatant. Always true while the Privacy feature is off; GMs and owners see everything.
 * @param {User} viewer The viewing user.
 * @param {Combatant} combatant The combatant.
 * @param {string} element One of `name`, `health` (exact values), `estimate` (health bucket), `initiative`, `effects`.
 * @returns {boolean} Visibility.
 */
export function canSee(viewer, combatant, element) {
  if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.PRIVACY_ENABLED)) return true;
  if (viewer.isGM || combatant.testUserPermission(viewer, 'OWNER')) return true;
  if (combatant.hidden) return false;
  const rule = game.settings.get(MODULE.ID, MODULE.SETTINGS.PRIVACY_RULES)[DISPOSITION_NAMES[combatantDisposition(combatant)].toLowerCase()];
  if (element === 'health') return rule.health === 'exact';
  if (element === 'estimate') return rule.health !== 'hidden';
  return rule[element];
}

/**
 * Combatant name as a user may see it, masked by the GM's chosen mode when Privacy hides the name.
 * @param {User} viewer The viewing user.
 * @param {Combatant} combatant The combatant.
 * @returns {string} Display name.
 */
export function displayName(viewer, combatant) {
  if (canSee(viewer, combatant, 'name')) return combatant.name;
  const mode = game.settings.get(MODULE.ID, MODULE.SETTINGS.NAME_MASK);
  const masked = { token: combatant.token?.name, actor: combatant.actor?.name }[mode];
  return masked ?? _loc('ROLLCALL.Privacy.Unknown');
}
