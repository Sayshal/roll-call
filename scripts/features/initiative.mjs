import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';
import { onSettingChange } from '../utils/_module.mjs';

/** Initiative tools: NPC auto-roll, reverse order and group initiative. */
export class Initiative {
  /** @type {Map<Combat, Set<string>>} Combatant ids waiting to be rolled, per combat. */
  static #pending = new Map();

  /** Hook combatant creation and updates. */
  static register() {
    const rollPending = foundry.utils.debounce(Initiative.#rollPending, 100);
    Hooks.on('createCombatant', (combatant) => Initiative.#queueRoll(combatant) && rollPending());
    Hooks.on('updateCombatant', Initiative.#syncGroup);
    Hooks.on('updateCombat', Initiative.#clearResetGroups);
  }

  /**
   * Whether this client keeps group initiative in sync.
   * @returns {boolean} Whether to sync.
   */
  static #syncsGroups() {
    return ATLAS.isPrimaryGM && !getAdapter().provides.groupRoll && game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_GROUP);
  }

  /**
   * Reverse the system's turn order when the setting is on.
   */
  static patchSort() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_REVERSE)) return;
    const proto = CONFIG.Combat.documentClass.prototype;
    const sort = proto._sortCombatants;
    proto._sortCombatants = function (a, b) {
      const result = sort.call(this, a, b);
      if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_REVERSE)) return result;
      const rolled = Number.isNumeric(a.initiative) && Number.isNumeric(b.initiative) && a.initiative !== b.initiative;
      return rolled ? -result : result;
    };
    for (const combat of game.combats) combat.setupTurns();
    onSettingChange([MODULE.SETTINGS.INITIATIVE_REVERSE], Initiative.#resort);
  }

  /** Rebuild every combat's turns after reverse order changes. */
  static #resort() {
    for (const combat of game.combats) combat.setupTurns();
    ui.combat.render();
  }

  /**
   * Queue a new NPC combatant for an initiative roll on the primary GM.
   * @param {Combatant} combatant The created combatant.
   * @returns {boolean} Whether it was queued.
   */
  static #queueRoll(combatant) {
    if (!ATLAS.isPrimaryGM || !game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_AUTO_ROLL)) return false;
    if (combatant.hasPlayerOwner || combatant.initiative != null || combatant.getFlag(MODULE.ID, MODULE.FLAGS.EVENT)) return false;
    if (!Initiative.#pending.has(combatant.parent)) Initiative.#pending.set(combatant.parent, new Set());
    Initiative.#pending.get(combatant.parent).add(combatant.id);
    return true;
  }

  /** Roll every queued combatant, whispered to GMs. */
  static #rollPending() {
    for (const [combat, ids] of Initiative.#pending) {
      const existing = [...ids].filter((id) => combat.combatants.get(id)?.initiative == null);
      if (existing.length) combat.rollInitiative(existing, { messageMode: 'gm', skipDialog: true });
    }
    Initiative.#pending.clear();
  }

  /**
   * Store a group member's new initiative on its group.
   * @param {Combatant} combatant The updated combatant.
   * @param {object} changes Changed data.
   */
  static #syncGroup(combatant, changes) {
    if (!('initiative' in changes) || !Initiative.#syncsGroups()) return;
    const group = combatant.group;
    if (group && group.initiative !== changes.initiative) group.update({ initiative: changes.initiative });
  }

  /**
   * Clear the initiative of groups whose members were all reset.
   * @param {Combat} combat The updated combat.
   * @param {object} changes Changed data.
   */
  static #clearResetGroups(combat, changes) {
    if (!changes.combatants || !Initiative.#syncsGroups()) return;
    const updates = combat.groups
      .filter((group) => group.initiative != null && [...group.members].every((member) => member._source.initiative == null))
      .map((group) => ({ _id: group.id, initiative: null }));
    if (updates.length) combat.updateEmbeddedDocuments('CombatantGroup', updates);
  }
}
