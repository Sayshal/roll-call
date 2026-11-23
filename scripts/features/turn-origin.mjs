import { MODULE } from '../constants.mjs';

/** A faded copy of the active combatant's token where it stood when its turn began, drawn under the tokens. */
export class TurnOrigin {
  /** @type {foundry.canvas.primary.PrimarySpriteMesh|null} The ghost mesh in the primary group. */
  static #ghost = null;

  /** @type {boolean} Whether a redraw is already queued for the next frame. */
  static #queued = false;

  /** Redraw on movement records, combat changes and refreshes of the active token, when the mode is not "never". */
  static register() {
    if (game.settings.get(MODULE.ID, MODULE.SETTINGS.TURN_ORIGIN) === 'never') return;
    const queue = () => TurnOrigin.#queue();
    for (const hook of ['canvasReady', 'recordToken', 'updateCombat', 'deleteCombat', 'deleteCombatant', 'updateCombatant', 'deleteToken', 'hoverToken', 'sightRefresh']) Hooks.on(hook, queue);
    Hooks.on('refreshToken', (token, flags) => token.document === game.combat?.combatant?.token && (flags.refreshVisibility || flags.refreshMesh || flags.refreshSize) && queue());
  }

  /** Redraw once on the next animation frame, however many changes arrive before it. */
  static #queue() {
    if (TurnOrigin.#queued) return;
    TurnOrigin.#queued = true;
    requestAnimationFrame(() => {
      TurnOrigin.#queued = false;
      TurnOrigin.#draw();
    });
  }

  /**
   * The active combatant's token and turn start position, when the ghost should show to this user.
   * @returns {{token: Token, origin: object}|null} Token and its first recorded position.
   */
  static #target() {
    const combatant = game.combat?.started ? game.combat.combatant : null;
    const token = combatant?.token?.object;
    const origin = token?.document.movementHistory[0];
    if (!origin || !token.visible || !combatant.visible) return null;
    if (foundry.documents.TokenDocument.arePositionsEqual(origin, token.document)) return null;
    if (game.settings.get(MODULE.ID, MODULE.SETTINGS.TURN_ORIGIN) === 'hover' && !token.hover) return null;
    if (!game.user.isGM && canvas.visibility.tokenVision && !canvas.visibility.testVisibility(token.document.getCenterPoint(origin), { object: token })) return null;
    return { token, origin };
  }

  /** Hide the ghost, or move it under the active token's turn start position. */
  static #draw() {
    if (!canvas.ready) return;
    const target = TurnOrigin.#target();
    if (!target) {
      if (TurnOrigin.#ghost && !TurnOrigin.#ghost.destroyed) TurnOrigin.#ghost.visible = false;
      return;
    }
    const { token, origin } = target;
    if (!TurnOrigin.#ghost || TurnOrigin.#ghost.destroyed) {
      TurnOrigin.#ghost = canvas.primary.addChild(new foundry.canvas.primary.PrimarySpriteMesh({ name: `${MODULE.ID}.turnOrigin` }));
      TurnOrigin.#ghost.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
    }
    const ghost = TurnOrigin.#ghost;
    const { width, height } = token.document.getSize(origin);
    const { x, y } = token.document.getCenterPoint(origin);
    const { fit, scaleX, scaleY, anchorX, anchorY, tint } = token.document.texture;
    ghost.texture = token.texture ?? PIXI.Texture.EMPTY;
    ghost.resize(width, height, { fit, scaleX, scaleY });
    ghost.anchor.set(anchorX, anchorY);
    ghost.position.set(x, y);
    ghost.angle = token.mesh.angle;
    ghost.tint = tint;
    ghost.alpha = 0.4;
    ghost.elevation = origin.elevation;
    ghost.sort = token.document.sort - 1;
    ghost.visible = true;
  }
}
