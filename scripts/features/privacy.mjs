import { MODULE } from '../constants.mjs';
import { canSee, displayName, onSettingChange, viewedCombat } from '../utils/_module.mjs';

/** Hides combatant details from players in the core tracker and on the canvas. */
export class Privacy {
  /** @type {Set<string>} Combatant ids this client already reported as seen. */
  static #reported = new Set();

  /**
   * Hook into the core tracker and combatant lifecycle when the feature is enabled.
   * @param {object} atlas ATLAS registration handle, used to relay sightings to the primary GM.
   */
  static register(atlas) {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.PRIVACY_ENABLED)) return;
    Hooks.on('preCreateCombatant', Privacy.#hideOnCreate);
    Hooks.on('preUpdateCombatant', Privacy.#clearAutoHidden);
    Hooks.on(MODULE.RELAY.REVEAL, Privacy.#onReveal);
    onSettingChange([MODULE.SETTINGS.NAME_MASK, MODULE.SETTINGS.PRIVACY_RULES], () => ui.combat.render());
    const report = () => Privacy.#reportSeen(atlas);
    for (const hook of ['sightRefresh', 'createCombatant']) Hooks.on(hook, report);
    Hooks.on('updateCombatant', (combatant, changes) => 'hidden' in changes && combatant.token?.object?.renderFlags.set({ refreshTurnMarker: true }));
  }

  /**
   * Mask the core tracker's row data and group names.
   */
  static patchCore() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.PRIVACY_ENABLED)) return;
    const token = CONFIG.Token.objectClass.prototype;
    const refreshMarker = token._refreshTurnMarker;
    token._refreshTurnMarker = function (...args) {
      refreshMarker.apply(this, args);
      if (this.turnMarker) this.turnMarker.visible = !(this.combatant?.hidden && Privacy.#active());
    };
    const Tracker = CONFIG.ui.combat;
    const prepare = Tracker.prototype._prepareTurnContext;
    Tracker.prototype._prepareTurnContext = async function (combat, combatant, index) {
      return Privacy.#maskTurn(await prepare.call(this, combat, combatant, index), combatant);
    };
    const groupName = Tracker.getGroupName;
    if (!groupName) return;
    Tracker.getGroupName = function (combatants) {
      const masked = Privacy.#active() && combatants.find((combatant) => !canSee(game.user, combatant, 'name'));
      return masked ? displayName(game.user, masked) : groupName.call(this, combatants);
    };
  }

  /**
   * Whether masking applies on this client.
   * @returns {boolean} Whether to mask.
   */
  static #active() {
    return !game.user.isGM && game.settings.get(MODULE.ID, MODULE.SETTINGS.PRIVACY_ENABLED);
  }

  /**
   * Apply the privacy rules to one tracker row's render data.
   * @param {object} turn Row data from core.
   * @param {Combatant} combatant The row's combatant.
   * @returns {object} Masked row data.
   */
  static #maskTurn(turn, combatant) {
    if (!Privacy.#active()) return turn;
    turn.name = displayName(game.user, combatant);
    if (!canSee(game.user, combatant, 'health')) turn.resource = null;
    if (!canSee(game.user, combatant, 'initiative')) turn.initiative = null;
    if (!canSee(game.user, combatant, 'effects')) turn.effects = { icons: [], tooltip: '' };
    return turn;
  }

  /**
   * Hide a new combatant no player owns until a player sees its token.
   * @param {Combatant} combatant The combatant being created.
   */
  static #hideOnCreate(combatant) {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.PRIVACY_ENABLED) || !game.settings.get(MODULE.ID, MODULE.SETTINGS.HIDE_UNTIL_SEEN) || combatant.hasPlayerOwner) return;
    combatant.updateSource({ hidden: true, flags: { [MODULE.ID]: { [MODULE.FLAGS.AUTO_HIDDEN]: true } } });
  }

  /**
   * Any change to a combatant's hidden state ends automatic reveal, so a GM's own hide is never undone.
   * @param {Combatant} combatant The combatant being updated.
   * @param {object} changes Pending changes.
   */
  static #clearAutoHidden(combatant, changes) {
    if ('hidden' in changes && combatant.getFlag(MODULE.ID, MODULE.FLAGS.AUTO_HIDDEN)) foundry.utils.setProperty(changes, `flags.${MODULE.ID}.${MODULE.FLAGS.AUTO_HIDDEN}`, false);
  }

  /**
   * Tell the primary GM which auto-hidden combatants this player can now see.
   * @param {object} atlas ATLAS registration handle.
   */
  static #reportSeen(atlas) {
    if (game.user.isGM || !game.settings.get(MODULE.ID, MODULE.SETTINGS.PRIVACY_ENABLED) || !game.settings.get(MODULE.ID, MODULE.SETTINGS.HIDE_UNTIL_SEEN)) return;
    const combat = viewedCombat();
    const seen = (combat?.combatants ?? []).filter(
      (combatant) => combatant.hidden && combatant.getFlag(MODULE.ID, MODULE.FLAGS.AUTO_HIDDEN) && !Privacy.#reported.has(combatant.id) && combatant.token?.object?.isVisible
    );
    if (!seen.length || !game.users.activeGM) return;
    const ids = seen.map((combatant) => combatant.id);
    for (const id of ids) Privacy.#reported.add(id);
    atlas.broadcast(MODULE.RELAY.REVEAL, combat.id, ids);
  }

  /**
   * Reveal combatants a player reported as seen.
   * @param {string} combatId Combat id.
   * @param {string[]} combatantIds Combatants the player saw.
   */
  static #onReveal(combatId, combatantIds) {
    if (!ATLAS.isPrimaryGM) return;
    const combat = game.combats.get(combatId);
    const updates = combatantIds
      .map((id) => combat?.combatants.get(id))
      .filter((combatant) => combatant?.getFlag(MODULE.ID, MODULE.FLAGS.AUTO_HIDDEN))
      .map((combatant) => ({ _id: combatant.id, hidden: false }));
    if (updates.length) combat.updateEmbeddedDocuments('Combatant', updates);
  }
}
