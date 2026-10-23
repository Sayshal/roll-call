/**
 * Pan the canvas to a combatant's token.
 * @param {Combatant} combatant The combatant.
 * @returns {Promise|void} Pan animation.
 */
export function panToCombatant(combatant) {
  return ui.combat._onPanToCombatant(combatant);
}

/**
 * Control and pan to a combatant's token on click, or open its sheet on double-click.
 * @param {PointerEvent} event The triggering event.
 * @param {HTMLElement} target Element carrying `data-combatant-id`.
 * @returns {void}
 */
export function activateCombatant(event, target) {
  return ui.combat._onCombatantMouseDown(event, target);
}

/**
 * Core combatant context menu entries plus entries other features add through the core hook.
 * Entries read `data-combatant-id` from the element the menu opens on.
 * @returns {object[]} Context menu entries.
 */
export function combatantContextOptions() {
  const entries = ui.combat._getEntryContextOptions();
  Hooks.callAll('getCombatTrackerContextOptions', ui.combat, entries);
  return entries;
}

/**
 * Ping a combatant's token.
 * @param {Combatant} combatant The combatant.
 * @returns {Promise|void} Ping result.
 */
export function pingCombatant(combatant) {
  return ui.combat._onPingCombatant(combatant);
}

/**
 * Play a sound from the client's combat sound theme.
 * @param {Combat} combat The combat.
 * @param {string} announcement `startEncounter`, `nextUp` or `yourTurn`.
 */
export function playCombatSound(combat, announcement) {
  combat._playCombatSound(announcement);
}

/**
 * Toggle a combatant's defeated state, and its defeated status effect when the token exists or the actor is linked.
 * @param {Combatant} combatant The combatant.
 * @returns {Promise<void>} Resolves after both updates.
 */
export async function toggleDefeated(combatant) {
  const isDefeated = !combatant.isDefeated;
  await combatant.update({ defeated: isDefeated });
  const actor = combatant.token || combatant.actor?.prototypeToken.actorLink ? combatant.actor : null;
  await actor?.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, { overlay: true, active: isDefeated });
}

/**
 * Toggle a combatant's hidden state.
 * @param {Combatant} combatant The combatant.
 * @returns {Promise<Combatant>} The updated combatant.
 */
export function toggleHidden(combatant) {
  return ui.combat._onToggleHidden(combatant);
}
