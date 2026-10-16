import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';
import { announce, displayName, onSettingChange, panToCombatant } from '../utils/_module.mjs';

/** Turn banner, glow, pan, token select and on-deck marker. */
export class TurnReminders {
  /** @type {PIXI.Container|null} Arc and tag drawn on the on-deck token. */
  static #marker = null;

  /** @type {string[]} Settings that change how the on-deck marker looks. */
  static #MARKER_KEYS = [
    MODULE.SETTINGS.ON_DECK_BACKGROUND_COLOR,
    MODULE.SETTINGS.ON_DECK_FONT_COLOR,
    MODULE.SETTINGS.ON_DECK_IMAGE,
    MODULE.SETTINGS.ON_DECK_LABEL,
    MODULE.SETTINGS.ON_DECK_MARKER,
    MODULE.SETTINGS.ON_DECK_OUTLINE_COLOR
  ];

  /** @type {Object<string, {font: string, background: string, outline: string}>} Theme variables each label style takes its default colors from. */
  static #LABEL_THEMES = {
    blade: { font: '--roll-call-ink', background: '--roll-call-secondary', outline: '--roll-call-secondary' },
    codex: { font: '--roll-call-secondary', background: '--roll-call-bg', outline: '--roll-call-secondary' }
  };

  /** Select the active token for its owner on every turn change, and hook the reminders and on-deck marker when the feature is enabled. */
  static register() {
    Hooks.on('combatTurnChange', TurnReminders.#selectActive);
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDERS_ENABLED)) return;
    Hooks.on('combatTurnChange', TurnReminders.#onTurnChange);
    const update = foundry.utils.debounce(TurnReminders.#updateMarker, 50);
    for (const hook of ['canvasReady', 'updateCombat', 'deleteCombat', 'createCombatant', 'updateCombatant', 'deleteCombatant']) Hooks.on(hook, update);
    onSettingChange([MODULE.SETTINGS.REMINDERS_ENABLED], update);
    onSettingChange(TurnReminders.#MARKER_KEYS, () => {
      TurnReminders.#clearMarker();
      update();
    });
    Hooks.on('refreshToken', (token, flags) => flags.refreshSize && token === TurnReminders.#marker?.parent && TurnReminders.#drawMarker(token));
  }

  /**
   * Whether this user is reminded for a combatant.
   * @param {Combatant|null} combatant The combatant.
   * @returns {boolean} Whether the reminder is for this user.
   */
  static #isMine(combatant) {
    if (!combatant) return false;
    return game.user.isGM ? !combatant.hasPlayerOwner : combatant.isOwner;
  }

  /**
   * Select the active combatant's token on the client of the user it belongs to, when that client's setting is on.
   * @param {Combat} combat The combat whose turn changed.
   */
  static #selectActive(combat) {
    if (!combat.active || !combat.started || !game.settings.get(MODULE.ID, MODULE.SETTINGS.SELECT_ACTIVE_TOKEN)) return;
    const token = combat.combatant?.token?.object;
    if (token && TurnReminders.#isMine(combat.combatant)) token.control({ releaseOthers: true });
  }

  /**
   * Whether two combatants share a group, so the second continues the first one's turn.
   * @param {Combatant|undefined} prior The previous turn's combatant.
   * @param {Combatant|null} combatant The current turn's combatant.
   * @returns {boolean} Whether both are in the same group.
   */
  static #sameGroup(prior, combatant) {
    if (!prior || !combatant) return false;
    const adapter = getAdapter();
    const key = adapter.groupKey(prior);
    return !!key && key === adapter.groupKey(combatant);
  }

  /**
   * Announce "your turn" to the current owner and "on deck" to the next owner, once per group.
   * @param {Combat} combat The combat whose turn changed.
   * @param {object} prior The round and combatant id before the change.
   */
  static #onTurnChange(combat, prior) {
    if (!combat.active || !combat.started || !game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDERS_ENABLED)) return;
    const { combatant, nextCombatant } = combat;
    if (prior?.round === combat.round && TurnReminders.#sameGroup(combat.combatants.get(prior.combatantId), combatant)) return;
    const banner = game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDER_BANNER);
    const glow = game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDER_GLOW);
    if (TurnReminders.#isMine(combatant)) {
      const subtitle = _loc('ROLLCALL.Reminder.TurnSubtitle', { name: combatant.name, round: combat.round });
      announce({ variant: 'turn', title: _loc('ROLLCALL.Reminder.YourTurn'), subtitle, img: combatant.img, banner, glow });
      if (game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDER_PAN)) panToCombatant(combatant);
      return;
    }
    if (!TurnReminders.#isMine(nextCombatant)) return;
    const subtitle = combatant?.visible ? _loc('ROLLCALL.Reminder.After', { name: displayName(game.user, combatant) }) : null;
    announce({ variant: 'ondeck', title: _loc('ROLLCALL.Dock.OnDeck'), subtitle, img: nextCombatant.img, banner, glow });
  }

  /**
   * The token that should carry the on-deck marker.
   * @returns {Token|null} The on-deck token.
   */
  static #onDeckToken() {
    if (!canvas.ready || !game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDERS_ENABLED)) return null;
    if (game.settings.get(MODULE.ID, MODULE.SETTINGS.ON_DECK_MARKER) === 'off' && game.settings.get(MODULE.ID, MODULE.SETTINGS.ON_DECK_LABEL) === 'off') return null;
    const combat = game.combat;
    const next = combat?.started ? combat.nextCombatant : null;
    if (!next?.visible || next === combat.combatant) return null;
    return next.token?.object ?? null;
  }

  /** Move the on-deck marker to the current on-deck token, or remove it. */
  static #updateMarker() {
    const token = TurnReminders.#onDeckToken();
    const marker = TurnReminders.#marker;
    if (marker && !marker.destroyed && marker.parent === token) return;
    if (token) TurnReminders.#drawMarker(token);
    else TurnReminders.#clearMarker();
  }

  /** Remove the on-deck marker. */
  static #clearMarker() {
    if (TurnReminders.#marker && !TurnReminders.#marker.destroyed) TurnReminders.#marker.destroy();
    TurnReminders.#marker = null;
  }

  /**
   * Draw a breathing arc or ring around a token and a label badge or custom image above it.
   * @param {Token} token The on-deck token.
   * @returns {Promise<void>}
   */
  static async #drawMarker(token) {
    TurnReminders.#clearMarker();
    const shape = game.settings.get(MODULE.ID, MODULE.SETTINGS.ON_DECK_MARKER);
    const label = game.settings.get(MODULE.ID, MODULE.SETTINGS.ON_DECK_LABEL);
    const marker = new PIXI.Container();
    TurnReminders.#marker = marker;
    const src = label !== 'off' && game.settings.get(MODULE.ID, MODULE.SETTINGS.ON_DECK_IMAGE);
    const texture = src ? await foundry.canvas.loadTexture(src) : null;
    if (TurnReminders.#marker !== marker || token.destroyed) return marker.destroy();
    if (shape !== 'off') TurnReminders.#arc(marker.addChild(new PIXI.Graphics()), token, shape);
    if (texture) marker.addChild(TurnReminders.#image(texture, token));
    else if (label !== 'off') {
      const tag = marker.addChild(TurnReminders.#tag(label));
      tag.position.set(token.w / 2, 0);
      tag.scale.set(canvas.dimensions.uiScale * token.document.width);
    }
    token.addChild(marker);
  }

  /**
   * Draw a breathing arc or ring in the token's disposition color.
   * @param {PIXI.Graphics} arc The graphics to draw into.
   * @param {Token} token The on-deck token.
   * @param {string} shape Marker shape.
   */
  static #arc(arc, token, shape) {
    const radius = token.externalRadius * 1.08;
    arc.lineStyle({ width: Math.max(3, radius * 0.08), color: token.getDispositionColor(), alpha: 0.9, cap: PIXI.LINE_CAP.ROUND });
    if (shape === 'ring') arc.drawCircle(0, 0, radius);
    else arc.arc(0, 0, radius, Math.PI * 0.2, Math.PI * 0.8);
    arc.position.set(token.w / 2, token.h / 2);
    const breathe = () => {
      if (arc.destroyed) return canvas.app.ticker.remove(breathe);
      arc.alpha = 0.65 + 0.35 * Math.sin((canvas.app.ticker.lastTime * 2 * Math.PI) / 3000);
    };
    canvas.app.ticker.add(breathe);
  }

  /**
   * Custom image in place of the label, as wide as the token and resting on its top edge.
   * @param {PIXI.Texture} texture The loaded image.
   * @param {Token} token The on-deck token.
   * @returns {PIXI.Sprite} Image.
   */
  static #image(texture, token) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(token.w / texture.width);
    sprite.position.set(token.w / 2, 0);
    return sprite;
  }

  /**
   * "Up Next" badge resting on the token's top edge: a slanted chip for blade, a top-rounded tab for codex.
   * @param {string} style Label style.
   * @returns {PIXI.Container} Badge.
   */
  static #tag(style) {
    const font = TurnReminders.#labelColor(MODULE.SETTINGS.ON_DECK_FONT_COLOR, TurnReminders.#LABEL_THEMES[style].font);
    const background = TurnReminders.#labelColor(MODULE.SETTINGS.ON_DECK_BACKGROUND_COLOR, TurnReminders.#LABEL_THEMES[style].background);
    const outline = TurnReminders.#labelColor(MODULE.SETTINGS.ON_DECK_OUTLINE_COLOR, TurnReminders.#LABEL_THEMES[style].outline);
    const tag = new PIXI.Container();
    const text = foundry.canvas.containers.PreciseText.getTextStyle({ fontSize: 16, fill: font.toNumber(), fontWeight: 'bold', letterSpacing: 2 });
    const caption = new foundry.canvas.containers.PreciseText(_loc('ROLLCALL.Dock.OnDeck').toUpperCase(), text);
    caption.anchor.set(0.5, 1);
    const width = caption.width + 20;
    const height = caption.height + 4;
    caption.y = -2;
    const plate = new PIXI.Graphics();
    plate.lineStyle({ width: 1.5, color: outline.toNumber(), alpha: outline.alpha }).beginFill(background.toNumber(), background.alpha);
    if (style === 'codex') {
      const radius = 6;
      plate
        .moveTo(-width / 2, 0)
        .lineTo(-width / 2, -height + radius)
        .arcTo(-width / 2, -height, -width / 2 + radius, -height, radius);
      plate
        .lineTo(width / 2 - radius, -height)
        .arcTo(width / 2, -height, width / 2, -height + radius, radius)
        .lineTo(width / 2, 0);
    } else {
      const skew = height * Math.tan(Math.toRadians(12));
      plate.drawPolygon([-width / 2 + skew, -height, width / 2 + skew, -height, width / 2 - skew, 0, -width / 2 - skew, 0]);
    }
    plate.endFill();
    tag.addChild(plate, caption);
    return tag;
  }

  /**
   * A badge color from its setting, or from the theme when the setting is empty.
   * @param {string} key Color setting key.
   * @param {string} variable Theme CSS variable used when the setting is empty.
   * @returns {PIXI.Color} Color.
   */
  static #labelColor(key, variable) {
    const custom = game.settings.get(MODULE.ID, key);
    if (custom) return new PIXI.Color(custom.css);
    const probe = document.body.appendChild(document.createElement('div'));
    probe.className = 'roll-call';
    probe.style.color = `var(${variable})`;
    const color = new PIXI.Color(getComputedStyle(probe).color);
    probe.remove();
    return color;
  }
}
