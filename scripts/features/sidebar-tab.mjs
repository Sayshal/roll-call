import { MODULE } from '../constants.mjs';
import { onSettingChange } from '../utils/_module.mjs';

/** Hides the core sidebar's combat tab. */
export class SidebarTab {
  /** Apply the setting now and whenever it changes. */
  static register() {
    SidebarTab.#toggle();
    onSettingChange([MODULE.SETTINGS.HIDE_COMBAT_TAB], SidebarTab.#onSetting);
  }

  /**
   * Toggle the tab's visibility.
   * @returns {boolean} Whether the tab is hidden.
   */
  static #toggle() {
    return document.body.classList.toggle('rc-hide-combat-tab', game.settings.get(MODULE.ID, MODULE.SETTINGS.HIDE_COMBAT_TAB));
  }

  /** Re-apply when the setting changes, leaving the tab if it is open. */
  static #onSetting() {
    if (SidebarTab.#toggle() && ui.sidebar.tabGroups.primary === 'combat') ui.sidebar.changeTab('chat', 'primary');
  }
}
