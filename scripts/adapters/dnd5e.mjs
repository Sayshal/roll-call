import { baseAdapter } from './base.mjs';

/** @type {object} dnd5e 6.0 overrides; unlisted members fall back to the base adapter. */
export const dnd5eAdapter = {
  id: 'dnd5e',

  /** Skip the system's turn recovery for actor-less combatants. */
  setup() {
    Hooks.on('dnd5e.combatRecovery', (combatant) => (combatant.actor ? undefined : false));
  },

  /**
   * The system's HP percentage as a 0..1 fraction, the same value dnd5e compares against its bloodied threshold.
   * @param {Actor} actor The combatant's actor.
   * @returns {number|null} Fraction, or null when the actor has no max HP.
   */
  healthFraction(actor) {
    const hp = actor?.system.attributes?.hp;
    return hp?.effectiveMax ? hp.pct / 100 : null;
  },

  /**
   * Temporary hit points as a 0..1 fraction of effective max.
   * @param {Actor} actor The combatant's actor.
   * @returns {number|null} Fraction, or null when the actor has none.
   */
  tempFraction(actor) {
    const hp = actor?.system.attributes?.hp;
    return hp?.effectiveMax && hp.temp ? Math.clamp(hp.temp / hp.effectiveMax, 0, 1) : null;
  },

  /**
   * Initiative without the dex tiebreak decimal.
   * @param {Combatant} combatant The combatant.
   * @returns {number|null} Display value.
   */
  initiativeLabel(combatant) {
    return combatant.initiative == null ? null : Math.floor(combatant.initiative);
  },

  /**
   * Roll initiative through the system dialog so dnd5e hooks fire.
   * @param {Combatant} combatant The combatant.
   * @returns {Promise} The roll result.
   */
  rollInitiative(combatant) {
    return combatant.actor?.rollInitiativeDialog() ?? baseAdapter.rollInitiative(combatant);
  },

  /**
   * Key of the core group, or of the system's virtual group of same-creature combatants sharing an initiative.
   * @param {Combatant} combatant The combatant.
   * @returns {string|null} Group key, or null when ungrouped.
   */
  groupKey(combatant) {
    return combatant.getGroupingKey();
  },

  /**
   * Name of the core group or the system tracker group.
   * @param {Combatant} combatant The combatant.
   * @returns {string|null} Group name, or null when ungrouped.
   */
  groupLabel(combatant) {
    if (combatant.group) return combatant.group.name;
    const key = combatant.getGroupingKey();
    const members = key && combatant.combat.createGroups().get(key)?.combatants;
    return members ? (CONFIG.ui.combat.getGroupName?.(members) ?? null) : null;
  },

  /**
   * Creatures summoned by an actor.
   * @param {Actor} actor The summoner.
   * @returns {Actor[]} Summoned actors.
   */
  summons(actor) {
    return actor?.summonedCreatures ?? [];
  },

  /**
   * Legendary actions left and their maximum.
   * @param {Actor} actor The combatant's actor.
   * @returns {{value: number, max: number}|null} Counts, or null when the actor has none.
   */
  legendaryActions(actor) {
    const legact = actor?.system.resources?.legact;
    return legact?.max ? { value: legact.value, max: legact.max } : null;
  },

  /**
   * Lair action initiative count under the legacy rules.
   * @param {Actor} actor The combatant's actor.
   * @returns {number|null} Initiative count, or null when it takes none.
   */
  lairInitiative(actor) {
    const lair = actor?.system.resources?.lair;
    const rules = actor?.system.source?.rules || (dnd5e.settings.rulesVersion === 'modern' ? '2024' : '2014');
    return rules === '2014' && lair?.initiative ? lair.initiative : null;
  },

  /**
   * Spend legendary actions, or restore them with a negative count.
   * @param {Actor} actor The combatant's actor.
   * @param {number} count Actions to spend.
   * @returns {Promise<Actor>} The updated actor.
   */
  spendLegendary(actor, count) {
    const { spent, max } = actor.system.resources.legact;
    return actor.update({ 'system.resources.legact.spent': Math.clamp(spent + count, 0, max) });
  },

  provides: { autoDefeat: true, groupRoll: true }
};
