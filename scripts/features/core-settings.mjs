/** Points GMs from core's combat tracker dialog to Roll Call. */
export class CoreSettings {
  /** Add a notice to core's combat tracker dialog. */
  static register() {
    Hooks.on('renderCombatTrackerConfig', CoreSettings.#addNotice);
  }

  /**
   * Tell the reader that Roll Call's dock follows these settings.
   * @param {foundry.applications.apps.CombatTrackerConfig} _app The dialog.
   * @param {HTMLElement} element Its rendered element.
   */
  static #addNotice(_app, element) {
    const notice = document.createElement('p');
    notice.className = 'notification info';
    notice.textContent = _loc('ROLLCALL.CoreConfig.Notice');
    element.querySelector('[data-application-part="body"]')?.prepend(notice);
  }
}
