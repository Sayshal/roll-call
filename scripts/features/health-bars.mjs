import { MODULE } from '../constants.mjs';
import { cachedSetting, canSee, onSettingChange } from '../utils/_module.mjs';

/** Shows combatant token bars to everyone during a started combat, without changing token data. */
export class HealthBars {
  /** Override bar visibility on token refresh and refresh tokens when combat or the setting changes. */
  static register() {
    Hooks.on('refreshToken', HealthBars.#refreshBars);
    const refreshAll = () => canvas.tokens?.placeables.forEach((token) => token.renderFlags.set({ refreshState: true }));
    const refreshOne = (combatant) => combatant.token?.object?.renderFlags.set({ refreshState: true });
    for (const hook of ['createCombat', 'deleteCombat']) Hooks.on(hook, refreshAll);
    for (const hook of ['createCombatant', 'updateCombatant', 'deleteCombatant']) Hooks.on(hook, refreshOne);
    Hooks.on('updateCombat', (_combat, changes) => ('round' in changes || 'active' in changes) && refreshAll());
    onSettingChange([MODULE.SETTINGS.HEALTH_BARS, MODULE.SETTINGS.PRIVACY_ENABLED, MODULE.SETTINGS.PRIVACY_RULES], refreshAll);
  }

  /**
   * Show a combatant's bars after core hid them, when the mode and the privacy rules allow.
   * @param {Token} token The refreshed token.
   * @param {object} flags Render flags being applied.
   */
  static #refreshBars(token, flags) {
    if (!flags.refreshState || token.bars.visible || !token.actor) return;
    const mode = cachedSetting(MODULE.SETTINGS.HEALTH_BARS);
    const combatant = token.combatant;
    if (mode === 'default' || !combatant?.combat.started || token.document.isSecret || !canSee(game.user, combatant, 'health')) return;
    token.bars.visible = mode === 'always' || token.hover;
  }
}
