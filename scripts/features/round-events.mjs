import { MODULE } from '../constants.mjs';
import { announce, eventWhen, logFired, pendingOn, promptRoundEvent, reachedCount, removeRoundEvent, roundEvents, syncTurnEvents, upcomingEvents, viewedCombat } from '../utils/_module.mjs';

/**
 * Round events: scheduled reminders and extra turns.
 */
export class RoundEvents {
  /** @type {object|null} ATLAS registration handle used to show a fired reminder's banner on every client. */
  static #relay = null;

  /**
   * Hook turn and round changes, the core tracker and its encounter menu when the feature is enabled.
   * @param {object} atlas ATLAS registration handle.
   */
  static register(atlas) {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.ROUND_EVENTS_ENABLED)) return;
    RoundEvents.#relay = atlas;
    Hooks.on('combatTurnChange', RoundEvents.#onTurnChange);
    Hooks.on('updateCombat', (combat, changes) => 'round' in changes && RoundEvents.#enabled() && ATLAS.isPrimaryGM && syncTurnEvents(combat));
    Hooks.on(MODULE.RELAY.EVENT, RoundEvents.#announce);
    Hooks.on('deleteCombatant', RoundEvents.#onDeleteCombatant);
    Hooks.on('renderCombatTracker', RoundEvents.#addRows);
    Hooks.on('getCombatContextOptions', (_tracker, entries) =>
      entries.push({
        label: 'ROLLCALL.RoundEvents.Add',
        icon: 'fa-solid fa-hourglass-half',
        visible: () => game.user.isGM && !!viewedCombat() && RoundEvents.#enabled(),
        onClick: () => promptRoundEvent(viewedCombat())
      })
    );
  }

  /**
   * Whether round events are on.
   * @returns {boolean} Whether enabled.
   */
  static #enabled() {
    return game.settings.get(MODULE.ID, MODULE.SETTINGS.ROUND_EVENTS_ENABLED);
  }

  /**
   * Fire due reminders and log turn events on the primary GM.
   * @param {Combat} combat The combat whose turn changed.
   */
  static async #onTurnChange(combat) {
    if (!ATLAS.isPrimaryGM || !combat.started || !RoundEvents.#enabled()) return;
    const { round, combatant } = combat;
    const turnEvent = combatant?.getFlag(MODULE.ID, MODULE.FLAGS.EVENT);
    const last = combat.turn === combat.turns.length - 1;
    const due = roundEvents(combat).filter((event) => event.mode === 'reminder' && pendingOn(event, round) && (last || reachedCount(combatant?.initiative, event.initiative)));
    const fired = due.map((event) => event.id);
    if (turnEvent) fired.push(turnEvent);
    if (fired.length) await logFired(combat, fired, round);
    for (const event of due) {
      const content = `<p><strong>${_loc('ROLLCALL.RoundEvents.Fired')}</strong> ${foundry.utils.escapeHTML(event.label)}</p>`;
      ChatMessage.implementation.create({ content, whisper: event.visible ? [] : ChatMessage.getWhisperRecipients('GM') });
      Hooks.callAll(MODULE.RELAY.EVENT, combat.id, event.id, round);
      RoundEvents.#relay.broadcast(MODULE.RELAY.EVENT, combat.id, event.id, round);
    }
  }

  /**
   * When the GM removes a turn event's combatant by hand, remove the event too, so it does not come back next round.
   * @param {Combatant} combatant The deleted combatant.
   * @param {object} options Deletion options; Roll Call marks its own with `rollCallSync`.
   * @param {string} userId Id of the deleting user.
   */
  static #onDeleteCombatant(combatant, options, userId) {
    const eventId = combatant.getFlag(MODULE.ID, MODULE.FLAGS.EVENT);
    if (eventId && userId === game.user.id && !options.rollCallSync) removeRoundEvent(combatant.parent, eventId);
  }

  /**
   * Show a fired reminder's banner to GMs, and to players when the event is visible.
   * @param {string} combatId Combat id.
   * @param {string} eventId Event id.
   * @param {number} round Round it fired on.
   */
  static #announce(combatId, eventId, round) {
    const event = roundEvents(game.combats.get(combatId)).find((entry) => entry.id === eventId);
    if (!event || (!game.user.isGM && !event.visible)) return;
    announce({ variant: 'event', title: event.label, subtitle: _loc('ROLLCALL.RoundEvents.Subtitle', { round }), glow: false, wait: true });
  }

  /**
   * List the viewed combat's upcoming events in the core tracker.
   * @param {foundry.applications.sidebar.tabs.CombatTracker} tracker The core tracker.
   * @param {HTMLElement} element Its rendered element.
   */
  static #addRows(tracker, element) {
    const combat = tracker.viewed;
    const list = element.querySelector('.combat-tracker');
    if (!combat || !list || !RoundEvents.#enabled()) return;
    const rows = upcomingEvents(combat).map(({ event, round }) => {
      const row = document.createElement('li');
      row.className = 'rc-tracker-event';
      const label = document.createElement('span');
      label.textContent = `${event.label} · ${eventWhen(event, round)}`;
      row.append(Object.assign(document.createElement('i'), { className: event.mode === 'turn' ? 'fa-solid fa-user-clock' : 'fa-solid fa-hourglass-half' }), label);
      if (game.user.isGM) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'inline-control icon fa-solid fa-xmark';
        remove.ariaLabel = _loc('ATLAS.Common.Remove');
        remove.addEventListener('click', () => removeRoundEvent(combat, event.id));
        row.append(remove);
      }
      return row;
    });
    list.prepend(...rows);
  }
}
