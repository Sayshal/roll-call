import { MODULE } from '../constants.mjs';
import { onSettingChange } from '../utils/_module.mjs';

const { DialogV2, DocumentSheetV2 } = foundry.applications.api;

/** Hides GM-chosen UI for players while a started combat runs on the scene they are viewing. */
export class FocusMode {
  /** @type {boolean} Whether focus is applied on this client. */
  static #active = false;

  /** @type {HTMLStyleElement|null} Style element hiding the GM's custom selectors. */
  static #customStyle = null;

  /** @type {string[]} Settings whose change re-applies focus. */
  static #SETTING_KEYS = [MODULE.SETTINGS.FOCUS_ENABLED, MODULE.SETTINGS.FOCUS_ELEMENTS, MODULE.SETTINGS.FOCUS_ON_DEVICE, MODULE.SETTINGS.FOCUS_SELECTORS];

  /** Re-evaluate focus on scene and combat changes when the feature is enabled. */
  static register() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.FOCUS_ENABLED)) return;
    const update = foundry.utils.debounce(() => FocusMode.#update(), 50);
    for (const hook of ['canvasReady', 'createCombat', 'updateCombat', 'deleteCombat']) Hooks.on(hook, update);
    onSettingChange(FocusMode.#SETTING_KEYS, () => {
      FocusMode.#exit();
      update();
    });
  }

  /**
   * Whether focus mode applies on this client.
   * @returns {boolean} Whether to focus.
   */
  static #shouldFocus() {
    if (game.user.isGM || !game.settings.get(MODULE.ID, MODULE.SETTINGS.FOCUS_ENABLED) || !game.settings.get(MODULE.ID, MODULE.SETTINGS.FOCUS_ON_DEVICE)) return false;
    const combat = game.combat;
    return !!combat?.started && (!combat.scene || combat.scene === canvas.scene);
  }

  /** Enter or leave focus to match the current combat. */
  static #update() {
    const focus = FocusMode.#shouldFocus();
    if (focus === FocusMode.#active) return;
    if (focus) FocusMode.#enter();
    else FocusMode.#exit();
  }

  /** Hide the chosen UI, move the sidebar to chat and offer to close open sheets. */
  static #enter() {
    FocusMode.#active = true;
    const elements = game.settings.get(MODULE.ID, MODULE.SETTINGS.FOCUS_ELEMENTS);
    for (const [key, hidden] of Object.entries(elements)) document.body.classList.toggle(`rc-focus-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, hidden);
    if (elements.sceneControls) canvas.tokens?.activate();
    FocusMode.#customStyle = document.head.appendChild(document.createElement('style'));
    FocusMode.#customStyle.textContent = game.settings
      .get(MODULE.ID, MODULE.SETTINGS.FOCUS_SELECTORS)
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => `body ${selector} { display: none !important; }`)
      .join('\n');
    const tab = ui.sidebar.tabGroups.primary;
    if (elements.chatTab || (elements.sidebarTabs && !['chat', 'combat'].includes(tab))) ui.sidebar.changeTab('chat', 'primary');
    if (elements.closeSheets) FocusMode.#promptCloseSheets();
  }

  /** Restore everything focus hid. */
  static #exit() {
    FocusMode.#active = false;
    for (const name of [...document.body.classList]) if (name.startsWith('rc-focus-')) document.body.classList.remove(name);
    FocusMode.#customStyle?.remove();
    FocusMode.#customStyle = null;
  }

  /** Ask the player to close their open document sheets, with a toggle per sheet to keep it open. */
  static async #promptCloseSheets() {
    const sheets = [...foundry.applications.instances.values()].filter((app) => app instanceof DocumentSheetV2 && app.rendered);
    if (!sheets.length) return;
    const groups = sheets.map((sheet) => {
      const input = foundry.applications.fields.createCheckboxInput({ name: sheet.id, value: false });
      return foundry.applications.fields.createFormGroup({ label: sheet.title, input }).outerHTML;
    });
    const keep = await DialogV2.wait({
      window: { title: 'ROLLCALL.FocusMode.CloseSheets.Title', icon: 'fa-solid fa-book' },
      classes: ['roll-call'],
      content: `<p class="hint">${_loc('ROLLCALL.FocusMode.CloseSheets.Hint')}</p>${groups.join('')}`,
      buttons: [
        {
          action: 'closeSheets',
          label: 'ROLLCALL.FocusMode.CloseSheets.Close',
          icon: 'fa-solid fa-xmark',
          default: true,
          callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
        },
        { action: 'cancel', label: 'ATLAS.Common.Cancel' }
      ],
      rejectClose: false
    });
    if (!keep || keep === 'cancel') return;
    for (const sheet of sheets) if (!keep[sheet.id]) sheet.close();
  }
}
