import { MODULE } from '../constants.mjs';

const { DialogV2 } = foundry.applications.api;

/** GM token-layer button that adds many tokens to the viewed combat at once. */
export class BulkAdd {
  /** Add the scene control button when the feature is enabled. */
  static register() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.BULK_ADD_ENABLED)) return;
    Hooks.on('getSceneControlButtons', BulkAdd.#addTool);
  }

  /**
   * Add the button to the token controls.
   * @param {object} controls Scene controls keyed by name.
   */
  static #addTool(controls) {
    if (!game.user.isGM || !controls.tokens || !game.settings.get(MODULE.ID, MODULE.SETTINGS.BULK_ADD_ENABLED)) return;
    controls.tokens.tools.rollCallBulkAdd = {
      name: 'rollCallBulkAdd',
      order: Object.keys(controls.tokens.tools).length + 1,
      title: 'ROLLCALL.BulkAdd.Title',
      icon: 'fa-solid fa-people-group',
      button: true,
      onChange: BulkAdd.#prompt
    };
  }

  /** Ask which tokens to add, then add them. */
  static async #prompt() {
    const { FRIENDLY, NEUTRAL, HOSTILE } = CONST.TOKEN_DISPOSITIONS;
    const choice = await DialogV2.wait({
      window: { title: 'ROLLCALL.BulkAdd.Title', icon: 'fa-solid fa-people-group' },
      classes: ['roll-call'],
      content: `<p>${_loc('ROLLCALL.BulkAdd.Hint')}</p>`,
      buttons: [
        { action: 'hostile', label: 'TOKEN.DISPOSITION.HOSTILE', icon: 'fa-solid fa-skull', callback: () => (token) => token.disposition === HOSTILE },
        { action: 'neutral', label: 'TOKEN.DISPOSITION.NEUTRAL', icon: 'fa-solid fa-circle-half-stroke', callback: () => (token) => token.disposition === NEUTRAL },
        { action: 'friendly', label: 'TOKEN.DISPOSITION.FRIENDLY', icon: 'fa-solid fa-handshake', callback: () => (token) => token.disposition === FRIENDLY },
        { action: 'visible', label: 'ROLLCALL.BulkAdd.Visible', icon: 'fa-solid fa-eye', callback: () => (token) => !token.hidden }
      ],
      rejectClose: false
    });
    if (!choice) return;
    const tokens = canvas.scene.tokens.filter((token) => token.actor && !token.inCombat && choice(token));
    if (tokens.length) await TokenDocument.implementation.createCombatants(tokens);
    else ui.notifications.info('ROLLCALL.BulkAdd.None', { localize: true });
  }
}
