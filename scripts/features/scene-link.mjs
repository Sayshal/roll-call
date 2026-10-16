import { MODULE } from '../constants.mjs';

/** Links an unlinked combat to the scene the GM is viewing when it starts. */
export class SceneLink {
  /** Hook combat start when the setting is on. */
  static register() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.LINK_SCENE)) return;
    Hooks.on('combatStart', SceneLink.#onStart);
  }

  /**
   * Link an unlinked combat to the viewed scene on start.
   * @param {Combat} combat The starting combat.
   * @param {object} updateData The start update, extended in place.
   */
  static #onStart(combat, updateData) {
    const scene = canvas.scene;
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.LINK_SCENE)) return;
    if (combat.scene || !scene || combat.combatants.some((combatant) => combatant.sceneId && combatant.sceneId !== scene.id)) return;
    updateData.scene = scene.id;
  }
}
