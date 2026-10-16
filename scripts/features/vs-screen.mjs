import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';
import { canSee, displayName, isAlly } from '../utils/_module.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Full-screen allies-versus-enemies intro in turn order, shown to everyone when combat starts and whenever the GM replays it. */
export class VsScreen extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number} Milliseconds the screen stays up before closing itself. */
  static #DURATION = 6500;

  /** @type {object|null} ATLAS registration handle used to replay the screen on every client. */
  static #relay = null;

  /** @type {string|null} Id of the combat being shown. */
  #combatId = null;

  /** @type {number|null} Timeout id of the automatic close. */
  #timer = null;

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: `${MODULE.ID}-vs`,
    classes: ['roll-call', 'rc-vs'],
    window: { frame: false, positioned: false },
    actions: { dismiss: VsScreen.#onDismiss }
  };

  /** @inheritdoc */
  static PARTS = { screen: { template: MODULE.TEMPLATES.VS } };

  /**
   * Create the screen and show it on combat start and on relayed replays, when the feature is enabled.
   * @param {object} atlas ATLAS registration handle.
   */
  static register(atlas) {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.VS_SCREEN)) return;
    VsScreen.#relay = atlas;
    const screen = new this();
    Hooks.on('combatTurnChange', (combat, prior, current) => prior.round === 0 && current.round === 1 && screen.#show(combat.id));
    Hooks.on(MODULE.RELAY.VS, (combatId) => screen.#show(combatId));
  }

  /**
   * Show the screen for a combat on every client, the GM's included.
   * @param {Combat} combat The combat to show.
   */
  static replay(combat) {
    if (!VsScreen.#relay || !combat) return;
    Hooks.callAll(MODULE.RELAY.VS, combat.id);
    VsScreen.#relay.broadcast(MODULE.RELAY.VS, combat.id);
  }

  /**
   * Render the screen for a combat with at least one combatant this user may see, and schedule its close.
   * @param {string} combatId Combat id.
   */
  #show(combatId) {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.VS_SCREEN)) return;
    if (!game.combats.get(combatId)?.turns.some((combatant) => combatant.visible)) return;
    this.#combatId = combatId;
    clearTimeout(this.#timer);
    this.element?.classList.remove('is-leaving');
    this.render({ force: true });
    this.#timer = setTimeout(() => this.#leave(), VsScreen.#DURATION);
  }

  /** Fade out, then close. */
  #leave() {
    clearTimeout(this.#timer);
    if (!this.rendered) return;
    this.element.classList.add('is-leaving');
    this.#timer = setTimeout(() => this.close(), 300);
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const combat = game.combats.get(this.#combatId);
    const tiles = { allies: [], enemies: [] };
    const grouped = new Map();
    const adapter = getAdapter();
    for (const combatant of combat?.turns.filter((member) => member.visible) ?? []) {
      const key = adapter.groupKey(combatant);
      if (key && grouped.has(key)) {
        grouped.get(key).count++;
        continue;
      }
      const known = canSee(game.user, combatant, 'name');
      const tile = {
        name: displayName(game.user, combatant),
        img: known ? combatant.img : null,
        initiative: canSee(game.user, combatant, 'initiative') ? (adapter.initiativeLabel(combatant) ?? null) : null,
        count: 1
      };
      if (key) grouped.set(key, tile);
      tiles[isAlly(combatant) ? 'allies' : 'enemies'].push(tile);
    }
    return Object.assign(context, tiles);
  }

  /**
   * Close the screen on click.
   * @this {VsScreen}
   */
  static #onDismiss() {
    this.#leave();
  }
}
