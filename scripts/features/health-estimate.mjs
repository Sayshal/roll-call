import { MODULE } from '../constants.mjs';
import { canSee, healthEstimate, onSettingChange } from '../utils/_module.mjs';

const { PreciseText } = foundry.canvas.containers;

/** Health bucket labels under tokens in a started combat. */
export class HealthEstimate {
  /** @type {WeakMap<Token, PreciseText>} Label drawn under each token. */
  static #labels = new WeakMap();

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
    if (!(flags.refreshState || flags.refreshBars || flags.refreshNameplate || flags.refreshSize)) return;
    const mode = game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_CANVAS);
    const combatant = token.combatant;
    const on = game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_ESTIMATE_ENABLED);
    const estimate = on && mode !== 'never' && combatant?.combat.started && canSee(game.user, combatant, 'estimate') ? healthEstimate(token.actor) : null;
    let label = HealthEstimate.#labels.get(token);
    if (!estimate) {
      if (label && !label.destroyed) label.visible = false;
      return;
    }
    if (!label || label.destroyed) {
      label = token.addChild(new PreciseText('', PreciseText.getTextStyle()));
      label.anchor.set(0.5, 0);
      HealthEstimate.#labels.set(token, label);
    }
    label.text = estimate.label;
    label.style.fill = estimate.color ?? CONFIG.canvasTextStyle.fill;
    label.visible = mode === 'always' || token.hover;
    label.style.fontSize = 24 * game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_SCALE);
    label.scale.set(canvas.dimensions.uiScale * token.document.width);
    label.position.set(token.nameplate.x, token.nameplate.y + token.nameplate.height);
  }
}
