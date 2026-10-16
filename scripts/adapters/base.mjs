/** @type {object} Core-only adapter used for any system without its own adapter. */
export const baseAdapter = {
  id: 'base',

  /** Hook into the system once the adapter is chosen. */
  setup() {},

  /**
   * Current health as a 0..1 fraction from the core tracked resource.
   * @param {Actor} actor The combatant's actor.
   * @returns {number|null} Fraction, or null when the resource is not a bar.
   */
  healthFraction(actor) {
    const path = foundry.documents.collections.CombatEncounters.settings.resource?.replace(/\.value$/, '');
    const resource = path ? foundry.utils.getProperty(actor?.system ?? {}, path) : null;
    if (!resource?.max) return null;
    return Math.clamp(resource.value / resource.max, 0, 1);
  },

  /**
   * Temporary health as a 0..1 fraction of max, drawn over the health bar.
   * @param {Actor} _actor The combatant's actor.
   * @returns {number|null} Fraction, or null when the system has no temporary health.
   */
  tempFraction(_actor) {
    return null;
  },

  /**
   * Initiative value to display.
   * @param {Combatant} combatant The combatant.
   * @returns {number|null} Display value.
   */
  initiativeLabel(combatant) {
    return combatant.initiative;
  },

  /**
   * Roll initiative for one combatant.
   * @param {Combatant} combatant The combatant.
   * @returns {Promise<Combat>} The updated combat.
   */
  rollInitiative(combatant) {
    return combatant.combat.rollInitiative([combatant.id]);
  },

  /**
   * Key shared by the members of a combatant's group, used to stack them on one dock card.
   * @param {Combatant} combatant The combatant.
   * @returns {string|null} Group key, or null when ungrouped.
   */
  groupKey(combatant) {
    return combatant.group?.id ?? null;
  },

  /**
   * Name of the group a combatant belongs to, shown on its dock card.
   * @param {Combatant} combatant The combatant.
   * @returns {string|null} Group name, or null when ungrouped.
   */
  groupLabel(combatant) {
    return combatant.group?.name ?? null;
  },

  /**
   * End every turn through an index, the way core's next turn does.
   * @param {Combat} combat The combat.
   * @param {number} last Index of the last turn to end.
   * @returns {Promise<Combat>} The updated combat.
   */
  endTurnsThrough(combat, last) {
    const skip = combat.settings.skipDefeated;
    const next = combat.turns.findIndex((combatant, index) => index > last && !(skip && combatant.isDefeated));
    if (next < 0) return combat.nextRound();
    const updateData = { round: combat.round, turn: next };
    const updateOptions = { direction: 1, worldTime: { delta: combat.getTimeDelta(combat.round, combat.turn, combat.round, next) } };
    Hooks.callAll('combatTurn', combat, updateData, updateOptions);
    return combat.update(updateData, updateOptions);
  },

  /**
   * Creatures summoned by an actor.
   * @param {Actor} _actor The summoner.
   * @returns {Actor[]} Summoned actors.
   */
  summons(_actor) {
    return [];
  },

  /**
   * Whether a combatant counts as defeated.
   * @param {Combatant} combatant The combatant.
   * @returns {boolean} Defeated state.
   */
  isDefeated(combatant) {
    return combatant.isDefeated;
  },

  /**
   * Legendary actions left and their maximum.
   * @param {Actor} _actor The combatant's actor.
   * @returns {{value: number, max: number}|null} Counts, or null when the actor has none.
   */
  legendaryActions(_actor) {
    return null;
  },

  /**
   * Initiative count at which a creature takes lair actions.
   * @param {Actor} _actor The combatant's actor.
   * @returns {number|null} Initiative count, or null when it takes none.
   */
  lairInitiative(_actor) {
    return null;
  },

  /**
   * Spend legendary actions, or restore them with a negative count.
   * @param {Actor} _actor The combatant's actor.
   * @param {number} _count Actions to spend.
   * @returns {Promise|void} The actor update.
   */
  spendLegendary(_actor, _count) {},

  /** @type {object} Features the system already provides. */
  provides: {}
};
