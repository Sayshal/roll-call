import { MODULE } from '../constants.mjs';
import { announce, displayName, onSettingChange, panToCombatant } from '../utils/_module.mjs';

/** Turn banner, glow, pan, token select and on-deck marker. */
export class TurnReminders {
  /** @type {PIXI.Container|null} Arc and tag drawn on the on-deck token. */
  static #marker = null;

  /** Select the active token for its owner on every turn change, and hook the reminders and on-deck marker when the feature is enabled. */
  static register() {
    Hooks.on('combatTurnChange', TurnReminders.#selectActive);
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDERS_ENABLED)) return;
    Hooks.on('combatTurnChange', TurnReminders.#onTurnChange);
    const update = foundry.utils.debounce(TurnReminders.#updateMarker, 50);
    for (const hook of ['canvasReady', 'updateCombat', 'deleteCombat', 'createCombatant', 'updateCombatant', 'deleteCombatant']) Hooks.on(hook, update);
    onSettingChange([MODULE.SETTINGS.REMINDERS_ENABLED, MODULE.SETTINGS.ON_DECK_MARKER], update);
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
   * Announce "your turn" to the current owner and "on deck" to the next owner.
   * @param {Combat} combat The combat whose turn changed.
   */
  static #onTurnChange(combat) {
    if (!combat.active || !combat.started || !game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDERS_ENABLED)) return;
    const banner = game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDER_BANNER);
    const glow = game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDER_GLOW);
    const { combatant, nextCombatant } = combat;
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
    if (!canvas.ready || !game.settings.get(MODULE.ID, MODULE.SETTINGS.REMINDERS_ENABLED) || !game.settings.get(MODULE.ID, MODULE.SETTINGS.ON_DECK_MARKER)) return null;
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
    else {
      if (marker && !marker.destroyed) marker.destroy();
      TurnReminders.#marker = null;
    }
  }

  /**
   * Draw a breathing arc under a token's bottom edge and a slanted "On Deck" tag above it.
   * @param {Token} token The on-deck token.
   */
  static #drawMarker(token) {
    if (TurnReminders.#marker && !TurnReminders.#marker.destroyed) TurnReminders.#marker.destroy();
    const color = token.getDispositionColor();
    const marker = new PIXI.Container();
    const arc = marker.addChild(new PIXI.Graphics());
    const radius = token.externalRadius * 1.08;
    arc.lineStyle({ width: Math.max(3, radius * 0.08), color, alpha: 0.9, cap: PIXI.LINE_CAP.ROUND });
    arc.arc(0, 0, radius, Math.PI * 0.2, Math.PI * 0.8);
    arc.position.set(token.w / 2, token.h / 2);
    const tag = marker.addChild(TurnReminders.#tag(color));
    tag.position.set(token.w / 2, -tag.height);
    token.addChild(marker);
    TurnReminders.#marker = marker;
    const breathe = () => {
      if (arc.destroyed) return canvas.app.ticker.remove(breathe);
      arc.alpha = 0.65 + 0.35 * Math.sin((canvas.app.ticker.lastTime * 2 * Math.PI) / 3000);
    };
    canvas.app.ticker.add(breathe);
  }

  /**
   * Slanted "On Deck" tag.
   * @param {number} color Border and text colour.
   * @returns {PIXI.Container} Tag.
   */
  static #tag(color) {
    const tag = new PIXI.Container();
    const style = foundry.canvas.containers.PreciseText.getTextStyle({ fontSize: 16, fill: color, fontWeight: 'bold', letterSpacing: 2 });
    const label = new foundry.canvas.containers.PreciseText(_loc('ROLLCALL.Dock.OnDeck').toUpperCase(), style);
    label.anchor.set(0.5);
    const width = label.width + 20;
    const height = label.height + 4;
    const skew = height * Math.tan(Math.toRadians(12));
    const plate = new PIXI.Graphics();
    plate.lineStyle({ width: 1.5, color }).beginFill(0x000000, 0.8);
    plate.drawPolygon([-width / 2 + skew, -height / 2, width / 2 + skew, -height / 2, width / 2 - skew, height / 2, -width / 2 - skew, height / 2]);
    plate.endFill();
    tag.addChild(plate, label);
    return tag;
  }
}
