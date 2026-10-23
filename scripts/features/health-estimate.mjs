import { MODULE } from '../constants.mjs';
import { canSee, healthEstimate, onSettingChange } from '../utils/_module.mjs';

const { PreciseText } = foundry.canvas.containers;

/** Health bucket labels under tokens in a started combat. */
export class HealthEstimate {
  /** @type {WeakMap<Token, PreciseText>} Label drawn under each token. */
  static #labels = new WeakMap();

  /** @type {PIXI.Container|null} Shared container drawing every label above tokens. */
  static #container = null;

  /** @type {string[]} Settings the labels read. */
  static #SETTING_KEYS = [
    MODULE.SETTINGS.HEALTH_BUCKETS,
    MODULE.SETTINGS.HEALTH_CANVAS,
    MODULE.SETTINGS.HEALTH_ESTIMATE_ENABLED,
    MODULE.SETTINGS.HEALTH_SCALE,
    MODULE.SETTINGS.NAME_MASK,
    MODULE.SETTINGS.PRIVACY_RULES,
    'core.combatTrackerConfig'
  ];

  /** Draw labels on token refresh and redraw them when combat or settings change, when the feature is enabled. */
  static register() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_ESTIMATE_ENABLED)) return;
    Hooks.on('refreshToken', HealthEstimate.#refreshLabel);
    Hooks.on('destroyToken', HealthEstimate.#removeLabel);
    const refreshAll = () => canvas.tokens?.placeables.forEach((token) => token.renderFlags.set({ refreshState: true }));
    const refreshOne = (combatant) => combatant.token?.object?.renderFlags.set({ refreshState: true });
    for (const hook of ['createCombat', 'deleteCombat']) Hooks.on(hook, refreshAll);
    for (const hook of ['createCombatant', 'updateCombatant', 'deleteCombatant']) Hooks.on(hook, refreshOne);
    Hooks.on('updateCombat', (_combat, changes) => ('round' in changes || 'active' in changes) && refreshAll());
    onSettingChange(HealthEstimate.#SETTING_KEYS, refreshAll);
  }

  /**
   * Show, update or hide a token's health label.
   * @param {Token} token The refreshed token.
   * @param {object} flags Render flags being applied.
   */
  static #refreshLabel(token, flags) {
    const contentChanged = flags.refreshState || flags.refreshBars || flags.refreshNameplate || flags.refreshSize;
    if (!(contentChanged || flags.refreshPosition || flags.refreshVisibility)) return;
    const mode = game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_CANVAS);
    if (contentChanged && !HealthEstimate.#updateContent(token, mode)) return;
    const label = HealthEstimate.#labels.get(token);
    if (!label || label.destroyed) return;
    label.visible = token.visible && token.renderable && !token.document.isSecret && (mode === 'always' || token.hover);
    label.alpha = token.alpha;
    label.position.set(token.x + token.nameplate.x, token.y + token.nameplate.y + token.nameplate.height);
  }

  /**
   * Create or update a token's label text and style, removing it when no estimate applies.
   * @param {Token} token The refreshed token.
   * @param {string} mode The health canvas display mode.
   * @returns {boolean} Whether the token has a label.
   */
  static #updateContent(token, mode) {
    const combatant = token.combatant;
    const on = game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_ESTIMATE_ENABLED);
    const estimate = on && mode !== 'never' && combatant?.combat.started && canSee(game.user, combatant, 'estimate') ? healthEstimate(token.actor) : null;
    if (!estimate) {
      HealthEstimate.#removeLabel(token);
      return false;
    }
    let label = HealthEstimate.#labels.get(token);
    if (!label || label.destroyed) {
      if (!HealthEstimate.#container || HealthEstimate.#container.destroyed) {
        HealthEstimate.#container = canvas.interface.addChild(new PIXI.Container());
        Object.assign(HealthEstimate.#container, { zIndex: 250, eventMode: 'none', interactiveChildren: false });
      }
      label = HealthEstimate.#container.addChild(new PreciseText('', PreciseText.getTextStyle()));
      label.anchor.set(0.5, 0);
      HealthEstimate.#labels.set(token, label);
    }
    label.text = estimate.label;
    label.style.fill = estimate.color ?? CONFIG.canvasTextStyle.fill;
    label.style.fontSize = 24 * game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_SCALE);
    label.scale.set(canvas.dimensions.uiScale * token.document.width);
    return true;
  }

  /**
   * Destroy and forget a token's label.
   * @param {Token} token The token whose label is removed.
   */
  static #removeLabel(token) {
    const label = HealthEstimate.#labels.get(token);
    if (label && !label.destroyed) label.destroy();
    HealthEstimate.#labels.delete(token);
  }
}
