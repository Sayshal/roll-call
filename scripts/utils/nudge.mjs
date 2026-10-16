import { MODULE } from '../constants.mjs';
import { announce } from './announce.mjs';
import { playCombatSound } from './core-actions.mjs';

/** @type {object|null} ATLAS registration handle used to relay nudges. */
let relay = null;

/**
 * Listen for nudges aimed at this user. Runs whether or not the Nudge feature is on, since the turn timer also nudges.
 * @param {object} atlas ATLAS registration handle.
 */
export function registerNudge(atlas) {
  relay = atlas;
  Hooks.on(MODULE.RELAY.NUDGE, onNudge);
}

/**
 * Whether a combatant can be nudged: the active combatant of a started combat with a player owner.
 * @param {Combatant|undefined} combatant The combatant.
 * @returns {boolean} Whether the nudge applies.
 */
export function canNudge(combatant) {
  return !!combatant?.parent.started && combatant.parent.combatant === combatant && combatant.hasPlayerOwner;
}

/**
 * Alert the players who own a combatant that it is their turn: sound, banner, glow and a whisper.
 * @param {Combatant} combatant The combatant whose players are nudged.
 */
export function nudge(combatant) {
  const userIds = combatant.players.map((user) => user.id);
  if (!userIds.length) return;
  relay.broadcast(MODULE.RELAY.NUDGE, combatant.parent.id, combatant.id, userIds);
  ChatMessage.implementation.create({ content: _loc('ROLLCALL.Nudge.Whisper', { name: combatant.name }), whisper: userIds });
}

/**
 * Play the nudge for this user when it is one of the targets.
 * @param {string} combatId Combat id.
 * @param {string} combatantId Nudged combatant id.
 * @param {string[]} userIds Target user ids.
 */
function onNudge(combatId, combatantId, userIds) {
  if (!userIds.includes(game.user.id)) return;
  const combat = game.combats.get(combatId);
  const combatant = combat?.combatants.get(combatantId);
  if (!combatant) return;
  playCombatSound(combat, 'yourTurn');
  announce({ variant: 'nudge', title: _loc('ROLLCALL.Reminder.YourTurn'), subtitle: combatant.name, img: combatant.img, tag: _loc('ROLLCALL.Nudge.Tag') });
}
